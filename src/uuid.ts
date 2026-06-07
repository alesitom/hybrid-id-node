import { decodeBase62, encodeBase62, isBase62String } from './base62.js';
import { IdOverflowError, InvalidIdError, InvalidProfileError } from './exception/errors.js';
import { Messages, fmt } from './exception/messages.js';
import { Profile, type ProfileInput } from './profile.js';
import { parse, profileConfig, type ParsedHybridId } from './metadata.js';
import { extractPrefix } from './prefix.js';

/**
 * Convert between HybridId and RFC 9562 UUID formats (v8, v7, v4-format).
 *
 * Prefixes are NOT preserved — the to* methods reject prefixed IDs to prevent
 * silent prefix loss and type confusion. Strip the prefix first and track it
 * separately. Only compact and standard profiles are supported.
 */

const MASK60 = (1n << 60n) - 1n;
const MASK58 = (1n << 58n) - 1n;
const TS_MAX = 62n ** 8n - 1n;

// Narrowed result of a successful parse (the valid branch of the union).
type ValidParsed = Extract<ParsedHybridId, { valid: true }>;

// -----------------------------------------------------------------------------
// UUIDv8 — RFC 9562, lossless for compact/standard (profile index is embedded)
// -----------------------------------------------------------------------------

/**
 * @throws {InvalidIdError} If the ID is invalid or prefixed.
 * @throws {InvalidProfileError} If the profile is not compact or standard.
 */
export function toUUIDv8(hybridId: string): string {
  const parsed = parseForConversion(hybridId, 'toUUIDv8');

  let profileIndex: bigint;
  if (parsed.profile === 'compact') {
    profileIndex = 0n;
  } else if (parsed.profile === 'standard') {
    profileIndex = 1n;
  } else {
    throw new InvalidProfileError(fmt(Messages.UUID_PACK_UNSUPPORTED, parsed.profile));
  }

  const [nodeValue, randomValue] = decodeComponents(parsed);

  // custom_c: [2-bit profile index][60-bit random]
  const customC = (profileIndex << 60n) | (randomValue & MASK60);

  const variantAndHigh = (0b10n << 2n) | ((customC >> 60n) & 0x3n);

  const hex =
    toHex(BigInt(parsed.timestamp), 12) +
    '8' +
    toHex(nodeValue, 3) +
    toHex(variantAndHigh, 1) +
    toHex(customC & MASK60, 15);

  return insertHyphens(hex);
}

/** @throws {InvalidIdError} If the UUID format or version is invalid. */
export function fromUUIDv8(uuid: string): string {
  assertUuidFormat(uuid, 8);
  const hex = stripHyphens(uuid);

  const timestamp = safeHexToBigInt(hex.slice(0, 12));
  const nodeValue = safeHexToBigInt(hex.slice(13, 16));
  const high2 = safeHexToBigInt(hex.slice(16, 17)) & 0x3n;
  const low60 = safeHexToBigInt(hex.slice(17, 32));
  const customC = (high2 << 60n) | low60;

  const profileIndex = (customC >> 60n) & 0x3n;
  const randomValue = customC & MASK60;

  let profile: string;
  if (profileIndex === 0n) {
    profile = 'compact';
  } else if (profileIndex === 1n) {
    profile = 'standard';
  } else {
    throw new InvalidIdError(Messages.UUID_UNRECOGNIZED_PROFILE);
  }

  return assembleBody(profile, timestamp, nodeValue, randomValue);
}

// -----------------------------------------------------------------------------
// UUIDv7 / v4-format — timestamp-preserving (profile must be hinted on decode)
// -----------------------------------------------------------------------------

/**
 * @throws {InvalidIdError} If the ID is invalid or prefixed.
 * @throws {InvalidProfileError} If the profile is not compact or standard.
 */
export function toUUIDv7(hybridId: string): string {
  return buildTimestampPreservingUuid(hybridId, 'toUUIDv7', 7);
}

/** @throws {InvalidIdError} If the UUID format or version is invalid. */
export function fromUUIDv7(uuid: string, profile: ProfileInput = Profile.Standard): string {
  assertUuidFormat(uuid, 7);
  assertSupportedProfile(profile, 'fromUUIDv7');
  const hex = stripHyphens(uuid);

  const timestamp = safeHexToBigInt(hex.slice(0, 12));
  const nodeValue = safeHexToBigInt(hex.slice(13, 16));
  const high2 = safeHexToBigInt(hex.slice(16, 17)) & 0x3n;
  const low58 = safeHexToBigInt(hex.slice(17, 32));
  const randomValue = (high2 << 58n) | low58;

  return assembleBody(profile, timestamp, nodeValue, randomValue);
}

/**
 * Convert to a UUID with v4 structure (version=4, variant=10xx). The output is
 * NOT a true random UUIDv4 — it deterministically encodes HybridId data. Lossy:
 * the original timestamp and node must be supplied to {@link fromUUIDv4Format}.
 *
 * @throws {InvalidIdError} If the ID is invalid or prefixed.
 * @throws {InvalidProfileError} If the profile is not compact or standard.
 */
export function toUUIDv4Format(hybridId: string): string {
  return buildTimestampPreservingUuid(hybridId, 'toUUIDv4Format', 4);
}

/**
 * Reconstruct a HybridId from a UUID created by {@link toUUIDv4Format}. Because
 * that conversion is lossy, supply the original timestamp and node.
 *
 * When `timestampMs` is null the current wall-clock time is used, so the result
 * will appear created "now" — always pass the real timestamp when known.
 *
 * @throws {InvalidIdError} If the UUID format, version, or node is invalid.
 * @throws {IdOverflowError} If the timestamp exceeds the encodable range.
 */
export function fromUUIDv4Format(
  uuid: string,
  profile: ProfileInput = Profile.Standard,
  timestampMs: number | null = null,
  node: string | null = null,
): string {
  assertUuidFormat(uuid, 4);
  assertSupportedProfile(profile, 'fromUUIDv4Format');
  const hex = stripHyphens(uuid);
  const config = profileConfig(profile);

  const timestamp = BigInt(timestampMs ?? Date.now());
  if (timestamp < 0n) {
    throw new InvalidIdError(Messages.UUID_NEGATIVE_TS);
  }
  if (timestamp > TS_MAX) {
    throw new IdOverflowError(Messages.UUID_TS_OVERFLOW);
  }

  let nodeChars: string;
  if (node !== null) {
    if (node.length !== 2 || !isBase62String(node)) {
      throw new InvalidIdError(Messages.UUID_NODE_INVALID);
    }
    nodeChars = node;
  } else {
    nodeChars = encodeBase62(safeHexToBigInt(hex.slice(13, 16)), 2);
  }

  const high2 = safeHexToBigInt(hex.slice(16, 17)) & 0x3n;
  const low58 = safeHexToBigInt(hex.slice(17, 32));
  const randomValue = (high2 << 58n) | low58;

  const tsChars = encodeBase62(timestamp, 8);
  const randomChars = encodeBase62(randomValue, config.random);

  return config.node > 0 ? tsChars + nodeChars + randomChars : tsChars + randomChars;
}

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

function buildTimestampPreservingUuid(hybridId: string, method: string, version: number): string {
  const parsed = parseForConversion(hybridId, method);
  assertSupportedProfile(parsed.profile, method);
  const [nodeValue, randomValue] = decodeComponents(parsed);

  const variantAndHigh = (0b10n << 2n) | ((randomValue >> 58n) & 0x3n);

  const hex =
    toHex(BigInt(parsed.timestamp), 12) +
    String(version) +
    toHex(nodeValue, 3) +
    toHex(variantAndHigh, 1) +
    toHex(randomValue & MASK58, 15);

  return insertHyphens(hex);
}

/** Rebuild a HybridId body from decoded numeric components. */
function assembleBody(
  profile: ProfileInput,
  timestamp: bigint,
  nodeValue: bigint,
  randomValue: bigint,
): string {
  const config = profileConfig(profile);
  const tsChars = encodeBase62(timestamp, 8);
  const randomChars = encodeBase62(randomValue, config.random);

  if (config.node > 0) {
    return tsChars + encodeBase62(nodeValue, config.node) + randomChars;
  }
  return tsChars + randomChars;
}

function parseForConversion(hybridId: string, method: string): ValidParsed {
  rejectPrefixed(hybridId, method);
  const parsed = parse(hybridId);
  if (!parsed.valid) {
    throw new InvalidIdError(fmt(Messages.UUID_CONVERSION_INVALID, method));
  }
  return parsed;
}

function decodeComponents(parsed: ValidParsed): [bigint, bigint] {
  const nodeValue = parsed.node !== null ? decodeBase62(parsed.node) : 0n;
  return [nodeValue, decodeBase62(parsed.random)];
}

function assertUuidFormat(uuid: string, expectedVersion: number): void {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!pattern.test(uuid)) {
    throw new InvalidIdError(Messages.UUID_INVALID_FORMAT);
  }

  const hex = stripHyphens(uuid);
  const version = Number.parseInt(hex.charAt(12), 16);
  if (version !== expectedVersion) {
    throw new InvalidIdError(fmt(Messages.UUID_EXPECTED_VERSION, expectedVersion, version));
  }

  const variantNibble = Number.parseInt(hex.charAt(16), 16);
  if (variantNibble >> 2 !== 0b10) {
    throw new InvalidIdError(Messages.UUID_INVALID_VARIANT);
  }
}

function assertSupportedProfile(profile: ProfileInput, method: string): void {
  if (profile !== 'compact' && profile !== 'standard') {
    throw new InvalidProfileError(fmt(Messages.UUID_PROFILE_UNSUPPORTED, method, profile));
  }
}

function rejectPrefixed(hybridId: string, method: string): void {
  if (extractPrefix(hybridId) !== null) {
    throw new InvalidIdError(fmt(Messages.UUID_PREFIX_REJECTED, method));
  }
}

/** Parse a hex substring to BigInt, rejecting segments wider than the 64-bit range. */
function safeHexToBigInt(hex: string): bigint {
  if (hex.length > 15) {
    throw new InvalidIdError(Messages.UUID_HEX_OVERFLOW);
  }
  return BigInt(`0x${hex}`);
}

function toHex(value: bigint, hexLen: number): string {
  return value.toString(16).padStart(hexLen, '0');
}

function insertHyphens(hex32: string): string {
  return (
    hex32.slice(0, 8) +
    '-' +
    hex32.slice(8, 12) +
    '-' +
    hex32.slice(12, 16) +
    '-' +
    hex32.slice(16, 20) +
    '-' +
    hex32.slice(20, 32)
  );
}

function stripHyphens(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase();
}
