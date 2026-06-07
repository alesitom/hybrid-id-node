import { describe, it, expect } from 'vitest';
import { HybridIdGenerator } from '../src/hybrid-id-generator.js';
import { ProfileRegistry } from '../src/profile-registry.js';
import { isBase62String } from '../src/base62.js';
import {
  IdOverflowError,
  InvalidIdError,
  InvalidProfileError,
  NodeRequiredError,
} from '../src/exception/errors.js';

describe('construction', () => {
  it('defaults to the standard profile and requires an explicit node', () => {
    expect(() => new HybridIdGenerator()).toThrow(NodeRequiredError);
    const gen = new HybridIdGenerator({ node: 'A1' });
    expect(gen.getProfile()).toBe('standard');
    expect(gen.bodyLength()).toBe(20);
    expect(gen.getNode()).toBe('A1');
  });

  it('compact is nodeless and needs no node', () => {
    const gen = new HybridIdGenerator({ profile: 'compact' });
    expect(gen.getNode()).toBeNull();
    expect(gen.bodyLength()).toBe(16);
  });

  it('auto-detects a node when requireExplicitNode is false', () => {
    const gen = new HybridIdGenerator({ profile: 'standard', requireExplicitNode: false });
    const node = gen.getNode();
    expect(node).not.toBeNull();
    expect(node).toHaveLength(2);
    expect(isBase62String(node as string)).toBe(true);
  });

  it('rejects an invalid node', () => {
    expect(() => new HybridIdGenerator({ node: 'A' })).toThrow(InvalidIdError);
    expect(() => new HybridIdGenerator({ node: 'A-' })).toThrow(InvalidIdError);
    expect(() => new HybridIdGenerator({ node: 'ABC' })).toThrow(InvalidIdError);
  });

  it('rejects an unknown profile', () => {
    expect(() => new HybridIdGenerator({ profile: 'nope' })).toThrow(InvalidProfileError);
  });

  it('rejects maxIdLength below the body length', () => {
    expect(() => new HybridIdGenerator({ node: 'A1', maxIdLength: 10 })).toThrow(IdOverflowError);
  });

  it('rejects a non-positive maxDriftMs', () => {
    expect(() => new HybridIdGenerator({ node: 'A1', maxDriftMs: 0 })).toThrow(RangeError);
  });
});

describe('generation', () => {
  const gen = new HybridIdGenerator({ node: 'A1' });

  it('produces a 20-char base62 standard ID', () => {
    const id = gen.generate();
    expect(id).toHaveLength(20);
    expect(isBase62String(id)).toBe(true);
    expect(id.slice(8, 10)).toBe('A1'); // node segment
  });

  it('applies a prefix', () => {
    const id = gen.generate('usr');
    expect(id.startsWith('usr_')).toBe(true);
    expect(id).toHaveLength(24); // usr_ + 20
  });

  it('per-profile helpers honor their widths', () => {
    expect(gen.compact()).toHaveLength(16);
    expect(gen.standard()).toHaveLength(20);
    expect(gen.extended()).toHaveLength(24);
  });

  it('IDs are unique and strictly monotonic', () => {
    const ids = gen.generateBatch(2000);
    expect(new Set(ids).size).toBe(2000);
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids); // base62 lexical order == generation order
  });

  it('generateBatch rejects out-of-range counts', () => {
    expect(() => gen.generateBatch(0)).toThrow(RangeError);
    expect(() => gen.generateBatch(10_001)).toThrow(RangeError);
  });

  it('respects maxIdLength against long prefixes', () => {
    const g = new HybridIdGenerator({ node: 'A1', maxIdLength: 22 });
    expect(g.generate('a')).toHaveLength(22); // a_ + 20
    expect(() => g.generate('toolong')).toThrow(IdOverflowError);
  });

  it('enforces the drift cap under sustained intra-ms pressure', () => {
    const g = new HybridIdGenerator({ node: 'A1', maxDriftMs: 5 });
    // Each call bumps the counter by >=1ms once saturated; >5ms ahead throws.
    expect(() => {
      for (let i = 0; i < 100; i++) g.generate();
    }).toThrow(IdOverflowError);
  });

  it('works with an injected custom-profile registry', () => {
    const reg = ProfileRegistry.withDefaults();
    reg.register('tiny', 6, 0); // 14 chars
    const g = new HybridIdGenerator({ profile: 'tiny', registry: reg });
    expect(g.generate()).toHaveLength(14);
  });
});

describe('timestamp ordering across instances', () => {
  it('IDs from the same ms sort by timestamp segment', () => {
    const gen = new HybridIdGenerator({ node: 'A1' });
    const a = gen.generate();
    const b = gen.generate();
    expect(a.slice(0, 8) <= b.slice(0, 8)).toBe(true);
    expect(a < b).toBe(true);
  });
});
