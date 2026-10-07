import { defineConfig } from 'vitest/config';

// One run across every workspace package; each package has its own vitest.config.ts.
export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
