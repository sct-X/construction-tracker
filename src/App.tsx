/**
 * Routes. Every hash route from src/screens/README.md is registered in
 * src/shell/routes.tsx with its element. Access is checked by <Guard> against
 * `api.canSee`, and `#/` sends each role to its home (src/shell/Landing).
 */
import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { DevBar } from './dev/DevBar';
import { AppShell } from './shell/AppShell';
import { Guard } from './shell/Guard';
import { Landing } from './shell/Landing';
import { ROUTES } from './shell/routes';
import NotFound from './screens/NotFound';
import SignIn from './screens/SignIn';

/** An in-app route change starts at the top, unless the location carries an anchor (#/jobs/x/program#stage-1). */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <DevBar />
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Landing />} />
          <Route path="/sign-in" element={<SignIn />} />
          {ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={<Guard screen={r.screen}>{r.element}</Guard>} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
