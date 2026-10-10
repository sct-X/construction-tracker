/**
 * Shipments (ported from v1 src/screens/Shipments.tsx, read-only): what's on
 * order and whether it arrives in time. Inside a job (`#/jobs/:jobId/shipments`,
 * Dom's brief change 2) only that job's shipments; on the desktop sidebar the
 * side-wide list (`#/shipments`) with a Job column, so two "windows" on two jobs
 * read apart.
 *
 * The ETA is each row's figure ("26 Oct 2026", Title 1 on the phone, Large
 * Title on the desktop) with its relative time and the gap in words under it
 * ("ETA 1 week before needed", "ETA 2 weeks after needed": plain, never red),
 * then the earliest needed-by with its relative time and "3 items". Red only
 * when the ETA has passed and it is not marked delivered. Desktop: a hairline
 * table on the ground. Phone: a plate per shipment.
 */
import { formatDate, formatDayMonth, relativeDays, type DashboardApi, type ShipmentRow, type SideFilter } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { usePhoneWidth } from '../shell/useNarrow';
import { LoadError, LoadingRows } from '../components/bits';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { plural, shipmentTiming } from '../ui/itemWords';
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
  const meta = count === null ? null : plural(count, 'shipment');
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

/** "26 Oct 2026": the row's figure. */
export function etaFigure(iso: string): string {
  return `${formatDayMonth(iso)} ${iso.slice(0, 4)}`;
}

/** Linked items as v1 counted them: open ones ("3 items", "Nothing linked"). */
export function itemsWords(r: Pick<ShipmentRow, 'linkedItems'>): string {
  const open = r.linkedItems.filter((i) => i.status !== 'done').length;
  return open === 0 ? 'Nothing linked' : plural(open, 'item');
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
            <div className="ships__card-top">
              <span className="ships__name">{r.name}</span>
              <span className="ships__status" data-testid="ship-status">
                {r.statusLabel}
              </span>
            </div>
            <Eta r={r} today={today} withNeeded />
            <span className="ships__items" data-testid="linked-items" title={r.linkedItems.map((i) => i.title).join(', ')}>
              {showJob ? (
                <>
                  {itemsWords(r)} for <span data-testid="ship-job">{r.jobName}</span>
                </>
              ) : (
                itemsWords(r)
              )}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <table className="table ships__table">
      <thead>
        <tr>
          <th scope="col">Shipment</th>
          {showJob && <th scope="col">Job</th>}
          <th scope="col">Status</th>
          <th scope="col">ETA</th>
          <th scope="col">Needed by</th>
          <th scope="col">Items</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.shipmentId} data-testid={`shipment-row-${r.shipmentId}`} data-late={r.isLate ? 'true' : 'false'}>
            <td className="ships__cell-name">
              <span className="ships__name">{r.name}</span>
              {r.supplier && <span className="ships__supplier">{r.supplier}</span>}
            </td>
            {showJob && (
              <td className="ships__cell-job" data-testid="ship-job">
                {r.jobName}
              </td>
            )}
            <td>
              <span data-testid="ship-status">{r.statusLabel}</span>
            </td>
            <td>
              <Eta r={r} today={today} />
            </td>
            <td data-testid="needed-by">
              {r.earliestNeededBy ? `${formatDate(r.earliestNeededBy, today)}, ${relativeDays(r.earliestNeededBy, today, { deadline: r.status !== 'delivered' })}` : <span className="ships__muted">No date</span>}
            </td>
            <td data-testid="linked-items" title={r.linkedItems.map((i) => i.title).join(', ')}>
              {itemsWords(r)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Eta({ r, today, withNeeded }: { r: ShipmentRow; today: string; withNeeded?: boolean }) {
  const t = shipmentTiming(r);
  if (!r.eta) {
    return (
      <span className="ships__eta-stack">
        <span className="ships__muted" data-testid="eta">
          No ETA yet
        </span>
      </span>
    );
  }
  const late = etaOverdue(r, today);
  return (
    <span className="ships__eta-stack">
      <span className="ships__eta" data-testid="eta">
        {etaFigure(r.eta)}
      </span>
      {late ? (
        <StatusText tone="late" plain className="ships__rel">
          {relativeDays(r.eta, today)}, not marked delivered
        </StatusText>
      ) : (
        <span className="ships__rel">{relativeDays(r.eta, today)}</span>
      )}
      <span className="ships__words">
        <StatusText tone={t.tone} plain testId="timing">
          {t.text}
        </StatusText>
        {withNeeded && r.earliestNeededBy && (
          <span className="ships__rel" data-testid="needed-by">
            needed {formatDate(r.earliestNeededBy, today)}, {relativeDays(r.earliestNeededBy, today, { deadline: r.status !== 'delivered' })}
          </span>
        )}
      </span>
    </span>
  );
}
