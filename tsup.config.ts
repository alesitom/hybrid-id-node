import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'bin/hybrid-id.ts',
  },
  format: ['esm', 'cjs'],
  dts: { entry: { index: 'src/index.ts' } },
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  shims: true,
});
