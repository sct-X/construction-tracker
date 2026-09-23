/**
 * Shipment detail (UI_PLAN 3.13, flow d): the one place an ETA is changed,
 * showing what the change does before it is saved.
 *
 * The ETA is the screen's one big figure. Status is a segmented trough of
 * four (never a dropdown). The ETA editor is a date field; as soon as the draft
 * differs from the saved ETA, the impact panel (<EtaImpact>) appears with the
 * items, the first step and the job's finish in words, and "Save new ETA"
 * applies it through api.setShipmentEta, which logs the activity entry that
 * "Why it moved" reads. Linked items take their expected date from the ETA in
 * the calculator (ItemForecast.expectedFromShipmentId); this screen only
 * shows it. Offline the screen is read-only ("Needs signal").
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { ActivityEntry, Item, ShipmentStatus } from '../domain/types';
import { ITEM_STATUS_LABELS, SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_ORDER } from '../domain/types';
import type { EtaPreview, ItemForecast } from '../domain/forecast';
import { formatDayMonth, formatLong, formatShort, formatShortRelative, formatTime, isISODate, relativeDate } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { EtaImpact } from '../components/EtaImpact';
import { StatusText } from '../components/StatusText';
import { PageHeader } from '../shell/PageHeader';
import { useLayout } from '../shell/AppShell';
import { timing } from './Shipments';
import './shipmentDetail.css';

interface LinkedRow {
  item: Item;
  forecast?: ItemForecast;
  ownerName?: string;
}

export default function ShipmentDetail() {
  const api = useApi();
  const { id = '' } = useParams();
  const { offline, role, today } = useSession();
  const layout = useLayout();
  const shipment = useQuery((api) => api.getShipment(id), [id]);
  const job = useQuery((api) => (shipment ? api.getJob(shipment.jobId) : undefined), [shipment?.jobId]);
  const forecast = useQuery((api) => (shipment ? api.getForecast(shipment.jobId) : undefined), [shipment?.jobId]);
  const rows = useQuery<LinkedRow[]>(
    (api) =>
      shipment
        ? api.listItems({ shipmentId: shipment.id, includeDone: true }).map((item) => ({
            item,
            forecast: forecast?.items[item.id],
            ownerName: item.ownerId ? api.getPerson(item.ownerId)?.name : undefined,
          }))
        : [],
    [shipment?.id, forecast],
  );
  const candidates = useQuery<Item[]>(
    (api) => (shipment ? api.listItems({ jobId: shipment.jobId, type: 'material' }).filter((i) => !i.shipmentId) : []),
    [shipment?.jobId],
  );
  const history = useQuery<ActivityEntry[]>((api) => (shipment ? api.listActivity({ shipmentId: shipment.id }) : []), [shipment?.id]);
  const people = useQuery((api) => new Map(api.listPeople().map((p) => [p.id, p.shortName])), []);

  const [draft, setDraft] = useState<string>(shipment?.eta ?? '');
  const [offerDone, setOfferDone] = useState(false);
  useEffect(() => setDraft(shipment?.eta ?? ''), [shipment?.eta]);

  if (!shipment) {
    return (
      <main className="page shipment" data-testid="shipment-detail">
        <PageHeader title="Shipment" back={{ to: '/shipments', label: 'Shipments' }} />
        <p className="shipment__empty" data-testid="shipment-missing">
          No shipment with that id on this side.
        </p>
      </main>
    );
  }

  const canEdit = role === 'admin' || role === 'partner' || role === 'builder';
  const locked = offline || !canEdit;
  const openItems = rows.filter((r) => r.item.status !== 'done');
  const neededBy = openItems.map((r) => r.forecast?.neededBy).filter((d): d is string => !!d).sort()[0];
  const t = timing(shipment.eta, neededBy);
  const dirty = isISODate(draft) && draft !== shipment.eta;
  let preview: EtaPreview | undefined;
  if (dirty) {
    try {
      preview = api.previewEtaChange(shipment.id, draft);
    } catch {
      preview = undefined;
    }
  }

  function save() {
    if (!shipment || !preview) return;
    api.setShipmentEta(shipment.id, preview.newEta);
  }

  function setStatus(status: ShipmentStatus) {
    if (!shipment || status === shipment.status) return;
    api.setShipmentStatus(shipment.id, status);
    setOfferDone(status === 'delivered' && openItems.length > 0);
  }

  function link(itemId: string) {
    if (shipment) api.linkItemToShipment(itemId, shipment.id);
  }
  function unlink(itemId: string) {
    api.linkItemToShipment(itemId, null);
  }

  function markItemsDone() {
    for (const r of openItems) api.updateItemStatus(r.item.id, 'done');
    setOfferDone(false);
  }

  const supplierLine = [shipment.supplier ? `From ${shipment.supplier}` : null].filter(Boolean).join('');

  return (
    <main className="page shipment" data-testid="shipment-detail">
      <PageHeader
        title={shipment.name}
        back={{ to: '/shipments', label: 'Shipments' }}
        meta={
          <>
            {supplierLine ? `${supplierLine} for ` : 'For '}
            {job ? (
              <Link to={`/jobs/${job.id}`} data-testid="shipment-job-link">
                {job.name}
              </Link>
            ) : (
              'a job on this side'
            )}
          </>
        }
      />

      <section className="shipment__hero">
        <BigNumber value={formatLong(shipment.eta)} label={`ETA ${relativeDate(shipment.eta, today)}`} testId="shipment-eta" tone={t.tone === 'late' ? 'late' : undefined} />
        <div className="shipment__timing">
          <StatusText tone={t.tone} testId="shipment-timing">
            {t.text}
          </StatusText>
          {neededBy && (
            <span className="shipment__needed" data-testid="shipment-needed-by">
              Needed by {formatShortRelative(neededBy, today, { deadline: true })}
            </span>
          )}
        </div>
      </section>

      <section className="shipment__status" aria-labelledby="shipment-status-heading">
        <h2 id="shipment-status-heading" className="shipment__heading">
          Status
        </h2>
        <div className="seg shipment__status-strip" role="group" aria-label="Shipment status">
          {SHIPMENT_STATUS_ORDER.map((s, i) => {
            const current = s === shipment.status;
            const passed = SHIPMENT_STATUS_ORDER.indexOf(shipment.status) > i;
            return (
              <button
                key={s}
                type="button"
                className={['seg__btn', 'shipment__status-btn', passed ? 'shipment__status-btn--passed' : ''].filter(Boolean).join(' ')}
                aria-pressed={current}
                disabled={locked}
                data-testid={`shipment-status-${s}`}
                onClick={() => setStatus(s)}
              >
                {SHIPMENT_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
        {offline && <p className="shipment__signal">Needs signal</p>}
        {offerDone && (
          <div className="shipment__offer" data-testid="shipment-offer-done">
            <p>Mark the {openItems.length === 1 ? '1 linked item' : `${openItems.length} linked items`} done?</p>
            <div className="shipment__offer-actions">
              <button type="button" className="btn btn--fill btn--desktop" data-testid="shipment-mark-items-done" onClick={markItemsDone}>
                Mark {openItems.length === 1 ? 'it' : 'them'} done
              </button>
              <button type="button" className="btn btn--desktop" data-testid="shipment-offer-dismiss" onClick={() => setOfferDone(false)}>
                Not yet
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="shipment__eta" aria-labelledby="shipment-eta-heading">
        <h2 id="shipment-eta-heading" className="shipment__heading">
          New ETA
        </h2>
        <div className="shipment__eta-row">
          <label className="sr-only" htmlFor="shipment-eta-input">
            New ETA
          </label>
          <input
            id="shipment-eta-input"
            className="input num shipment__eta-input"
            type="date"
            value={draft}
            disabled={locked}
            data-testid="shipment-eta-input"
            onChange={(e) => setDraft(e.target.value)}
          />
          {offline && <span className="shipment__signal">Needs signal</span>}
        </div>
        {preview && job && (
          <>
            <EtaImpact preview={preview} />
            <div className="shipment__eta-actions">
              <button type="button" className="btn btn--primary" data-testid="shipment-save-eta" onClick={save} disabled={locked}>
                Save new ETA
              </button>
              <button type="button" className="btn" data-testid="shipment-cancel-eta" onClick={() => setDraft(shipment.eta)}>
                Keep {formatDayMonth(shipment.eta)}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="shipment__items" aria-labelledby="shipment-items-heading">
        <h2 id="shipment-items-heading" className="shipment__heading">
          {rows.length === 1 ? '1 linked item' : `${rows.length} linked items`}
        </h2>
        {rows.length === 0 ? (
          <p className="shipment__empty">No items linked yet.</p>
        ) : layout === 'desktop' ? (
          <ItemsTable rows={rows} onUnlink={locked ? undefined : unlink} />
        ) : (
          <ItemsList rows={rows} onUnlink={locked ? undefined : unlink} />
        )}
        {canEdit && (
          <div className="shipment__link" data-testid="shipment-link-items">
            <h3 className="shipment__subheading">Link an item</h3>
            {candidates.length === 0 ? (
              <p className="shipment__empty">Every material on this job is already on a shipment.</p>
            ) : (
              <ul className="shipment__candidates">
                {candidates.map((item) => (
                  <li key={item.id} className="shipment__candidate">
                    <span className="shipment__candidate-title">{item.title}</span>
                    <button type="button" className="btn btn--desktop" data-testid={`shipment-link-item-${item.id}`} disabled={locked} onClick={() => link(item.id)}>
                      Link<span className="sr-only"> {item.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {offline && <p className="shipment__signal">Needs signal</p>}
          </div>
        )}
      </section>

      <section className="shipment__history" aria-labelledby="shipment-history-heading">
        <h2 id="shipment-history-heading" className="shipment__heading">
          History
        </h2>
        {history.length === 0 ? (
          <p className="shipment__empty">Nothing yet.</p>
        ) : (
          <ol className="shipment__history-list" data-testid="shipment-history">
            {history.map((a) => (
              <li key={a.id} className="shipment__history-entry" data-testid={`shipment-history-${a.id}`}>
                <span className="shipment__history-when num">
                  {formatDayMonth(a.at.slice(0, 10))} {formatTime(a.at)}
                </span>
                <span className="shipment__history-text">
                  {a.text}
                  <span className="shipment__history-who"> ({people.get(a.personId) ?? a.personId})</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function ItemStatus({ row }: { row: LinkedRow }) {
  const { item, forecast } = row;
  if (item.status === 'done') return <StatusText tone="muted">Done</StatusText>;
  if (forecast?.lateText) return <StatusText tone="late">{forecast.lateText}</StatusText>;
  return <StatusText tone="plain">{ITEM_STATUS_LABELS[item.status]}</StatusText>;
}

type Unlink = ((itemId: string) => void) | undefined;

function UnlinkButton({ id, onUnlink }: { id: string; onUnlink: Unlink }) {
  if (!onUnlink) return null;
  return (
    <button type="button" className="btn btn--ghost btn--desktop shipment__unlink" data-testid={`shipment-unlink-item-${id}`} onClick={() => onUnlink(id)}>
      Unlink
    </button>
  );
}

/** A date in a table cell with its relative time on a quiet second line. */
function DateCell({ iso, deadline }: { iso?: string; deadline?: boolean }) {
  const { today } = useSession();
  if (!iso) return null;
  return (
    <>
      {formatShort(iso)}
      <span className="shipment__item-substatus">{relativeDate(iso, today, { deadline })}</span>
    </>
  );
}

function ItemsTable({ rows, onUnlink }: { rows: LinkedRow[]; onUnlink: Unlink }) {
  return (
    <table className="table shipment__table">
      <thead>
        <tr>
          <th scope="col">Item</th>
          <th scope="col">Owner</th>
          <th scope="col">Act by</th>
          <th scope="col">Needed by</th>
          <th scope="col">Expected</th>
          <th scope="col">Status</th>
          {onUnlink && (
            <th scope="col">
              <span className="sr-only">Unlink</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.item.id} data-testid={`shipment-item-${row.item.id}`}>
            <td>
              <Link to={`/items/${row.item.id}`} className="shipment__item-link">
                {row.item.title}
              </Link>
            </td>
            <td>{row.ownerName ?? <span className="shipment__muted">Nobody</span>}</td>
            <td className="num">
              <DateCell iso={row.forecast?.actBy} deadline={row.item.status === 'to_do' || row.item.status === 'booked'} />
            </td>
            <td className="num">
              <DateCell iso={row.forecast?.neededBy} deadline={row.item.status !== 'done'} />
            </td>
            <td className="num" data-testid={`shipment-item-expected-${row.item.id}`}>
              <DateCell iso={row.forecast?.expected} />
            </td>
            <td>
              <span data-testid={`shipment-item-status-${row.item.id}`}>
                <ItemStatus row={row} />
                {row.item.status !== 'done' && row.forecast?.lateText && (
                  <span className="shipment__item-substatus">{ITEM_STATUS_LABELS[row.item.status]}</span>
                )}
              </span>
            </td>
            {onUnlink && (
              <td className="shipment__cell-unlink">
                <UnlinkButton id={row.item.id} onUnlink={onUnlink} />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ItemsList({ rows, onUnlink }: { rows: LinkedRow[]; onUnlink: Unlink }) {
  const { today } = useSession();
  return (
    <ul className="shipment__list">
      {rows.map((row) => (
        <li key={row.item.id} className="shipment__list-row" data-testid={`shipment-item-${row.item.id}`}>
          <Link to={`/items/${row.item.id}`} className="shipment__item-card">
            <div className="shipment__item-top">
              <span className="shipment__item-title">{row.item.title}</span>
              <span data-testid={`shipment-item-status-${row.item.id}`}>
                <ItemStatus row={row} />
              </span>
            </div>
            <div className="shipment__item-meta">
              <span>{row.ownerName ?? 'Nobody'}</span>
              {row.forecast?.actBy && <span className="num">act by {formatShortRelative(row.forecast.actBy, today, { deadline: row.item.status === 'to_do' || row.item.status === 'booked' })}</span>}
              {row.forecast?.expected && (
                <span className="num" data-testid={`shipment-item-expected-${row.item.id}`}>
                  expected {formatShortRelative(row.forecast.expected, today)}
                </span>
              )}
              {row.item.status !== 'done' && row.forecast?.lateText && <span>{ITEM_STATUS_LABELS[row.item.status]}</span>}
            </div>
          </Link>
          <UnlinkButton id={row.item.id} onUnlink={onUnlink} />
        </li>
      ))}
    </ul>
  );
}
