/**
 * Shipments (v1 look): what's ordered and on its way, soonest ETA first.
 * Inside a job (`#/jobs/:jobId/shipments`, Dom's brief change 2) only that
 * job's shipments; on the desktop sidebar the side-wide list (`#/shipments`),
 * where each row names its job, so two "windows" on two jobs read apart.
 *
 * Each shipment: where it is (Design, In production, Shipped, Delivered), the
 * ETA with its relative time, the earliest needed-by among its open linked
 * items and the gap in plain words ("7 days to spare", "14 days late": two
 * future dates are never red), and the items that take their date from it.
 * Red only when the ETA has passed and it is not marked delivered.
 * Desktop: one table on a plate. Phone: one card per shipment.
 */
import type { DashboardApi, ShipmentRow, SideFilter } from '@ct/core';
import { formatDate, relativeDays } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { usePhoneWidth } from '../shell/useNarrow';
import { LoadError, LoadingRows } from '../components/bits';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { plural, shipmentTimingWords } from '../ui/itemWords';
import { shortRelative } from '../ui/when';
import '../styles/shipments.css';

export interface ShipmentsData {
  today: string;
  rows: ShipmentRow[];
}

export async function loadShipments(api: DashboardApi, filter: SideFilter, jobId: string | null = null): Promise<ShipmentsData> {
  const [today, rows] = await Promise.all([api.getToday(), api.getShipments(filter)]);
  return { today, rows: jobId ? rows.filter((r) => r.jobId === jobId) : rows };
}

export function ShipmentsScreen({ jobId = null }: { jobId?: string | null }) {
  const q = useSideQuery((api, f) => loadShipments(api, f, jobId));
  const count = q.status === 'ready' ? q.data.rows.length : null;
  const meta = count === null ? null : count === 0 ? 'Nothing on order' : plural(count, 'shipment');
  return (
    <div className="ships" data-testid="shipments">
      {jobId ? (
        <div className="ships__head">
          <h2 className="ships__title">Shipments</h2>
          {meta && <p className="page-header__meta">{meta}</p>}
        </div>
      ) : (
        <PageHeader title="Shipments" meta={meta} />
      )}
      {q.status === 'loading' && <LoadingRows rows={2} label="Loading shipments" />}
      {q.status === 'error' && <LoadError what="the shipments" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ShipmentsBody data={q.data} showJob={!jobId} />}
    </div>
  );
}

/** ETA gone and not delivered: the one red case on this screen. */
export function etaOverdue(r: Pick<ShipmentRow, 'eta' | 'status'>, today: string): boolean {
  return !!r.eta && r.eta < today && r.status !== 'delivered';
}

export function ShipmentsBody({ data, showJob }: { data: ShipmentsData; showJob: boolean }) {
  const phone = usePhoneWidth();
  const { today, rows } = data;
  if (!rows.length) return <p className="empty-line">No shipments being tracked.</p>;
  if (phone) {
    return (
      <ul className="ships__cards">
        {rows.map((r) => (
          <li key={r.shipmentId} className="plate ships__card" data-testid={`shipment-row-${r.shipmentId}`} data-late={r.isLate ? 'true' : 'false'}>
            <div className="ships__card-head">
              <ShipName r={r} showJob={showJob} />
              <span className="ships__status" data-testid="ship-status">
                {r.statusLabel}
              </span>
            </div>
            <Eta r={r} today={today} />
            <Needed r={r} today={today} />
            <Linked r={r} today={today} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="plate ships__plate">
      <table className="table ships__table">
        <thead>
          <tr>
            <th scope="col">Shipment</th>
            <th scope="col">Status</th>
            <th scope="col">ETA</th>
            <th scope="col">Needed by</th>
            <th scope="col">Items</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.shipmentId} data-testid={`shipment-row-${r.shipmentId}`} data-late={r.isLate ? 'true' : 'false'}>
              <th scope="row">
                <ShipName r={r} showJob={showJob} />
              </th>
              <td>
                <span className="ships__status" data-testid="ship-status">
                  {r.statusLabel}
                </span>
              </td>
              <td>
                <Eta r={r} today={today} />
              </td>
              <td>
                <Needed r={r} today={today} />
              </td>
              <td>
                <Linked r={r} today={today} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShipName({ r, showJob }: { r: ShipmentRow; showJob: boolean }) {
  return (
    <span className="ships__name-block">
      {showJob && (
        <span className="ships__job" data-testid="ship-job">
          {r.jobName}
        </span>
      )}
      <span className="ships__name">{r.name}</span>
      {r.supplier && <span className="ships__supplier">{r.supplier}</span>}
    </span>
  );
}

function Eta({ r, today }: { r: ShipmentRow; today: string }) {
  if (!r.eta) {
    return (
      <span className="ships__eta-none" data-testid="eta">
        No ETA yet
      </span>
    );
  }
  const late = etaOverdue(r, today);
  return (
    <span className="ships__eta-block">
      <span className="ships__eta" data-testid="eta">
        {formatDate(r.eta, today)}
      </span>
      {late ? (
        <StatusText tone="late" plain className="ships__rel">
          {relativeDays(r.eta, today)}, not marked delivered
        </StatusText>
      ) : (
        <span className="ships__rel">{relativeDays(r.eta, today)}</span>
      )}
    </span>
  );
}

function Needed({ r, today }: { r: ShipmentRow; today: string }) {
  return (
    <span className="ships__needed-block">
      {r.earliestNeededBy ? (
        <span className="ships__needed" data-testid="needed-by">
          {shortRelative(r.earliestNeededBy, today)}
        </span>
      ) : (
        <span className="ships__needed ships__quiet" data-testid="needed-by">
          Not needed yet
        </span>
      )}
      <span className="ships__timing" data-testid="timing">
        {shipmentTimingWords(r)}
      </span>
    </span>
  );
}

function Linked({ r, today }: { r: ShipmentRow; today: string }) {
  if (!r.linkedItems.length) {
    return (
      <span className="ships__quiet" data-testid="linked-items">
        Nothing linked yet
      </span>
    );
  }
  return (
    <ul className="ships__linked" data-testid="linked-items">
      {r.linkedItems.map((i) => (
        <li key={i.itemId}>
          <span className="ships__linked-title">{i.title}</span>
          <span className="ships__linked-meta">{[i.owner, i.status === 'done' ? 'done' : i.neededBy ? `needed ${formatDate(i.neededBy, today)}` : null].filter(Boolean).join(', ')}</span>
        </li>
      ))}
    </ul>
  );
}
