import { IdOverflowError, InvalidIdError } from './exception/errors.js';
import { Messages, fmt } from './exception/messages.js';

/** Base62 alphabet: digits, uppercase, lowercase (62 characters, URL-safe). */
export const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Reverse lookup: character => position for O(1) decoding. */
const BASE62_MAP: Record<string, number> = {};
for (let i = 0; i < BASE62.length; i++) {
  BASE62_MAP[BASE62.charAt(i)] = i;
}

/**
 * 64-bit signed ceiling (PHP_INT_MAX on 64-bit). decodeBase62 enforces this for
 * behavioral parity with the PHP package, which rejects values above PHP_INT_MAX.
 */
const MAX_INT64 = (1n << 63n) - 1n;

/**
 * Encode a non-negative integer to a fixed-length base62 string.
 *
 * Accepts `number` or `bigint`; values are handled as BigInt internally so the
 * full 64-bit (and beyond, for UUID conversion) range is lossless.
 *
 * @throws {RangeError} If length < 1 (programmer error).
 * @throws {IdOverflowError} If value is negative or exceeds the capacity of `length` chars.
 */
export function encodeBase62(value: bigint | number, length: number): string {
  if (length < 1) {
    throw new RangeError(Messages.GEN_ENCODE_LENGTH);
  }

  let num = typeof value === 'bigint' ? value : BigInt(value);

  if (num < 0n) {
    throw new IdOverflowError(Messages.GEN_ENCODE_NEGATIVE);
  }

  if (num === 0n) {
    return '0'.repeat(length);
  }

  let encoded = '';
  while (num > 0n) {
    encoded = BASE62.charAt(Number(num % 62n)) + encoded;
    num = num / 62n;
  }

  if (encoded.length > length) {
    throw new IdOverflowError(fmt(Messages.GEN_ENCODE_OVERFLOW, length));
  }

  return encoded.padStart(length, '0');
}

/**
 * Decode a base62 string to a BigInt.
 *
 * Callers that know the value fits in a JS-safe integer (e.g. an 8-char
 * timestamp, always < 2^53) may convert with `Number()`.
 *
 * @throws {InvalidIdError} If the string is empty or contains a non-base62 character.
 * @throws {IdOverflowError} If the value exceeds the 64-bit signed range.
 */
export function decodeBase62(str: string): bigint {
  if (str === '') {
    throw new InvalidIdError(Messages.GEN_DECODE_EMPTY);
  }

  // Early guard: more than 11 significant base62 digits always overflows 64-bit
  // (62^11 > 2^63). Exactly-11 cases are caught by the per-step check below.
  const significant = str.replace(/^0+/, '');
  if (significant.length > 11) {
    throw new IdOverflowError(Messages.GEN_DECODE_OVERFLOW);
  }

  let result = 0n;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charAt(i);
    const pos = BASE62_MAP[ch];

    if (pos === undefined) {
      throw new InvalidIdError(fmt(Messages.GEN_DECODE_INVALID_CHAR, ch));
    }

    result = result * 62n + BigInt(pos);

    if (result > MAX_INT64) {
      throw new IdOverflowError(Messages.GEN_DECODE_OVERFLOW);
    }
  }

  return result;
}

/** True when `str` is non-empty and contains only base62 characters. */
export function isBase62String(str: string): boolean {
  if (str === '') {
    return false;
  }
  for (let i = 0; i < str.length; i++) {
    if (BASE62_MAP[str.charAt(i)] === undefined) {
      return false;
    }
  }
  return true;
}
