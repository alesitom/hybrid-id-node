import { describe, it, expect } from 'vitest';
import { minForTimestamp, maxForTimestamp, minForDate, maxForDate } from '../src/range.js';
import { HybridIdGenerator } from '../src/hybrid-id-generator.js';
import { extractTimestamp, stripPrefix } from '../src/index.js';
import { encodeBase62 } from '../src/base62.js';
import { IdOverflowError } from '../src/exception/errors.js';

const TS = 1_700_000_000_000;

describe('min/maxForTimestamp — shape', () => {
  it('standard: 8 ts + 12 fill, correct fill chars', () => {
    expect(minForTimestamp(TS)).toBe(encodeBase62(TS, 8) + '0'.repeat(12));
    expect(maxForTimestamp(TS)).toBe(encodeBase62(TS, 8) + 'z'.repeat(12));
    expect(minForTimestamp(TS)).toHaveLength(20);
    expect(maxForTimestamp(TS)).toHaveLength(20);
  });

  it('honors per-profile widths', () => {
    expect(minForTimestamp(TS, 'compact')).toHaveLength(16); // 8 + 8
    expect(maxForTimestamp(TS, 'extended')).toHaveLength(24); // 8 + 2 + 14
  });

  it('min <= max and they share the ts segment', () => {
    const lo = minForTimestamp(TS);
    const hi = maxForTimestamp(TS);
    expect(lo < hi).toBe(true);
    expect(lo.slice(0, 8)).toBe(hi.slice(0, 8));
  });
});

describe('range brackets a real ID', () => {
  it('a generated ID falls within [min, max] for its own timestamp', () => {
    const gen = new HybridIdGenerator({ node: 'A1' });
    const id = gen.generate('usr');
    const ts = extractTimestamp(id);
    const body = stripPrefix(id);
    expect(minForTimestamp(ts) <= body).toBe(true);
    expect(body <= maxForTimestamp(ts)).toBe(true);
  });

  it('the next millisecond is strictly above this ms upper bound', () => {
    expect(maxForTimestamp(TS) < minForTimestamp(TS + 1)).toBe(true);
  });
});

describe('Date variants', () => {
  it('delegate to the timestamp variants', () => {
    const d = new Date(TS);
    expect(minForDate(d)).toBe(minForTimestamp(TS));
    expect(maxForDate(d, 'extended')).toBe(maxForTimestamp(TS, 'extended'));
  });
});

describe('overflow', () => {
  it('throws when the timestamp exceeds 8 base62 chars', () => {
    expect(() => minForTimestamp(62 ** 8)).toThrow(IdOverflowError); // 62^8 needs 9 chars
  });
});
