import { HybridIdGenerator } from './hybrid-id-generator.js';
import {
  detectProfile,
  profileConfig,
  extractTimestamp,
  extractDate,
  extractNode,
  entropy,
  profiles,
} from './metadata.js';
import { extractPrefix, stripPrefix } from './prefix.js';
import { HybridIdError } from './exception/errors.js';
import { VERSION } from './version.js';

/**
 * @internal CLI application. Not part of the library's public API — its output
 * format and flags may change between minor versions.
 */

/** Output sink. Console writes to stdout/stderr; the buffered impl captures for tests. */
export interface Output {
  writeln(line: string): void;
  error(line: string): void;
}

/** Writes straight to the process streams. */
export class ConsoleOutput implements Output {
  writeln(line: string): void {
    process.stdout.write(`${line}\n`);
  }
  error(line: string): void {
    process.stderr.write(`${line}\n`);
  }
}

/** Captures output in memory — used by the CLI test suite. */
export class BufferedOutput implements Output {
  readonly lines: string[] = [];
  readonly errors: string[] = [];
  writeln(line: string): void {
    this.lines.push(line);
  }
  error(line: string): void {
    this.errors.push(line);
  }
  /** Joined stdout, for assertions. */
  get stdout(): string {
    return this.lines.join('\n');
  }
  /** Joined stderr, for assertions. */
  get stderr(): string {
    return this.errors.join('\n');
  }
}

const MAX_INPUT_LENGTH = 256;
const MAX_COUNT = 10_000;

export class Application {
  private readonly output: Output;
  private json = false;

  constructor(output: Output = new ConsoleOutput()) {
    this.output = output;
  }

  /**
   * Run the CLI. `args` are the user arguments (no node/script entries) — i.e.
   * `process.argv.slice(2)`. Returns the process exit code.
   */
  run(args: string[]): number {
    // --json is global and may appear anywhere; strip it before dispatch.
    const stripped = args.filter((a) => a !== '--json');
    this.json = stripped.length !== args.length;

    const command = stripped[0] ?? 'help';
    const rest = stripped.slice(1);

    switch (command) {
      case 'generate':
        return this.commandGenerate(rest);
      case 'inspect':
        return this.commandInspect(rest);
      case 'profiles':
        return this.commandProfiles();
      case 'help':
      case '--help':
      case '-h':
        return this.commandHelp();
      case '--version':
      case '-v':
        this.output.writeln(`hybrid-id v${VERSION}`);
        return 0;
      default:
        return this.commandHelp(command);
    }
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  private commandGenerate(args: string[]): number {
    let profile = 'standard';
    let count = 1;
    let node: string | null = null;
    let prefix: string | null = null;
    let blind = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i] as string;
      switch (arg) {
        case '-p':
        case '--profile': {
          const value = args[++i];
          if (value === undefined) return this.emitError('Missing value for --profile');
          profile = value;
          break;
        }
        case '-n':
        case '--count': {
          const value = args[++i];
          if (value === undefined) return this.emitError('Missing value for --count');
          if (!/^-?\d+$/.test(value)) return this.emitError('Count must be a valid integer');
          count = Number.parseInt(value, 10);
          break;
        }
        case '--node': {
          const value = args[++i];
          if (value === undefined) return this.emitError('Missing value for --node');
          node = value;
          break;
        }
        case '--prefix': {
          const value = args[++i];
          if (value === undefined) return this.emitError('Missing value for --prefix');
          prefix = value;
          break;
        }
        case '--blind':
          blind = true;
          break;
        default: {
          const msg = arg.startsWith('-')
            ? `Unknown option: ${sanitize(arg)}`
            : `Unexpected argument: ${sanitize(arg)}`;
          return this.emitError(msg);
        }
      }
    }

    if (count < 1) return this.emitError('Count must be a positive integer');
    if (count > MAX_COUNT) return this.emitError('Count must not exceed 10,000');

    let blindSecret: Buffer | null = null;
    if (blind) {
      const secret = resolveBlindSecretFromEnv();
      if (secret === null) {
        return this.emitError('Blind mode requires the HYBRID_ID_BLIND_SECRET env var (base64)');
      }
      blindSecret = secret;
    }

    let gen: HybridIdGenerator;
    try {
      gen = new HybridIdGenerator({
        profile,
        node,
        requireExplicitNode: false,
        blind,
        blindSecret,
      });
    } catch (e) {
      return this.emitError(sanitize(errorMessage(e)));
    }

    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      try {
        ids.push(gen.generate(prefix));
      } catch (e) {
        return this.emitError(sanitize(errorMessage(e)));
      }
    }

    if (this.json) {
      this.output.writeln(JSON.stringify({ ids }));
    } else {
      for (const id of ids) this.output.writeln(id);
    }
    return 0;
  }

  private commandInspect(args: string[]): number {
    const id = args[0];
    if (id === undefined || id === '') {
      return this.emitError('Usage: hybrid-id inspect <id>');
    }

    const profile = detectProfile(id);
    if (profile === null) {
      return this.emitError(`Invalid HybridId: ${sanitize(id)}`);
    }

    const prefix = extractPrefix(id);
    const config = profileConfig(profile);
    const timestamp = extractTimestamp(id);
    const datetime = formatDateTime(extractDate(id));
    const node = extractNode(id);
    const rawId = stripPrefix(id);
    const random = rawId.slice(8 + config.node);
    const entropyBits = entropy(profile);

    if (this.json) {
      this.output.writeln(
        JSON.stringify({
          id,
          prefix,
          profile,
          length: config.length,
          timestamp,
          datetime,
          node,
          random,
          entropy_bits: entropyBits,
          valid: true,
        }),
      );
      return 0;
    }

    this.output.writeln('');
    this.output.writeln(`  ID:         ${id}`);
    if (prefix !== null) this.output.writeln(`  Prefix:     ${prefix}`);
    this.output.writeln(`  Profile:    ${profile} (${config.length} chars)`);
    this.output.writeln(`  Timestamp:  ${timestamp}`);
    this.output.writeln(`  DateTime:   ${datetime}`);
    if (node !== null) this.output.writeln(`  Node:       ${node}`);
    this.output.writeln(`  Random:     ${random}`);
    this.output.writeln(`  Entropy:    ${entropyBits} bits`);
    this.output.writeln('  Valid:      yes');
    this.output.writeln('');
    return 0;
  }

  private commandProfiles(): number {
    const rows = profiles().map((name) => {
      const config = profileConfig(name);
      return { name, ...config, entropy_bits: entropy(name) };
    });

    if (this.json) {
      this.output.writeln(
        JSON.stringify({
          profiles: rows.map((r) => ({
            name: r.name,
            length: r.length,
            ts: r.ts,
            node: r.node,
            random: r.random,
            entropy_bits: r.entropy_bits,
          })),
        }),
      );
      return 0;
    }

    const comparisons: Record<string, string> = {
      compact: '< UUID v7',
      standard: '~ UUID v7',
      extended: '> UUID v7',
    };

    this.output.writeln('');
    this.output.writeln('  Profile     Length   Structure              Random bits   vs UUID v7');
    this.output.writeln('  -------     ------   ---------              -----------   ----------');
    for (const r of rows) {
      const structure =
        r.node > 0 ? `${r.ts}ts + ${r.node}node + ${r.random}rand` : `${r.ts}ts + ${r.random}rand`;
      const cmp = comparisons[r.name] ?? 'custom';
      this.output.writeln(
        `  ${pad(r.name, 10)}  ${pad(String(r.length), 7)}  ${pad(structure, 21)}  ${pad(
          `${r.entropy_bits} bits`,
          12,
        )}  ${cmp}`,
      );
    }
    this.output.writeln('');
    return 0;
  }

  private commandHelp(unknown?: string): number {
    if (unknown !== undefined) {
      this.output.error(`Unknown command: ${sanitize(unknown)}`);
    }

    const lines = [
      'HybridId - Compact, time-sortable unique ID generator',
      '',
      'Usage:',
      '  hybrid-id generate [options]    Generate one or more IDs',
      '  hybrid-id inspect <id>          Inspect an existing ID',
      '  hybrid-id profiles              Show available profiles',
      '  hybrid-id help                  Show this help',
      '',
      'Generate options:',
      '  -p, --profile <name>   Profile: compact (16), standard (20), extended (24)',
      '  -n, --count <number>   Number of IDs to generate (default: 1)',
      '  --node <XX>            Node identifier (2 base62 chars)',
      '  --prefix <name>        Prefix for self-documenting IDs (e.g., usr, ord)',
      '  --blind                Generate using blind mode (requires HYBRID_ID_BLIND_SECRET)',
      '',
      'Global options:',
      '  --json                 Output in JSON format (generate, inspect, profiles)',
      '',
      'Examples:',
      '  hybrid-id generate',
      '  hybrid-id generate -p compact -n 10',
      '  hybrid-id generate -p extended --node A1',
      '  hybrid-id generate --prefix usr',
      '  hybrid-id inspect usr_0A1b2C3dX9YyZzWwQq12',
      '  hybrid-id generate --json -n 3',
      '',
    ];
    for (const line of lines) this.output.writeln(line);

    return unknown !== undefined ? 1 : 0;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /** Emit an error in the active format (text or JSON) and return exit code 1. */
  private emitError(message: string): number {
    if (this.json) {
      this.output.error(JSON.stringify({ error: message }));
    } else {
      this.output.error(message);
    }
    return 1;
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Strip control/non-ASCII chars and cap length, so untrusted input can't break output. */
function sanitize(input: string): string {
  // Keep only printable ASCII (space..tilde); drop control/non-ASCII bytes.
  const cleaned = input.replace(/[^ -~]/g, '');
  return cleaned.length > MAX_INPUT_LENGTH ? cleaned.slice(0, MAX_INPUT_LENGTH) : cleaned;
}

/** Right-pad to `width` with spaces (table formatting; never truncates). */
function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

/** Format a Date as `YYYY-MM-DD HH:MM:SS.mmm` in UTC (deterministic, tz-independent). */
function formatDateTime(date: Date): string {
  const p = (n: number, w = 2): string => String(n).padStart(w, '0');
  return (
    `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())} ` +
    `${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())}.` +
    `${p(date.getUTCMilliseconds(), 3)}`
  );
}

/** Resolve and validate HYBRID_ID_BLIND_SECRET (base64). Returns null when unset/empty. */
function resolveBlindSecretFromEnv(): Buffer | null {
  const raw = process.env.HYBRID_ID_BLIND_SECRET;
  if (raw === undefined || raw === '') return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) return null;
  const buf = Buffer.from(raw, 'base64');
  return buf.length > 0 ? buf : null;
}

/** Extract a clean message string from an unknown thrown value. */
function errorMessage(e: unknown): string {
  if (e instanceof HybridIdError || e instanceof Error) return e.message;
  return String(e);
}
