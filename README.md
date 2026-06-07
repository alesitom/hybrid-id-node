# hybrid-id

**Compact, time-sortable unique identifiers for Node.js**

A space-efficient alternative to UUID with configurable entropy profiles, Stripe-style
prefixes, and an instance-based API. Generate chronologically sortable, URL-safe
identifiers 33–56% smaller than canonical UUIDs — with zero runtime dependencies.

> Node port of [`alesitom/hybrid-id`](https://github.com/alesitom/hybrid-id) (PHP).
> **Compatibility: spec parity** — same format, layout and parsing as the PHP library
> (a non-blind ID generated in PHP can be parsed in Node and vice versa). It is **not**
> byte-exact across languages. See [`ANALYSIS_AND_PLAN.md`](ANALYSIS_AND_PLAN.md).

## Status

🚧 In development. The package scaffold (TypeScript, dual ESM/CJS build, tests, CI) is in
place; the core implementation is landing in phases per the plan.

## Development

```bash
npm install
npm test          # run the test suite
npm run typecheck # tsc --noEmit
npm run lint      # eslint + prettier
npm run build     # dual ESM/CJS bundle via tsup
```

## License

MIT
