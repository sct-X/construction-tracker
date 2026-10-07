import { test, type Page, type TestInfo } from '@playwright/test';

/** Skips the api project while the root has no `e2e:server` script (see playwright.config.ts). */
export function skipIfPending(info: TestInfo): void {
  const meta = info.project.metadata as { pending?: boolean };
  test.skip(!!meta.pending, 'api project pending: root package.json has no e2e:server script yet');
}

export function isMock(info: TestInfo): boolean {
  return (info.project.metadata as { dataMode?: string }).dataMode === 'mock';
}

export async function openMonday(page: Page): Promise<void> {
  await page.goto('./#/');
  await page.getByTestId('build-row-park-rd').waitFor();
}

export function buildRow(page: Page, jobId: string) {
  return page.getByTestId(`build-row-${jobId}`);
}
