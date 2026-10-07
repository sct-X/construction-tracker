/**
 * Shipments: everything ordered from overseas across every job on this side,
 * soonest ETA first: which job, where it is (Design, In production, Shipped,
 * Delivered), the ETA against the earliest needed-by, and the items that take
 * their expected date from it. Two "windows" on two jobs read apart at a glance.
 */
import { formatDate, relativeDays, type DashboardApi, type ShipmentRow, type SideFilter } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { LoadError, LoadingRows } from '../components/bits';
import { DateCell } from '../components/listBits';
import { SHIPMENT_STEPS, plural, shipmentStepWords, shipmentTimingWords } from '../ui/itemWords';
import '../styles/lists.css';

export interface ShipmentsData {
  today: string;
  rows: ShipmentRow[];
}

export async function loadShipments(api: DashboardApi, filter: SideFilter): Promise<ShipmentsData> {
  const [today, rows] = await Promise.all([api.getToday(), api.getShipments(filter)]);
  return { today, rows };
}

export function ShipmentsScreen() {
  const q = useSideQuery(loadShipments);
  return (
    <div className="screen shipments">
      <header className="screen-head">
        <h1>Shipments</h1>
        {q.status === 'ready' && q.data.rows.length > 0 && (
          <p className="screen-sub" data-testid="shipments-sub">
            {q.data.rows.length
              ? `${plural(q.data.rows.length, 'shipment')} across ${plural(new Set(q.data.rows.map((r) => r.jobId)).size, 'job')}, soonest first. Linked items take their expected date from the ETA.`
              : null}
          </p>
        )}
      </header>
      {q.status === 'loading' && <LoadingRows rows={3} label="Loading shipments" />}
      {q.status === 'error' && <LoadError what="the shipments" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ShipmentsBody data={q.data} />}
    </div>
  );
}

export function ShipmentsBody({ data }: { data: ShipmentsData }) {
  const { today, rows } = data;
  if (!rows.length) return <p className="empty">No shipments being tracked.</p>;
  return (
    <table className="board ship-table">
      <thead>
        <tr>
          <th scope="col">Shipment</th>
          <th scope="col">Where it is</th>
          <th scope="col">ETA</th>
          <th scope="col">First needed</th>
          <th scope="col">Linked items</th>
        </tr>
      </thead>
      {rows.map((r) => (
        <ShipmentLine key={r.shipmentId} row={r} today={today} />
      ))}
    </table>
  );
}

function ShipmentLine({ row, today }: { row: ShipmentRow; today: string }) {
  const items = row.linkedItems;
  const at = SHIPMENT_STEPS.findIndex((s) => s.status === row.status);
  const timing = shipmentTimingWords(row);
  return (
    <tbody className="job ship" data-testid={`shipment-row-${row.shipmentId}`} data-late={row.isLate ? 'true' : 'false'}>
      <tr className="job-main">
        <th scope="row" className="c-ship">
          <span className="ship-job" data-testid="ship-job">
            {row.jobName}
          </span>
          <span className="ship-name">{row.name}</span>
          {row.supplier && <span className="sub">{row.supplier}</span>}
        </th>
        <td className="c-track">
          <span className="cell-label">Where it is </span>
          <ol className="track" aria-label={shipmentStepWords(row.status)}>
            {SHIPMENT_STEPS.map((s, i) => (
              <li key={s.status} className={i < at ? 'track-past' : i === at ? 'track-now' : 'track-next'} aria-hidden="true" />
            ))}
          </ol>
          <span className="track-words" data-testid="ship-status">
            {row.statusLabel}
          </span>
          <span className="sub">Step {at + 1} of 4</span>
        </td>
        <td className="c-eta">
          <span className="cell-label">ETA </span>
          {row.eta ? (
            <>
              <span className="date-md" data-testid="eta">
                {formatDate(row.eta, today)}
              </span>
              <span className="sub">{relativeDays(row.eta, today)}</span>
            </>
          ) : (
            <span className="date-none" data-testid="eta">
              No ETA yet
            </span>
          )}
        </td>
        <td className="c-needed">
          <DateCell label="First needed" iso={row.earliestNeededBy} today={today} testId="needed-by" />
          <span className={row.isLate ? 'flag flag-late' : 'timing'} data-testid="timing">
            {timing}
          </span>
        </td>
        <td className="c-linked">
          <span className="cell-label">Linked items </span>
          {items.length ? (
            <ul className="linked" data-testid="linked-items">
              {items.map((i) => (
                <li key={i.itemId}>
                  <span className="linked-title">{i.title}</span>
                  <span className="linked-meta">
                    {[i.owner, i.status === 'done' ? 'done' : i.neededBy ? `needed ${formatDate(i.neededBy, today)}` : null].filter(Boolean).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="sub" data-testid="linked-items">
              {row.linkedCount ? plural(row.linkedCount, 'linked item') : 'Nothing linked yet'}
            </span>
          )}
        </td>
      </tr>
    </tbody>
  );
}
