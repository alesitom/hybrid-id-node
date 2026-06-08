# CLI Reference

A `hybrid-id` binary ships with the package. Run it via `npx` (or directly when the package is installed and its `.bin` is on `PATH`):

```bash
npx hybrid-id <command> [options]
```

## Global options

| Flag | Description |
|---|---|
| `--json` | Emit machine-readable JSON from `generate`, `inspect`, and `profiles` (including errors). May appear anywhere in the arguments. Useful for scripting and CI. |
| `--version`, `-v` | Print the package version. |

## Commands

### `generate`

Generate one or more IDs.

| Flag | Short | Description | Default |
|---|---|---|---|
| `--profile <name>` | `-p` | compact, standard, extended | standard |
| `--count <number>` | `-n` | Number of IDs (1–10,000) | 1 |
| `--node <XX>` | | 2 base62 chars | auto-detected |
| `--prefix <name>` | | Stripe-style prefix | none |
| `--blind` | | Enable blind mode (needs `HYBRID_ID_BLIND_SECRET`) | false |

```bash
npx hybrid-id generate
npx hybrid-id generate -p compact -n 10
npx hybrid-id generate -p extended --node A1 --prefix txn
npx hybrid-id generate --json -n 3
# {"ids":["…","…","…"]}
```

> `--blind` reads the base64 `HYBRID_ID_BLIND_SECRET` from the environment so blind IDs are reproducible. It errors if the variable is absent. Load it however you like — `node --env-file=.env` (Node ≥ 20.6) or your shell:
>
> ```bash
> export HYBRID_ID_BLIND_SECRET="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))")"
> npx hybrid-id generate --blind
> ```

### `inspect`

Break an existing ID into its components.

```bash
npx hybrid-id inspect usr_0VBFDQz4A1Rtntu09sbf
```

```
  ID:         usr_0VBFDQz4A1Rtntu09sbf
  Prefix:     usr
  Profile:    standard (20 chars)
  Timestamp:  1739750400000
  DateTime:   2026-02-17 00:00:00.000
  Node:       A1
  Random:     Rtntu09sbf
  Entropy:    59.5 bits
  Valid:      yes
```

`DateTime` is formatted in UTC. Add `--json` for a structured object.

### `profiles`

List available profiles.

```bash
npx hybrid-id profiles
```

```
  Profile     Length   Structure              Random bits   vs UUID v7
  -------     ------   ---------              -----------   ----------
  compact     16       8ts + 8rand            47.6 bits     < UUID v7
  standard    20       8ts + 2node + 10rand   59.5 bits     ~ UUID v7
  extended    24       8ts + 2node + 14rand   83.4 bits     > UUID v7
```

### `help`

```bash
npx hybrid-id help
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Error (invalid input, unknown command, generation failure) |
