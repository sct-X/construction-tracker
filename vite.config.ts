/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from /construction-tracker/, so every asset
// URL, the manifest and the service worker scope hang off that base.
export default defineConfig({
  base: '/construction-tracker/',
  plugins: [react()],
  build: {
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
