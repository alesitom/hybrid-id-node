import { describe, it, expect } from 'vitest';
import { ProfileRegistry } from '../src/profile-registry.js';
import { Profile } from '../src/profile.js';
import { InvalidProfileError } from '../src/exception/errors.js';

describe('built-in profiles', () => {
  it('exposes compact/standard/extended with the expected layout', () => {
    const r = ProfileRegistry.withDefaults();
    expect(r.get('compact')).toEqual({ length: 16, ts: 8, node: 0, random: 8 });
    expect(r.get('standard')).toEqual({ length: 20, ts: 8, node: 2, random: 10 });
    expect(r.get('extended')).toEqual({ length: 24, ts: 8, node: 2, random: 14 });
  });

  it('returns undefined for unknown names', () => {
    expect(ProfileRegistry.withDefaults().get('nope')).toBeUndefined();
  });

  it('does not resolve prototype keys (no proto-key lookup)', () => {
    const r = ProfileRegistry.withDefaults();
    expect(r.get('__proto__')).toBeUndefined();
    expect(r.get('constructor')).toBeUndefined();
    expect(r.get('toString')).toBeUndefined();
  });

  it('maps body length back to a profile name', () => {
    const r = ProfileRegistry.withDefaults();
    expect(r.getByLength(16)).toBe('compact');
    expect(r.getByLength(20)).toBe('standard');
    expect(r.getByLength(24)).toBe('extended');
    expect(r.getByLength(99)).toBeUndefined();
  });

  it('lists all built-in names', () => {
    expect(ProfileRegistry.withDefaults().all()).toEqual(['compact', 'standard', 'extended']);
  });

  it('Profile constants match built-in names', () => {
    const r = ProfileRegistry.withDefaults();
    expect(r.get(Profile.Compact)).toBeDefined();
    expect(r.get(Profile.Standard)).toBeDefined();
    expect(r.get(Profile.Extended)).toBeDefined();
  });

  it('returned configs are immutable', () => {
    const cfg = ProfileRegistry.withDefaults().get('standard');
    expect(() => {
      // @ts-expect-error testing runtime immutability
      cfg.random = 99;
    }).toThrow();
  });
});

describe('custom profiles', () => {
  it('registers and resolves a custom profile', () => {
    const r = ProfileRegistry.withDefaults();
    r.register('tiny', 6, 0); // length = 8 + 0 + 6 = 14
    expect(r.get('tiny')).toEqual({ length: 14, ts: 8, node: 0, random: 6 });
    expect(r.getByLength(14)).toBe('tiny');
    expect(r.all()).toContain('tiny');
  });

  it('defaults node width to 2', () => {
    const r = ProfileRegistry.withDefaults();
    r.register('mid', 11); // length = 8 + 2 + 11 = 21
    expect(r.get('mid')).toEqual({ length: 21, ts: 8, node: 2, random: 11 });
  });

  it('rejects invalid names', () => {
    const r = ProfileRegistry.withDefaults();
    expect(() => r.register('Bad', 10)).toThrow(InvalidProfileError);
    expect(() => r.register('1bad', 10)).toThrow(InvalidProfileError);
    expect(() => r.register('with_underscore', 10)).toThrow(InvalidProfileError);
  });

  it('rejects duplicate names (including built-ins)', () => {
    const r = ProfileRegistry.withDefaults();
    expect(() => r.register('standard', 10)).toThrow(InvalidProfileError);
    r.register('dup', 10, 0); // length 18, no collision
    expect(() => r.register('dup', 12, 0)).toThrow(InvalidProfileError);
  });

  it('rejects random length out of [6, 128]', () => {
    const r = ProfileRegistry.withDefaults();
    expect(() => r.register('a', 5)).toThrow(InvalidProfileError);
    expect(() => r.register('b', 129)).toThrow(InvalidProfileError);
  });

  it('rejects node width out of [0, 10]', () => {
    const r = ProfileRegistry.withDefaults();
    expect(() => r.register('a', 10, -1)).toThrow(InvalidProfileError);
    expect(() => r.register('b', 10, 11)).toThrow(InvalidProfileError);
  });

  it('rejects a length that collides with an existing profile', () => {
    const r = ProfileRegistry.withDefaults();
    // 8 + 0 + 8 = 16 collides with compact
    expect(() => r.register('clash', 8, 0)).toThrow(InvalidProfileError);
  });

  it('reset() drops custom profiles but keeps built-ins', () => {
    const r = ProfileRegistry.withDefaults();
    r.register('temp', 10, 0);
    r.reset();
    expect(r.get('temp')).toBeUndefined();
    expect(r.getByLength(18)).toBeUndefined();
    expect(r.all()).toEqual(['compact', 'standard', 'extended']);
  });

  it('isolates custom profiles between registry instances', () => {
    const a = ProfileRegistry.withDefaults();
    const b = ProfileRegistry.withDefaults();
    a.register('onlya', 10, 0);
    expect(b.get('onlya')).toBeUndefined();
  });
});
