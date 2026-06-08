# hybrid-id

**Compact, time-sortable unique identifiers for Node.js**

[![npm version](https://img.shields.io/npm/v/hybrid-id.svg?style=flat-square)](https://www.npmjs.com/package/hybrid-id)
[![CI](https://img.shields.io/github/actions/workflow/status/alesitom/hybrid-id-node/ci.yml?style=flat-square&label=ci)](https://github.com/alesitom/hybrid-id-node/actions)
[![types](https://img.shields.io/npm/types/hybrid-id?style=flat-square)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/npm/l/hybrid-id.svg?style=flat-square)](LICENSE)

A space-efficient alternative to UUID with configurable entropy profiles, Stripe-style prefixes, and an instance-based API. Generate chronologically sortable, URL-safe identifiers 33–56% smaller than canonical UUIDs — with **zero runtime dependencies**, full TypeScript types, and dual ESM/CJS output.

> Node port of [`alesitom/hybrid-id`](https://github.com/alesitom/hybrid-id) (PHP).
> **Compatibility: spec parity** — same format, layout, and parsing as the PHP library, so a non-blind ID generated in PHP parses in Node and vice versa. It is **not** byte-exact across languages (random bytes differ). The one exception is UUID conversion, which is byte-exact (it targets the RFC 9562 wire format, not PHP).

## Why HybridId?

| Feature | HybridId | TypeID | KSUID | UUIDv7 | NanoID | CUID2 |
|---|---|---|---|---|---|---|
| Length | 16–24 chars | 26 chars | 27 chars | 36 chars | 21 chars | 24 chars |
| Configurable size | Yes | No | No | No | No | No |
| Type prefixes | Yes | Yes | No | No | No | No |
| Time-sortable | Yes | Yes | Yes | Yes | No | No |
| Metadata extraction | Full | Partial | Partial | Partial | None | None |
| Zero dependencies | Yes | Varies | Varies | Yes | Varies | Varies |
| Range queries | Yes | No | No | No | No | No |
| Multi-node safe | Yes | Yes | No | Yes | N/A | N/A |
| Random entropy | 47.6 – 83.4+ bits | ~80 bits | 128 bits | 74 bits | ~126 bits | ~120 bits |

## Installation

```bash
npm install hybrid-id
```

Requires Node.js ≥ 22. No runtime dependencies. Ships ESM + CJS with bundled `.d.ts` types.

## Quick Start

```ts
import { HybridIdGenerator } from 'hybrid-id';

const gen = new HybridIdGenerator({ node: 'A1' });

gen.generate();        // '0VBFDQz4A1Rtntu09sbf'
gen.generate('usr');   // 'usr_0VBFDQz4A1Rtntu09sbf'
gen.compact('log');    // 'log_0VBFDQz6xK9mLp2w'
gen.extended('txn');   // 'txn_0VBFDQz7A1pBKVwwn2xiF0'
```

CommonJS works too:

```js
const { HybridIdGenerator } = require('hybrid-id');
```

## Profiles

Three built-in profiles with different size/entropy tradeoffs:

| Profile | Length | Structure | Random entropy | Use case |
|---|---|---|---|---|
| `compact` | 16 | 8ts + 8rand | 47.6 bits | Internal PKs, low-scale apps |
| `standard` | 20 | 8ts + 2node + 10rand | 59.5 bits | General purpose (default) |
| `extended` | 24 | 8ts + 2node + 14rand | 83.4 bits | High-scale, public-facing IDs |

```
Standard / Extended:          Compact (no node):

0VBFDQz4 A1 Rtntu09sbf        0VBFDQz4 xK9mLp2w
|______| |_| |_________|      |______| |________|
   ts   node   random            ts      random
```

- **ts** (8 chars): millisecond timestamp in base62. Enables chronological sorting.
- **node** (2 chars, standard/extended): server/process identifier. Prevents cross-node collisions.
- **rand** (variable): cryptographically secure random bytes via `node:crypto`.

Custom profiles are available via `ProfileRegistry` — see [API Reference](docs/api-reference.md#custom-profiles).

## Configuration

The constructor takes a single options object:

```ts
import { HybridIdGenerator } from 'hybrid-id';

// Standard profile with explicit node (recommended for production)
const gen = new HybridIdGenerator({ node: 'A1' });

// Explicit profile
const gen = new HybridIdGenerator({ profile: 'extended', node: 'A1' });

// Compact — no node needed
const gen = new HybridIdGenerator({ profile: 'compact' });

// From environment variables
const gen = HybridIdGenerator.fromEnv();
```

By default, standard and extended profiles **require** an explicit node to prevent accidental collisions in production. Pass `requireExplicitNode: false` for local development.

### Environment variables

`HybridIdGenerator.fromEnv()` reads from `process.env`:

| Variable | Default | Description |
|---|---|---|
| `HYBRID_ID_PROFILE` | `standard` | `compact`, `standard`, `extended` (or a registered custom profile) |
| `HYBRID_ID_NODE` | — | 2-char base62 node identifier |
| `HYBRID_ID_REQUIRE_NODE` | `1` | Set to `0` to disable the explicit-node guard |
| `HYBRID_ID_BLIND` | `0` | Set to `1` to enable [blind mode](docs/blind-mode.md) |
| `HYBRID_ID_BLIND_SECRET` | — | Base64-encoded persistent HMAC secret |
| `HYBRID_ID_MAX_LENGTH` | — | Hard cap on full ID length |

This library reads `process.env` directly and bundles no `.env` loader (zero deps). Load your `.env` however you prefer — the native `node --env-file=.env` (Node ≥ 20.6) needs nothing extra; [`dotenv`](https://www.npmjs.com/package/dotenv) is a common alternative. It's up to you.

> ⚠️ `HYBRID_ID_NODE` and `HYBRID_ID_BLIND_SECRET` are sensitive config — treat the secret like a credential. **Never** expose it through a client-bundled env (e.g. a `VITE_`-prefixed variable): those ship to the browser. The blind secret stays server-side only.

## Prefixes

Stripe-style prefixes make IDs self-documenting:

```ts
gen.generate('usr');   // 'usr_0VBFDQz4A1Rtntu09sbf'
gen.generate('ord');   // 'ord_0VBFDQz5A1xiF0G9pBKV'
```

Rules: 1–8 chars, lowercase alphanumeric, starts with a letter. All extraction and validation functions handle prefixed IDs transparently.

## Metadata & parsing

Metadata helpers are standalone, tree-shakeable functions — import only what you use:

```ts
import { parse, extractTimestamp, extractDate, extractNode, detectProfile } from 'hybrid-id';

extractTimestamp('0VBFDQz4A1Rtntu09sbf'); // 1739750400000 (ms since epoch)
extractDate('0VBFDQz4A1Rtntu09sbf');      // Date
extractNode('0VBFDQz4A1Rtntu09sbf');      // 'A1' (null for compact)
detectProfile('0VBFDQz4A1Rtntu09sbf');    // 'standard'

const p = parse('usr_0VBFDQz4A1Rtntu09sbf');
if (p.valid) {
  p.prefix;    // 'usr'
  p.profile;   // 'standard'
  p.timestamp; // 1739750400000
  p.node;      // 'A1'
  p.random;    // 'Rtntu09sbf'
}
```

`parse()` returns a discriminated union on `valid`, so TypeScript narrows the component fields for you. See the [API Reference](docs/api-reference.md) for the full surface (validation, sorting, range queries, custom profiles, the `HybridId` value object).

## Database

### Column sizing

| Profile | No prefix | With prefix (max 3) | With prefix (max 8) |
|---|---|---|---|
| `compact` | `CHAR(16)` | `VARCHAR(20)` | `VARCHAR(25)` |
| `standard` | `CHAR(20)` | `VARCHAR(24)` | `VARCHAR(29)` |
| `extended` | `CHAR(24)` | `VARCHAR(28)` | `VARCHAR(33)` |

### Collation (MySQL/MariaDB)

Base62 uses mixed case (`A` != `a`). You **must** use `ascii_bin` or `utf8mb4_bin` collation — the default `utf8mb4_0900_ai_ci` will silently break uniqueness and sort order.

```sql
CREATE TABLE users (
    id CHAR(20) COLLATE ascii_bin NOT NULL PRIMARY KEY
    -- ...
);
```

PostgreSQL and SQLite are case-sensitive by default — no special collation needed.

### Storage efficiency

| Format | Size | Savings vs UUID |
|--------|------|-----------------|
| UUID (canonical) | CHAR(36) | — |
| ULID | CHAR(26) | 28% |
| TypeID | VARCHAR(34) | 6% |
| HybridId compact | CHAR(16) | 56% |
| HybridId standard | CHAR(20) | 44% |
| HybridId extended | CHAR(24) | 33% |

Smaller primary keys improve B-tree index density and reduce page splits. Time-sorted layout eliminates the random-insert penalty of UUID v4. See the [Database Guide](docs/database.md) for time-range queries, NoSQL patterns, and migration strategies.

## Security

**Not for secrets.** Do NOT use HybridId for security tokens, session IDs, API keys, or password resets. The timestamp is predictable — use `crypto.randomBytes()` with 128+ bits for those.

**Standards alignment:**
- [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562): UUIDv8-compliant via `toUUIDv8()`
- CSPRNG: `node:crypto` `randomBytes()`, backed by OS-level cryptographic random
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986): URL-safe base62, no percent-encoding needed
- Rejection sampling eliminates modulo bias in the random field

**What HybridId is NOT:** not a secret-bearing token, not constant-time in validation, timestamps are predictable by design (same as UUIDv7).

## Blind Mode

HMAC-hashes the timestamp and node with a per-instance secret, making creation time unextractable. Same length and format — an observer cannot tell if an ID is blind.

```ts
const gen = new HybridIdGenerator({ node: 'A1', blind: true });
gen.generate('usr'); // 'usr_<opaque 20 chars>'
```

See [Blind Mode](docs/blind-mode.md) for what works, what changes, and persistent secrets.

## UUID Interoperability

Convert between HybridId and RFC 9562 UUIDs:

| Function | Lossless | Notes |
|--------|----------|-------|
| `toUUIDv8()` / `fromUUIDv8()` | Yes | Profile auto-detected on decode |
| `toUUIDv7()` / `fromUUIDv7()` | No | Timestamp-preserving, needs profile hint |
| `toUUIDv4Format()` / `fromUUIDv4Format()` | No | Lossy, NOT a true UUIDv4 |

```ts
import { toUUIDv8, fromUUIDv8 } from 'hybrid-id';

const uuid = toUUIDv8('0VBFDQz4A1Rtntu09sbf'); // RFC 9562 v8
fromUUIDv8(uuid);                              // '0VBFDQz4A1Rtntu09sbf'
```

Compact and standard profiles only. Prefixed IDs are rejected — strip the prefix first. See [UUID Interoperability](docs/uuid-interoperability.md).

## CLI

A `hybrid-id` binary ships with the package:

```bash
npx hybrid-id generate -p compact -n 10
npx hybrid-id inspect usr_0VBFDQz4A1Rtntu09sbf
npx hybrid-id profiles
npx hybrid-id generate --json -n 3
```

See the [CLI Reference](docs/cli.md).

## Testing & Dependency Injection

Type against the `IdGenerator` interface and inject a `MockHybridIdGenerator` in tests:

```ts
import { type IdGenerator, MockHybridIdGenerator } from 'hybrid-id';

const mock = new MockHybridIdGenerator(['ord_test001', 'ord_test002']);
mock.generate(); // 'ord_test001'
```

See [Dependency Injection & Testing](docs/dependency-injection.md).

## Learn More

| Topic | Link |
|---|---|
| Full API (validation, parsing, metadata, sorting, custom profiles, value object) | [docs/api-reference.md](docs/api-reference.md) |
| UUID conversion (v8, v7, v4-format) | [docs/uuid-interoperability.md](docs/uuid-interoperability.md) |
| Database (time-range queries, NoSQL, migration from UUID) | [docs/database.md](docs/database.md) |
| Blind mode (HMAC-hashed timestamps) | [docs/blind-mode.md](docs/blind-mode.md) |
| CLI reference | [docs/cli.md](docs/cli.md) |
| Dependency injection & testing | [docs/dependency-injection.md](docs/dependency-injection.md) |
| Internals (clock drift, concurrency, design decisions) | [docs/internals.md](docs/internals.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |

## License

MIT
