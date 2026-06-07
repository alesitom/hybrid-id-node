import { createHmac, randomBytes } from 'node:crypto';
import { BASE62, encodeBase62, isBase62String } from './base62.js';
import {
  HybridIdError,
  IdOverflowError,
  InvalidIdError,
  InvalidProfileError,
  NodeRequiredError,
} from './exception/errors.js';
import { Messages, fmt } from './exception/messages.js';
import { Profile, type ProfileConfig, type ProfileInput } from './profile.js';
import { ProfileRegistry, type ProfileRegistryInterface } from './profile-registry.js';
import { applyPrefix } from './prefix.js';

/**
 * Default maximum allowed drift (ms) between the monotonic counter and
 * wall-clock time. Exceeding it throws {@link IdOverflowError}.
 */
export const DEFAULT_MAX_DRIFT_MS = 10_000;

/** Options for {@link HybridIdGenerator}. All optional with sensible defaults. */
export interface HybridIdGeneratorOptions {
  /** Profile name; defaults to `standard`. */
  profile?: ProfileInput;
  /** Explicit 2-char base62 node. Required for standard/extended unless `requireExplicitNode` is false. */
  node?: string | null;
  /** Hard cap on full ID length (including prefix). */
  maxIdLength?: number | null;
  /** When true (default), standard/extended require an explicit node. */
  requireExplicitNode?: boolean;
  /** Custom profile registry; defaults to the shared registry with built-ins. */
  registry?: ProfileRegistryInterface;
  /** Forward-drift cap in ms; defaults to {@link DEFAULT_MAX_DRIFT_MS}. */
  maxDriftMs?: number;
  /** Enable blind mode (HMAC-hashed timestamp+node). Implied when `blindSecret` is set. */
  blind?: boolean;
  /** Per-instance HMAC key (>=32 bytes). Generated automatically when blind and omitted. */
  blindSecret?: Buffer | Uint8Array | null;
}

let defaultRegistryInstance: ProfileRegistry | undefined;

/** Shared registry used when no explicit registry is injected. */
function defaultRegistry(): ProfileRegistry {
  return (defaultRegistryInstance ??= ProfileRegistry.withDefaults());
}

/**
 * Wrapper around crypto.randomBytes that surfaces CSPRNG failures within the
 * library's error message namespace.
 */
function secureRandomBytes(length: number): Buffer {
  try {
    return randomBytes(length);
  } catch (e) {
    throw new HybridIdError(Messages.GEN_URANDOM_FAILED, { cause: e });
  }
}

/** Resolve the per-instance HMAC key: a defensive copy, a fresh 32 bytes, or null. */
function resolveBlindSecret(blind: boolean, secret: Buffer | Uint8Array | null): Buffer | null {
  if (!blind) {
    return null;
  }
  return secret !== null ? Buffer.from(secret) : secureRandomBytes(32);
}

/**
 * Compute the opaque (blind) prefix that replaces the timestamp+node segment.
 *
 * Pure given its inputs — exported for testing. `hmacNode` is the node string to
 * fold into the HMAC (empty when the profile is nodeless), and `opaqueLen` is
 * `ts + node` characters. Reads 2 HMAC bytes per output char to remove modulo bias.
 *
 * @internal
 */
export function blindOpaquePrefix(
  secret: Buffer,
  timestampMs: number,
  hmacNode: string,
  opaqueLen: number,
): string {
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigUInt64BE(BigInt(timestampMs));
  const hmacInput =
    hmacNode !== '' ? Buffer.concat([tsBuf, Buffer.from(hmacNode, 'latin1')]) : tsBuf;
  const digest = createHmac('sha384', secret).update(hmacInput).digest();

  let opaque = '';
  for (let i = 0; i < opaqueLen; i++) {
    const val = (digest.readUInt8(i * 2) << 8) | digest.readUInt8(i * 2 + 1);
    opaque += BASE62.charAt(val % 62);
  }
  return opaque;
}

/**
 * Generate `length` base62 characters from a CSPRNG using rejection sampling
 * (bytes >= 248 are discarded) to eliminate modulo bias.
 */
function randomBase62(length: number): string {
  const limit = 248; // largest multiple of 62 <= 255 (4 * 62)
  let chars = '';
  let buffer = secureRandomBytes(Math.ceil(length * 1.25));
  let pos = 0;

  while (chars.length < length) {
    if (pos >= buffer.length) {
      buffer = secureRandomBytes(Math.ceil((length - chars.length) * 1.25));
      pos = 0;
    }
    const byte = buffer.readUInt8(pos);
    pos++;
    if (byte < limit) {
      chars += BASE62.charAt(byte % 62);
    }
  }

  return chars;
}

/**
 * Generate a random 2-char node identifier (1 of 3844). Dev/testing fallback —
 * production should always set an explicit node.
 *
 * Modulo bias: 65536 % 3844 = 120, so values [0, 119] are ~0.003% more likely.
 * Negligible for a non-deterministic fallback.
 */
function autoDetectNode(): string {
  const bytes = secureRandomBytes(2);
  const nodeNum = ((bytes.readUInt8(0) << 8) | bytes.readUInt8(1)) % 3844;
  return encodeBase62(nodeNum, 2);
}

/**
 * Compact, time-sortable unique ID generator.
 *
 * NOT safe to share across `worker_threads`/`cluster` workers: each worker must
 * use its own instance (or distinct explicit nodes) to avoid timestamp collisions.
 */
export class HybridIdGenerator {
  private readonly registry: ProfileRegistryInterface;
  private readonly profileName: string;
  private readonly profileConfig: ProfileConfig;
  private readonly node: string;
  private readonly maxIdLength: number | null;
  private readonly maxDriftMs: number;
  private readonly blind: boolean;
  private readonly blindSecret: Buffer | null;
  private lastTimestamp = 0;

  constructor(options: HybridIdGeneratorOptions = {}) {
    const {
      profile = Profile.Standard,
      node = null,
      maxIdLength = null,
      requireExplicitNode = true,
      registry,
      maxDriftMs = DEFAULT_MAX_DRIFT_MS,
      blind = false,
      blindSecret = null,
    } = options;

    if (!Number.isInteger(maxDriftMs) || maxDriftMs < 1) {
      throw new RangeError(fmt(Messages.GEN_DRIFT_INVALID, maxDriftMs));
    }
    this.maxDriftMs = maxDriftMs;

    this.registry = registry ?? defaultRegistry();

    const config = this.registry.get(profile);
    if (config === undefined) {
      throw new InvalidProfileError(fmt(Messages.GEN_PROFILE_UNKNOWN, profile));
    }
    this.profileName = profile;
    this.profileConfig = config;

    // Blind mode: implied by an explicit secret. The secret (not the node)
    // differentiates instances, so an explicit node is no longer required.
    this.blind = blind || blindSecret !== null;
    if (blindSecret !== null && blindSecret.length < 32) {
      throw new RangeError(fmt(Messages.GEN_BLIND_SECRET_LENGTH, blindSecret.length));
    }
    this.blindSecret = resolveBlindSecret(this.blind, blindSecret);

    if (node !== null) {
      if (node.length !== 2 || !isBase62String(node)) {
        throw new InvalidIdError(Messages.GEN_NODE_INVALID);
      }
      this.node = node;
    } else if (config.node === 0) {
      this.node = '';
    } else if (this.blind) {
      this.node = autoDetectNode();
    } else if (requireExplicitNode) {
      throw new NodeRequiredError(Messages.GEN_NODE_REQUIRED);
    } else {
      this.node = autoDetectNode();
    }

    if (maxIdLength !== null && maxIdLength < config.length) {
      throw new IdOverflowError(
        fmt(Messages.GEN_MAX_LENGTH_INVALID, maxIdLength, config.length, profile),
      );
    }
    this.maxIdLength = maxIdLength;
  }

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  /** Generate an ID using this instance's configured profile. */
  generate(prefix?: string | null): string {
    return this.generateWithProfile(this.profileName, prefix);
  }

  /** Generate a compact ID (16 chars: 8ts + 8random). */
  compact(prefix?: string | null): string {
    return this.generateWithProfile(Profile.Compact, prefix);
  }

  /** Generate a standard ID (20 chars: 8ts + 2node + 10random). */
  standard(prefix?: string | null): string {
    return this.generateWithProfile(Profile.Standard, prefix);
  }

  /** Generate an extended ID (24 chars: 8ts + 2node + 14random). */
  extended(prefix?: string | null): string {
    return this.generateWithProfile(Profile.Extended, prefix);
  }

  /**
   * Generate `count` IDs (1–10,000) in one call.
   *
   * Large batches advance the monotonic counter and drift the timestamp forward
   * (~1ms per ID once intra-ms saturated); the drift cap may throw.
   */
  generateBatch(count: number, prefix?: string | null): string[] {
    if (!Number.isInteger(count) || count < 1 || count > 10_000) {
      throw new RangeError(fmt(Messages.GEN_BATCH_LIMIT, count));
    }
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generate(prefix));
    }
    return ids;
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /** The configured profile name. */
  getProfile(): string {
    return this.profileName;
  }

  /** The node identifier, or null for nodeless profiles. */
  getNode(): string | null {
    return this.profileConfig.node === 0 ? null : this.node;
  }

  /** Body length (without prefix) for this instance's profile. */
  bodyLength(): number {
    return this.profileConfig.length;
  }

  /** The configured max ID length, or null if unset. */
  getMaxIdLength(): number | null {
    return this.maxIdLength;
  }

  /** Whether this instance generates blind (HMAC-hashed timestamp+node) IDs. */
  isBlind(): boolean {
    return this.blind;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private generateWithProfile(profile: string, prefix?: string | null): string {
    const config = profile === this.profileName ? this.profileConfig : this.registry.get(profile);
    if (config === undefined) {
      throw new InvalidProfileError(fmt(Messages.GEN_PROFILE_UNKNOWN, profile));
    }

    // A per-profile helper (compact/standard/extended) may target a node-bearing
    // profile this nodeless instance can't satisfy. In non-blind mode that would
    // silently emit a too-short body, so fail loudly instead. (Blind mode keeps the
    // correct length regardless, since the opaque segment is ts+node chars wide.)
    if (!this.blind && config.node > 0 && this.node === '') {
      throw new NodeRequiredError(
        fmt(Messages.GEN_NODE_MISSING_FOR_PROFILE, profile, this.profileName),
      );
    }

    let now = Date.now();

    // Monotonic guard: if the clock did not advance, bump to guarantee strict
    // ordering. Cap forward drift to avoid unbounded future-dated timestamps.
    if (now <= this.lastTimestamp) {
      now = this.lastTimestamp + 1;
      const realNow = Date.now();
      if (now - realNow > this.maxDriftMs) {
        throw new IdOverflowError(fmt(Messages.GEN_DRIFT_EXCEEDED, this.maxDriftMs));
      }
    }

    const random = randomBase62(config.random);

    let body: string;
    if (this.blind && this.blindSecret !== null) {
      // Replace timestamp+node with opaque chars of equal length. Hides absolute
      // time; sequential IDs from one instance still reveal relative order.
      const hmacNode = config.node > 0 ? this.node : '';
      const opaque = blindOpaquePrefix(this.blindSecret, now, hmacNode, config.ts + config.node);
      body = opaque + random;
    } else {
      const timestamp = encodeBase62(now, config.ts);
      body = config.node > 0 ? timestamp + this.node + random : timestamp + random;
    }

    // Update only after a successful body build to avoid counter desync on failure.
    this.lastTimestamp = now;
    const fullId = applyPrefix(body, prefix);

    if (this.maxIdLength !== null && fullId.length > this.maxIdLength) {
      throw new IdOverflowError(
        fmt(Messages.GEN_ID_LENGTH_EXCEEDED, fullId.length, this.maxIdLength),
      );
    }

    return fullId;
  }
}
