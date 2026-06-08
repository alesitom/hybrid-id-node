# UUID Interoperability

Convert between HybridId and RFC 9562 UUIDs. These conversions target the UUID **wire format**, so they are byte-exact and interoperable with any RFC 9562 implementation — including the PHP `hybrid-id` package, whose output they match byte-for-byte (pinned as golden vectors in the test suite).

```ts
import { toUUIDv8, fromUUIDv8, toUUIDv7, fromUUIDv7, toUUIDv4Format, fromUUIDv4Format } from 'hybrid-id';
```

## Overview

| Function | Version | Lossless | Profiles | Notes |
|---|---|---|---|---|
| `toUUIDv8()` / `fromUUIDv8()` | v8 | Yes | compact, standard | Profile auto-detected on decode |
| `toUUIDv7()` / `fromUUIDv7()` | v7 | No | compact, standard | Timestamp-preserving, needs profile hint |
| `toUUIDv4Format()` / `fromUUIDv4Format()` | v4 structure | No | compact, standard | Lossy, NOT a true UUIDv4 |

All `to*` functions reject prefixed IDs. Strip the prefix first and track it separately. The **extended** profile is not supported (its random portion exceeds UUID capacity) and throws `InvalidProfileError`.

## UUIDv8 (lossless)

RFC 9562 UUIDv8 provides 122 custom bits. HybridId packs timestamp, node, profile index, and random into them for a lossless round-trip.

```ts
const uuid = toUUIDv8('0VBFDQz4A1Rtntu09sbf');
// '019c5e5b-f71a-826d-953d-cf368e401def'

fromUUIDv8(uuid);
// '0VBFDQz4A1Rtntu09sbf' (identical — profile auto-detected)
```

### Bit layout

```
Bits   0–47   timestamp (48 bits, same position as UUIDv7)
Bits  48–51   version (1000 = v8)
Bits  52–63   node value (12 bits, encodes 62^2 = 3844 values)
Bits  64–65   variant (10 = RFC 4122)
Bits  66–67   profile index (00 = compact, 01 = standard)
Bits  68–127  random (60 bits)
```

## UUIDv7 (timestamp-preserving)

Preserves the millisecond timestamp in the standard UUIDv7 position. Node and random are packed into the remaining bits. Not lossless — requires a profile hint on decode (default `'standard'`).

```ts
const uuid = toUUIDv7('0VBFDQz4A1Rtntu09sbf');

fromUUIDv7(uuid, 'standard');
fromUUIDv7(uuid, 'compact');
```

Timestamps are directly comparable with other UUIDv7 implementations since they occupy the same bit positions.

## UUIDv4 format (lossy)

Packs HybridId data into the UUID v4 structure (version=4, variant=10xx). The output is **not** a true UUIDv4 — it is deterministically derived, not 122 random bits.

```ts
const uuid = toUUIDv4Format('0VBFDQz4A1Rtntu09sbf');

fromUUIDv4Format(uuid, 'standard', originalTimestampMs, 'A1');
```

`fromUUIDv4Format(uuid, profile?, timestampMs?, node?)`:

- `timestampMs` — the original creation time. If omitted (`null`), the current time is used, so the result appears created "now". Must be a non-negative integer or `null`.
- `node` — the original 2-char node. If omitted, it is reconstructed from the UUID bytes.

Use this only for systems that strictly require v4-formatted UUIDs. Prefer `toUUIDv8()` for new integrations.

## Prefixed IDs

All `to*` functions reject prefixed IDs to prevent silent prefix loss:

```ts
import { extractPrefix, stripPrefix, toUUIDv8 } from 'hybrid-id';

toUUIDv8('usr_0VBFDQz4A1Rtntu09sbf'); // throws InvalidIdError

const prefix = extractPrefix(id);     // 'usr' — track it yourself
const uuid = toUUIDv8(stripPrefix(id));
```

## Blind mode

UUID conversion technically works on blind IDs (the characters are valid base62), but the encoded timestamp and node are HMAC-derived — they do not represent real time or identity, and a round-trip won't reproduce the original ID from a different generator instance.

## Migration from UUID

When migrating from UUIDv4, use `fromUUIDv4Format()` to convert existing records, supplying the creation timestamp when known:

```ts
const hybridId = fromUUIDv4Format(existingUuid, 'standard', createdAtMs, 'A1');
```

See the [Database Guide](database.md#migration-from-uuid) for the full strategy.
