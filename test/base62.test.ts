import { describe, it, expect } from 'vitest';
import { BASE62, encodeBase62, decodeBase62, isBase62String } from '../src/base62.js';
import { IdOverflowError, InvalidIdError } from '../src/exception/errors.js';

describe('BASE62 alphabet', () => {
  it('is 62 chars: digits, uppercase, lowercase', () => {
    expect(BASE62).toBe('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
    expect(BASE62).toHaveLength(62);
  });
});

describe('encodeBase62', () => {
  it('pads zero to the requested length', () => {
    expect(encodeBase62(0, 8)).toBe('00000000');
    expect(encodeBase62(0, 1)).toBe('0');
  });

  it('encodes small values with left zero-padding', () => {
    expect(encodeBase62(1, 4)).toBe('0001');
    expect(encodeBase62(61, 2)).toBe('0z');
    expect(encodeBase62(62, 2)).toBe('10');
    expect(encodeBase62(3843, 2)).toBe('zz'); // 62^2 - 1
  });

  it('accepts bigint and number identically', () => {
    expect(encodeBase62(123456789n, 8)).toBe(encodeBase62(123456789, 8));
  });

  it('encodes large 64-bit-range values (bigint)', () => {
    // 62^10 - 1 fits in standard random width (10 chars)
    const max10 = 62n ** 10n - 1n;
    expect(encodeBase62(max10, 10)).toBe('zzzzzzzzzz');
  });

  it('throws RangeError when length < 1', () => {
    expect(() => encodeBase62(1, 0)).toThrow(RangeError);
  });

  it('throws IdOverflowError on negative input', () => {
    expect(() => encodeBase62(-1, 8)).toThrow(IdOverflowError);
  });

  it('throws IdOverflowError when value exceeds length capacity', () => {
    expect(() => encodeBase62(62, 1)).toThrow(IdOverflowError); // needs 2 chars
    expect(() => encodeBase62(3844, 2)).toThrow(IdOverflowError); // 62^2
  });
});

describe('decodeBase62', () => {
  it('decodes to bigint', () => {
    expect(decodeBase62('0001')).toBe(1n);
    expect(decodeBase62('10')).toBe(62n);
    expect(decodeBase62('zz')).toBe(3843n);
  });

  it('ignores leading zeros', () => {
    expect(decodeBase62('00000000')).toBe(0n);
    expect(decodeBase62('0000000z')).toBe(61n);
  });

  it('throws InvalidIdError on empty string', () => {
    expect(() => decodeBase62('')).toThrow(InvalidIdError);
  });

  it('throws InvalidIdError on non-base62 characters', () => {
    expect(() => decodeBase62('ab-cd')).toThrow(InvalidIdError);
    expect(() => decodeBase62('hello!')).toThrow(InvalidIdError);
  });

  it('throws IdOverflowError above the 64-bit ceiling', () => {
    // 12 significant chars always overflow
    expect(() => decodeBase62('1000000000000')).toThrow(IdOverflowError);
    // 62^11 overflows 2^63
    expect(() => decodeBase62('zzzzzzzzzzzz')).toThrow(IdOverflowError);
  });
});

describe('round-trip', () => {
  it('encode→decode preserves value across widths', () => {
    const cases: Array<[bigint, number]> = [
      [0n, 8],
      [1n, 8],
      [61n, 2],
      [62n, 8],
      [BigInt(Date.now()), 8],
      [62n ** 10n - 1n, 10],
    ];
    for (const [value, width] of cases) {
      expect(decodeBase62(encodeBase62(value, width))).toBe(value);
    }
  });
});

describe('isBase62String', () => {
  it('accepts only non-empty base62 strings', () => {
    expect(isBase62String('abcABC123')).toBe(true);
    expect(isBase62String('0VBFDQz4')).toBe(true);
    expect(isBase62String('')).toBe(false);
    expect(isBase62String('with space')).toBe(false);
    expect(isBase62String('under_score')).toBe(false);
    expect(isBase62String('dash-')).toBe(false);
  });
});
