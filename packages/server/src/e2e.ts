/** Defaults for `npm run e2e:server` (Playwright local-API mode). */
import { join } from 'node:path';

export const E2E_DEFAULT_PORT = 4310;
export const E2E_DEFAULT_TODAY = '2026-09-17';

/** The e2e server's DATA_DIR: "<os tmp>/ct-e2e-<port>", wiped on every start. */
export function e2eDataDir(port: number = E2E_DEFAULT_PORT, tmp: string): string {
  return join(tmp, `ct-e2e-${port}`);
}
