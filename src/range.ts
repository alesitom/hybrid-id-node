import { encodeBase62 } from './base62.js';
import { Profile, type ProfileInput } from './profile.js';
import { profileConfig } from './metadata.js';

/**
 * Lowest possible ID for a timestamp and profile — an inclusive lower bound for
 * range queries: `WHERE id >= minForTimestamp(startMs)`.
 *
 * @throws {InvalidProfileError} If the profile is unknown.
 * @throws {IdOverflowError} If the timestamp exceeds the encodable range.
 */
export function minForTimestamp(
  timestampMs: number,
  profile: ProfileInput = Profile.Standard,
): string {
  const config = profileConfig(profile);
  return encodeBase62(timestampMs, config.ts) + '0'.repeat(config.node + config.random);
}

/**
 * Highest possible ID for a timestamp and profile — an inclusive upper bound for
 * range queries: `WHERE id <= maxForTimestamp(endMs)`.
 *
 * @throws {InvalidProfileError} If the profile is unknown.
 * @throws {IdOverflowError} If the timestamp exceeds the encodable range.
 */
export function maxForTimestamp(
  timestampMs: number,
  profile: ProfileInput = Profile.Standard,
): string {
  const config = profileConfig(profile);
  return encodeBase62(timestampMs, config.ts) + 'z'.repeat(config.node + config.random);
}

/** Lowest possible ID for a Date and profile. See {@link minForTimestamp}. */
export function minForDate(date: Date, profile: ProfileInput = Profile.Standard): string {
  return minForTimestamp(date.getTime(), profile);
}

/** Highest possible ID for a Date and profile. See {@link maxForTimestamp}. */
export function maxForDate(date: Date, profile: ProfileInput = Profile.Standard): string {
  return maxForTimestamp(date.getTime(), profile);
}
