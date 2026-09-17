/**
 * The route registry: every hash route from src/screens/README.md with the
 * screen key that gates it (`api.canSee`), a title, the stage it arrives in,
 * and the element to render. Adding a screen is one edit here: swap its
 * Placeholder for the component. App.tsx turns this list into <Route>s.
 *
 * e2e/no-money-for-site.spec.ts reads the `path:` values out of this file,
 * so keep each entry on one line, starting with its path.
 */
import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import type { ScreenKey } from '../data/api';
import { useQuery } from '../data/context';
import JobOverview from '../screens/JobOverview';
import JobsList from '../screens/JobsList';
import Monday from '../screens/Monday';
import NotFound from '../screens/NotFound';
import Placeholder from '../screens/Placeholder';
import Program from '../screens/Program';
import ShipmentDetail from '../screens/ShipmentDetail';
import Shipments from '../screens/Shipments';
import StepDetail from '../screens/StepDetail';
import WhyItMoved from '../screens/WhyItMoved';

export interface RouteDef {
  path: string;
  /** Screen key for `canSee`; undefined means everyone. */
  screen?: ScreenKey;
  title: string;
  /** Stage the screen is built in. */
  stage: number;
  element: ReactElement;
}

/** `/jobs/:id`: the build overview (Alec's Today section lands in Stage 3); design checklist in Stage 5. */
function JobRoute() {
  const { id = '' } = useParams();
  const job = useQuery((api) => api.getJob(id), [id]);
  if (!job) return <NotFound />;
  if (job.kind === 'design') return <Placeholder title={job.name} stage={5} />;
  return <JobOverview />;
}

const soon = (title: string, stage: number) => <Placeholder title={title} stage={stage} />;

export const ROUTES: RouteDef[] = [
  { path: '/monday', screen: 'monday', title: 'Monday', stage: 1, element: <Monday /> },
  { path: '/jobs', screen: 'jobs', title: 'Jobs', stage: 1, element: <JobsList /> },
  { path: '/jobs/:id', screen: 'job', title: 'Job', stage: 2, element: <JobRoute /> },
  { path: '/jobs/:id/why', screen: 'monday', title: 'Why it moved', stage: 1, element: <WhyItMoved /> },
  { path: '/jobs/:id/program', screen: 'program', title: 'Program', stage: 2, element: <Program /> },
  { path: '/steps/:id', screen: 'step', title: 'Step', stage: 2, element: <StepDetail /> },
  { path: '/waiting', screen: 'waiting', title: 'Waiting on', stage: 4, element: soon('Waiting on', 4) },
  { path: '/deliveries', screen: 'deliveries', title: 'Deliveries', stage: 3, element: soon('Deliveries', 3) },
  { path: '/items/new', screen: 'item', title: 'New item', stage: 4, element: soon('New item', 4) },
  { path: '/items/:id', screen: 'item', title: 'Item', stage: 4, element: soon('Item', 4) },
  { path: '/calls', screen: 'calls', title: 'Call list', stage: 4, element: soon('Call list', 4) },
  { path: '/shipments', screen: 'shipments', title: 'Shipments', stage: 2, element: <Shipments /> },
  { path: '/shipments/:id', screen: 'shipment', title: 'Shipment', stage: 2, element: <ShipmentDetail /> },
  { path: '/jobs/:id/photos', screen: 'photos', title: 'Photos', stage: 3, element: soon('Photos', 3) },
  { path: '/jobs/:id/upload', screen: 'upload', title: 'Upload photos', stage: 3, element: soon('Upload photos', 3) },
  { path: '/queue', screen: 'queue', title: 'Upload queue', stage: 3, element: soon('Upload queue', 3) },
  { path: '/jobs/:id/notes', screen: 'notes', title: 'Daily notes', stage: 5, element: soon('Daily notes', 5) },
  { path: '/notifications', screen: 'notifications', title: 'Notifications', stage: 5, element: soon('Notifications', 5) },
  { path: '/settings', screen: 'settings', title: 'My settings', stage: 6, element: soon('My settings', 6) },
  { path: '/jobs/:id/edit', screen: 'editor', title: 'Program editor', stage: 6, element: soon('Program editor', 6) },
  { path: '/templates', screen: 'templates', title: 'Templates and new job', stage: 6, element: soon('Templates and new job', 6) },
  { path: '/trades', screen: 'trades', title: 'Trades', stage: 6, element: soon('Trades', 6) },
  { path: '/people', screen: 'people', title: 'People and roles', stage: 6, element: soon('People and roles', 6) },
];
