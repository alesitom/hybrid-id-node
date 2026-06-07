import { InvalidIdError } from './exception/errors.js';
import { Messages } from './exception/messages.js';
import { parse } from './metadata.js';

/**
 * Immutable value object representing a parsed HybridId.
 *
 * Wraps {@link parse} with eager validation: constructing one guarantees a
 * well-formed ID. Serializes back to its string form via `toString()`/`toJSON()`,
 * so it drops into template literals and `JSON.stringify` transparently.
 *
 * Note: for a blind ID, `timestamp`/`date`/`node` reflect the opaque HMAC output,
 * not the real creation time — the parser cannot distinguish blind IDs.
 */
export class HybridId {
  readonly id: string;
  readonly prefix: string | null;
  readonly profile: string;
  readonly timestamp: number;
  readonly node: string | null;

  constructor(id: string) {
    const parsed = parse(id);
    if (!parsed.valid) {
      throw new InvalidIdError(`${Messages.GEN_FORMAT_INVALID}: "${id}"`);
    }
    this.id = id;
    this.prefix = parsed.prefix;
    this.profile = parsed.profile;
    this.timestamp = parsed.timestamp;
    this.node = parsed.node;
  }

  /** Named constructor for more expressive instantiation. */
  static fromString(id: string): HybridId {
    return new HybridId(id);
  }

  /** A fresh Date for this ID's timestamp (derived, keeping the VO immutable). */
  get date(): Date {
    return new Date(this.timestamp);
  }

  toString(): string {
    return this.id;
  }

  /** Primitive coercion to the underlying string (enables `<`/`>` ordering). */
  valueOf(): string {
    return this.id;
  }

  toJSON(): string {
    return this.id;
  }

  /** Value equality against another HybridId or a raw ID string. */
  equals(other: HybridId | string): boolean {
    return this.id === (other instanceof HybridId ? other.id : other);
  }
}
