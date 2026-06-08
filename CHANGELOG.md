# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-08

Initial release — a Node.js/TypeScript port of the PHP
[`alesitom/hybrid-id`](https://github.com/alesitom/hybrid-id) package, at **spec
parity** (same format, layout, and parsing; not byte-exact across languages,
except UUID conversion which targets the RFC 9562 wire format).

### Added

- **Generator** — `HybridIdGenerator` with an options-object constructor;
  `generate`, `compact`, `standard`, `extended`, and `generateBatch`; monotonic
  drift guard with a configurable `maxDriftMs`; `HybridIdGenerator.fromEnv()`.
- **Profiles** — built-in `compact` / `standard` / `extended`, plus custom
  profiles via an injectable `ProfileRegistry` (no global mutable state).
- **Prefixes** — Stripe-style `{type}_{id}` helpers.
- **Metadata** — standalone, tree-shakeable `parse`, `isValid`, `detectProfile`,
  `extractTimestamp`, `extractDate`, `extractNode`, `extractPrefix`, `compare`,
  `entropy`, `profileConfig`, `profiles`, `recommendedColumnSize`.
- **Range queries** — `minForTimestamp` / `maxForTimestamp` / `minForDate` /
  `maxForDate`, with optional prefix bounding.
- **Value object** — immutable `HybridId` (`toString`/`valueOf`/`toJSON`/`equals`).
- **UUID interop** — byte-exact RFC 9562 conversion: `toUUIDv8`/`fromUUIDv8`
  (lossless), `toUUIDv7`/`fromUUIDv7`, `toUUIDv4Format`/`fromUUIDv4Format`.
- **Blind mode** — HMAC-SHA384 over timestamp+node, with ephemeral or persistent
  per-instance secrets.
- **Dependency injection** — `IdGenerator` interface and a `MockHybridIdGenerator`
  (sequential + callback modes) for testing.
- **CLI** — `hybrid-id generate | inspect | profiles | help`, with `--json`.
- Dual ESM/CJS build with bundled TypeScript declarations; zero runtime
  dependencies; Node ≥ 22.

[1.0.0]: https://github.com/alesitom/hybrid-id-node/releases/tag/v1.0.0
