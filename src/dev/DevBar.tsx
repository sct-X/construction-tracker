/**
 * The dev bar: person, side, "today is", offline, fire reminders, reset. One
 * quiet strip above the shell, obviously not the app. It collapses to a 24px
 * tag (remembered on this browser) and scrolls sideways on a phone rather
 * than wrapping into three rows.
 *
 * Hidden by default: it appears once the hash carries `?dev=1` (or any
 * session param such as `as=`), and stays on for this browser after that.
 * Tests drive it through data-testids and through URL params
 * (`#/...?as=alec&today=2026-09-17&offline=1`), so every control stays in
 * the DOM and visible while the bar is open.
 */
import { useEffect, useState } from 'react';
import { useApi, useQuery, useSession } from '../data/context';
import { ROLE_LABELS } from '../domain/types';
import { formatLong } from '../domain/dates';
import { DEFAULT_TODAY, hashHasSessionParams } from '../data/session';
import './devbar.css';

const COLLAPSED_KEY = 'construction-tracker.devbar.collapsed';
const DEV_KEY = 'construction-tracker.dev';

function readDev(): boolean {
  try {
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
}

/** True once the hash has asked for the dev bar, remembered on this browser. */
function useDevMode(): boolean {
  const [on, setOn] = useState(() => readDev() || hashHasSessionParams(window.location.hash));
  useEffect(() => {
    const check = () => {
      if (!hashHasSessionParams(window.location.hash)) return;
      setOn(true);
      try {
        localStorage.setItem(DEV_KEY, '1');
      } catch {
        /* private mode: on for this load only */
      }
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  return on;
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function DevBar() {
  const api = useApi();
  const session = useSession();
  const everyone = useQuery((api) => api.listSignIns(), []);
  const [lastFired, setLastFired] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const dev = useDevMode();
  if (!dev) return null;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* private mode: the bar just stays open next time */
    }
  };

  return (
    <div className={collapsed ? 'devbar devbar--collapsed' : 'devbar'} data-testid="dev-bar" role="region" aria-label="Developer bar">
      <button type="button" className="devbar__tag" onClick={toggle} aria-expanded={!collapsed} data-testid="dev-collapse" title={collapsed ? 'Show the dev bar' : 'Hide the dev bar'}>
        <span className="devbar__dot" aria-hidden="true" />
        dev
      </button>

      {!collapsed && (
        <div className="devbar__row">
          <label className="devbar__field">
            <span className="sr-only">As</span>
            <select data-testid="dev-person" value={session.personId} onChange={(e) => session.setSession({ personId: e.target.value })}>
              <option value="">Signed out</option>
              {everyone.map(({ person: p, roles }) => (
                <option key={p.id} value={p.id}>
                  {p.shortName}
                  {roles[0] ? ` (${ROLE_LABELS[roles[0].role].toLowerCase()})` : ''}
                </option>
              ))}
            </select>
          </label>

          {session.sides.length > 1 && (
            <label className="devbar__field">
              <span className="sr-only">Side</span>
              <select data-testid="dev-side" value={session.sideId} onChange={(e) => session.setSession({ sideId: e.target.value })}>
                {session.sides.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="devbar__field">
            <span className="devbar__label">Today</span>
            <input data-testid="dev-today" type="date" value={session.today} onChange={(e) => e.target.value && session.setSession({ today: e.target.value })} />
            <span className="devbar__hint" data-testid="dev-today-label">
              {formatLong(session.today)}
            </span>
          </label>

          <label className="devbar__field devbar__check">
            <input data-testid="dev-offline" type="checkbox" checked={session.offline} onChange={(e) => session.setSession({ offline: e.target.checked })} />
            <span>Offline</span>
          </label>

          <button
            type="button"
            data-testid="dev-fire-reminders"
            className="devbar__button"
            onClick={() => {
              const raised = api.fireRemindersDueToday();
              setLastFired(`${raised.length} raised`);
            }}
          >
            Fire reminders
          </button>
          {lastFired && (
            <span className="devbar__hint" data-testid="dev-fire-result">
              {lastFired}
            </span>
          )}

          <button
            type="button"
            data-testid="dev-reset"
            className="devbar__button"
            onClick={() => {
              api.reset();
              session.setSession({ today: DEFAULT_TODAY, offline: false });
              setLastFired(null);
            }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
