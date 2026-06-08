import { describe, it, expect, afterEach } from 'vitest';
import { Application, BufferedOutput } from '../src/cli.js';

/** Run the CLI with a captured output buffer. */
function run(args: string[]): { code: number; out: BufferedOutput } {
  const out = new BufferedOutput();
  const code = new Application(out).run(args);
  return { code, out };
}

afterEach(() => {
  delete process.env.HYBRID_ID_BLIND_SECRET;
});

describe('generate', () => {
  it('emits one standard ID by default', () => {
    const { code, out } = run(['generate']);
    expect(code).toBe(0);
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]).toMatch(/^[0-9A-Za-z]{20}$/);
  });

  it('honors --count and --profile', () => {
    const { code, out } = run(['generate', '-p', 'compact', '-n', '5']);
    expect(code).toBe(0);
    expect(out.lines).toHaveLength(5);
    for (const id of out.lines) expect(id).toHaveLength(16);
  });

  it('applies a prefix', () => {
    const { out } = run(['generate', '--prefix', 'usr']);
    expect(out.lines[0]).toMatch(/^usr_[0-9A-Za-z]{20}$/);
  });

  it('accepts an explicit node', () => {
    const { code, out } = run(['generate', '--node', 'A1']);
    expect(code).toBe(0);
    expect(out.lines[0]?.slice(8, 10)).toBe('A1');
  });

  it('outputs JSON with --json (flag position independent)', () => {
    const { code, out } = run(['generate', '--json', '-n', '2']);
    expect(code).toBe(0);
    const parsed = JSON.parse(out.stdout) as { ids: string[] };
    expect(parsed.ids).toHaveLength(2);
  });

  it('rejects a non-integer count', () => {
    const { code, out } = run(['generate', '-n', 'abc']);
    expect(code).toBe(1);
    expect(out.stderr).toMatch(/valid integer/i);
  });

  it('rejects a count above 10,000', () => {
    const { code, out } = run(['generate', '-n', '10001']);
    expect(code).toBe(1);
    expect(out.stderr).toMatch(/exceed/i);
  });

  it('rejects a non-positive count', () => {
    expect(run(['generate', '-n', '0']).code).toBe(1);
  });

  it('rejects an unknown option and an unexpected argument', () => {
    expect(run(['generate', '--nope']).out.stderr).toMatch(/Unknown option/);
    expect(run(['generate', 'stray']).out.stderr).toMatch(/Unexpected argument/);
  });

  it('reports a missing flag value', () => {
    expect(run(['generate', '--profile']).out.stderr).toMatch(/Missing value/);
  });

  it('surfaces an invalid profile as an error (exit 1)', () => {
    const { code, out } = run(['generate', '-p', 'bogus']);
    expect(code).toBe(1);
    expect(out.stderr).not.toBe('');
  });

  it('errors in JSON shape when --json is set', () => {
    const { code, out } = run(['generate', '--json', '-n', 'x']);
    expect(code).toBe(1);
    expect(JSON.parse(out.stderr)).toHaveProperty('error');
  });
});

describe('generate --blind', () => {
  it('errors without a secret', () => {
    const { code, out } = run(['generate', '--blind']);
    expect(code).toBe(1);
    expect(out.stderr).toMatch(/HYBRID_ID_BLIND_SECRET/);
  });

  it('generates when the env secret is present', () => {
    process.env.HYBRID_ID_BLIND_SECRET = Buffer.alloc(32, 9).toString('base64');
    const { code, out } = run(['generate', '--blind']);
    expect(code).toBe(0);
    expect(out.lines[0]).toHaveLength(20);
  });
});

describe('inspect', () => {
  it('breaks an ID into fields', () => {
    const id = run(['generate', '--node', 'A1', '--prefix', 'usr']).out.lines[0] as string;
    const { code, out } = run(['inspect', id]);
    expect(code).toBe(0);
    expect(out.stdout).toContain('Profile:    standard');
    expect(out.stdout).toContain('Prefix:     usr');
    expect(out.stdout).toContain('Node:       A1');
  });

  it('emits structured JSON', () => {
    const id = run(['generate']).out.lines[0] as string;
    const { out } = run(['inspect', id, '--json']);
    const parsed = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(parsed).toMatchObject({ id, profile: 'standard', valid: true });
    expect(parsed.datetime).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}$/);
  });

  it('rejects an invalid ID', () => {
    const { code, out } = run(['inspect', 'not-an-id']);
    expect(code).toBe(1);
    expect(out.stderr).toMatch(/Invalid HybridId/);
  });

  it('requires an argument', () => {
    expect(run(['inspect']).out.stderr).toMatch(/Usage/);
  });

  it('sanitizes control characters in the error', () => {
    const { out } = run(['inspect', 'bad\x07\x1bid']);
    expect(out.stderr).toContain('badid');
    expect(out.stderr).not.toContain('\x07');
  });
});

describe('profiles', () => {
  it('lists the three built-ins as a table', () => {
    const { code, out } = run(['profiles']);
    expect(code).toBe(0);
    expect(out.stdout).toContain('compact');
    expect(out.stdout).toContain('standard');
    expect(out.stdout).toContain('extended');
  });

  it('lists them as JSON', () => {
    const { out } = run(['profiles', '--json']);
    const parsed = JSON.parse(out.stdout) as { profiles: { name: string }[] };
    expect(parsed.profiles.map((p) => p.name)).toEqual(['compact', 'standard', 'extended']);
  });
});

describe('help and dispatch', () => {
  it('defaults to help (exit 0) with no args', () => {
    const { code, out } = run([]);
    expect(code).toBe(0);
    expect(out.stdout).toContain('Usage:');
  });

  it('prints help for an unknown command (exit 1)', () => {
    const { code, out } = run(['wat']);
    expect(code).toBe(1);
    expect(out.stderr).toMatch(/Unknown command/);
    expect(out.stdout).toContain('Usage:');
  });

  it('reports the version', () => {
    const { code, out } = run(['--version']);
    expect(code).toBe(0);
    expect(out.stdout).toMatch(/^hybrid-id v\d+\.\d+\.\d+$/);
  });
});
