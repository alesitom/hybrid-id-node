# API Reference

Full reference for the public API. The generator is a class (`HybridIdGenerator`); everything else — validation, parsing, metadata, sorting, range queries, UUID conversion — is exposed as standalone, tree-shakeable functions.

```ts
import {
  HybridIdGenerator,
  parse,
  isValid,
  extractTimestamp,
  extractDate,
  extractNode,
  extractPrefix,
  detectProfile,
  compare,
  entropy,
  profileConfig,
  profiles,
  recommendedColumnSize,
  HybridId,
  ProfileRegistry,
} from 'hybrid-id';
```

## Generation

### `generate(prefix?: string | null): string`

Generate an ID using the instance's configured profile.

```ts
const gen = new HybridIdGenerator({ node: 'A1' });
gen.generate();      // '0VBFDQz4A1Rtntu09sbf'
gen.generate('usr'); // 'usr_0VBFDQz4A1Rtntu09sbf'
```

### Profile-specific generators

```ts
gen.compact('log');  // 16 chars: 8ts + 8rand
gen.standard('usr'); // 20 chars: 8ts + 2node + 10rand (default)
gen.extended('txn'); // 24 chars: 8ts + 2node + 14rand
```

> A nodeless instance (e.g. `{ profile: 'compact' }`) throws `NodeRequiredError` if you call `standard()`/`extended()`, which need a node. Construct with a node to use those.

### `generateBatch(count: number, prefix?: string | null): string[]`

Generate multiple IDs (1–10,000) with guaranteed monotonic ordering.

```ts
const ids = gen.generateBatch(100, 'evt');
// ['evt_…', 'evt_…', …] — 100 unique, ordered IDs
```

Large batches advance the monotonic counter proportionally (~1ms drift per ID once intra-millisecond capacity is saturated). Throws `IdOverflowError` if drift exceeds `maxDriftMs` (default 10,000ms). Out-of-range counts throw `RangeError`.

### `HybridIdGenerator.fromEnv(registry?): HybridIdGenerator` (static)

Construct from environment variables (read from `process.env`). See [Configuration](../README.md#environment-variables) for the full variable list. Empty strings are treated as unset. Throws `InvalidProfileError` / `InvalidIdError` for malformed values.

```ts
const gen = HybridIdGenerator.fromEnv();
```

## Validation

### `gen.validate(id: string, expectedPrefix?: string | null): boolean` (instance)

Validate against **this instance's** profile configuration.

```ts
const gen = new HybridIdGenerator({ profile: 'standard', node: 'A1' });
gen.validate(id);        // true if body is 20 chars of base62
gen.validate(id, 'usr'); // true only if the prefix is exactly 'usr'
```

### `isValid(id: string): boolean` (standalone)

Validate against any built-in profile length.

```ts
isValid('0VBFDQz4A1Rtntu09sbf');     // true
isValid('usr_0VBFDQz4A1Rtntu09sbf'); // true
isValid('not-valid');                // false
```

> Uses the default registry — custom profiles registered on an injected `ProfileRegistry` are not visible. Use `gen.validate()` on the instance instead.

## Metadata extraction

### `extractTimestamp(id: string): number`

Milliseconds since the Unix epoch.

```ts
extractTimestamp(id); // 1739750400000
```

### `extractDate(id: string): Date`

A `Date` with millisecond precision.

```ts
extractDate(id).toISOString(); // '2026-02-17T00:00:00.000Z'
```

### `extractNode(id: string): string | null`

The 2-char node, or `null` for compact (nodeless) profiles.

```ts
extractNode('0VBFDQz4A1Rtntu09sbf'); // 'A1'
extractNode('0VBFDQz4xK9mLp2w');      // null
```

### `extractPrefix(id: string): string | null`

The prefix, or `null` if unprefixed.

```ts
extractPrefix('usr_0VBFDQz4A1Rtntu09sbf'); // 'usr'
extractPrefix('0VBFDQz4A1Rtntu09sbf');      // null
```

## Parsing

### `parse(id: string): ParsedHybridId`

Extract every component in one pass. The result is a **discriminated union** on `valid`, so TypeScript narrows the component fields after a `valid` check.

```ts
const result = parse('usr_0VBFDQz4A1Rtntu09sbf');
if (result.valid) {
  result.prefix;    // 'usr' | null
  result.body;      // '0VBFDQz4A1Rtntu09sbf'
  result.profile;   // 'standard'
  result.timestamp; // 1739750400000
  result.node;      // 'A1' | null
  result.random;    // 'Rtntu09sbf'
} else {
  result.valid; // false — component fields are not present on this branch
}
```

## Sorting

### `compare(a: string, b: string): number`

Total ordering suitable for `Array.prototype.sort`. Primary key: timestamp. Tiebreaker: lexicographic on the body (prefixes stripped). Returns `0` only when both bodies are byte-identical.

```ts
ids.sort(compare);
```

## Range queries

### `minForTimestamp(timestampMs, profile?, prefix?): string`
### `maxForTimestamp(timestampMs, profile?, prefix?): string`

Inclusive lower/upper bounds for a timestamp. `min` fills node+random with `0` (lowest base62); `max` fills with `z` (highest). `profile` defaults to `'standard'`. Pass `prefix` to bound a prefixed column directly.

### `minForDate(date, profile?, prefix?): string`
### `maxForDate(date, profile?, prefix?): string`

Same, accepting a `Date`.

```ts
import { minForDate, maxForDate } from 'hybrid-id';

const min = minForDate(new Date('2026-01-01'), 'standard', 'ord');
const max = maxForDate(new Date('2026-02-01'), 'standard', 'ord');

// WHERE id >= $min AND id <= $max
```

See the [Database Guide](database.md) for query patterns.

## Introspection

### `detectProfile(id: string): string | null`

Detect a profile by body length.

```ts
detectProfile('0VBFDQz4A1Rtntu09sbf'); // 'standard'
```

### `profileConfig(profile): ProfileConfig`

```ts
profileConfig('standard');
// { length: 20, ts: 8, node: 2, random: 10 }
```

### `profiles(): string[]`

List all profile names (built-in + custom on the default registry).

### `entropy(profile): number`

Random entropy in bits.

```ts
entropy('extended'); // 83.4
```

### `recommendedColumnSize(profile, maxPrefixLength = 0): number`

Database column-size helper.

```ts
recommendedColumnSize('standard', 3); // 24 (3 prefix + 1 underscore + 20 body)
```

### Getters

```ts
gen.getProfile();     // 'standard'
gen.getNode();        // 'A1' — or null for nodeless profiles
gen.bodyLength();     // 20
gen.getMaxIdLength(); // null or the configured limit
gen.isBlind();        // false
```

## Value object

### `HybridId`

Immutable wrapper around a parsed ID. Stringifies to its `id`, and serializes to a JSON string.

```ts
import { HybridId } from 'hybrid-id';

const id = new HybridId('usr_0VBFDQz4A1Rtntu09sbf');
// or: HybridId.fromString('usr_…')

id.id;        // 'usr_0VBFDQz4A1Rtntu09sbf'
id.prefix;    // 'usr' | null
id.profile;   // 'standard'
id.timestamp; // number (ms since epoch)
id.date;      // Date (fresh instance each access)
id.node;      // 'A1' | null

String(id);            // same as id.id (toString / valueOf)
`${id}`;               // 'usr_0VBFDQz4A1Rtntu09sbf'
JSON.stringify(id);    // '"usr_0VBFDQz4A1Rtntu09sbf"'
id.equals('usr_0VBFDQz4A1Rtntu09sbf'); // true (accepts HybridId | string)
```

Throws `InvalidIdError` if the string is not a valid HybridId. Uses `parse()` under the hood, so only built-in profiles are recognized — for IDs built from a caller-registered custom profile, validate via a generator instance instead.

## Custom profiles

Register custom profiles (different random/node lengths) on a `ProfileRegistry` and inject it:

```ts
import { ProfileRegistry, HybridIdGenerator } from 'hybrid-id';

const registry = ProfileRegistry.withDefaults();
registry.register('medium', 12);        // 8ts + 2node + 12rand = 22 chars
registry.register('tiny', 10, 0);       // 8ts + 0node + 10rand = 18 chars (nodeless)

const gen = new HybridIdGenerator({ profile: 'medium', node: 'A1', registry });
gen.generate('evt'); // 'evt_<22 chars>'
```

Signature: `register(name: string, random: number, node = 2): void`

Constraints:

- **Name** — lowercase alphanumeric, starts with a letter
- **Random** — 6–128 characters
- **Node** — 0–10 characters (0 produces a nodeless profile like `compact`)
- Total length must not conflict with an existing profile

Injecting a registry is safe for long-lived processes and multi-tenant setups — there is no global mutable profile state.

## Prefix rules

- 1–8 characters
- Lowercase alphanumeric only
- Must start with a letter
- Separator: `_` (Stripe convention)

All extraction and validation functions handle prefixed IDs transparently. The prefix helpers (`applyPrefix`, `extractPrefix`, `stripPrefix`, `validatePrefix`, `isValidPrefix`) and constants (`PREFIX_SEPARATOR`, `PREFIX_MAX_LENGTH`) are exported too.

## Errors

| Class | When |
|---|---|
| `InvalidProfileError` | Unknown profile name |
| `InvalidPrefixError` | Prefix format invalid |
| `InvalidIdError` | ID format invalid |
| `IdOverflowError` | Value exceeds capacity, drift exceeds the limit, or `maxIdLength` exceeded |
| `NodeRequiredError` | Node required but not provided |

All extend `HybridIdError`, so you can catch the whole family with one `instanceof HybridIdError` check. Error messages are an implementation detail — match on the class, not the string.
