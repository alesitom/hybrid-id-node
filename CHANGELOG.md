# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-09-27

Maintenance release. The published package (`dist/`, `README.md`, `LICENSE`) is
identical to 1.0.0; only development tooling changed. Upgrading is a drop-in.

### Changed

- Dev toolchain: vitest and `@vitest/coverage-v8` 2 → 5, TypeScript 5.9 → 6.0
  (`~6.0.3`, bounded by typescript-eslint's peer range), eslint 9 → 10,
  typescript-eslint 8.70, prettier 3.9, `@types/node` 22.20 (#1, #2, #12, #15).
- Resolved all critical/high/moderate `npm audit` findings in devDependencies
  (#1, #2). One low advisory remains in esbuild via tsup (Windows dev server
  only) until tsup allows esbuild 0.28.

### CI

- Actions pinned by commit SHA (`actions/checkout` v7.0.1, `actions/setup-node`
  v7.0.0); `permissions: contents: read`; `concurrency` for PR runs; an `npm audit` step that fails on moderate or
  higher (#4, #5).
- Dependabot for npm and GitHub Actions, grouping minor/patch dev updates into
  one weekly PR; TypeScript ≥ 7 and `@types/node` majors ignored (#5, #11, #16).

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

[1.0.1]: https://github.com/alesitom/hybrid-id-node/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/alesitom/hybrid-id-node/releases/tag/v1.0.0
