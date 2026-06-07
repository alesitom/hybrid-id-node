import { describe, it, expect } from 'vitest';
import { MockHybridIdGenerator } from '../src/mock.js';
import { HybridIdGenerator } from '../src/hybrid-id-generator.js';
import type { IdGenerator } from '../src/id-generator.js';

const real = new HybridIdGenerator({ node: 'A1' });

describe('sequential mode', () => {
  it('returns IDs in order and tracks remaining', () => {
    const mock = new MockHybridIdGenerator(['a', 'b', 'c']);
    expect(mock.remaining()).toBe(3);
    expect(mock.generate()).toBe('a');
    expect(mock.generate()).toBe('b');
    expect(mock.remaining()).toBe(1);
  });

  it('throws when exhausted, and reset() rewinds', () => {
    const mock = new MockHybridIdGenerator(['x']);
    expect(mock.generate()).toBe('x');
    expect(() => mock.generate()).toThrow(/exhausted/i);
    mock.reset();
    expect(mock.generate()).toBe('x');
  });

  it('throws when constructed empty with no callback', () => {
    expect(() => new MockHybridIdGenerator([])).toThrow(/at least one/i);
  });

  it('enforces the requested prefix on returned IDs', () => {
    const ok = new MockHybridIdGenerator(['usr_abc']);
    expect(ok.generate('usr')).toBe('usr_abc');

    const bad = new MockHybridIdGenerator(['abc']);
    expect(() => bad.generate('usr')).toThrow(/does not start with/i);
  });
});

describe('callback mode', () => {
  it('never exhausts and passes the prefix through', () => {
    let n = 0;
    const mock = MockHybridIdGenerator.withCallback((prefix) => {
      const body = `id${n++}`;
      return prefix ? `${prefix}_${body}` : body;
    });
    expect(mock.remaining()).toBe(Number.MAX_SAFE_INTEGER);
    expect(mock.generate()).toBe('id0');
    expect(mock.generate('usr')).toBe('usr_id1');
    mock.reset(); // no-op
    expect(mock.generate()).toBe('id2');
  });
});

describe('IdGenerator contract', () => {
  it('generateBatch respects range and prefix', () => {
    const mock = new MockHybridIdGenerator(['usr_a', 'usr_b']);
    expect(mock.generateBatch(2, 'usr')).toEqual(['usr_a', 'usr_b']);
    expect(() => new MockHybridIdGenerator(['a']).generateBatch(0)).toThrow(RangeError);
  });

  it('bodyLength is configurable; validate uses real format rules', () => {
    const mock = new MockHybridIdGenerator(['a'], 16);
    expect(mock.bodyLength()).toBe(16);
    const validId = real.generate('usr');
    expect(mock.validate(validId)).toBe(true);
    expect(mock.validate(validId, 'usr')).toBe(true);
    expect(mock.validate(validId, 'ord')).toBe(false);
    expect(mock.validate('nope')).toBe(false);
  });

  it('is assignable to the IdGenerator interface', () => {
    const gen: IdGenerator = new MockHybridIdGenerator(['a']);
    expect(gen.bodyLength()).toBe(20);
    const realGen: IdGenerator = real;
    expect(typeof realGen.generate()).toBe('string');
  });
});
