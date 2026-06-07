/**
 * Error hierarchy for hybrid-id.
 *
 * Every error thrown by the library extends {@link HybridIdError}, so callers
 * can catch the whole domain with a single `instanceof HybridIdError` check, or
 * narrow to a specific subclass. This mirrors the PHP package's `HybridIdException`
 * marker interface (the PHP equivalents are IdOverflow/InvalidId/InvalidPrefix/
 * InvalidProfile/NodeRequired).
 *
 * Note: pure programmer-argument errors (e.g. a non-positive `length`) are thrown
 * as the built-in `RangeError`, matching PHP's use of a plain `InvalidArgumentException`
 * there — those are bugs in caller code, not part of the catchable ID domain.
 */
export class HybridIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    // Preserve the prototype chain across transpilation targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when a value exceeds an encodable range (negative, too large, 64-bit ceiling). */
export class IdOverflowError extends HybridIdError {}

/** Thrown when an ID (or one of its parts) is malformed. */
export class InvalidIdError extends HybridIdError {}

/** Thrown when a prefix does not match the required format. */
export class InvalidPrefixError extends HybridIdError {}

/** Thrown when a profile is unknown or otherwise invalid. */
export class InvalidProfileError extends HybridIdError {}

/** Thrown when an explicit node is required but none was provided. */
export class NodeRequiredError extends HybridIdError {}
