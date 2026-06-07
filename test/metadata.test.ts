import { describe, it, expect } from 'vitest';
import { HybridIdGenerator } from '../src/hybrid-id-generator.js';
import {
  parse,
  detectProfile,
  isValid,
  extractTimestamp,
  extractDate,
  extractNode,
  compare,
  recommendedColumnSize,
  entropy,
  profileConfig,
  profiles,
} from '../src/metadata.js';
import {
  InvalidIdError,
  InvalidPrefixError,
  InvalidProfileError,
} from '../src/exception/errors.js';

const std = new HybridIdGenerator({ node: 'A1' });
const compactGen = new HybridIdGenerator({ profile: 'compact' });

describe('detectProfile', () => {
  it('detects each built-in by length', () => {
    expect(detectProfile(std.compact())).toBe('compact');
    expect(detectProfile(std.standard())).toBe('standard');
    expect(detectProfile(std.extended())).toBe('extended');
  });

  it('handles prefixed IDs', () => {
    expect(detectProfile(std.generate('usr'))).toBe('standard');
  });

  it('returns null for junk', () => {
    expect(detectProfile('')).toBeNull();
    expect(detectProfile('short')).toBeNull();
    expect(detectProfile('_leadingunderscore12')).toBeNull();
    expect(detectProfile('has space invalid!!!')).toBeNull();
    expect(detectProfile('BAD_0VBFDQz4A1Rtntu09sbf')).toBeNull(); // uppercase prefix
  });
});

describe('isValid', () => {
  it('agrees with detectProfile', () => {
    expect(isValid(std.generate())).toBe(true);
    expect(isValid(std.generate('usr'))).toBe(true);
    expect(isValid('nope')).toBe(false);
  });
});

describe('parse — round trip with generation', () => {
  it('recovers timestamp/node/random/prefix for a standard ID', () => {
    const before = Date.now();
    const id = std.generate('usr');
    const after = Date.now();
    const p = parse(id);

    expect(p.valid).toBe(true);
    expect(p.prefix).toBe('usr');
    expect(p.profile).toBe('standard');
    expect(p.body).toHaveLength(20);
    expect(p.node).toBe('A1');
    expect(p.random).toHaveLength(10);
    expect(p.timestamp).toBeGreaterThanOrEqual(before);
    expect(p.timestamp).toBeLessThanOrEqual(after + 5);
    expect(p.date).toBeInstanceOf(Date);
    expect(p.date?.getTime()).toBe(p.timestamp);
  });

  it('reports node=null for compact', () => {
    const p = parse(compactGen.compact('log'));
    expect(p.valid).toBe(true);
    expect(p.profile).toBe('compact');
    expect(p.node).toBeNull();
    expect(p.random).toHaveLength(8);
  });

  it('returns an all-null result for invalid input but keeps prefix/body when shaped', () => {
    const empty = parse('');
    expect(empty.valid).toBe(false);
    expect(empty.timestamp).toBeNull();

    const wrongLen = parse('usr_abc'); // valid chars, unknown length
    expect(wrongLen.valid).toBe(false);
    expect(wrongLen.prefix).toBe('usr');
    expect(wrongLen.body).toBe('abc');
    expect(wrongLen.profile).toBeNull();
  });
});

describe('extractors', () => {
  it('extractTimestamp / extractDate agree with parse', () => {
    const id = std.generate();
    expect(extractTimestamp(id)).toBe(parse(id).timestamp);
    expect(extractDate(id).getTime()).toBe(parse(id).timestamp);
  });

  it('extractNode returns the node or null', () => {
    expect(extractNode(std.generate('usr'))).toBe('A1');
    expect(extractNode(compactGen.compact())).toBeNull();
  });

  it('throw InvalidIdError on malformed input', () => {
    expect(() => extractTimestamp('nope')).toThrow(InvalidIdError);
    expect(() => extractDate('nope')).toThrow(InvalidIdError);
    expect(() => extractNode('nope')).toThrow(InvalidIdError);
  });
});

describe('compare', () => {
  it('orders by timestamp then body, total ordering', () => {
    const ids = std.generateBatch(50);
    const shuffled = [...ids].reverse();
    shuffled.sort(compare);
    expect(shuffled).toEqual(ids);
  });

  it('returns 0 only for identical bodies (ignoring prefix)', () => {
    const id = std.generate();
    const prefixed = `usr_${id}`;
    expect(compare(id, prefixed)).toBe(0);
    expect(compare(id, id)).toBe(0);
  });
});

describe('instance validate()', () => {
  it('checks against the instance profile and optional prefix', () => {
    const id = std.generate('usr');
    expect(std.validate(id)).toBe(true);
    expect(std.validate(id, 'usr')).toBe(true);
    expect(std.validate(id, 'ord')).toBe(false);
    expect(compactGen.validate(id)).toBe(false); // wrong length for compact
    expect(std.validate('')).toBe(false);
  });
});

describe('profile metadata', () => {
  it('recommendedColumnSize accounts for prefixes', () => {
    expect(recommendedColumnSize('standard')).toBe(20);
    expect(recommendedColumnSize('standard', 3)).toBe(24); // 3 + 1 + 20
    expect(recommendedColumnSize('compact', 8)).toBe(25); // 8 + 1 + 16
  });

  it('recommendedColumnSize rejects out-of-range prefix length', () => {
    expect(() => recommendedColumnSize('standard', 9)).toThrow(InvalidPrefixError);
  });

  it('entropy matches the documented values', () => {
    expect(entropy('compact')).toBe(47.6);
    expect(entropy('standard')).toBe(59.5);
    expect(entropy('extended')).toBe(83.4);
  });

  it('profileConfig / profiles expose registry data', () => {
    expect(profileConfig('standard')).toEqual({ length: 20, ts: 8, node: 2, random: 10 });
    expect(profiles()).toEqual(['compact', 'standard', 'extended']);
    expect(() => profileConfig('nope')).toThrow(InvalidProfileError);
  });
});
