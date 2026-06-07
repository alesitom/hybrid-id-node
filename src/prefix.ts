import { InvalidPrefixError } from './exception/errors.js';
import { Messages, fmt } from './exception/messages.js';

/** Separator between prefix and body (Stripe convention). */
export const PREFIX_SEPARATOR = '_';

/** Maximum allowed prefix length (Stripe uses max 8). */
export const PREFIX_MAX_LENGTH = 8;

/** Valid prefix: lowercase alphanumeric, starts with a letter. */
const REGEX_PREFIX = /^[a-z][a-z0-9]*$/;

/** True when `prefix` is a well-formed, in-length-bounds prefix. */
export function isValidPrefix(prefix: string): boolean {
  return prefix !== '' && prefix.length <= PREFIX_MAX_LENGTH && REGEX_PREFIX.test(prefix);
}

/** @throws {InvalidPrefixError} If the prefix is malformed. */
export function validatePrefix(prefix: string): void {
  if (!isValidPrefix(prefix)) {
    throw new InvalidPrefixError(fmt(Messages.GEN_PREFIX_FORMAT, PREFIX_MAX_LENGTH));
  }
}

/**
 * Prepend a validated prefix to an ID body. Returns the body unchanged when
 * `prefix` is null/undefined.
 *
 * @throws {InvalidPrefixError} If a prefix is given but malformed.
 */
export function applyPrefix(id: string, prefix?: string | null): string {
  if (prefix === null || prefix === undefined) {
    return id;
  }
  validatePrefix(prefix);
  return prefix + PREFIX_SEPARATOR + id;
}

/** Extract the prefix from an ID, or null when unprefixed. */
export function extractPrefix(id: string): string | null {
  const pos = id.indexOf(PREFIX_SEPARATOR);
  if (pos <= 0) {
    return null;
  }
  return id.slice(0, pos);
}

/**
 * Strip the prefix from an ID, returning the body.
 *
 * Returns the input unchanged when there is no separator, or when the body
 * still contains a separator (malformed) — so it fails downstream validation
 * cleanly rather than silently producing a wrong body.
 */
export function stripPrefix(id: string): string {
  const pos = id.indexOf(PREFIX_SEPARATOR);
  if (pos === -1) {
    return id;
  }
  const body = id.slice(pos + 1);
  if (body.includes(PREFIX_SEPARATOR)) {
    return id;
  }
  return body;
}
