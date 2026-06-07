import { describe, it, expect } from 'vitest';
import {
  applyPrefix,
  extractPrefix,
  stripPrefix,
  isValidPrefix,
  validatePrefix,
} from '../src/prefix.js';
import { InvalidPrefixError } from '../src/exception/errors.js';

describe('isValidPrefix', () => {
  it('accepts 1-8 char lowercase alphanumeric starting with a letter', () => {
    expect(isValidPrefix('usr')).toBe(true);
    expect(isValidPrefix('a')).toBe(true);
    expect(isValidPrefix('ab12cd34')).toBe(true);
  });

  it('rejects bad prefixes', () => {
    expect(isValidPrefix('')).toBe(false);
    expect(isValidPrefix('USR')).toBe(false);
    expect(isValidPrefix('1abc')).toBe(false);
    expect(isValidPrefix('toolongprefix')).toBe(false); // > 8
    expect(isValidPrefix('a_b')).toBe(false);
  });
});

describe('validatePrefix', () => {
  it('throws InvalidPrefixError on bad input', () => {
    expect(() => validatePrefix('Bad')).toThrow(InvalidPrefixError);
  });
});

describe('applyPrefix', () => {
  it('returns body unchanged when no prefix', () => {
    expect(applyPrefix('abc')).toBe('abc');
    expect(applyPrefix('abc', null)).toBe('abc');
  });

  it('prepends a valid prefix with underscore', () => {
    expect(applyPrefix('abc', 'usr')).toBe('usr_abc');
  });

  it('throws on invalid prefix', () => {
    expect(() => applyPrefix('abc', 'Bad')).toThrow(InvalidPrefixError);
  });
});

describe('extractPrefix', () => {
  it('returns the prefix for a prefixed ID', () => {
    expect(extractPrefix('usr_abc')).toBe('usr');
  });

  it('returns null for unprefixed or leading-underscore IDs', () => {
    expect(extractPrefix('abc')).toBeNull();
    expect(extractPrefix('_abc')).toBeNull();
  });
});

describe('stripPrefix', () => {
  it('removes a single prefix', () => {
    expect(stripPrefix('usr_abc')).toBe('abc');
  });

  it('returns input unchanged when no separator', () => {
    expect(stripPrefix('abc')).toBe('abc');
  });

  it('returns input unchanged when body still has a separator (malformed)', () => {
    expect(stripPrefix('usr_ab_cd')).toBe('usr_ab_cd');
  });
});
