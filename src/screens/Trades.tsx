/**
 * Trades (UI_PLAN 3.22): the subbies on this side, with a phone number you
 * can ring from the list and the jobs each one is on. Desktop: a table.
 * Phone: cards with a 56px "Ring" target, because this list is opened
 * between calls. Admin and partners add, edit and delete; the builder can add
 * a trade he has just booked. The type picker is buttons built from the trade
 * types the programs on this side ask for, so a new trade matches a
 * requirement without anyone typing the same words twice.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, Job, Trade } from '../domain/types';
import type { ItemForecast } from '../domain/forecast';
import { ItemRow } from '../components/ItemRow';
import NotFound from './NotFound';
import { PageHeader } from '../shell/PageHeader';
import { useLayout } from '../shell/AppShell';
import './trades.css';

export interface TradeRow {
  trade: Trade;
  /** Jobs whose open items wait on this trade, or whose program asks for its type. */
  jobs: Job[];
}

/** "0411 200 307" -> "tel:0411200307". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Trade types split out of a requirement's "Plumber, Electrician". */
export function splitTradeTypes(tradeType?: string): string[] {
  if (!tradeType) return [];
  return tradeType
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function jobsWords(jobs: Job[]): string {
  if (jobs.length === 0) return 'Not on a job yet';
  return jobs.map((j) => j.name).join(', ');
}

/** The usual subbies on a house build, so an empty side still gets buttons rather than a blank picker. */
export const COMMON_TRADE_TYPES = [
  'Bricklayer',
  'Certifier',
  'Cladder',
  'Concrete pump',
  'Concreter',
  'Electrician',
  'Excavator',
  'Frame carpenter',
  'Joiner',
  'Landscaper',
  'Painter',
  'Plasterer',
  'Plumber',
  'Roof plumber',
  'Tiler',
  'Waterproofer',
  'Window installer',
];

/** The trade types this side's programs ask for, plus the usual ones and the types already on the list. */
function useTradeTypes(): string[] {
  return useQuery<string[]>((api) => {
    const types = new Set<string>(COMMON_TRADE_TYPES);
    for (const job of api.listJobs({ includeTemplates: true })) {
      for (const r of api.listRequirements(job.id)) if (r.kind === 'trade') for (const t of splitTradeTypes(r.tradeType)) types.add(t);
    }
    for (const t of api.listTrades()) if (t.type) types.add(t.type);
    return [...types].sort((a, b) => a.localeCompare(b));
  }, []);
}

function useRows(): TradeRow[] {
  return useQuery<TradeRow[]>((api) => {
    const jobs = api.listJobs();
    const byId = new Map(jobs.map((j) => [j.id, j]));
    const reqTypes = new Map<string, Set<string>>(); // jobId -> trade types its program asks for
    for (const job of jobs) {
      const set = new Set<string>();
      for (const r of api.listRequirements(job.id)) if (r.kind === 'trade') for (const t of splitTradeTypes(r.tradeType)) set.add(t);
      reqTypes.set(job.id, set);
    }
    return api.listTrades().map((trade) => {
      const ids = new Set<string>();
      for (const item of api.listItems({ tradeId: trade.id })) ids.add(item.jobId);
      for (const [jobId, set] of reqTypes) if (set.has(trade.type)) ids.add(jobId);
      const onJobs = jobs.filter((j) => ids.has(j.id) && byId.has(j.id));
      return { trade, jobs: onJobs };
    });
  }, []);
}

/** Admin, partners and the builder keep the trade list; the site role only reads it (and cannot open the screen). */
export function canEditTrades(role: string): boolean {
  return role === 'admin' || role === 'partner' || role === 'builder';
}

export default function Trades() {
  const { side, role, offline } = useSession();
  const layout = useLayout();
  const rows = useRows();
  const types = useTradeTypes();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canEdit = canEditTrades(role) && !offline;
  const count = rows.length === 1 ? '1 trade' : `${rows.length} trades`;

  const addButton =
    canEditTrades(role) && !adding ? (
      <button type="button" className="btn btn--primary btn--desktop" data-testid="trade-add" disabled={offline} onClick={() => { setAdding(true); setEditingId(null); }}>
        {offline ? 'Add trade: needs signal' : 'Add trade'}
      </button>
    ) : undefined;

  return (
    <main className="page trades" data-testid="trades">
      <PageHeader title="Trades" meta={`${count} on ${side.name}`} actions={addButton} />
      {offline && canEditTrades(role) && (
        <p className="trades__offline" data-testid="trades-offline">
          Needs signal. You can ring anyone from here, but adding or changing a trade waits until you are back in range.
        </p>
      )}
      {adding && <TradeForm types={types} onDone={() => setAdding(false)} />}
      {rows.length === 0 ? (
        <div className="trades__empty" data-testid="trades-empty">
          <p className="trades__empty-words">No trades yet. Add them as you book them.</p>
          {canEdit && !adding && (
            <button type="button" className="btn btn--primary" data-testid="trade-add-empty" onClick={() => setAdding(true)}>
              Add the first trade
            </button>
          )}
        </div>
      ) : layout === 'desktop' ? (
        <TradeTable rows={rows} canEdit={canEdit} editingId={editingId} setEditingId={setEditingId} types={types} />
      ) : (
        <TradeCards rows={rows} canEdit={canEdit} editingId={editingId} setEditingId={setEditingId} types={types} />
      )}
    </main>
  );
}

interface ListProps {
  rows: TradeRow[];
  canEdit: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  types: string[];
}

function TradeTable({ rows, canEdit, editingId, setEditingId, types }: ListProps) {
  return (
    <table className="trades__table">
      <thead>
        <tr>
          <th scope="col">Trade</th>
          <th scope="col">Type</th>
          <th scope="col">Phone</th>
          <th scope="col">On jobs</th>
          {canEdit && (
            <th scope="col">
              <span className="trades__sr">Change</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ trade, jobs }) =>
          editingId === trade.id ? (
            <tr key={trade.id} data-testid={`trade-${trade.id}`}>
              <td colSpan={canEdit ? 5 : 4} className="trades__edit-cell">
                <TradeForm trade={trade} types={types} onDone={() => setEditingId(null)} />
              </td>
            </tr>
          ) : (
            <tr key={trade.id} className="trades__row" data-testid={`trade-${trade.id}`}>
              <td className="trades__cell-name">
                <Link to={`/trades/${trade.id}`} className="trades__name" data-testid={`trade-open-${trade.id}`}>
                  {trade.name}
                </Link>
              </td>
              <td className="trades__cell-type">{trade.type || <span className="trades__muted">No type</span>}</td>
              <td className="trades__cell-phone">
                {trade.phone ? (
                  <a className="trades__tel" href={telHref(trade.phone)} data-testid={`trade-ring-${trade.id}`}>
                    {trade.phone}
                  </a>
                ) : (
                  <span className="trades__muted">No number</span>
                )}
              </td>
              <td className="trades__cell-jobs" data-testid={`trade-jobs-${trade.id}`}>
                {jobsWords(jobs)}
              </td>
              {canEdit && (
                <td className="trades__cell-actions">
                  <button type="button" className="btn btn--desktop" data-testid={`trade-edit-${trade.id}`} onClick={() => setEditingId(trade.id)}>
                    Edit
                  </button>
                </td>
              )}
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function TradeCards({ rows, canEdit, editingId, setEditingId, types }: ListProps) {
  return (
    <ul className="trades__cards">
      {rows.map(({ trade, jobs }) => (
        <li key={trade.id} className="trades__card" data-testid={`trade-${trade.id}`}>
          {editingId === trade.id ? (
            <TradeForm trade={trade} types={types} onDone={() => setEditingId(null)} />
          ) : (
            <>
              <div className="trades__card-words">
                <Link to={`/trades/${trade.id}`} className="trades__name" data-testid={`trade-open-${trade.id}`}>
                  {trade.name}
                </Link>
                <span className="trades__type">{trade.type || 'No type'}</span>
                <span className="trades__jobs" data-testid={`trade-jobs-${trade.id}`}>
                  {jobsWords(jobs)}
                </span>
                {canEdit && (
                  <button type="button" className="trades__edit-link" data-testid={`trade-edit-${trade.id}`} onClick={() => setEditingId(trade.id)}>
                    Edit
                  </button>
                )}
              </div>
              {trade.phone ? (
                <a className="trades__ring" href={telHref(trade.phone)} data-testid={`trade-ring-${trade.id}`}>
                  <span className="trades__ring-word">Ring</span>
                  <span className="trades__ring-number">{trade.phone}</span>
                </a>
              ) : (
                <span className="trades__ring trades__ring--none">No number</span>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * One form for adding and editing. Type is a row of buttons from the side's
 * requirements; "Something else" opens a text field for a type no program
 * has asked for yet. Delete asks once, in words, before it goes.
 */
function TradeForm({ trade, types, onDone, onDeleted }: { trade?: Trade; types: string[]; onDone: () => void; onDeleted?: () => void }) {
  const api = useApi();
  const { role, offline } = useSession();
  const [name, setName] = useState(trade?.name ?? '');
  const [type, setType] = useState(trade?.type ?? '');
  const [other, setOther] = useState(() => (trade?.type && !types.includes(trade.type) ? trade.type : ''));
  const [otherOpen, setOtherOpen] = useState(() => !!trade?.type && !types.includes(trade.type));
  const [phone, setPhone] = useState(trade?.phone ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const finalType = otherOpen ? other.trim() : type;
  const ready = name.trim().length > 0 && finalType.length > 0 && !offline;
  const canDelete = !!trade && canEditTrades(role) && !offline;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const input = { name: name.trim(), type: finalType, phone: phone.trim() || undefined };
    if (trade) api.updateTrade(trade.id, input);
    else api.addTrade(input);
    onDone();
  }

  function remove() {
    if (!trade) return;
    api.deleteTrade(trade.id);
    onDone();
    onDeleted?.();
  }

  const prefix = trade ? `trade-${trade.id}-` : '';
  return (
    <form className="trades__form" data-testid={trade ? `trade-edit-form-${trade.id}` : 'trade-add-form'} onSubmit={submit}>
      <h2 className="trades__form-title">{trade ? `Change ${trade.name}` : 'New trade'}</h2>
      <div className="trades__field">
        <label htmlFor={`${prefix}trade-name`}>Business or person</label>
        <input id={`${prefix}trade-name`} className="trades__input" value={name} data-testid="trade-name" onChange={(e) => setName(e.target.value)} placeholder="Baxter Plumbing" />
      </div>
      <div className="trades__field">
        <span className="trades__field-label" id={`${prefix}trade-type-label`}>
          What they do
        </span>
        <div className="trades__picker" role="group" aria-labelledby={`${prefix}trade-type-label`}>
          {types.map((t) => (
            <button
              key={t}
              type="button"
              className="trades__pick"
              aria-pressed={!otherOpen && t === type}
              data-testid={`trade-type-${t.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              onClick={() => {
                setType(t);
                setOtherOpen(false);
              }}
            >
              {t}
            </button>
          ))}
          <button type="button" className="trades__pick" aria-pressed={otherOpen} data-testid="trade-type-other" onClick={() => setOtherOpen(true)}>
            Something else
          </button>
        </div>
        {otherOpen && (
          <input className="trades__input" value={other} data-testid="trade-type-other-text" aria-label="Trade type" onChange={(e) => setOther(e.target.value)} placeholder="Scaffolder" />
        )}
      </div>
      <div className="trades__field">
        <label htmlFor={`${prefix}trade-phone`}>Phone</label>
        <input id={`${prefix}trade-phone`} className="trades__input num" type="tel" inputMode="tel" value={phone} data-testid="trade-phone" onChange={(e) => setPhone(e.target.value)} placeholder="0411 200 300" />
      </div>
      <div className="trades__form-actions">
        <button type="submit" className="btn btn--primary" data-testid="trade-save" disabled={!ready}>
          {offline ? 'Needs signal' : trade ? 'Save changes' : 'Add trade'}
        </button>
        <button type="button" className="btn" data-testid="trade-cancel" onClick={onDone}>
          Cancel
        </button>
        {canDelete && !confirmDelete && (
          <button type="button" className="btn trades__delete" data-testid={`trade-delete-${trade.id}`} onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
      </div>
      {canDelete && confirmDelete && (
        <div className="trades__confirm" data-testid={`trade-delete-words-${trade.id}`}>
          <p>Delete {trade.name}? Items waiting on them keep their words but lose the number.</p>
          <div className="trades__form-actions">
            <button type="button" className="btn trades__delete" data-testid={`trade-delete-confirm-${trade.id}`} onClick={remove}>
              Yes, delete {trade.name}
            </button>
            <button type="button" className="btn" data-testid={`trade-delete-keep-${trade.id}`} onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * One trade (UI_PLAN 3.22): the number, the jobs they are on, and the items
 * waiting on them, as the shared item row. Version two's "what's owed" sits
 * on this page later. Edit and delete live here too, through the same form.
 */
export function TradeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { role, offline } = useSession();
  const types = useTradeTypes();
  const [editing, setEditing] = useState(false);
  const row = useRows().find((r) => r.trade.id === id);
  const items = useQuery<{ item: Item; forecast?: ItemForecast; jobName: string; ownerName?: string }[]>(
    (api) => {
      const jobs = new Map(api.listJobs().map((j) => [j.id, j.name]));
      return api
        .listItems({ tradeId: id })
        .map((item) => ({
          item,
          forecast: api.getForecast(item.jobId)?.items[item.id],
          jobName: jobs.get(item.jobId) ?? '',
          ownerName: item.ownerId ? api.getPerson(item.ownerId)?.shortName : undefined,
        }))
        .sort((a, b) => (a.forecast?.actBy ?? '9').localeCompare(b.forecast?.actBy ?? '9'));
    },
    [id],
  );
  if (!row) return <NotFound />;
  const { trade, jobs } = row;
  const canEdit = canEditTrades(role);
  const itemHref = api.canSee('item') ? (itemId: string) => `/items/${itemId}` : () => undefined;
  const editButton =
    canEdit && !editing ? (
      <button type="button" className="btn btn--desktop" data-testid={`trade-edit-${trade.id}`} disabled={offline} onClick={() => setEditing(true)}>
        {offline ? 'Edit: needs signal' : 'Edit'}
      </button>
    ) : undefined;

  return (
    <main className="page trades" data-testid="trade-detail">
      <PageHeader title={trade.name} meta={trade.type || 'No type'} back={{ to: '/trades', label: 'Trades' }} actions={editButton} />
      {editing ? (
        <TradeForm trade={trade} types={types} onDone={() => setEditing(false)} onDeleted={() => navigate('/trades')} />
      ) : (
        <div className="trades__detail-top">
          {trade.phone ? (
            <a className="trades__ring" href={telHref(trade.phone)} data-testid={`trade-ring-${trade.id}`}>
              <span className="trades__ring-word">Ring</span>
              <span className="trades__ring-number">{trade.phone}</span>
            </a>
          ) : (
            <span className="trades__ring trades__ring--none">No number</span>
          )}
          <p className="trades__detail-jobs" data-testid={`trade-jobs-${trade.id}`}>
            {jobs.length === 0 ? 'Not on a job yet.' : `On ${jobsWords(jobs)}.`}
          </p>
        </div>
      )}
      <section className="trades__items" aria-labelledby="trade-items-title">
        <h2 id="trade-items-title" className="trades__items-title">
          {items.length === 0 ? 'Nothing waiting on them' : items.length === 1 ? '1 item waiting on them' : `${items.length} items waiting on them`}
        </h2>
        {items.length === 0 ? (
          <p className="trades__muted" data-testid="trade-detail-empty">
            No open items are waiting on {trade.name}.
          </p>
        ) : (
          <ul className="trades__item-list" data-testid="trade-detail-items">
            {items.map(({ item, forecast, jobName, ownerName }) => (
              <li key={item.id}>
                <ItemRow item={item} forecast={forecast} ownerName={ownerName} href={itemHref(item.id)} context={jobName} testId={`trade-detail-item-${item.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
