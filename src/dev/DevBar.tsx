/**
 * The dev bar stands in for login. Person switcher, "today is", offline
 * toggle, reset, fire reminders. Tests drive it through data-testids and
 * through URL params (`#/...?as=alec&today=2026-09-17&offline=1`).
 */
import { useState } from 'react';
import { useApi, useQuery, useSession } from '../data/context';
import { ROLE_LABELS } from '../domain/types';
import { formatLong } from '../domain/dates';
import { DEFAULT_TODAY } from '../data/session';
import './devbar.css';

export function DevBar() {
  const api = useApi();
  const session = useSession();
  const people = useQuery((api) => api.listPeople(), []);
  const memberships = useQuery((api) => api.listMemberships(), []);
  const [lastFired, setLastFired] = useState<string | null>(null);

  const roleOf = (personId: string) => memberships.find((m) => m.personId === personId)?.role;

  return (
    <div className="devbar" data-testid="dev-bar" role="region" aria-label="Developer bar">
      <span className="devbar__tag">dev</span>

      <label className="devbar__field">
        <span>As</span>
        <select
          data-testid="dev-person"
          value={session.personId}
          onChange={(e) => session.setSession({ personId: e.target.value })}
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.shortName}
              {roleOf(p.id) ? ` (${ROLE_LABELS[roleOf(p.id)!].toLowerCase()})` : ''}
            </option>
          ))}
        </select>
      </label>

      {session.sides.length > 1 && (
        <label className="devbar__field">
          <span>Side</span>
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
        <span>Today is</span>
        <input
          data-testid="dev-today"
          type="date"
          value={session.today}
          onChange={(e) => e.target.value && session.setSession({ today: e.target.value })}
        />
        <span className="devbar__hint" data-testid="dev-today-label">
          {formatLong(session.today)}
        </span>
      </label>

      <label className="devbar__field devbar__check">
        <input
          data-testid="dev-offline"
          type="checkbox"
          checked={session.offline}
          onChange={(e) => session.setSession({ offline: e.target.checked })}
        />
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
        Fire reminders due today
      </button>
      {lastFired && (
        <span className="devbar__hint" data-testid="dev-fire-result">
          {lastFired}
        </span>
      )}

      <button
        type="button"
        data-testid="dev-reset"
        className="devbar__button devbar__button--quiet"
        onClick={() => {
          api.reset();
          session.setSession({ today: DEFAULT_TODAY, offline: false });
          setLastFired(null);
        }}
      >
        Reset
      </button>
    </div>
  );
}
