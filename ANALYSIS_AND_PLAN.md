# Hybrid-ID para Node.js — Plan de Migración

> Puerto de [`alesitom/hybrid-id`](https://github.com/alesitom/hybrid-id) (PHP, v4.4.0) a TypeScript/Node.
> Referencia del código fuente PHP: `~/Documents/dev-sources/projects/hybrid-id`.

## 0. Decisión de compatibilidad (define todo el alcance)

**Objetivo: spec parity (niveles 1 + 2). NO byte-exact parity.**

| Nivel | Qué garantiza | ¿Lo hacemos? |
|---|---|---|
| 1. Formato/spec | Mismo alfabeto base62, largos (16/20/24), layout `ts+node+random`, reglas de prefijo, dimensionado de columna | **Sí** |
| 2. Parseo | Un ID **no-blind** generado en PHP se `parse()` en Node y viceversa (decodificación determinística) | **Sí** (sale gratis con el nivel 1) |
| 3. Byte-exact | Mismos inputs → mismos bytes en ambos lenguajes; golden vectors desde PHP como gate de CI | **No** |

**Implicancias:**
- Testeamos contra **el spec**, no contra los bytes que emite PHP. No hay fixtures "golden desde PHP" como gate.
- **Blind mode**: implementamos el mismo algoritmo (HMAC-SHA384, mismo layout) para tener un solo spec documentado, pero NO se gatea byte-a-byte contra PHP. Un ID blind es opaco por diseño: nadie lo lee cross-stack, así que la igualdad bit a bit no le sirve a nadie. Lo que importa es que el **formato** (largo, charset) sea idéntico.
- **UUID interop se mantiene**: no es interop PHP↔Node, es interop con el ecosistema UUID (RFC 9562, columnas `uuid` de Postgres, otros servicios). Valioso por sí solo.

---

## 1. Correcciones al plan original (Gemini)

El plan anterior subestimaba ~70% de la superficie y tenía errores que romperían el nivel 1/2:

1. **Blind mode usa SHA-384, NO SHA-256.** (`HybridIdGenerator.php:870`). El plan decía `createHmac('sha256')`.
2. **El layout del blind mode es específico:** `pack('J', $now)` (uint64 **big-endian**) `+` node bytes → HMAC-SHA384 → se leen **2 bytes por char opaco** con `(hi<<8 | lo) % 62`. (`HybridIdGenerator.php:867-877`).
3. **El node siempre son 2 chars base62 (3844 valores).** No varía "62 o 3844 según perfil".
4. **El criterio real no es "sub-millisecond"** sino el **monotonic drift guard** (`HybridIdGenerator.php:846`): si el reloj no avanzó, incrementa el ts; si la deriva supera `maxDriftMs` (default 10000) tira `IdOverflowException`.
5. Faltaban por completo: prefijos, `HybridId` (VO), `ProfileRegistry`/DI, interface `IdGenerator`, `MockHybridIdGenerator`, `UuidConverter`, CLI, y toda la familia parse/extract/compare/range/fromEnv.

---

## 2. Inventario de superficie (paridad PHP → Node)

| Componente PHP | LOC aprox | Equivalente Node | Notas |
|---|---|---|---|
| `HybridIdGenerator` | ~1120 | `HybridIdGenerator` (clase) | Core. Generación, parse, validación, range helpers. |
| `Profile` (enum) | ~40 | `Profile` (const obj / union) | `compact`/`standard`/`extended`. |
| `ProfileRegistry` + interface | ~130 | `ProfileRegistry` (clase) | Perfiles custom inyectables. `registerProfile` global queda deprecado → no portar. |
| `IdGenerator` (interface) | ~40 | `IdGenerator` (interface TS) | Para DI/testing del consumidor. |
| `HybridId` (value object) | ~70 | `HybridId` (clase, `toString`/`toJSON`) | Inmutable, parseado. |
| `MockHybridIdGenerator` | — | idem | Testing helper que exporta la lib. |
| `UuidConverter` | ~395 | `UuidConverter` | **Único que obliga BigInt** (128 bits). v8/v7/v4-format. |
| `Cli/*` + `bin/hybrid-id` | ~437 | `bin/` + `src/cli/` | CLI. Fase tardía / opcional v1. |
| `Exception/*` | ~varios | jerarquía de `Error` en TS | `HybridIdError` base + subclases. |

Tests PHP: ~4583 LOC en 10 archivos → buena fuente de **casos** (no de bytes) para replicar en Vitest.

---

## 3. Decisiones técnicas clave

### 3.1 BigInt: quirúrgico, no global
- **Timestamp ms** (~1.7×10¹²) y `decodeBase62` de los 8 chars de ts (máx 62⁸≈2.18×10¹⁴) entran en `Number` (seguro < 2⁵³≈9×10¹⁵). Se puede manejar como `number`.
- **`encodeBase62`/`decodeBase62` genéricos** los hacemos **BigInt-native** porque `UuidConverter` los llama con valores de hasta 62¹⁴ (random extended) y 128 bits. Exponemos wrappers `number` donde sea seguro.
- **`UuidConverter` entero en BigInt**: shifts de 60/58 bits, máscaras `0x0FFFFFFFFFFFFFFF`, ensamblado de 128 bits. `Number` no alcanza.
- **Decisión de diseño**: PHP tira `IdOverflowException` al pasar 64-bit. En JS con BigInt no pasa solo → replicamos ese techo explícitamente por simetría de comportamiento (nivel 1).

### 3.2 Mapeo de primitivas PHP → Node
| PHP | Node |
|---|---|
| `random_bytes(n)` | `crypto.randomBytes(n)` |
| `hash_hmac('sha384', $msg, $key, true)` | `crypto.createHmac('sha384', key).update(msg).digest()` |
| `pack('J', $n)` (uint64 BE) | `Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(n))` |
| `(int)(microtime(true)*1000)` | `Date.now()` |
| `intdiv`, `%` sobre int | BigInt o `Math.trunc` según contexto |

### 3.3 Rejection sampling (paridad estadística)
`randomBase62` con límite **248** (mayor múltiplo de 62 ≤ 255) para eliminar modulo bias. Se mantiene idéntico aunque no haya gate byte-exacto — es la garantía de distribución uniforme.

### 3.4 Concurrencia
PHP nota "no thread-safe, una instancia por worker". En Node el event loop es single-threaded, pero documentar el caso **worker_threads / cluster**: una instancia por worker o nodes explícitos distintos.

### 3.5 API idiomática (libertad que da spec parity)
- Empaquetar ESM + CJS (`tsup`).
- `fromEnv()` lee `process.env` (orden simple, sin el triple fallback de PHP).
- `HybridId` implementa `toJSON()`/`toString()` nativos.
- Errores: clase base `HybridIdError extends Error` + subclases, en vez de la jerarquía PHP exacta.

---

## 4. Stack

- **TypeScript 5.x** strict.
- **tsup** → bundle ESM + CJS + `.d.ts`.
- **Vitest** (TS nativo).
- **ESLint + Prettier**.
- **Zero runtime deps** (`node:crypto` alcanza).
- **GitHub Actions**: test + lint + typecheck en cada PR; release a npm.
- Repo nuevo (`hybrid-id-node`), no monorepo con el PHP.

---

## 5. Plan por fases (ordenado por dependencias)

### Fase 0 — Setup
- `npm init`, tsconfig strict, tsup (ESM+CJS), Vitest, ESLint/Prettier, estructura `src/`.
- CI básico (GitHub Actions): typecheck + lint + test.

### Fase 1 — Base62 + errores
- Jerarquía de errores (`HybridIdError` + subclases).
- `encodeBase62`/`decodeBase62` **BigInt-native**, con guardas de overflow (paridad de techo 64-bit).
- Tests de round-trip y bordes (0, overflow, chars inválidos).

### Fase 2 — Profiles + Registry
- `Profile` (compact/standard/extended) y `ProfileRegistry` (built-ins + custom, validaciones de largo/conflicto).
- `getByLength`, `register(name, random, node)`.

### Fase 3 — Generación core
- `HybridIdGenerator` constructor (profile, node, blind, maxIdLength, maxDriftMs, requireExplicitNode, registry).
- `generate()`, `compact()`, `standard()`, `extended()`, `generateBatch()`.
- **Monotonic drift guard** (port fiel de `:842-899`).
- `autoDetectNode()` (3844, con la misma nota de modulo bias).

### Fase 4 — Prefijos
- `applyPrefix`/`stripPrefix`/`extractPrefix`, validación (`/^[a-z][a-z0-9]*$/`, máx 8), separador `_`, manejo de múltiples underscores.

### Fase 5 — Blind mode
- HMAC-SHA384, `writeBigUInt64BE` + node bytes, lectura 2-bytes-por-char `(hi<<8|lo)%62`.
- Validación de `blindSecret` (≥32 bytes), generación de secret si falta.
- **Gate: formato (largo/charset) idéntico**, NO bytes vs PHP.

### Fase 6 — Parse / extract / metadata
- `parse()` (single-pass, todas las keys), `extractTimestamp/DateTime/Node/Prefix`, `detectProfile`, `isValid`, `validate()` (instancia).
- `compare()`, `recommendedColumnSize()`, `entropy()`.

### Fase 7 — Range helpers
- `minForTimestamp`/`maxForTimestamp`/`minForDate`/`maxForDate`.

### Fase 8 — Value Object
- `HybridId` (clase inmutable) con `fromString`, `toString`, `toJSON`.

### Fase 9 — UuidConverter (BigInt)
- v8 (`to`/`from`, lossless compact/standard), v7 (timestamp-preserving), v4-format (lossy).
- Rechazo de prefijos, validación de formato/versión/variante, `safeHexdec` con guarda de overflow.

### Fase 10 — fromEnv + DI helpers
- `fromEnv()` (`process.env`), `IdGenerator` interface, `MockHybridIdGenerator`.

### Fase 11 — CLI (opcional para v1)
- `bin/hybrid-id` + comandos equivalentes a `Cli/Application`.

### Fase 12 — Docs + release
- README, port de `docs/*` relevantes, nota explícita de **nivel de compatibilidad** (spec parity, no byte-exact).
- Publicación a npm + CI de release.

---

## 6. Estrategia de testing

- **Fuente de casos**: los ~4583 LOC de tests PHP → portar los *escenarios* (no los bytes esperados de generación aleatoria).
- **Spec invariants** (lo que sí se gatea):
  - Largos exactos por perfil; charset base62; orden cronológico; monotonía estricta intra-ms.
  - Round-trips `encode`/`decode`, `parse`/generación, UUID `to`/`from`.
  - **Cross-parse no-blind**: un ID de ejemplo *fijado a mano* con timestamp/node conocidos se parsea idéntico que en PHP (valida nivel 2 con un puñado de vectores, no como gate masivo).
  - Bordes: overflow, prefijos inválidos, drift excedido, secret corto.
- **Blind mode**: se valida formato y que el timestamp NO sea extraíble; no se compara contra bytes de PHP.
- Cobertura objetivo razonable, pero el criterio de "done" es **invariantes del spec**, no un número.

---

## 7. Decisiones tomadas

1. **Nombre del paquete npm**: `hybrid-id` (sin scope).
2. **CLI**: incluido en v1 (Fase 11 es parte del alcance inicial).
3. **`fromEnv` scope**: subset idiomático sobre `process.env` (sin el triple fallback `getenv`→`$_ENV`→`$_SERVER` de PHP). Vars: `HYBRID_ID_PROFILE`, `HYBRID_ID_NODE`, `HYBRID_ID_BLIND`, `HYBRID_ID_BLIND_SECRET`, `HYBRID_ID_MAX_LENGTH`, `HYBRID_ID_REQUIRE_NODE`.
4. **Versionado**: arranca en `1.0.0` (librería nueva).
