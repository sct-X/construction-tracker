/**
 * The route registry: every hash route from src/screens/README.md with the
 * screen key that gates it (`api.canSee`), a title, the stage it arrived in,
 * and the element to render. Adding a screen is one entry here. App.tsx
 * turns this list into <Route>s.
 *
 * e2e/no-money-for-site.spec.ts reads the `path:` values out of this file,
 * so keep each entry on one line, starting with its path.
 */
import type { ReactElement } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import type { ScreenKey } from '../data/api';
import { useQuery } from '../data/context';
import { shipmentHref } from './nav';
import DailyNotes from '../screens/DailyNotes';
import Deliveries from '../screens/Deliveries';
import DesignChecklist from '../screens/DesignChecklist';
import ItemSheet from '../screens/ItemSheet';
import JobOverview from '../screens/JobOverview';
import PhotoUpload from '../screens/PhotoUpload';
import NotFound from '../screens/NotFound';
import Notifications from '../screens/Notifications';
import PhotoGallery from '../screens/PhotoGallery';
import People from '../screens/People';
import Program from '../screens/Program';
import ProgramEditor from '../screens/ProgramEditor';
import Settings from '../screens/Settings';
import Trades, { TradeDetail } from '../screens/Trades';
import ShipmentDetail from '../screens/ShipmentDetail';
import Shipments from '../screens/Shipments';
import StepDetail from '../screens/StepDetail';
import Templates, { TemplateDetail } from '../screens/Templates';
import NewJob from '../screens/NewJob';
import UploadQueue from '../screens/UploadQueue';
import WaitingOn from '../screens/WaitingOn';
import Overview from '../screens/Overview';

export interface RouteDef {
  path: string;
  /** Screen key for `canSee`; undefined means everyone. */
  screen?: ScreenKey;
  title: string;
  /** Stage the screen is built in. */
  stage: number;
  element: ReactElement;
}

/** `/jobs/:id`: the build overview, or the design checklist for a design job. */
function JobRoute() {
  const { id = '' } = useParams();
  const job = useQuery((api) => api.getJob(id), [id]);
  if (!job) return <NotFound />;
  if (job.kind === 'design') return <DesignChecklist />;
  return <JobOverview />;
}

/** `/jobs/:id/shipments`: the Shipments list, scoped to this job (Dom's brief, change 2). */
function JobShipmentsRoute() {
  const { id = '' } = useParams();
  const job = useQuery((api) => api.getJob(id), [id]);
  if (!job) return <NotFound />;
  return <Shipments jobId={id} />;
}

/**
 * `/shipments/:id`: every role is forwarded into the shipment's job so old
 * links and notifications land with the job around it. An unknown id shows
 * the detail's own "No shipment" words.
 */
function ShipmentRoute() {
  const { id = '' } = useParams();
  const shipment = useQuery((api) => api.getShipment(id), [id]);
  if (shipment) return <Redirect to={shipmentHref(shipment)} />;
  return <ShipmentDetail />;
}

/**
 * Old routes forward to their new home with the query kept, so `?as=` and
 * `?today=` in a bookmarked or typed URL still reach the session provider.
 */
function Redirect({ to, set }: { to: string; set?: Record<string, string> }) {
  const { search } = useLocation();
  const p = new URLSearchParams(search);
  for (const [k, v] of Object.entries(set ?? {})) p.set(k, v);
  const q = p.toString();
  return <Navigate to={q ? `${to}?${q}` : to} replace />;
}

export const ROUTES: RouteDef[] = [
  { path: '/overview', screen: 'overview', title: 'Overview', stage: 1, element: <Overview /> },
  { path: '/monday', title: 'Overview', stage: 1, element: <Redirect to="/overview" /> },
  { path: '/jobs', title: 'Overview', stage: 1, element: <Redirect to="/overview" /> },
  { path: '/jobs/:id', screen: 'job', title: 'Job', stage: 2, element: <JobRoute /> },
  { path: '/jobs/:id/program', screen: 'program', title: 'Program', stage: 2, element: <Program /> },
  { path: '/steps/:id', screen: 'step', title: 'Step', stage: 2, element: <StepDetail /> },
  { path: '/waiting', screen: 'waiting', title: 'Waiting on', stage: 4, element: <WaitingOn /> },
  { path: '/deliveries', screen: 'deliveries', title: 'Deliveries', stage: 3, element: <Deliveries /> },
  { path: '/items/new', screen: 'item', title: 'New item', stage: 4, element: <ItemSheet /> },
  { path: '/items/:id', screen: 'item', title: 'Item', stage: 4, element: <ItemSheet /> },
  { path: '/calls', screen: 'waiting', title: 'Waiting on', stage: 4, element: <Redirect to="/waiting" set={{ mode: 'call' }} /> },
  { path: '/shipments', screen: 'shipments', title: 'Shipments', stage: 2, element: <Shipments /> },
  { path: '/shipments/:id', screen: 'jobShipment', title: 'Shipment', stage: 2, element: <ShipmentRoute /> },
  { path: '/jobs/:id/shipments', screen: 'jobShipments', title: 'Shipments', stage: 2, element: <JobShipmentsRoute /> },
  { path: '/jobs/:id/shipments/:shipmentId', screen: 'jobShipment', title: 'Shipment', stage: 2, element: <ShipmentDetail /> },
  { path: '/jobs/:id/photos', screen: 'photos', title: 'Photos', stage: 3, element: <PhotoGallery /> },
  { path: '/jobs/:id/upload', screen: 'upload', title: 'Upload photos', stage: 3, element: <PhotoUpload /> },
  { path: '/queue', screen: 'queue', title: 'Upload queue', stage: 3, element: <UploadQueue /> },
  { path: '/jobs/:id/notes', screen: 'notes', title: 'Daily notes', stage: 5, element: <DailyNotes /> },
  { path: '/notifications', screen: 'notifications', title: 'Notifications', stage: 5, element: <Notifications /> },
  { path: '/settings', screen: 'settings', title: 'My settings', stage: 6, element: <Settings /> },
  { path: '/jobs/:id/edit', screen: 'editor', title: 'Program editor', stage: 6, element: <ProgramEditor /> },
  { path: '/templates', screen: 'templates', title: 'Templates and new job', stage: 6, element: <Templates /> },
  { path: '/templates/:id', screen: 'templates', title: 'Template', stage: 6, element: <TemplateDetail /> },
  { path: '/jobs/new', screen: 'templates', title: 'New job', stage: 6, element: <NewJob /> },
  { path: '/trades', screen: 'trades', title: 'Trades', stage: 6, element: <Trades /> },
  { path: '/trades/:id', screen: 'trades', title: 'Trade', stage: 6, element: <TradeDetail /> },
  { path: '/people', screen: 'people', title: 'People and roles', stage: 6, element: <People /> },
];
