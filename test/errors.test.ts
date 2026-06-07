import { describe, it, expect } from 'vitest';
import {
  HybridIdError,
  IdOverflowError,
  InvalidIdError,
  InvalidPrefixError,
  InvalidProfileError,
  NodeRequiredError,
} from '../src/exception/errors.js';

const subclasses = [
  IdOverflowError,
  InvalidIdError,
  InvalidPrefixError,
  InvalidProfileError,
  NodeRequiredError,
] as const;

describe('error hierarchy', () => {
  it('every domain error extends HybridIdError and Error', () => {
    for (const Cls of subclasses) {
      const err = new Cls('boom');
      expect(err).toBeInstanceOf(HybridIdError);
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('sets the concrete class name and message', () => {
    const err = new IdOverflowError('too big');
    expect(err.name).toBe('IdOverflowError');
    expect(err.message).toBe('too big');
  });

  it('allows catching the whole domain via HybridIdError', () => {
    const caught = (() => {
      try {
        throw new InvalidProfileError('nope');
      } catch (e) {
        return e instanceof HybridIdError;
      }
    })();
    expect(caught).toBe(true);
  });

  it('keeps subclasses distinct from one another', () => {
    expect(new IdOverflowError('x')).not.toBeInstanceOf(InvalidIdError);
  });
});
