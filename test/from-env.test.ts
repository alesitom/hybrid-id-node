import { describe, it, expect, afterEach } from 'vitest';
import { HybridIdGenerator } from '../src/hybrid-id-generator.js';
import { InvalidIdError, InvalidProfileError } from '../src/exception/errors.js';

const KEYS = [
  'HYBRID_ID_PROFILE',
  'HYBRID_ID_NODE',
  'HYBRID_ID_REQUIRE_NODE',
  'HYBRID_ID_BLIND',
  'HYBRID_ID_BLIND_SECRET',
  'HYBRID_ID_MAX_LENGTH',
];

function clearEnv(): void {
  for (const k of KEYS) delete process.env[k];
}

afterEach(clearEnv);

describe('fromEnv — happy paths', () => {
  it('defaults to standard and requires a node', () => {
    expect(() => HybridIdGenerator.fromEnv()).toThrow(/node is required/i);
  });

  it('reads profile + node', () => {
    process.env.HYBRID_ID_PROFILE = 'extended';
    process.env.HYBRID_ID_NODE = 'A1';
    const gen = HybridIdGenerator.fromEnv();
    expect(gen.getProfile()).toBe('extended');
    expect(gen.getNode()).toBe('A1');
    expect(gen.generate()).toHaveLength(24);
  });

  it('REQUIRE_NODE=0 disables the explicit-node guard', () => {
    process.env.HYBRID_ID_REQUIRE_NODE = '0';
    const gen = HybridIdGenerator.fromEnv();
    expect(gen.getNode()).not.toBeNull();
  });

  it('compact needs no node', () => {
    process.env.HYBRID_ID_PROFILE = 'compact';
    expect(HybridIdGenerator.fromEnv().generate()).toHaveLength(16);
  });

  it('enables blind mode and reads a base64 secret', () => {
    process.env.HYBRID_ID_NODE = 'A1';
    process.env.HYBRID_ID_BLIND = '1';
    process.env.HYBRID_ID_BLIND_SECRET = Buffer.alloc(32, 7).toString('base64');
    const gen = HybridIdGenerator.fromEnv();
    expect(gen.isBlind()).toBe(true);
    expect(gen.generate()).toHaveLength(20);
  });

  it('reads MAX_LENGTH', () => {
    process.env.HYBRID_ID_NODE = 'A1';
    process.env.HYBRID_ID_MAX_LENGTH = '25';
    expect(HybridIdGenerator.fromEnv().getMaxIdLength()).toBe(25);
  });
});

describe('fromEnv — validation', () => {
  it('rejects an unknown profile', () => {
    process.env.HYBRID_ID_PROFILE = 'nope';
    expect(() => HybridIdGenerator.fromEnv()).toThrow(InvalidProfileError);
  });

  it('rejects an invalid node', () => {
    process.env.HYBRID_ID_NODE = 'ABC';
    expect(() => HybridIdGenerator.fromEnv()).toThrow(InvalidIdError);
  });

  it('rejects invalid base64 secret', () => {
    process.env.HYBRID_ID_NODE = 'A1';
    process.env.HYBRID_ID_BLIND_SECRET = 'not valid base64!!';
    expect(() => HybridIdGenerator.fromEnv()).toThrow(InvalidIdError);
  });

  it('rejects a non-positive MAX_LENGTH', () => {
    process.env.HYBRID_ID_NODE = 'A1';
    process.env.HYBRID_ID_MAX_LENGTH = '0';
    expect(() => HybridIdGenerator.fromEnv()).toThrow(InvalidIdError);
  });

  it('treats empty strings as unset', () => {
    process.env.HYBRID_ID_PROFILE = '';
    process.env.HYBRID_ID_NODE = 'A1';
    expect(HybridIdGenerator.fromEnv().getProfile()).toBe('standard');
  });
});
