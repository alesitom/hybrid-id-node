import { decodeBase62, isBase62String } from './base62.js';
import { InvalidIdError, InvalidPrefixError, InvalidProfileError } from './exception/errors.js';
import { Messages, fmt } from './exception/messages.js';
import type { ProfileConfig, ProfileInput } from './profile.js';
import { defaultRegistry } from './profile-registry.js';
import { extractPrefix, isValidPrefix, stripPrefix, PREFIX_MAX_LENGTH } from './prefix.js';

/**
 * Maximum possible ID length: prefix (8) + separator (1) + max body (138)
 * where max body = 8 ts + 2 node + 128 random.
 */
export const MAX_ID_LENGTH = 147;

/** Valid ID characters: alphanumeric + underscore (the prefix separator). */
export const REGEX_ID_CHARS = /^[a-zA-Z0-9_]+$/;

/** All components of a parsed HybridId. See {@link parse}. */
export interface ParsedHybridId {
  valid: boolean;
  prefix: string | null;
  body: string | null;
  profile: string | null;
  /** Millisecond timestamp, or null when invalid. */
  timestamp: number | null;
  /** JS Date built from the timestamp, or null when invalid. */
  date: Date | null;
  node: string | null;
  random: string | null;
}

/**
 * Resolve a profile's configuration from the shared default registry.
 *
 * @throws {InvalidProfileError} If the profile is unknown.
 */
export function profileConfig(profile: ProfileInput): ProfileConfig {
  const config = defaultRegistry().get(profile);
  if (config === undefined) {
    throw new InvalidProfileError(fmt(Messages.GEN_PROFILE_UNKNOWN, profile));
  }
  return config;
}

/** All known profile names from the shared default registry. */
export function profiles(): string[] {
  return defaultRegistry().all();
}

/**
 * Random-bits entropy for a profile (random chars × log2(62)), rounded to 1 decimal.
 *
 * @throws {InvalidProfileError} If the profile is unknown.
 */
export function entropy(profile: ProfileInput): number {
  const config = profileConfig(profile);
  return Math.round(config.random * Math.log2(62) * 10) / 10;
}

/**
 * Recommended database column size (chars) for a profile.
 *
 * @param maxPrefixLength Maximum prefix length to accommodate (0 = no prefix).
 * @throws {InvalidPrefixError} If maxPrefixLength is out of [0, 8].
 * @throws {InvalidProfileError} If the profile is unknown.
 */
export function recommendedColumnSize(profile: ProfileInput, maxPrefixLength = 0): number {
  if (maxPrefixLength < 0 || maxPrefixLength > PREFIX_MAX_LENGTH) {
    throw new InvalidPrefixError(fmt(Messages.GEN_PREFIX_LENGTH, PREFIX_MAX_LENGTH));
  }
  const bodyLength = profileConfig(profile).length;
  return maxPrefixLength === 0 ? bodyLength : maxPrefixLength + 1 + bodyLength;
}

/**
 * Detect which profile an ID belongs to, or null if it is not a well-formed
 * HybridId of any built-in length. Handles prefixed and unprefixed IDs.
 *
 * Uses the shared default registry — custom profiles are not visible here.
 */
export function detectProfile(id: string): string | null {
  const raw = stripPrefix(id);
  const prefix = extractPrefix(id);

  // A separator was present but did not yield a valid prefix → reject.
  if (raw !== id && prefix === null) {
    return null;
  }
  if (prefix !== null && !isValidPrefix(prefix)) {
    return null;
  }

  const profile = defaultRegistry().getByLength(raw.length);
  if (profile === undefined || !isBase62String(raw)) {
    return null;
  }
  return profile;
}

/** True when `id` is a well-formed HybridId of any built-in profile length. */
export function isValid(id: string): boolean {
  return detectProfile(id) !== null;
}

function assertValid(id: string): void {
  if (!isValid(id)) {
    throw new InvalidIdError(Messages.GEN_FORMAT_INVALID);
  }
}

/**
 * Parse an ID into all of its components in a single pass.
 *
 * Always returns every key. When `valid` is false the component fields are null,
 * though `prefix`/`body` may still be populated for debugging. Do not expose
 * parse() output directly through a public API.
 *
 * Note: a blind ID parses as structurally valid, but its `timestamp`/`date`/`node`
 * are opaque (HMAC output), not the real creation time — parse cannot tell.
 */
export function parse(id: string): ParsedHybridId {
  const nullResult: ParsedHybridId = {
    valid: false,
    prefix: null,
    body: null,
    profile: null,
    timestamp: null,
    date: null,
    node: null,
    random: null,
  };

  if (id === '' || id.length > MAX_ID_LENGTH || !REGEX_ID_CHARS.test(id)) {
    return nullResult;
  }

  const prefix = extractPrefix(id);
  const body = stripPrefix(id);
  const profile = detectProfile(id);

  if (profile === null) {
    return { ...nullResult, prefix, body };
  }

  const config = profileConfig(profile);
  const timestamp = Number(decodeBase62(body.slice(0, 8)));

  return {
    valid: true,
    prefix,
    body,
    profile,
    timestamp,
    date: new Date(timestamp),
    node: config.node > 0 ? body.slice(8, 8 + config.node) : null,
    random: body.slice(8 + config.node),
  };
}

/**
 * Extract the millisecond timestamp from an ID (prefixed or not).
 *
 * @throws {InvalidIdError} If the ID is malformed.
 */
export function extractTimestamp(id: string): number {
  assertValid(id);
  return Number(decodeBase62(stripPrefix(id).slice(0, 8)));
}

/**
 * Extract a JS Date from an ID (prefixed or not).
 *
 * Under high throughput the monotonic guard advances timestamps, so the time may
 * be slightly ahead of the real wall-clock creation time.
 *
 * @throws {InvalidIdError} If the ID is malformed.
 */
export function extractDate(id: string): Date {
  return new Date(extractTimestamp(id));
}

/**
 * Extract the node identifier, or null for nodeless profiles (e.g. compact).
 *
 * @throws {InvalidIdError} If the ID is malformed.
 */
export function extractNode(id: string): string | null {
  assertValid(id);
  const profile = detectProfile(id);
  const config = profileConfig(profile as string);
  if (config.node === 0) {
    return null;
  }
  return stripPrefix(id).slice(8, 8 + config.node);
}

/**
 * Total-ordering comparison of two IDs: by timestamp, then lexicographically on
 * the body (prefixes stripped). Returns -1, 0, or 1; 0 only when the bodies are
 * byte-identical. Suitable for `Array.prototype.sort`.
 *
 * @throws {InvalidIdError} If either ID is malformed.
 */
export function compare(a: string, b: string): number {
  const ta = extractTimestamp(a);
  const tb = extractTimestamp(b);
  if (ta !== tb) {
    return ta < tb ? -1 : 1;
  }
  const ba = stripPrefix(a);
  const bb = stripPrefix(b);
  if (ba === bb) {
    return 0;
  }
  return ba < bb ? -1 : 1;
}
