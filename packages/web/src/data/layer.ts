/**
 * Picks the data layer. VITE_DATA is fixed at build time (vite.config.ts), so
 * only one implementation's chunk is ever loaded. Screens never import either
 * implementation: they get DashboardApi from DataProvider (useApi).
 */
import type { DashboardApi, DevControls } from '@ct/core';

export interface DataLayer {
  mode: 'mock' | 'api';
  api: DashboardApi;
  /** Dev bar controls: mock mode only. */
  dev: DevControls | null;
}

export async function loadDataLayer(): Promise<DataLayer> {
  if (import.meta.env.VITE_DATA === 'api') {
    const { HttpDashboardApi } = await import('./http');
    return { mode: 'api', api: new HttpDashboardApi(), dev: null };
  }
  const { createBrowserMock } = await import('./mock');
  const { api, dev } = createBrowserMock();
  return { mode: 'mock', api, dev };
}
