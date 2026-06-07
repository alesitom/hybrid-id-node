/**
 * The minimal ID-generation contract for dependency injection and testing.
 *
 * Both {@link HybridIdGenerator} and the test double {@link MockHybridIdGenerator}
 * implement it, so application code can depend on the interface and swap a
 * deterministic mock in tests.
 */
export interface IdGenerator {
  /** Generate a single ID, optionally prefixed. */
  generate(prefix?: string | null): string;

  /** Generate `count` IDs (1–10,000) with guaranteed monotonic ordering. */
  generateBatch(count: number, prefix?: string | null): string[];

  /** Body length (without prefix) this generator produces. */
  bodyLength(): number;

  /**
   * Validate an ID's format. Not an authorization mechanism.
   *
   * @param expectedPrefix When given, the ID's prefix must match exactly.
   */
  validate(id: string, expectedPrefix?: string | null): boolean;
}
