import type { Page, TestInfo } from '@playwright/test';

export function isMock(info: TestInfo): boolean {
  return (info.project.metadata as { dataMode?: string }).dataMode === 'mock';
}

/** The home screen: v1's Overview (timing first). */
export async function openOverview(page: Page): Promise<void> {
  await page.goto('./#/');
  await page.getByTestId('overview-card-park-rd').waitFor();
}

export function card(page: Page, jobId: string) {
  return page.getByTestId(`overview-card-${jobId}`);
}
