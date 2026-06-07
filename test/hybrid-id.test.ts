import { describe, it, expect } from 'vitest';
import { HybridId } from '../src/hybrid-id.js';
import { HybridIdGenerator } from '../src/hybrid-id-generator.js';
import { InvalidIdError } from '../src/exception/errors.js';

const std = new HybridIdGenerator({ node: 'A1' });
const compactGen = new HybridIdGenerator({ profile: 'compact' });

describe('construction', () => {
  it('parses a standard prefixed ID into readonly fields', () => {
    const raw = std.generate('usr');
    const vo = HybridId.fromString(raw);
    expect(vo.id).toBe(raw);
    expect(vo.prefix).toBe('usr');
    expect(vo.profile).toBe('standard');
    expect(vo.node).toBe('A1');
    expect(typeof vo.timestamp).toBe('number');
  });

  it('new and fromString are equivalent', () => {
    const raw = std.generate();
    expect(new HybridId(raw).id).toBe(HybridId.fromString(raw).id);
  });

  it('node is null for compact, prefix is null when unprefixed', () => {
    const vo = HybridId.fromString(compactGen.compact());
    expect(vo.node).toBeNull();
    expect(vo.prefix).toBeNull();
    expect(vo.profile).toBe('compact');
  });

  it('throws InvalidIdError (with the offending id) on bad input', () => {
    expect(() => HybridId.fromString('nope')).toThrow(InvalidIdError);
    expect(() => HybridId.fromString('nope')).toThrow(/"nope"/);
  });
});

describe('date', () => {
  it('derives a fresh Date matching the timestamp', () => {
    const vo = HybridId.fromString(std.generate());
    expect(vo.date).toBeInstanceOf(Date);
    expect(vo.date.getTime()).toBe(vo.timestamp);
  });

  it('returns a new Date each access (immutability)', () => {
    const vo = HybridId.fromString(std.generate());
    expect(vo.date).not.toBe(vo.date);
    expect(vo.date.getTime()).toBe(vo.date.getTime());
  });
});

describe('serialization', () => {
  it('toString returns the id and works in template literals', () => {
    const raw = std.generate('usr');
    const vo = HybridId.fromString(raw);
    expect(vo.toString()).toBe(raw);
    // Verifying the implicit toString() coercion is the point of this assertion.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    expect(`${vo}`).toBe(raw);
    expect(String(vo)).toBe(raw);
  });

  it('JSON.stringify yields the bare id string', () => {
    const raw = std.generate('usr');
    const vo = HybridId.fromString(raw);
    expect(JSON.stringify(vo)).toBe(`"${raw}"`);
    expect(JSON.stringify({ ref: vo })).toBe(`{"ref":"${raw}"}`);
  });
});
