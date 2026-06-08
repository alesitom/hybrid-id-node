# Database Guide

HybridId-specific database patterns beyond the basics in the README.

## Time-range queries

Use `minForTimestamp()` / `maxForTimestamp()` (or the `Date` variants) to query by creation time using the primary-key index directly — no separate `created_at` column needed.

```ts
import { minForDate, maxForDate } from 'hybrid-id';

const min = minForDate(new Date('2026-01-01'));
const max = maxForDate(new Date('2026-02-01'));
```

These produce boundary IDs: `min` fills node+random with `0` (lowest base62), `max` with `z` (highest).

```sql
-- All orders in January 2026, scanning the clustered PK index
SELECT * FROM orders
WHERE id >= $1 AND id <= $2
ORDER BY id;
```

Faster than filtering a `created_at` column because it scans the B-tree directly without a secondary-index lookup.

### Cursor-based pagination

```sql
SELECT * FROM orders
WHERE id > $1   -- last seen id
ORDER BY id
LIMIT 20;
```

No offset needed. Efficient at any depth.

### Prefixed columns

If your table stores prefixed IDs, pass the prefix to the range helper so the bound matches:

```ts
const min = minForDate(new Date('2026-01-01'), 'standard', 'ord'); // 'ord_…000'
const max = maxForDate(new Date('2026-02-01'), 'standard', 'ord'); // 'ord_…zzz'
```

## NoSQL patterns

### MongoDB

HybridIds sort correctly as strings. Use as `_id` for natural time ordering:

```js
db.events.find({ _id: { $gte: minId, $lte: maxId } });
```

### DynamoDB

Use HybridId as the **sort key** for time-ordered queries within a partition:

```
Partition key: tenant_id
Sort key:      hybrid_id
```

Avoid using HybridId as the partition key directly — the time-sorted prefix creates write hotspots. If you must, prefix with a hash shard.

### Redis

Sorted sets with lexicographic range:

```
ZADD events 0 "0VBFDQz4A1Rtntu09sbf"
ZRANGEBYLEX events "[0VBFDQz4" "[0VBFDQz5"
```

## Migration from UUID

### Approach

1. Add a `hybrid_id` column alongside the existing UUID column.
2. Dual-write: generate HybridIds for new records while keeping UUIDs.
3. Backfill existing records using `fromUUIDv4Format()` with original timestamps.
4. Switch reads to `hybrid_id`.
5. Drop the UUID column.

### Backfill

```ts
import { fromUUIDv4Format } from 'hybrid-id';

for (const record of records) {
  const hybridId = fromUUIDv4Format(
    record.uuid,
    'standard',
    record.createdAt.getTime(),
    'A1',
  );
  await record.update({ hybridId });
}
```

### When NOT to migrate

- External APIs that expect UUIDs — convert at the boundary instead (see below).
- Tables with heavy foreign-key dependencies where downtime is unacceptable.
- If you only need smaller IDs for new tables, just use HybridId there.

### Coexistence

For systems that need both formats, convert at the boundary:

```ts
import { toUUIDv8, stripPrefix } from 'hybrid-id';

// Store as HybridId internally
const id = gen.generate('usr');

// Expose as a UUID to external consumers (strip the prefix first)
const uuid = toUUIDv8(stripPrefix(id));
```
