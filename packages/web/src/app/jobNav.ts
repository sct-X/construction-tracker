/**
 * Navigation helpers, all derived from the route table (routes.tsx): main
 * links are `nav` rows with no params (sidebar groups, phone tabs and tools);
 * job tabs are `nav` rows under `/jobs/:jobId`. ROUTES is only read inside
 * functions (screens import this file and routes.tsx imports the screens).
 */
import type { JobKind } from '@ct/core';
import { href } from './router';
import { ROUTES, type RouteDef } from './routes';

export const JOB_PREFIX = '/jobs/:jobId';

export function isJobRoute(r: RouteDef): boolean {
  return r.path === JOB_PREFIX || r.path.startsWith(`${JOB_PREFIX}/`);
}

/** Every main link (sidebar), in table order. */
export function mainLinks(group?: 'main' | 'setup'): RouteDef[] {
  return ROUTES.filter((r) => r.nav && !r.path.includes(':') && (!group || (r.group ?? 'main') === group));
}

/** The phone tab bar's links (Overview, Waiting on) and the nav bar's tool glyphs (Changes). */
export function phoneLinks(kind: 'tab' | 'tool'): RouteDef[] {
  return mainLinks().filter((r) => r.phone === kind);
}

export function jobTabs(kind: JobKind): RouteDef[] {
  return ROUTES.filter((r) => r.nav && isJobRoute(r) && (!r.kinds || r.kinds.includes(kind)));
}

export function tabLabel(r: RouteDef): string {
  return r.tab ?? r.title;
}

/** "/jobs/:jobId/program" + {jobId: 'park-rd'} -> "/jobs/park-rd/program". */
export function fillPath(pattern: string, params: Record<string, string>): string {
  return pattern.replace(/:([A-Za-z]+)/g, (_, k: string) => encodeURIComponent(params[k] ?? ''));
}

/** Where a job opens: the overview for a build, the checklist for a design job. */
export function jobHome(job: { jobId: string; kind: JobKind }): string {
  return href(job.kind === 'design' ? `/jobs/${encodeURIComponent(job.jobId)}/checklist` : `/jobs/${encodeURIComponent(job.jobId)}`);
}

/** The href of a job tab by its label ("Waiting on", "Photos"), or null when no such tab exists for that kind. */
export function tabHref(job: { jobId: string; kind: JobKind }, label: string): string | null {
  const r = jobTabs(job.kind).find((t) => tabLabel(t) === label);
  return r ? href(fillPath(r.path, { jobId: job.jobId })) : null;
}

/** The tab a route sits under (itself for a tab, its parent for a deeper page). */
export function activeTabPath(r: RouteDef | undefined): string | null {
  if (!r || !isJobRoute(r)) return null;
  return r.parent ?? r.path;
}

/**
 * Which main link is "here": the route itself, its parent (Setup sub-pages),
 * Overview for every job page, Changes for a job's changes.
 */
export function isHere(link: RouteDef, current: RouteDef | undefined): boolean {
  if (!current) return false;
  if (current === link) return true;
  if (current.parent === link.path) return true;
  if (link.path === '/' && isJobRoute(current)) return true;
  if (link.path === '/history' && current.path === '/history/:jobId') return true;
  return false;
}

/**
 * Switching job keeps the tab when the other job has it (Program -> Program),
 * otherwise opens the other job's home.
 */
export function switchJobHref(current: RouteDef | undefined, job: { jobId: string; kind: JobKind }): string {
  const tab = activeTabPath(current);
  if (tab && jobTabs(job.kind).some((t) => t.path === tab)) return href(fillPath(tab, { jobId: job.jobId }));
  return jobHome(job);
}
