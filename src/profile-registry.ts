import { InvalidProfileError } from './exception/errors.js';
import { Messages, fmt } from './exception/messages.js';
import type { ProfileConfig } from './profile.js';

const PROFILE_NAME_RE = /^[a-z][a-z0-9]*$/;

/** Registry of profile definitions: built-in plus optional custom profiles. */
export interface ProfileRegistryInterface {
  /** Get profile configuration by name, or `undefined` if unknown. */
  get(name: string): ProfileConfig | undefined;
  /** Get the profile name for a given body length, or `undefined`. */
  getByLength(length: number): string | undefined;
  /**
   * Register a custom profile.
   *
   * @param random Number of random characters (6–128).
   * @param node Number of node characters (0–10, default 2; 0 = nodeless).
   * @throws {InvalidProfileError} If name/random/node is invalid or conflicts.
   */
  register(name: string, random: number, node?: number): void;
  /** All known profile names (built-in first, then custom in insertion order). */
  all(): string[];
  /** Remove all custom profiles, keeping only the built-ins. */
  reset(): void;
}

// Maps (not plain objects) so arbitrary lookups like get('__proto__') can never
// resolve to a prototype member — they return undefined as expected.
const BUILT_IN = new Map<string, ProfileConfig>([
  ['compact', Object.freeze({ length: 16, ts: 8, node: 0, random: 8 })],
  ['standard', Object.freeze({ length: 20, ts: 8, node: 2, random: 10 })],
  ['extended', Object.freeze({ length: 24, ts: 8, node: 2, random: 14 })],
]);

const BUILT_IN_LENGTH_MAP = new Map<number, string>([
  [16, 'compact'],
  [20, 'standard'],
  [24, 'extended'],
]);

export class ProfileRegistry implements ProfileRegistryInterface {
  private custom = new Map<string, ProfileConfig>();
  private customLengthMap = new Map<number, string>();

  /** Create a registry seeded with the built-in profiles. */
  static withDefaults(): ProfileRegistry {
    return new ProfileRegistry();
  }

  get(name: string): ProfileConfig | undefined {
    return BUILT_IN.get(name) ?? this.custom.get(name);
  }

  getByLength(length: number): string | undefined {
    return BUILT_IN_LENGTH_MAP.get(length) ?? this.customLengthMap.get(length);
  }

  register(name: string, random: number, node = 2): void {
    if (!PROFILE_NAME_RE.test(name)) {
      throw new InvalidProfileError(Messages.PROFILE_NAME_INVALID);
    }

    if (this.get(name) !== undefined) {
      throw new InvalidProfileError(fmt(Messages.PROFILE_EXISTS, name));
    }

    if (random < 6 || random > 128) {
      throw new InvalidProfileError(Messages.RANDOM_LENGTH_INVALID);
    }

    if (node < 0 || node > 10) {
      throw new InvalidProfileError(Messages.NODE_LENGTH_INVALID);
    }

    const length = 8 + node + random;

    const existing = this.getByLength(length);
    if (existing !== undefined) {
      throw new InvalidProfileError(fmt(Messages.LENGTH_CONFLICT, length, existing));
    }

    this.custom.set(name, Object.freeze({ length, ts: 8, node, random }));
    this.customLengthMap.set(length, name);
  }

  all(): string[] {
    return [...BUILT_IN.keys(), ...this.custom.keys()];
  }

  reset(): void {
    this.custom.clear();
    this.customLengthMap.clear();
  }
}

let defaultInstance: ProfileRegistry | undefined;

/**
 * Shared registry (built-ins only) used by the generator's default and by the
 * standalone metadata functions. Mirrors the PHP package's global default
 * registry: custom profiles registered on *other* instances are not visible here.
 */
export function defaultRegistry(): ProfileRegistry {
  return (defaultInstance ??= ProfileRegistry.withDefaults());
}
