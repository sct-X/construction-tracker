/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chosen at build time from the Vite mode (see vite.config.ts). */
  readonly VITE_DATA: 'mock' | 'api';
}
