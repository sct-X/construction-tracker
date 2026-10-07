import { useEffect } from 'react';
import { DevBar } from '../components/DevBar';
import { SideSwitcher } from '../components/SideSwitcher';
import { useData } from '../data/DataContext';
import { href, matchPath, useHashPath } from './router';
import { ROUTES } from './routes';

export function App() {
  const path = useHashPath();
  const { dev } = useData();
  const found = ROUTES.map((r) => ({ r, params: matchPath(r.path, path) })).find((x) => x.params);

  useEffect(() => {
    document.title = `${found?.r.title ?? 'Not found'} | Tracker`;
  }, [found?.r.title]);

  return (
    <div className={dev ? 'app has-devbar' : 'app'}>
      {dev && <DevBar />}
      <div className="frame">
        <header className="rail">
          <a className="brand" href={href('/')}>
            Tracker
          </a>
          <SideSwitcher />
          <nav className="nav" aria-label="Main">
            {ROUTES.filter((r) => r.nav).map((r) => (
              <a key={r.path} href={href(r.path)} className="nav-link" aria-current={found?.r === r ? 'page' : undefined}>
                {r.title}
              </a>
            ))}
          </nav>
        </header>
        <main className="main" id="main">
          {found ? (
            found.r.render(found.params!)
          ) : (
            <div className="screen">
              <h1>Nothing here</h1>
              <p className="empty">
                There is no page at #{path}. <a href={href('/')}>Go to Monday</a>.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
