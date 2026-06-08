# Internals

Design decisions and implementation details for contributors and advanced users.

## Monotonic guard & clock drift

Each `HybridIdGenerator` instance tracks its last-used timestamp. If the clock drifts backward, or two IDs are generated within the same millisecond, the timestamp is incremented:

```
Real time:  1000, 1001, 1001, 1001, 1002
Used:       1000, 1001, 1002, 1003, 1004  (monotonically increasing)
```

This guarantees strict ordering within an instance but introduces "drift" — the gap between the monotonic counter and real wall-clock time.

### Drift cap

`maxDriftMs` defaults to 10,000. If the counter drifts more than 10 seconds ahead of real time, `IdOverflowError` is thrown, preventing unbounded future-dated timestamps under sustained high throughput. Normal workloads never hit this.

### Forward clock jumps

If the system clock jumps forward (e.g. an NTP correction), the guard naturally catches up — no special handling needed. A large *backward* step can leave the counter ahead of wall-clock; if it ends up more than `maxDriftMs` ahead, generation throws until the real clock catches up.

## Concurrency

`HybridIdGenerator` is **not** safe to share across `worker_threads` or `cluster` workers. Each worker must use its own instance (or distinct explicit nodes) to avoid timestamp collisions.

The monotonic guard is per-instance, so independent instances can emit IDs with the same millisecond timestamp — the node + random portions keep them from colliding. (Within a single thread, the JS event loop already serializes access, so a per-process instance needs no locking.)

## Node auto-detection

When no explicit node is provided (and the profile needs one, with the guard disabled or in blind mode), `crypto.randomBytes(2)` generates a random 2-character node. This is a dev/testing fallback — production should always use explicit nodes.

Modulo bias: `65536 % 3844 = 120`, so values `[0, 119]` are ~0.003% more likely. Negligible for a non-deterministic fallback.

## Base62 encoding

Alphabet: `0-9A-Za-z` (62 characters, URL-safe, no percent-encoding needed).

Encoding is big-endian with zero-padding to a fixed length. This preserves sort order: lexicographic string comparison matches numeric comparison. All encode/decode math runs through `BigInt`, so the full 64-bit range (and the 128-bit values needed for UUID conversion) is lossless. `decodeBase62()` enforces a signed-64-bit ceiling for behavioral parity with the PHP package.

### Rejection sampling

`randomBase62()` uses rejection sampling to eliminate modulo bias. Each random byte is accepted only if `< 248` (the largest multiple of 62 that fits in a byte); rejected bytes are discarded. Expected overhead is ~3.1% extra bytes, and the buffer is pre-allocated (`ceil(length * 1.25)`) to minimize `randomBytes()` calls.

### Decode hardening

`decodeBase62()` strips leading zeros and only loops over the significant digits, with a per-step overflow check. This bounds the work regardless of how much zero-padding the input carries — there is no CPU-exhaustion vector on padded input — and rejects any value above the 64-bit ceiling with `IdOverflowError`.

## Why no version byte

Unlike ULID or TypeID, HybridId doesn't embed a version identifier in the ID:

- Every character is precious at 16–24 chars — a version byte costs ~6 bits of entropy.
- Profile detection works by length (16/20/24 for built-in profiles).
- Breaking format changes get a new major version, not a new byte.

## Blind mode HMAC (SHA-384)

- **Input**: `writeBigUInt64BE(timestamp)` (big-endian 64-bit) concatenated with the node bytes.
- **Key**: `randomBytes(32)` generated once per instance (or a persistent value via `blindSecret`).
- **Algorithm**: `createHmac('sha384', key)`.
- **Output**: per-character derivation from 16-bit pairs of HMAC bytes, each `% 62`, for `ts + node` characters.

The per-character `% 62` on 16-bit values introduces ~0.0014% modulo bias — acceptable, because the HMAC output is for privacy (making timestamps unextractable), not for cryptographic key material. SHA-384 mirrors the PHP implementation for spec parity.

## UUID conversion

UUID conversion is the one place this port is **byte-exact** with PHP — it targets the RFC 9562 wire format, so both implementations must agree bit-for-bit. The 128-bit packing uses `BigInt` with 60/58-bit shifts and masks; the PHP-generated golden vectors are pinned in the test suite to guard against shift/mask drift. Reconstruction wraps the internal `encodeBase62` so an over-capacity UUID surfaces as a friendly `InvalidIdError` rather than leaking the internal overflow error.

## Prefix design

Stripe convention: `{type}_{id}`. Constraints:

- 1–8 lowercase alphanumeric characters, starting with a letter.
- Separator: a single `_`.
- IDs with multiple underscores in the body are rejected by `stripPrefix()`.

Prefixes are metadata, not part of the ID body. All comparison, extraction, and UUID-conversion functions strip the prefix before operating.

## Build & types

The package is built with `tsup` into dual ESM (`.js`) + CJS (`.cjs`) bundles plus bundled declaration files (`.d.ts` / `.d.cts`), so it works under both `import` and `require` with full types. Source targets Node 22+ and is written in strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
