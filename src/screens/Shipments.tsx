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
import type { MouseEvent } from 'react';
import { useQuery, useSession } from '../data/context';
import type { Item, Job, Shipment } from '../domain/types';
import { SHIPMENT_STATUS_LABELS } from '../domain/types';
import { calendarDaysBetween, formatDayMonthYear, formatShort, minDate } from '../domain/dates';
import { Money } from '../components/Money';
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
  const { side } = useSession();
  const layout = useLayout();
  const rows = useRows();
  const count = rows.length === 1 ? '1 shipment' : `${rows.length} shipments`;

  return (
    <main className="page shipments" data-testid="shipments-list">
      <PageHeader title="Shipments" meta={`${count} on ${side.name}`} />
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
  const go = useRowNav();
  const showMoney = rows.some((r) => r.job?.weeklyHoldingCost !== undefined);
  return (
    <table className="shipments__table">
      <thead>
        <tr>
          <th scope="col">Shipment</th>
          <th scope="col">Job</th>
          <th scope="col">Status</th>
          <th scope="col">ETA</th>
          <th scope="col">Needed by</th>
          <th scope="col">Items</th>
          {showMoney && <th scope="col">A week late costs</th>}
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
                  <StatusText tone={t.tone} plain={t.tone === 'ok'} testId={`shipment-timing-${shipment.id}`}>
                    {t.text}
                  </StatusText>
                </div>
              </td>
              <td className="num">{neededBy ? formatShort(neededBy) : <span className="shipments__muted">No date</span>}</td>
              <td className="num" data-testid={`shipment-items-${shipment.id}`}>
                {itemsWords(items.length)}
              </td>
              {showMoney && (
                <td className="shipments__cell-money">
                  <Money value={job?.weeklyHoldingCost} />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ShipmentCards({ rows }: { rows: ShipmentRow[] }) {
  return (
    <ul className="shipments__cards">
      {rows.map(({ shipment, job, items, neededBy }) => {
        const t = timing(shipment.eta, neededBy);
        return (
          <li key={shipment.id}>
            <Link to={`/shipments/${shipment.id}`} className="shipments__card" data-testid={`shipment-row-${shipment.id}`}>
              <div className="shipments__card-top">
                <span className="shipments__name">{shipment.name}</span>
                <span className="shipments__eta num" data-testid={`shipment-eta-${shipment.id}`}>
                  {formatDayMonthYear(shipment.eta)}
                </span>
              </div>
              <div className="shipments__card-mid">
                <span data-testid={`shipment-status-text-${shipment.id}`}>{SHIPMENT_STATUS_LABELS[shipment.status]}</span>
                <span data-testid={`shipment-items-${shipment.id}`}>
                  {itemsWords(items.length)} for {job?.name ?? 'no job'}
                </span>
              </div>
              <div className="shipments__card-status">
                <StatusText tone={t.tone} testId={`shipment-timing-${shipment.id}`}>
                  {t.text}
                </StatusText>
                {neededBy && <span className="shipments__needed">needed {formatShort(neededBy)}</span>}
              </div>
              <Money value={job?.weeklyHoldingCost} label="A week late costs" className="shipments__card-money" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
