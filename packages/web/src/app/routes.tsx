/**
 * The route table. Stage 4 adds job overview, program, step, waiting-on,
 * to-chase, shipments, photos, notes, design checklist and change history
 * here; Stage 5 adds the desktop-only Setup routes. A route with `nav` gets a
 * link in the shell (sidebar on desktop, bottom bar on a phone), in this order.
 */
import type { ReactElement } from 'react';
import { MondayScreen } from '../screens/Monday';
import { JobsScreen } from '../screens/Jobs';

export interface RouteDef {
  /** Hash path pattern; ":name" segments become params. */
  path: string;
  /** Used for the document title and the nav link. */
  title: string;
  nav?: boolean;
  render: (params: Record<string, string>) => ReactElement;
}

export const ROUTES: RouteDef[] = [
  { path: '/', title: 'Monday', nav: true, render: () => <MondayScreen /> },
  { path: '/jobs', title: 'Jobs', nav: true, render: () => <JobsScreen /> },
  // Stage 4: { path: '/jobs/:jobId', title: 'Job', render: ({ jobId }) => <JobOverviewScreen jobId={jobId!} /> },
  // Stage 4: { path: '/waiting', title: 'Waiting on', nav: true, render: () => <WaitingOnScreen /> },
  // Stage 5: { path: '/setup', title: 'Setup', nav: true, render: () => <SetupScreen /> },
];
