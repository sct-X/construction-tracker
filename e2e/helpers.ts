import type { Page, TestInfo } from '@playwright/test';

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
