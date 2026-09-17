/**
 * The route registry: every hash route from src/screens/README.md, the
 * screen key that gates it (`api.canSee`), a title for the shell, and the
 * stage it arrives in. App.tsx turns this into <Route>s; unbuilt screens
 * render the Placeholder so nothing 404s.
 */
import type { ScreenKey } from '../data/api';

export interface RouteDef {
  path: string;
  /** Screen key for `canSee`; undefined means everyone. */
  screen?: ScreenKey;
  title: string;
  /** Stage the screen is built in. */
  stage: number;
}

export const ROUTES: RouteDef[] = [
  { path: '/monday', screen: 'monday', title: 'Monday', stage: 1 },
  { path: '/jobs', screen: 'jobs', title: 'Jobs', stage: 1 },
  { path: '/jobs/:id', screen: 'job', title: 'Job', stage: 2 },
  { path: '/jobs/:id/why', screen: 'monday', title: 'Why it moved', stage: 1 },
  { path: '/jobs/:id/program', screen: 'program', title: 'Program', stage: 2 },
  { path: '/steps/:id', screen: 'step', title: 'Step', stage: 2 },
  { path: '/waiting', screen: 'waiting', title: 'Waiting on', stage: 4 },
  { path: '/deliveries', screen: 'deliveries', title: 'Deliveries', stage: 3 },
  { path: '/items/new', screen: 'item', title: 'New item', stage: 4 },
  { path: '/items/:id', screen: 'item', title: 'Item', stage: 4 },
  { path: '/calls', screen: 'calls', title: 'Call list', stage: 4 },
  { path: '/shipments', screen: 'shipments', title: 'Shipments', stage: 2 },
  { path: '/shipments/:id', screen: 'shipment', title: 'Shipment', stage: 2 },
  { path: '/jobs/:id/photos', screen: 'photos', title: 'Photos', stage: 3 },
  { path: '/jobs/:id/upload', screen: 'upload', title: 'Upload photos', stage: 3 },
  { path: '/queue', screen: 'queue', title: 'Upload queue', stage: 3 },
  { path: '/jobs/:id/notes', screen: 'notes', title: 'Daily notes', stage: 5 },
  { path: '/notifications', screen: 'notifications', title: 'Notifications', stage: 5 },
  { path: '/settings', screen: 'settings', title: 'My settings', stage: 6 },
  { path: '/jobs/:id/edit', screen: 'editor', title: 'Program editor', stage: 6 },
  { path: '/templates', screen: 'templates', title: 'Templates and new job', stage: 6 },
  { path: '/trades', screen: 'trades', title: 'Trades', stage: 6 },
  { path: '/people', screen: 'people', title: 'People and roles', stage: 6 },
];

/** Routes that have a screen in this build; everything else renders the Placeholder. */
export const BUILT: ReadonlySet<string> = new Set(['/monday', '/jobs', '/jobs/:id/why']);
