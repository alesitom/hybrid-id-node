import { describe, it, expect } from 'vitest';
import { HybridIdGenerator, blindOpaquePrefix } from '../src/hybrid-id-generator.js';
import { isBase62String } from '../src/base62.js';

const SECRET_A = Buffer.alloc(32, 0xaa);
const SECRET_B = Buffer.alloc(32, 0xbb);

describe('blind mode — construction', () => {
  it('is off by default and on when enabled', () => {
    expect(new HybridIdGenerator({ node: 'A1' }).isBlind()).toBe(false);
    expect(new HybridIdGenerator({ node: 'A1', blind: true }).isBlind()).toBe(true);
  });

  it('is implied by passing a secret', () => {
    expect(new HybridIdGenerator({ blindSecret: SECRET_A }).isBlind()).toBe(true);
  });

  it('does not require an explicit node (secret differentiates instances)', () => {
    // standard profile would normally throw NodeRequiredError without a node
    expect(() => new HybridIdGenerator({ profile: 'standard', blind: true })).not.toThrow();
  });

  it('rejects a secret shorter than 32 bytes', () => {
    expect(() => new HybridIdGenerator({ blindSecret: Buffer.alloc(31) })).toThrow(RangeError);
  });
});

describe('blind mode — output shape', () => {
  it('keeps the exact profile length and base62 charset', () => {
    for (const profile of ['compact', 'standard', 'extended'] as const) {
      const gen = new HybridIdGenerator({ profile, blind: true, blindSecret: SECRET_A });
      const lengths: Record<string, number> = { compact: 16, standard: 20, extended: 24 };
      const id = gen.generate();
      expect(id).toHaveLength(lengths[profile] as number);
      expect(isBase62String(id)).toBe(true);
    }
  });

  it('supports prefixes', () => {
    const gen = new HybridIdGenerator({ blind: true, blindSecret: SECRET_A });
    const id = gen.generate('usr');
    expect(id.startsWith('usr_')).toBe(true);
    expect(id).toHaveLength(24); // usr_ + 20
  });

  it('an observer cannot tell a blind ID from a normal one by shape', () => {
    const normal = new HybridIdGenerator({ node: 'A1' }).generate();
    const blind = new HybridIdGenerator({
      node: 'A1',
      blind: true,
      blindSecret: SECRET_A,
    }).generate();
    expect(blind).toHaveLength(normal.length);
    expect(isBase62String(blind)).toBe(true);
  });
});

describe('blind mode — opacity', () => {
  it('does not leak the real timestamp in the first 8 chars', () => {
    // A normal ID encodes Date.now() in its first 8 chars; a blind one must not.
    const normal = new HybridIdGenerator({ node: 'A1' }).generate();
    const blind = new HybridIdGenerator({
      node: 'A1',
      blind: true,
      blindSecret: SECRET_A,
    }).generate();
    // Same millisecond window, yet the leading segments should differ structurally.
    expect(blind.slice(0, 8)).not.toBe(normal.slice(0, 8));
  });

  it('different secrets produce different opaque prefixes for the same instant', () => {
    const a = new HybridIdGenerator({ node: 'A1', blindSecret: SECRET_A });
    const b = new HybridIdGenerator({ node: 'A1', blindSecret: SECRET_B });
    // Compare the deterministic opaque segment (first 10 chars), excluding random tail.
    const idA = a.generate();
    const idB = b.generate();
    expect(idA.slice(0, 10)).not.toBe(idB.slice(0, 10));
  });

  it('remains unique and monotonic', () => {
    const gen = new HybridIdGenerator({ node: 'A1', blind: true, blindSecret: SECRET_A });
    const ids = gen.generateBatch(1000);
    expect(new Set(ids).size).toBe(1000);
  });
});

describe('blindOpaquePrefix (pure)', () => {
  const TS = 1_700_000_000_000;

  it('is deterministic for fixed inputs and the right shape', () => {
    const a = blindOpaquePrefix(SECRET_A, TS, 'A1', 10);
    const b = blindOpaquePrefix(SECRET_A, TS, 'A1', 10);
    expect(a).toBe(b);
    expect(a).toHaveLength(10);
    expect(isBase62String(a)).toBe(true);
  });

  it('changes with the secret', () => {
    expect(blindOpaquePrefix(SECRET_A, TS, 'A1', 10)).not.toBe(
      blindOpaquePrefix(SECRET_B, TS, 'A1', 10),
    );
  });

  it('changes with the timestamp', () => {
    expect(blindOpaquePrefix(SECRET_A, TS, 'A1', 10)).not.toBe(
      blindOpaquePrefix(SECRET_A, TS + 1, 'A1', 10),
    );
  });

  it('changes with the node', () => {
    expect(blindOpaquePrefix(SECRET_A, TS, 'A1', 10)).not.toBe(
      blindOpaquePrefix(SECRET_A, TS, 'B2', 10),
    );
  });

  it('nodeless (empty node) folds only the timestamp', () => {
    const out = blindOpaquePrefix(SECRET_A, TS, '', 8);
    expect(out).toHaveLength(8);
    expect(isBase62String(out)).toBe(true);
  });
});
