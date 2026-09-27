import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'bin/hybrid-id.ts',
  },
  format: ['esm', 'cjs'],
  dts: {
    entry: { index: 'src/index.ts' },
    // tsup's dts build sets baseUrl itself, which TS 6 flags as deprecated.
    compilerOptions: { ignoreDeprecations: '6.0' },
  },
  clean: true,
  sourcemap: true,
  target: 'node22',
  splitting: false,
  shims: true,
});
