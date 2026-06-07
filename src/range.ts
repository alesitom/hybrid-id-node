import { encodeBase62 } from './base62.js';
import { Profile, type ProfileInput } from './profile.js';
import { profileConfig } from './metadata.js';
import { applyPrefix } from './prefix.js';

/**
 * Lowest possible ID for a timestamp and profile — an inclusive lower bound for
 * range queries: `WHERE id >= minForTimestamp(startMs)`.
 *
 * Pass `prefix` to bound a prefixed column directly (`WHERE id >= 'usr_00…'`).
 *
 * @throws {InvalidProfileError} If the profile is unknown.
 * @throws {InvalidPrefixError} If a prefix is given but malformed.
 * @throws {IdOverflowError} If the timestamp exceeds the encodable range.
 */
export function minForTimestamp(
  timestampMs: number,
  profile: ProfileInput = Profile.Standard,
  prefix: string | null = null,
): string {
  const config = profileConfig(profile);
  const body = encodeBase62(timestampMs, config.ts) + '0'.repeat(config.node + config.random);
  return applyPrefix(body, prefix);
}

/**
 * Highest possible ID for a timestamp and profile — an inclusive upper bound for
 * range queries: `WHERE id <= maxForTimestamp(endMs)`.
 *
 * Pass `prefix` to bound a prefixed column directly (`WHERE id <= 'usr_zz…'`).
 *
 * @throws {InvalidProfileError} If the profile is unknown.
 * @throws {InvalidPrefixError} If a prefix is given but malformed.
 * @throws {IdOverflowError} If the timestamp exceeds the encodable range.
 */
export function maxForTimestamp(
  timestampMs: number,
  profile: ProfileInput = Profile.Standard,
  prefix: string | null = null,
): string {
  const config = profileConfig(profile);
  const body = encodeBase62(timestampMs, config.ts) + 'z'.repeat(config.node + config.random);
  return applyPrefix(body, prefix);
}

/** Lowest possible ID for a Date and profile. See {@link minForTimestamp}. */
export function minForDate(
  date: Date,
  profile: ProfileInput = Profile.Standard,
  prefix: string | null = null,
): string {
  return minForTimestamp(date.getTime(), profile, prefix);
}

/** Highest possible ID for a Date and profile. See {@link maxForTimestamp}. */
export function maxForDate(
  date: Date,
  profile: ProfileInput = Profile.Standard,
  prefix: string | null = null,
): string {
  return maxForTimestamp(date.getTime(), profile, prefix);
}
