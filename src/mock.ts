import { Messages, fmt } from './exception/messages.js';
import { isValid } from './metadata.js';
import { extractPrefix } from './prefix.js';
import type { IdGenerator } from './id-generator.js';

/** A callback that produces an ID from an optional prefix. */
export type MockCallback = (prefix: string | null) => string;

/**
 * Deterministic {@link IdGenerator} test double.
 *
 * Two modes: a fixed sequence of IDs (exhausts), or a callback (never exhausts).
 * When a prefix is requested, the produced ID must start with `"<prefix>_"`.
 */
export class MockHybridIdGenerator implements IdGenerator {
  private readonly ids: string[];
  private readonly callback: MockCallback | null;
  private readonly bodyLengthValue: number;
  private cursor = 0;

  /**
   * @param ids Sequence of IDs returned by successive generate() calls.
   * @param bodyLength Body length to report (default 20, standard profile).
   */
  constructor(ids: string[] = [], bodyLength = 20, callback: MockCallback | null = null) {
    if (callback === null && ids.length === 0) {
      throw new Error(Messages.MOCK_EMPTY);
    }
    this.ids = [...ids];
    this.bodyLengthValue = bodyLength;
    this.callback = callback;
  }

  /**
   * Create a mock that produces IDs dynamically via a callback (never exhausts).
   * The callback receives the prefix (or null) and must return a full ID; when a
   * prefix is requested the returned ID must start with `"<prefix>_"`.
   */
  static withCallback(callback: MockCallback, bodyLength = 20): MockHybridIdGenerator {
    return new MockHybridIdGenerator([], bodyLength, callback);
  }

  generate(prefix?: string | null): string {
    const id = this.callback !== null ? this.callback(prefix ?? null) : this.nextSequentialId();

    if (prefix !== undefined && prefix !== null && !id.startsWith(`${prefix}_`)) {
      const hint =
        this.callback !== null
          ? 'Ensure your callback returns prefixed IDs when a prefix is requested.'
          : 'Include the prefix in your mock IDs.';
      throw new Error(fmt(Messages.MOCK_PREFIX_MISMATCH, prefix, id, prefix, hint));
    }

    return id;
  }

  generateBatch(count: number, prefix?: string | null): string[] {
    if (!Number.isInteger(count) || count < 1 || count > 10_000) {
      throw new RangeError(fmt(Messages.MOCK_BATCH_LIMIT, count));
    }
    const ids = new Array<string>(count);
    for (let i = 0; i < count; i++) {
      ids[i] = this.generate(prefix);
    }
    return ids;
  }

  bodyLength(): number {
    return this.bodyLengthValue;
  }

  validate(id: string, expectedPrefix?: string | null): boolean {
    return (
      isValid(id) &&
      (expectedPrefix === undefined ||
        expectedPrefix === null ||
        extractPrefix(id) === expectedPrefix)
    );
  }

  /** How many IDs remain before exhaustion. `Infinity`-ish in callback mode. */
  remaining(): number {
    return this.callback !== null ? Number.MAX_SAFE_INTEGER : this.ids.length - this.cursor;
  }

  /** Reset the cursor to the start of the sequence. No-op in callback mode. */
  reset(): void {
    if (this.callback === null) {
      this.cursor = 0;
    }
  }

  private nextSequentialId(): string {
    if (this.cursor >= this.ids.length) {
      throw new Error(fmt(Messages.MOCK_EXHAUSTED, this.ids.length));
    }
    const id = this.ids[this.cursor];
    this.cursor++;
    return id as string;
  }
}
