import { resolve } from 'node:path';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  treeshake: true,
  clean: true,
  target: 'node22',
  alias: {
    '@': resolve(import.meta.dirname, 'src'),
  },
});
