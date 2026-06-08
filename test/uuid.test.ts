import { describe, it, expect } from 'vitest';
import {
  toUUIDv8,
  fromUUIDv8,
  toUUIDv7,
  fromUUIDv7,
  toUUIDv4Format,
  fromUUIDv4Format,
} from '../src/uuid.js';
import { HybridIdGenerator } from '../src/hybrid-id-generator.js';
import { extractTimestamp, extractNode } from '../src/metadata.js';
import { InvalidIdError, InvalidProfileError, IdOverflowError } from '../src/exception/errors.js';

const std = new HybridIdGenerator({ node: 'A1' });
const compactGen = new HybridIdGenerator({ profile: 'compact' });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('UUIDv8 — lossless round trip', () => {
  it('standard: to → from recovers the exact ID', () => {
    for (let i = 0; i < 50; i++) {
      const id = std.generate();
      const uuid = toUUIDv8(id);
      expect(uuid).toMatch(UUID_RE);
      expect(uuid.charAt(14)).toBe('8'); // version nibble
      expect(fromUUIDv8(uuid)).toBe(id);
    }
  });

  it('compact: to → from recovers the exact ID (profile auto-detected)', () => {
    for (let i = 0; i < 50; i++) {
      const id = compactGen.compact();
      expect(fromUUIDv8(toUUIDv8(id))).toBe(id);
    }
  });

  it('sets the RFC 4122 variant bits (10xx)', () => {
    const uuid = toUUIDv8(std.generate());
    const variantNibble = parseInt(uuid.replace(/-/g, '').charAt(16), 16);
    expect(variantNibble >> 2).toBe(0b10);
  });
});

describe('UUIDv7 — timestamp-preserving with profile hint', () => {
  it('standard round trips with the matching profile hint', () => {
    const id = std.generate();
    const uuid = toUUIDv7(id);
    expect(uuid.charAt(14)).toBe('7');
    expect(fromUUIDv7(uuid, 'standard')).toBe(id);
  });

  it('compact round trips', () => {
    const id = compactGen.compact();
    expect(fromUUIDv7(toUUIDv7(id), 'compact')).toBe(id);
  });

  it('preserves the timestamp even with the default (wrong-width) hint', () => {
    const id = std.generate();
    const ts = extractTimestamp(id);
    // Decoding standard data as compact still preserves the timestamp segment.
    expect(extractTimestamp(fromUUIDv7(toUUIDv7(id)))).toBe(ts);
  });
});

describe('UUIDv4-format — lossy, needs ts/node supplied back', () => {
  it('round trips when the original timestamp and node are provided', () => {
    const id = std.generate();
    const ts = extractTimestamp(id);
    const node = extractNode(id);
    const uuid = toUUIDv4Format(id);
    expect(uuid.charAt(14)).toBe('4');
    expect(fromUUIDv4Format(uuid, 'standard', ts, node)).toBe(id);
  });

  it('reconstructs node from the UUID when not supplied', () => {
    const id = std.generate();
    const ts = extractTimestamp(id);
    expect(fromUUIDv4Format(toUUIDv4Format(id), 'standard', ts)).toBe(id);
  });

  it('rejects an out-of-range timestamp', () => {
    const uuid = toUUIDv4Format(std.generate());
    expect(() => fromUUIDv4Format(uuid, 'standard', 62 ** 8)).toThrow(IdOverflowError);
  });
});

describe('PHP cross-language golden vectors', () => {
  // Generated from alesitom/hybrid-id (PHP 8.5) UuidConverter. Pinning these
  // guards the 128-bit bit-twiddling against regressions: any shift/mask drift
  // would diverge from the reference implementation here.
  const vectors = [
    {
      profile: 'standard' as const,
      id: '0VBFDQz4A1Rtntu09sbf',
      v8: '019c5e5b-f71a-826d-953d-cf368e401def',
      v7: '019c5e5b-f71a-726d-913d-cf368e401def',
      v4: '019c5e5b-f71a-426d-913d-cf368e401def',
    },
    {
      profile: 'compact' as const,
      id: '0VBFDQz4xK9mLp2w',
      v8: '019c5e5b-f71a-8000-8000-be0307dd8a3a',
      v7: '019c5e5b-f71a-7000-8000-be0307dd8a3a',
      v4: '019c5e5b-f71a-4000-8000-be0307dd8a3a',
    },
  ];

  it('Node output matches PHP byte-for-byte (to*)', () => {
    for (const v of vectors) {
      expect(toUUIDv8(v.id)).toBe(v.v8);
      expect(toUUIDv7(v.id)).toBe(v.v7);
      expect(toUUIDv4Format(v.id)).toBe(v.v4);
    }
  });

  it('Node decodes PHP-produced UUIDs back to the same ID (from*)', () => {
    for (const v of vectors) {
      expect(fromUUIDv8(v.v8)).toBe(v.id);
      expect(fromUUIDv7(v.v7, v.profile)).toBe(v.id);
    }
  });
});

describe('rejections and validation', () => {
  it('rejects prefixed IDs', () => {
    const id = std.generate('usr');
    expect(() => toUUIDv8(id)).toThrow(InvalidIdError);
    expect(() => toUUIDv7(id)).toThrow(InvalidIdError);
    expect(() => toUUIDv4Format(id)).toThrow(InvalidIdError);
  });

  it('rejects the extended profile', () => {
    const ext = new HybridIdGenerator({ node: 'A1', profile: 'extended' });
    expect(() => toUUIDv8(ext.generate())).toThrow(InvalidProfileError);
    expect(() => toUUIDv7(ext.generate())).toThrow(InvalidProfileError);
  });

  it('rejects malformed UUIDs and version mismatches', () => {
    expect(() => fromUUIDv8('not-a-uuid')).toThrow(InvalidIdError);
    const v8 = toUUIDv8(std.generate());
    expect(() => fromUUIDv7(v8)).toThrow(InvalidIdError); // version 8 != 7
  });

  it('rejects an invalid node in fromUUIDv4Format', () => {
    const uuid = toUUIDv4Format(std.generate());
    expect(() => fromUUIDv4Format(uuid, 'standard', 1, 'XYZ')).toThrow(InvalidIdError);
  });

  it('rejects an unsupported profile hint', () => {
    const uuid = toUUIDv7(std.generate());
    expect(() => fromUUIDv7(uuid, 'extended')).toThrow(InvalidProfileError);
  });
});

describe('hardening — malformed input never leaks internal errors', () => {
  it('wraps an over-capacity random segment as InvalidIdError, not IdOverflowError', () => {
    // Hand-crafted v8 with profile index 0 (compact: 8 random chars, ~47.6 bits)
    // but the full 60 random bits set — the value overflows the compact random
    // field, so reconstruction must fail as InvalidIdError (friendly), not as the
    // internal IdOverflowError that encodeBase62 throws.
    const overflow = '00000000-0000-8000-8fff-ffffffffffff';
    expect(() => fromUUIDv8(overflow)).toThrow(InvalidIdError);
    expect(() => fromUUIDv8(overflow)).not.toThrow(IdOverflowError);
  });

  it('rejects a non-integer timestampMs before BigInt coercion', () => {
    const uuid = toUUIDv4Format(std.generate());
    expect(() => fromUUIDv4Format(uuid, 'standard', 1.5)).toThrow(InvalidIdError);
  });

  it('rejects a string-typed timestampMs (no silent coercion)', () => {
    const uuid = toUUIDv4Format(std.generate());
    // @ts-expect-error — guarding the runtime contract against untyped callers.
    expect(() => fromUUIDv4Format(uuid, 'standard', '123')).toThrow(InvalidIdError);
  });

  it('still accepts null timestampMs (defaults to now)', () => {
    const uuid = toUUIDv4Format(std.generate());
    expect(() => fromUUIDv4Format(uuid, 'standard', null)).not.toThrow();
  });
});
