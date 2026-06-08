# Blind Mode

HMAC-hash the timestamp and node with a per-instance secret, making creation time and node identity unextractable from the ID.

## Why

HybridId timestamps are predictable by design (same as UUIDv7). Sometimes you don't want observers to know when an ID was created — user-facing IDs where registration timing could be exploited, or privacy-sensitive contexts where creation time is PII.

## Usage

```ts
const gen = new HybridIdGenerator({ node: 'A1', blind: true });
gen.generate('usr'); // 'usr_<opaque 20 chars>'

// Works with all profiles
new HybridIdGenerator({ profile: 'compact', blind: true });
new HybridIdGenerator({ profile: 'extended', node: 'A1', blind: true });

// From environment (HYBRID_ID_BLIND=1, HYBRID_ID_BLIND_SECRET=…)
HybridIdGenerator.fromEnv();
```

```bash
# CLI (reads HYBRID_ID_BLIND_SECRET from the environment)
npx hybrid-id generate --blind
```

## How it works

When no `blindSecret` is provided, the constructor generates a 32-byte secret via `crypto.randomBytes(32)`. When one is provided, that value is used as the HMAC key. During generation:

1. Pack the monotonic timestamp (big-endian uint64) + node into a buffer.
2. HMAC-SHA384 with the per-instance secret.
3. Derive base62 characters from the HMAC output (replacing the timestamp+node portion).
4. Append the random portion (unchanged).

```
Normal:  [timestamp][node][random]
Blind:   [ HMAC(ts+node) ][random]
```

Same length, same alphabet. An observer cannot tell whether an ID is blind.

## Persistent secrets

By default the secret is **ephemeral** — generated fresh on each constructor call. IDs from two separate instances are blinded with different secrets and share no mapping.

Pass a persistent secret to keep the mapping consistent across instances or restarts. The `blindSecret` option accepts a `Buffer`/`Uint8Array` of at least 32 bytes, used directly as the HMAC-SHA384 key:

```ts
import { randomBytes } from 'node:crypto';

// Generate once and store securely
const secret = randomBytes(32);

const gen = new HybridIdGenerator({ node: 'A1', blind: true, blindSecret: secret });
```

### Via environment variable

`fromEnv()` reads `HYBRID_ID_BLIND_SECRET` as a **base64-encoded** secret:

```bash
# Generate and encode a secret once
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
# Store the output in your secret manager or .env
```

```ini
HYBRID_ID_BLIND=1
HYBRID_ID_BLIND_SECRET=base64encodedvalue...
```

```ts
// Picks up HYBRID_ID_BLIND and HYBRID_ID_BLIND_SECRET automatically
const gen = HybridIdGenerator.fromEnv();
```

`fromEnv()` throws `InvalidIdError` if `HYBRID_ID_BLIND_SECRET` is set but is not valid base64.

> ⚠️ Treat the secret like a credential and keep it server-side. **Never** expose it through a client-bundled env (e.g. a `VITE_`-prefixed variable) — those ship to the browser.

### Security considerations

- Store the secret with the same care as a signing key.
- There is no built-in key rotation. Rotating changes the blinding output for future IDs but does not re-blind existing ones.
- Losing the secret does not expose historical IDs; it only means you can no longer reproduce the same blinded output for a given input.
- A persistent secret does not add cryptographic authentication. Blind mode is a privacy feature, not a MAC scheme.

## What works

- `isValid()`, `gen.validate()`, `detectProfile()` — all work normally.
- Same length, same prefix support, same collision resistance.
- `generateBatch()` works.
- UUID conversion technically works (but the encoded values are opaque).

## What changes

- **No chronological sorting** — HMAC output is not lexicographically time-sortable.
- **Ordering leak** — sequential blind IDs from the *same* instance reveal relative generation order (not absolute time), because the HMAC input is monotonically increasing.
- `extractTimestamp()` returns an HMAC-derived value, not real time.
- `minForTimestamp()` / `maxForTimestamp()` won't match blind IDs.
- `extractNode()` returns HMAC-derived characters.
- **Secret is ephemeral by default** — pass `blindSecret` or set `HYBRID_ID_BLIND_SECRET` to make the mapping persistent.

## Node handling

Blind mode bypasses `requireExplicitNode`:

```ts
// Both valid — no NodeRequiredError
new HybridIdGenerator({ blind: true });
new HybridIdGenerator({ node: 'A1', blind: true });
```

If a node is provided, it's folded into the HMAC input. If not, one is auto-detected silently and used only as HMAC input — it never appears in the output.

## When NOT to use

- **Not for security tokens** — entropy is unchanged. Use `crypto.randomBytes()` with 128+ bits for tokens, API keys, session IDs.
- **When you need sorting** — blind IDs aren't chronologically sortable.
- **When you need range queries** — `minForTimestamp()` / `maxForTimestamp()` won't work.
