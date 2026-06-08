# Dependency Injection & Testing

## The `IdGenerator` interface

Type against `IdGenerator` so production code never hard-depends on the concrete generator:

```ts
interface IdGenerator {
  generate(prefix?: string | null): string;
  generateBatch(count: number, prefix?: string | null): string[];
  bodyLength(): number;
  validate(id: string, expectedPrefix?: string | null): boolean;
}
```

Both `HybridIdGenerator` and `MockHybridIdGenerator` implement it.

```ts
import { type IdGenerator } from 'hybrid-id';

class OrderService {
  constructor(private readonly ids: IdGenerator) {}

  createOrder(data: OrderData): Order {
    return new Order(this.ids.generate('ord'), data);
  }
}
```

Wire the real generator at the composition root:

```ts
import { HybridIdGenerator } from 'hybrid-id';

const ids = HybridIdGenerator.fromEnv();
const orders = new OrderService(ids);
```

## ProfileRegistry injection

Custom profiles are injected via a `ProfileRegistry` — there is no global mutable profile state, which keeps things safe for long-lived servers and multi-tenant setups:

```ts
import { ProfileRegistry, HybridIdGenerator } from 'hybrid-id';

const registry = ProfileRegistry.withDefaults();
registry.register('medium', 12); // 8ts + 2node + 12rand = 22 chars

const gen = new HybridIdGenerator({ profile: 'medium', node: 'A1', registry });
```

## Testing

### MockHybridIdGenerator

A drop-in `IdGenerator` for tests. It runs in two modes.

**Sequential** — returns the queued IDs in order, throwing when exhausted:

```ts
import { MockHybridIdGenerator } from 'hybrid-id';

const mock = new MockHybridIdGenerator(['ord_test001', 'ord_test002']);
mock.generate();   // 'ord_test001'
mock.generate();   // 'ord_test002'
mock.remaining();  // 0
mock.reset();      // rewinds to the start
```

**Callback** — never exhausts; computes each ID (the requested prefix is passed through):

```ts
let n = 0;
const mock = MockHybridIdGenerator.withCallback((prefix) => {
  const body = `id${n++}`;
  return prefix ? `${prefix}_${body}` : body;
});
```

If you call `generate('usr')` in sequential mode, the mock asserts the queued ID actually starts with `usr_` — so your test fails loudly on a prefix mismatch instead of passing a wrong fixture. `validate()` uses the real format rules.

### Multi-node isolation

```ts
const genA = new HybridIdGenerator({ node: 'A1' });
const genB = new HybridIdGenerator({ node: 'B2' });
// IDs from different nodes never collide on the node portion
```

### Framework notes

This package is framework-agnostic. In a DI container (NestJS, Awilix, tsyringe, …) register `HybridIdGenerator.fromEnv()` as a singleton bound to the `IdGenerator` token, and inject `MockHybridIdGenerator` in tests. Because the generator tracks a monotonic counter, share **one** instance per node rather than constructing a new one per request.
