/**
 * Routes. Every hash route from src/screens/README.md is registered here
 * (see src/shell/routes.ts); screens that arrive in a later stage render
 * the Placeholder so nothing 404s. Access is checked by <Guard> against
 * `api.canSee`, and `#/` sends each role to its home (src/shell/Landing).
 */
import { HashRouter, Route, Routes, useParams } from 'react-router-dom';
import { DevBar } from './dev/DevBar';
import { AppShell } from './shell/AppShell';
import { Guard } from './shell/Guard';
import { Landing } from './shell/Landing';
import { ROUTES, type RouteDef } from './shell/routes';
import { useQuery, useSession } from './data/context';
import JobsList from './screens/JobsList';
import Monday from './screens/Monday';
import WhyItMoved from './screens/WhyItMoved';
import NotFound from './screens/NotFound';
import Placeholder from './screens/Placeholder';
import SignIn from './screens/SignIn';

/** `/jobs/:id` until Stage 2 (build overview), 3 (Alec's Today) and 5 (design checklist) land. */
function JobRoute() {
  const { id = '' } = useParams();
  const { role } = useSession();
  const job = useQuery((api) => api.getJob(id), [id]);
  if (!job) return <NotFound />;
  if (job.kind === 'design') return <Placeholder title={job.name} stage={5} />;
  return <Placeholder title={role === 'site' ? `Today at ${job.name}` : job.name} stage={role === 'site' ? 3 : 2} />;
}

function elementFor(r: RouteDef) {
  switch (r.path) {
    case '/monday':
      return <Monday />;
    case '/jobs':
      return <JobsList />;
    case '/jobs/:id/why':
      return <WhyItMoved />;
    case '/jobs/:id':
      return <JobRoute />;
    default:
      return <Placeholder title={r.title} stage={r.stage} />;
  }
}

export default function App() {
  return (
    <HashRouter>
      <DevBar />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Landing />} />
          <Route path="/sign-in" element={<SignIn />} />
          {ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={<Guard screen={r.screen}>{elementFor(r)}</Guard>} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
