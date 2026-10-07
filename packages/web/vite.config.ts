import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Modes (see docs/CONTRACTS.md, "Web"):
 *   development (`npm run dev`)        mock data in the browser, base /
 *   api-dev     (`npm run dev:api`)    HTTP API, /api proxied to CT_API (default http://localhost:4310)
 *   pages       (`npm run build:pages`) mock data, base /construction-tracker/, noindex, emits dist-pages/
 *   api         (`npm run build`)       HTTP API, base ./, emits dist/ (the server serves it at /)
 */
export type DataMode = 'mock' | 'api';

function dataModeFor(mode: string): DataMode {
  const fromEnv = process.env.VITE_DATA;
  if (fromEnv === 'mock' || fromEnv === 'api') return fromEnv;
  return mode === 'api' || mode === 'api-dev' ? 'api' : 'mock';
}

function noindex(): Plugin {
  return {
    name: 'ct-noindex',
    transformIndexHtml: (html) => html.replace('</title>', '</title>\n    <meta name="robots" content="noindex" />'),
  };
}

export default defineConfig(({ mode }) => {
  const data = dataModeFor(mode);
  return {
    base: mode === 'pages' ? '/construction-tracker/' : mode === 'api' ? './' : '/',
    plugins: [react(), ...(mode === 'pages' ? [noindex()] : [])],
    define: { 'import.meta.env.VITE_DATA': JSON.stringify(data) },
    resolve: {
      alias: { '@ct/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)) },
    },
    build: {
      outDir: mode === 'pages' ? 'dist-pages' : 'dist',
      emptyOutDir: true,
    },
    server: {
      proxy: data === 'api' ? { '/api': process.env.CT_API ?? 'http://localhost:4310' } : undefined,
    },
  };
});
