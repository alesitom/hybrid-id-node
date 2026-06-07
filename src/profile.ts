/** Structural configuration of a profile. All lengths are in base62 characters. */
export interface ProfileConfig {
  /** Total body length (without prefix): ts + node + random. */
  readonly length: number;
  /** Timestamp width (always 8). */
  readonly ts: number;
  /** Node width (0 = nodeless). */
  readonly node: number;
  /** Random width. */
  readonly random: number;
}

/**
 * Built-in profile names. Modeled as a const object + union type rather than a
 * TS `enum` (no runtime enum object, no reverse-mapping footguns). Custom
 * profiles registered via {@link ProfileRegistry} are plain strings.
 */
export const Profile = {
  Compact: 'compact',
  Standard: 'standard',
  Extended: 'extended',
} as const;

/** One of the three built-in profile names. */
export type BuiltInProfile = (typeof Profile)[keyof typeof Profile];

/** Anything accepted where a profile is expected: a built-in or a custom profile name. */
export type ProfileInput = BuiltInProfile | (string & {});
