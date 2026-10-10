/**
 * The route table. One row per screen; the shell builds every menu from it.
 *
 * Main links (paths with no params, `nav: true`):
 * - `group: 'main'` (default) sits in the desktop sidebar's main list; `group: 'setup'` under its "Setup" header.
 * - `icon` is the sidebar and tab bar glyph (shell/icons.tsx).
 * - `phone: 'tab'` puts it in the phone's floating tab bar (Overview and Waiting on only, Dom's brief);
 *   `phone: 'tool'` makes it a 44px glyph at the right of the phone nav bar (Changes). Otherwise desktop only.
 * - `desktopOnly` routes (Setup) show a one-line message on a phone (SetupFrame does that).
 * Job tabs (`nav: true` under `/jobs/:jobId`): in table order, `kinds` limits a tab to build or design jobs,
 * `tab` overrides the label. Every `/jobs/:jobId...` route gets the job header from the shell (back link, the
 * job switcher as the page's h1, the tabs). `parent` names the tab a deeper page sits under.
 * `redirect` rows forward old links (#/jobs, #/chase, #/monday).
 */
import { lazy, useEffect, type ReactElement } from 'react';
import type { JobKind } from '@ct/core';
import type { IconName } from '../shell/icons';
// The Overview is the landing screen and loads with the shell; every other screen is its own chunk.
import { OverviewScreen } from '../screens/Overview';
const JobOverviewScreen = lazy(() => import('../screens/JobOverview').then((m) => ({ default: m.JobOverviewScreen })));
const ProgramScreen = lazy(() => import('../screens/Program').then((m) => ({ default: m.ProgramScreen })));
const StepDetailScreen = lazy(() => import('../screens/StepDetail').then((m) => ({ default: m.StepDetailScreen })));
const DesignChecklistScreen = lazy(() => import('../screens/DesignChecklist').then((m) => ({ default: m.DesignChecklistScreen })));
const WaitingOnScreen = lazy(() => import('../screens/WaitingOn').then((m) => ({ default: m.WaitingOnScreen })));
const ShipmentsScreen = lazy(() => import('../screens/Shipments').then((m) => ({ default: m.ShipmentsScreen })));
const HistoryScreen = lazy(() => import('../screens/History').then((m) => ({ default: m.HistoryScreen })));
const PhotosScreen = lazy(() => import('../screens/Photos').then((m) => ({ default: m.PhotosScreen })));
const NotesScreen = lazy(() => import('../screens/Notes').then((m) => ({ default: m.NotesScreen })));
// The desktop-only Setup area
const SetupNewJobScreen = lazy(() => import('../screens/SetupNewJob').then((m) => ({ default: m.SetupNewJobScreen })));
const SetupProgramsScreen = lazy(() => import('../screens/SetupPrograms').then((m) => ({ default: m.SetupProgramsScreen })));
const SetupProgramEditorScreen = lazy(() => import('../screens/SetupProgramEditor').then((m) => ({ default: m.SetupProgramEditorScreen })));
const SetupTemplatesScreen = lazy(() => import('../screens/SetupTemplates').then((m) => ({ default: m.SetupTemplatesScreen })));
const SetupTradesScreen = lazy(() => import('../screens/SetupTrades').then((m) => ({ default: m.SetupTradesScreen })));

export interface RouteDef {
  /** Hash path pattern; ":name" segments become params. */
  path: string;
  /** Used for the document title and the nav link. */
  title: string;
  nav?: boolean;
  /** Main links: which sidebar list. Default 'main'. */
  group?: 'main' | 'setup';
  icon?: IconName;
  /** Main links: 'tab' = the phone tab bar, 'tool' = a glyph in the phone nav bar. Omitted = desktop only. */
  phone?: 'tab' | 'tool';
  /** Job tabs only: the job kinds that show this tab. Default: both. */
  kinds?: JobKind[];
  /** Job tabs only: the tab label, when it differs from `title`. */
  tab?: string;
  /** A page under a job tab: that tab's path (e.g. step detail -> '/jobs/:jobId/program'). */
  parent?: string;
  /** Shown on a desktop only (Setup). */
  desktopOnly?: boolean;
  /** Forward to this path (old links). */
  redirect?: string;
  render: (params: Record<string, string>) => ReactElement;
}

/** Replaces the hash so an old link lands on its new home (and Back skips the old one). */
function Redirect({ to }: { to: string }) {
  useEffect(() => {
    globalThis.location?.replace(`#${to}`);
  }, [to]);
  return <></>;
}

export const ROUTES: RouteDef[] = [
  // Main links
  { path: '/', title: 'Overview', nav: true, icon: 'overview', phone: 'tab', render: () => <OverviewScreen /> },
  { path: '/waiting', title: 'Waiting on', nav: true, icon: 'waiting', phone: 'tab', render: () => <WaitingOnScreen /> },
  { path: '/shipments', title: 'Shipments', nav: true, icon: 'shipments', render: () => <ShipmentsScreen /> },
  { path: '/history', title: 'Changes', nav: true, icon: 'changes', phone: 'tool', render: () => <HistoryScreen /> },
  { path: '/history/:jobId', title: 'Changes', render: ({ jobId }) => <HistoryScreen key={jobId} jobId={jobId!} /> },
  // Setup: desktop only. Every /setup page shows a one-line message on a phone instead.
  { path: '/setup', title: 'New job', nav: true, group: 'setup', icon: 'newjob', desktopOnly: true, render: () => <SetupNewJobScreen /> },
  { path: '/setup/programs', title: 'Programs', nav: true, group: 'setup', icon: 'programs', desktopOnly: true, render: () => <SetupProgramsScreen /> },
  { path: '/setup/programs/:jobId', title: 'Program editor', parent: '/setup/programs', render: ({ jobId }) => <SetupProgramEditorScreen key={jobId} jobId={jobId!} /> },
  { path: '/setup/templates', title: 'Templates', nav: true, group: 'setup', icon: 'templates', desktopOnly: true, render: () => <SetupTemplatesScreen /> },
  { path: '/setup/templates/:jobId', title: 'Template editor', parent: '/setup/templates', render: ({ jobId }) => <SetupProgramEditorScreen key={jobId} jobId={jobId!} /> },
  { path: '/setup/trades', title: 'Trades', nav: true, group: 'setup', icon: 'trades', desktopOnly: true, render: () => <SetupTradesScreen /> },
  // Old links
  { path: '/jobs', title: 'Overview', redirect: '/', render: () => <Redirect to="/" /> },
  { path: '/monday', title: 'Overview', redirect: '/', render: () => <Redirect to="/" /> },
  { path: '/chase', title: 'Waiting on', redirect: '/waiting', render: () => <Redirect to="/waiting" /> },

  // Job tabs
  { path: '/jobs/:jobId', title: 'Overview', nav: true, kinds: ['build'], render: ({ jobId }) => <JobOverviewScreen key={jobId} jobId={jobId!} /> },
  { path: '/jobs/:jobId/checklist', title: 'Checklist', nav: true, kinds: ['design'], render: ({ jobId }) => <DesignChecklistScreen key={jobId} jobId={jobId!} /> },
  { path: '/jobs/:jobId/program', title: 'Program', nav: true, kinds: ['build'], render: ({ jobId }) => <ProgramScreen key={jobId} jobId={jobId!} /> },
  { path: '/jobs/:jobId/waiting', title: 'Waiting on', nav: true, render: ({ jobId }) => <WaitingOnScreen key={jobId} jobId={jobId!} /> },
  { path: '/jobs/:jobId/shipments', title: 'Shipments', nav: true, kinds: ['build'], render: ({ jobId }) => <ShipmentsScreen key={jobId} jobId={jobId!} /> },
  { path: '/jobs/:jobId/photos', title: 'Photos', nav: true, kinds: ['build'], render: ({ jobId }) => <PhotosScreen key={jobId} jobId={jobId!} /> },
  { path: '/jobs/:jobId/notes', title: 'Daily notes', tab: 'Notes', nav: true, kinds: ['build'], render: ({ jobId }) => <NotesScreen key={jobId} jobId={jobId!} /> },

  // Pages under a job tab
  {
    path: '/jobs/:jobId/steps/:stepId',
    title: 'Step',
    parent: '/jobs/:jobId/program',
    render: ({ jobId, stepId }) => <StepDetailScreen key={stepId} jobId={jobId!} stepId={stepId!} />,
  },
];
