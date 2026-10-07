import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ct/core': src('core'),
      '@ct/llm': src('llm'),
    },
  },
  test: {
    name: 'eval',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
