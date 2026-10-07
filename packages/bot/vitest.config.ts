import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ct/core': src('core'),
      '@ct/llm': src('llm'),
      // Tests only: the bot runs against the server's SqliteStore and HTTP API.
      '@ct/server': src('server'),
      '@ct/bot': src('bot'),
    },
  },
  test: {
    name: 'bot',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
