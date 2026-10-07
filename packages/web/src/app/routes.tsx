/**
 * The route table. One row per screen; the shell builds every menu from it.
 *
 * - `nav: true` on a path with no params: a main link (rail on desktop, bottom bar on a phone), in table order.
 * - `nav: true` on a path under `/jobs/:jobId/...`: a job tab, shown in the job bar above every job screen, in
 *   table order. `kinds` limits a tab to build or design jobs (default both). `tab` overrides the tab label.
 * - Any path starting `/jobs/:jobId` gets the job bar (job name, job switcher, tabs). `parent` names the tab a
 *   deeper page belongs to (step detail sits under Program).
 * Stage 4 screens add rows here; Stage 5 adds the desktop-only Setup routes.
 */
import { lazy, type ReactElement } from 'react';
import type { JobKind } from '@ct/core';
// Monday is the landing screen and loads with the shell; every other screen is its own chunk.
import { MondayScreen } from '../screens/Monday';
const JobsScreen = lazy(() => import('../screens/Jobs').then((m) => ({ default: m.JobsScreen })));
const JobOverviewScreen = lazy(() => import('../screens/JobOverview').then((m) => ({ default: m.JobOverviewScreen })));
const ProgramScreen = lazy(() => import('../screens/Program').then((m) => ({ default: m.ProgramScreen })));
const StepDetailScreen = lazy(() => import('../screens/StepDetail').then((m) => ({ default: m.StepDetailScreen })));
const DesignChecklistScreen = lazy(() => import('../screens/DesignChecklist').then((m) => ({ default: m.DesignChecklistScreen })));
// Stage 4b
const WaitingOnScreen = lazy(() => import('../screens/WaitingOn').then((m) => ({ default: m.WaitingOnScreen })));
const ToChaseScreen = lazy(() => import('../screens/ToChase').then((m) => ({ default: m.ToChaseScreen })));
const ShipmentsScreen = lazy(() => import('../screens/Shipments').then((m) => ({ default: m.ShipmentsScreen })));
const HistoryScreen = lazy(() => import('../screens/History').then((m) => ({ default: m.HistoryScreen })));
const PhotosScreen = lazy(() => import('../screens/Photos').then((m) => ({ default: m.PhotosScreen })));
const NotesScreen = lazy(() => import('../screens/Notes').then((m) => ({ default: m.NotesScreen })));

export interface RouteDef {
  /** Hash path pattern; ":name" segments become params. */
  path: string;
  /** Used for the document title and the nav link. */
  title: string;
  nav?: boolean;
  /** Job tabs only: the job kinds that show this tab. Default: both. */
  kinds?: JobKind[];
  /** Job tabs only: the tab label, when it differs from `title`. */
  tab?: string;
  /** A page under a job tab: that tab's path (e.g. step detail -> '/jobs/:jobId/program'). */
  parent?: string;
  render: (params: Record<string, string>) => ReactElement;
}

export const ROUTES: RouteDef[] = [
  // Main links
  { path: '/', title: 'Monday', nav: true, render: () => <MondayScreen /> },
  { path: '/jobs', title: 'Jobs', nav: true, render: () => <JobsScreen /> },
  // Main links, Stage 4 (shipments, to chase, change history): add here.
  { path: '/waiting', title: 'Waiting on', nav: true, render: () => <WaitingOnScreen /> },
  { path: '/chase', title: 'To chase', nav: true, render: () => <ToChaseScreen /> },
  { path: '/shipments', title: 'Shipments', nav: true, render: () => <ShipmentsScreen /> },
  { path: '/history', title: 'Changes', nav: true, render: () => <HistoryScreen /> },
  { path: '/history/:jobId', title: 'Changes', render: ({ jobId }) => <HistoryScreen key={jobId} jobId={jobId!} /> },

  // Job tabs
  { path: '/jobs/:jobId', title: 'Overview', nav: true, kinds: ['build'], render: ({ jobId }) => <JobOverviewScreen jobId={jobId!} /> },
  { path: '/jobs/:jobId/checklist', title: 'Checklist', nav: true, kinds: ['design'], render: ({ jobId }) => <DesignChecklistScreen jobId={jobId!} /> },
  { path: '/jobs/:jobId/program', title: 'Program', nav: true, kinds: ['build'], render: ({ jobId }) => <ProgramScreen jobId={jobId!} /> },
  // Job tabs, Stage 4 (waiting on, photos, notes): add here.
  { path: '/jobs/:jobId/waiting', title: 'Waiting on', nav: true, render: ({ jobId }) => <WaitingOnScreen key={jobId} jobId={jobId!} /> },
  { path: '/jobs/:jobId/photos', title: 'Photos', nav: true, kinds: ['build'], render: ({ jobId }) => <PhotosScreen key={jobId} jobId={jobId!} /> },
  { path: '/jobs/:jobId/notes', title: 'Daily notes', tab: 'Notes', nav: true, kinds: ['build'], render: ({ jobId }) => <NotesScreen key={jobId} jobId={jobId!} /> },

  // Pages under a job tab
  {
    path: '/jobs/:jobId/steps/:stepId',
    title: 'Step',
    parent: '/jobs/:jobId/program',
    render: ({ jobId, stepId }) => <StepDetailScreen jobId={jobId!} stepId={stepId!} />,
  },
];
