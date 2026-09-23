/**
 * Shipments list (UI_PLAN 3.12): everything coming from overseas on this side
 * and whether it will arrive in time. Desktop: a table. Phone: cards.
 *
 * A shipment is late when its ETA is after the earliest needed-by among its
 * linked items. That is said in words ("ETA 2 weeks after needed"), never
 * as a colour alone. The one money figure is what a week of lateness costs
 * the job, so the partner can price a slipping ETA at a glance; it draws
 * nothing when the field is absent.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useState, type FormEvent, type MouseEvent } from 'react';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, Job, Shipment, ShipmentStatus } from '../domain/types';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_ORDER } from '../domain/types';
import { calendarDaysBetween, formatDayMonthYear, formatShort, isISODate, minDate, relativeDate } from '../domain/dates';
import { StatusText, type Tone } from '../components/StatusText';
import { PageHeader } from '../shell/PageHeader';
import { useLayout } from '../shell/AppShell';
import './shipments.css';

export interface ShipmentRow {
  shipment: Shipment;
  job?: Job;
  /** Linked items that are not done. */
  items: Item[];
  /** Earliest needed-by among the linked items, from the calculator. */
  neededBy?: string;
}

/** "1 week", "10 days", "2 weeks": whole weeks read as weeks, the rest as days. */
export function gapWords(days: number): string {
  const n = Math.abs(days);
  if (n >= 7 && n % 7 === 0) {
    const w = n / 7;
    return `${w} ${w === 1 ? 'week' : 'weeks'}`;
  }
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/** The ETA read against the earliest needed-by, in words. */
export function timing(eta: string, neededBy?: string): { tone: Tone; text: string } {
  if (!neededBy) return { tone: 'muted', text: 'Nothing waiting on it' };
  const gap = calendarDaysBetween(neededBy, eta);
  if (gap > 0) return { tone: 'late', text: `ETA ${gapWords(gap)} after needed` };
  if (gap === 0) return { tone: 'amber', text: 'ETA on the day it is needed' };
  return { tone: 'ok', text: `ETA ${gapWords(gap)} before needed` };
}

function useRows(): ShipmentRow[] {
  return useQuery<ShipmentRow[]>((api) => {
    const jobs = new Map(api.listJobs().map((j) => [j.id, j]));
    return api
      .listShipments()
      .map((shipment) => {
        const items = api.listItems({ shipmentId: shipment.id });
        const forecast = api.getForecast(shipment.jobId);
        const neededBy = minDate(...items.map((i) => forecast?.items[i.id]?.neededBy));
        return { shipment, job: jobs.get(shipment.jobId), items, neededBy };
      })
      .sort((a, b) => (a.shipment.eta < b.shipment.eta ? -1 : a.shipment.eta > b.shipment.eta ? 1 : 0));
  }, []);
}

export default function Shipments() {
  const { side, role, offline } = useSession();
  const layout = useLayout();
  const rows = useRows();
  const [adding, setAdding] = useState(false);
  const count = rows.length === 1 ? '1 shipment' : `${rows.length} shipments`;
  const canAdd = role === 'admin' || role === 'partner' || role === 'builder';

  const addButton =
    canAdd && !adding ? (
      <button type="button" className="btn btn--primary btn--desktop" data-testid="shipment-add" disabled={offline} onClick={() => setAdding(true)}>
        Add shipment
      </button>
    ) : undefined;

  return (
    <main className="page shipments" data-testid="shipments-list">
      <PageHeader title="Shipments" meta={`${count} on ${side.name}`} actions={addButton} />
      {adding && <AddShipment onDone={() => setAdding(false)} />}
      {rows.length === 0 ? (
        <p className="shipments__empty" data-testid="shipments-empty">
          No shipments being tracked.
        </p>
      ) : layout === 'desktop' ? (
        <ShipmentTable rows={rows} />
      ) : (
        <ShipmentCards rows={rows} />
      )}
    </main>
  );
}

/**
 * The add form (UI_PLAN 3.12 action): name, job, status as buttons, ETA.
 * Saves through api.addShipment and opens the new shipment so items can be
 * linked there. Dates need signal, so the form is not offered offline.
 */
function AddShipment({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const navigate = useNavigate();
  const jobs = useQuery((api) => api.listJobs({ kind: 'build' }), []);
  const [name, setName] = useState('');
  const [supplier, setSupplier] = useState('');
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const [status, setStatus] = useState<ShipmentStatus>('design');
  const [eta, setEta] = useState('');
  const ready = name.trim().length > 0 && jobId !== '' && isISODate(eta);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const sh = api.addShipment({ jobId, name: name.trim(), supplier: supplier.trim() || undefined, status, eta });
    onDone();
    navigate(`/shipments/${sh.id}`);
  }

  return (
    <form className="shipments__add plate" data-testid="shipment-add-form" onSubmit={submit}>
      <h2 className="shipments__add-title">New shipment</h2>
      <div className="field">
        <label className="field__label" htmlFor="shipment-add-name">
          Name
        </label>
        <input id="shipment-add-name" className="input" value={name} data-testid="shipment-add-name" onChange={(e) => setName(e.target.value)} placeholder="Park Rd windows" />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="shipment-add-supplier">
          Supplier
        </label>
        <input id="shipment-add-supplier" className="input" value={supplier} data-testid="shipment-add-supplier" onChange={(e) => setSupplier(e.target.value)} />
      </div>
      <div className="field">
        <span className="field__label" id="shipment-add-job-label">
          Job
        </span>
        <div className="seg shipments__seg" role="group" aria-labelledby="shipment-add-job-label">
          {jobs.map((j) => (
            <button key={j.id} type="button" className="seg__btn" aria-pressed={j.id === jobId} data-testid={`shipment-add-job-${j.id}`} onClick={() => setJobId(j.id)}>
              {j.name}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="field__label" id="shipment-add-status-label">
          Status
        </span>
        <div className="seg shipments__seg" role="group" aria-labelledby="shipment-add-status-label">
          {SHIPMENT_STATUS_ORDER.map((s) => (
            <button key={s} type="button" className="seg__btn" aria-pressed={s === status} data-testid={`shipment-add-status-${s}`} onClick={() => setStatus(s)}>
              {SHIPMENT_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="shipment-add-eta">
          ETA
        </label>
        <input id="shipment-add-eta" className="input num shipments__date" type="date" value={eta} data-testid="shipment-add-eta" onChange={(e) => setEta(e.target.value)} />
      </div>
      <div className="shipments__add-actions">
        <button type="submit" className="btn btn--primary" data-testid="shipment-add-save" disabled={!ready}>
          Add shipment
        </button>
        <button type="button" className="btn" data-testid="shipment-add-cancel" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function itemsWords(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}

/** Whole rows are targets; links inside keep their own. */
function useRowNav() {
  const navigate = useNavigate();
  return (id: string) => (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/shipments/${id}`);
  };
}

function ShipmentTable({ rows }: { rows: ShipmentRow[] }) {
  const { today } = useSession();
  const go = useRowNav();
  return (
    <table className="table table--rows shipments__table">
      <thead>
        <tr>
          <th scope="col">Shipment</th>
          <th scope="col">Job</th>
          <th scope="col">Status</th>
          <th scope="col">ETA</th>
          <th scope="col">Needed by</th>
          <th scope="col">Items</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ shipment, job, items, neededBy }) => {
          const t = timing(shipment.eta, neededBy);
          return (
            <tr key={shipment.id} className="shipments__row" data-testid={`shipment-row-${shipment.id}`} onClick={go(shipment.id)}>
              <td className="shipments__cell-name">
                <Link to={`/shipments/${shipment.id}`} className="shipments__name" data-testid={`shipment-link-${shipment.id}`}>
                  {shipment.name}
                </Link>
                {shipment.supplier && <span className="shipments__supplier">{shipment.supplier}</span>}
              </td>
              <td className="shipments__cell-job">{job?.name ?? 'No job'}</td>
              <td>
                <span data-testid={`shipment-status-text-${shipment.id}`}>{SHIPMENT_STATUS_LABELS[shipment.status]}</span>
              </td>
              <td>
                <div className="shipments__eta-stack">
                  <span className="shipments__eta num" data-testid={`shipment-eta-${shipment.id}`}>
                    {formatDayMonthYear(shipment.eta)}
                  </span>
                  <span className="shipments__needed">{relativeDate(shipment.eta, today)}</span>
                  <StatusText tone={t.tone} plain={t.tone === 'ok'} testId={`shipment-timing-${shipment.id}`}>
                    {t.text}
                  </StatusText>
                </div>
              </td>
              <td className="num">
                {neededBy ? (
                  `${formatShort(neededBy)}, ${relativeDate(neededBy, today, { deadline: shipment.status !== 'delivered' })}`
                ) : (
                  <span className="shipments__muted">No date</span>
                )}
              </td>
              <td className="num" data-testid={`shipment-items-${shipment.id}`}>
                {itemsWords(items.length)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ShipmentCards({ rows }: { rows: ShipmentRow[] }) {
  const { today } = useSession();
  return (
    <ul className="shipments__cards">
      {rows.map(({ shipment, job, items, neededBy }) => {
        const t = timing(shipment.eta, neededBy);
        return (
          <li key={shipment.id}>
            <Link to={`/shipments/${shipment.id}`} className="shipments__card plate" data-testid={`shipment-row-${shipment.id}`}>
              <div className="shipments__card-top">
                <span className="shipments__name">{shipment.name}</span>
                <span className="shipments__card-status-word" data-testid={`shipment-status-text-${shipment.id}`}>
                  {SHIPMENT_STATUS_LABELS[shipment.status]}
                </span>
              </div>
              <div className="shipments__eta-stack">
                <span className="shipments__eta num" data-testid={`shipment-eta-${shipment.id}`}>
                  {formatDayMonthYear(shipment.eta)}
                </span>
                <span className="shipments__needed">{relativeDate(shipment.eta, today)}</span>
                <span className="shipments__eta-words">
                  <StatusText tone={t.tone} plain={t.tone === 'ok'} testId={`shipment-timing-${shipment.id}`}>
                    {t.text}
                  </StatusText>
                  {neededBy && (
                    <span className="shipments__needed">
                      needed {formatShort(neededBy)}, {relativeDate(neededBy, today, { deadline: shipment.status !== 'delivered' })}
                    </span>
                  )}
                </span>
              </div>
              <div className="shipments__card-mid">
                <span data-testid={`shipment-items-${shipment.id}`}>
                  {itemsWords(items.length)} for {job?.name ?? 'no job'}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
