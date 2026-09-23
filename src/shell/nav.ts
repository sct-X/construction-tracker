/**
 * Navigation per role, from docs/UI_PLAN.md section 2. The lists are built
 * from `api.canSee`, never by hiding links: a role only gets the items its
 * screens allow. Test ids are `nav-<name>`.
 */
import type { ScreenKey, TrackerApi } from '../data/api';
import type { Role } from '../domain/types';
import { currentJobId } from './lastJob';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  screen?: ScreenKey;
  /** Which route paths count as "here" for this item (prefix match on the pathname). */
  match: string[];
}

/** Where each role opens the app. */
export function homeFor(role: Role, api: TrackerApi): string {
  switch (role) {
    case 'admin':
    case 'partner':
      return '/overview';
    case 'builder':
      return '/waiting?owner=me';
    case 'site': {
      const id = currentJobId(api);
      return id ? `/jobs/${id}` : '/jobs';
    }
  }
}

/**
 * Phone bottom tabs, left to right, per UI_PLAN section 2. Partners and admin
 * get Overview and Waiting on only: Shipments lives inside each job (Dom's
 * brief, change 2), at `/jobs/:id/shipments`.
 */
export function phoneTabs(role: Role, api: TrackerApi): NavItem[] {
  const jobId = currentJobId(api);
  const jobPath = jobId ? `/jobs/${jobId}` : '/jobs';
  const all: Record<Role, NavItem[]> = {
    site: [
      { id: 'today', label: 'Today', to: jobPath, screen: 'job', match: jobId ? [`/jobs/${jobId}`] : [] },
      { id: 'overview', label: 'Jobs', to: '/overview', screen: 'overview', match: ['/overview', '/jobs'] },
    ],
    builder: [
      { id: 'waiting', label: 'My items', to: '/waiting?owner=me', screen: 'waiting', match: ['/waiting', '/items'] },
      { id: 'overview', label: 'Jobs', to: '/overview', screen: 'overview', match: ['/overview', '/jobs'] },
      { id: 'upload', label: '+ Photos', to: `${jobPath}/upload`, screen: 'upload', match: [`${jobPath}/upload`, '/queue'] },
    ],
    partner: [
      { id: 'overview', label: 'Overview', to: '/overview', screen: 'overview', match: ['/overview', '/jobs'] },
      { id: 'waiting', label: 'Waiting on', to: '/waiting', screen: 'waiting', match: ['/waiting', '/items'] },
    ],
    admin: [
      { id: 'overview', label: 'Overview', to: '/overview', screen: 'overview', match: ['/overview', '/jobs'] },
      { id: 'waiting', label: 'Waiting on', to: '/waiting', screen: 'waiting', match: ['/waiting', '/items'] },
    ],
  };
  return all[role].filter((t) => !t.screen || api.canSee(t.screen));
}

/** Desktop sidebar, main group. */
export function sidebarMain(api: TrackerApi): NavItem[] {
  const items: NavItem[] = [
    { id: 'overview', label: 'Overview', to: '/overview', screen: 'overview', match: ['/overview', '/jobs', '/steps'] },
    { id: 'waiting', label: 'Waiting on', to: '/waiting', screen: 'waiting', match: ['/waiting', '/items'] },
    { id: 'shipments', label: 'Shipments', to: '/shipments', screen: 'shipments', match: ['/shipments'] },
    { id: 'activity', label: 'Notifications', to: '/notifications', screen: 'activity', match: ['/notifications'] },
  ];
  return items.filter((t) => !t.screen || api.canSee(t.screen));
}

/** Desktop sidebar, setup group (admin; partners see Templates and Trades; builders Trades). */
export function sidebarSetup(api: TrackerApi): NavItem[] {
  const items: NavItem[] = [
    { id: 'templates', label: 'Templates and new job', to: '/templates', screen: 'templates', match: ['/templates'] },
    { id: 'trades', label: 'Trades', to: '/trades', screen: 'trades', match: ['/trades'] },
    { id: 'people', label: 'People and roles', to: '/people', screen: 'people', match: ['/people'] },
  ];
  return items.filter((t) => !t.screen || api.canSee(t.screen));
}

/** Roles whose shipments live inside the job (`/jobs/:id/shipments`). Builders keep the global list. */
export function shipmentsInJob(role: Role): boolean {
  return role === 'partner' || role === 'admin';
}

/** Where a shipment opens for this role: inside its job for partners and admin, else the global detail. */
export function shipmentHref(role: Role, shipment: { id: string; jobId: string }): string {
  return shipmentsInJob(role) ? `/jobs/${shipment.jobId}/shipments/${shipment.id}` : `/shipments/${shipment.id}`;
}

export function isHere(item: NavItem, pathname: string): boolean {
  return item.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
}

/** The job pages that carry the job switcher, by the path segment after `/jobs/:id`. */
export type JobSection = 'overview' | 'program' | 'shipments' | 'photos' | 'notes';

/**
 * Roles whose job pages open with the job switcher (Dom's brief, change 1).
 * Builder and site job pages keep their plain title.
 */
export function jobSwitcherFor(role: Role): boolean {
  return role === 'partner' || role === 'admin';
}

/**
 * Where switching to `job` lands from `section`: the same page on the new
 * job when it has one, else the job's overview. Design jobs are a checklist
 * only, so every section lands on the checklist.
 */
export function jobSectionHref(section: JobSection, job: { id: string; kind: 'build' | 'design' }): string {
  if (section === 'overview' || job.kind === 'design') return `/jobs/${job.id}`;
  return `/jobs/${job.id}/${section}`;
}
