/**
 * Waiting-on list (UI_PLAN 3.8, wireframe "Waiting-on list, phone"): the one
 * list of everything that can hold a job up, built for Raff to tick off with
 * a thumb between calls. `#/waiting?owner=me` is his home.
 *
 *   [Mine | Anyone]  [All jobs | Park Rd | ...]  [All types | ...]
 *
 *   9  Overdue                        <- a plate: the one loud thing
 *   ! Act by Mon 10 Aug, 5 weeks ago      Ordered or booked
 *   Windows  Park Rd                      Material
 *   waiting on Hangzhou Glazing Co, with you
 *   Call  Set date                        [Mark confirmed]
 *
 *   2  This week  14-20 Sep
 *   1  Next week  21-27 Sep
 *   18 Later                              show
 *   11 Done                               show
 *
 * Groups are by act-by date (the reminder date): Overdue is act-by passed or
 * the item already late; then this week, next week, later; done items sit
 * collapsed at the foot. Filters are buttons: owner (mine / anyone), job,
 * type; the side is automatic. Every row is the shared <ItemRow> (a link to
 * the item sheet) with one action that moves the status forward, labelled
 * with exactly what it does. The desktop draws the same rows as a table with
 * the extra columns. Alec never reaches this screen (the guard refuses the
 * site role); his deliveries list is his version.
 */
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, ItemType, Job, Person, Trade } from '../domain/types';
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '../domain/types';
import type { ItemForecast, JobForecast } from '../domain/forecast';
import { addCalendarDays, agoWords, formatShort, formatWeekRange, lastMonday } from '../domain/dates';
import { nextStatus } from '../domain/itemFlow';
import { ITEM_TYPE_WORDS, ItemRow, ItemRowList, itemWhenWords } from '../components/ItemRow';
import { StatusText, type Tone } from '../components/StatusText';
import { useLayout } from '../shell/AppShell';
import { PageHeader } from '../shell/PageHeader';
import './waitingOn.css';

export type GroupKey = 'overdue' | 'this-week' | 'next-week' | 'later' | 'done';

const GROUP_ORDER: GroupKey[] = ['overdue', 'this-week', 'next-week', 'later', 'done'];

/**
 * The date an open item is grouped and sorted by: the act-by date (the
 * reminder) until it is confirmed, then the date it is expected or needed,
 * since the acting is done and only the arrival is left.
 */
export function keyDate(item: Item, f: ItemForecast | undefined): string | undefined {
  if (!f) return undefined;
  return item.status === 'confirmed' ? (f.expected ?? f.neededBy) : f.actBy;
}

/** Which group an item sits in. Overdue: late, or its key date has passed. */
export function groupFor(item: Item, f: ItemForecast | undefined, today: string): GroupKey {
  if (item.status === 'done') return 'done';
  if (f?.isLate) return 'overdue';
  const key = keyDate(item, f);
  if (!key) return 'later';
  if (key < today) return 'overdue';
  const monday = lastMonday(today);
  const nextMon = addCalendarDays(monday, 7);
  const afterNext = addCalendarDays(monday, 14);
  if (key < nextMon) return 'this-week';
  if (key < afterNext) return 'next-week';
  return 'later';
}

/**
 * The row's one date phrase, relative to today, replacing the shared row's
 * default: "Act by Mon 10 Aug, 5 weeks ago" until the item is confirmed,
 * then "Expected Wed 16 Sep, yesterday". A late item keeps the calculator's
 * own late phrase (undefined leaves the default in place).
 */
export function rowWhenWords(item: Item, f: ItemForecast | undefined, today: string): { text: string; tone: Tone } | undefined {
  if (!f || f.isLate || item.status === 'done') return undefined;
  if (item.status === 'confirmed') {
    const when = f.expected ?? f.neededBy;
    if (!when) return undefined;
    return { text: `${f.expected ? 'Expected' : 'Needed'} ${formatShort(when)}, ${agoWords(when, today)}`, tone: when < today ? 'amber' : 'plain' };
  }
  if (!f.actBy) return undefined;
  return { text: `Act by ${formatShort(f.actBy)}, ${agoWords(f.actBy, today)}`, tone: f.actBy < today ? 'amber' : 'plain' };
}

interface Row {
  item: Item;
  f?: ItemForecast;
  job?: Job;
  group: GroupKey;
}

function groupTitle(key: GroupKey, today: string): { title: string; sub?: string } {
  const monday = lastMonday(today);
  switch (key) {
    case 'overdue':
      return { title: 'Overdue' };
    case 'this-week':
      return { title: 'This week', sub: formatWeekRange(monday) };
    case 'next-week':
      return {
        title: 'Next week',
        sub: formatWeekRange(addCalendarDays(monday, 7)),
      };
    case 'later':
      return { title: 'Later' };
    case 'done':
      return { title: 'Done' };
  }
}

export default function WaitingOn() {
  const api = useApi();
  const { personId, role, today } = useSession();
  const layout = useLayout();
  const [params, setParams] = useSearchParams();

  const ownerParam = params.get('owner'); // "me" or a person id
  const jobParam = params.get('job');
  const typeParam = params.get('type') as ItemType | null;

  const data = useQuery((api) => {
    const jobs = api.listJobs();
    const items = api.listItems({ includeDone: true });
    const forecasts = new Map<string, JobForecast | undefined>();
    for (const j of jobs) forecasts.set(j.id, api.getForecast(j.id));
    return { jobs, items, forecasts, people: api.listPeople(), trades: api.listTrades() };
  }, []);
  const { jobs, items, forecasts, people, trades } = data;
  const { offline } = useSession();
  const tradeOf = (r: Row): Trade | undefined => (r.item.tradeId ? trades.find((t) => t.id === r.item.tradeId) : undefined);
  // Inline "Set date": which row is editing its expected date, and the draft.
  const [dating, setDating] = useState<{ id: string; value: string } | null>(null);
  const nameOf = (pid?: string) => people.find((p: Person) => p.id === pid)?.shortName;

  const ownerId = ownerParam === 'me' ? personId : (ownerParam ?? undefined);

  const rows = useMemo<Row[]>(() => {
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    return items
      .filter((i) => (!ownerId || i.ownerId === ownerId) && (!jobParam || i.jobId === jobParam) && (!typeParam || i.type === typeParam))
      .map((item) => {
        const f = forecasts.get(item.jobId)?.items[item.id];
        return {
          item,
          f,
          job: jobById.get(item.jobId),
          group: groupFor(item, f, today),
        };
      })
      .sort((a, b) => {
        if (a.group === 'done' && b.group === 'done') return (b.item.doneAt ?? '').localeCompare(a.item.doneAt ?? '');
        const ka = keyDate(a.item, a.f) ?? '9999';
        const kb = keyDate(b.item, b.f) ?? '9999';
        return ka.localeCompare(kb) || a.item.title.localeCompare(b.item.title);
      });
  }, [items, forecasts, jobs, ownerId, jobParam, typeParam, today]);

  const groups = GROUP_ORDER.map((key) => ({
    key,
    rows: rows.filter((r) => r.group === key),
  }));
  const openCount = rows.filter((r) => r.group !== 'done').length;
  const overdueCount = groups[0].rows.length;
  const typesPresent = Array.from(new Set(items.map((i) => i.type))) as ItemType[];
  const typeOrder = (Object.keys(ITEM_TYPE_LABELS) as ItemType[]).filter((t) => typesPresent.includes(t));

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const advance = (item: Item) => {
    const next = nextStatus(item);
    if (next) api.updateItemStatus(item.id, next.status);
  };
  const saveDate = () => {
    if (!dating) return;
    api.setItemExpectedDate(dating.id, dating.value || undefined);
    setDating(null);
  };

  const jobFilter = jobParam ? jobs.find((j) => j.id === jobParam) : undefined;
  const addHref = `/items/new${jobParam ? `?job=${jobParam}` : ''}`;
  const title = ownerParam === 'me' ? 'My items' : 'Waiting on';
  const meta =
    openCount === 0
      ? 'Nothing waiting.'
      : `${openCount} to act on${overdueCount ? `, ${overdueCount} overdue` : ''}${jobFilter ? ` on ${jobFilter.name}` : ''}`;

  const chip = (key: string, label: string, pressed: boolean, onClick: () => void) => (
    <button key={key} type="button" className="seg__btn" aria-pressed={pressed} onClick={onClick} data-testid={`waiting-filter-${key}`}>
      {label}
    </button>
  );

  const filters = (
    <div className="waiting__filters" data-testid="waiting-filters">
      <div className="seg waiting__seg" role="group" aria-label="Owner">
        {chip('mine', 'Mine', ownerParam === 'me', () => setParam('owner', ownerParam === 'me' ? null : 'me'))}
        {chip('anyone', 'Anyone', !ownerParam, () => setParam('owner', null))}
        {role !== 'builder' &&
          people
            .filter((p) => p.id !== personId)
            .map((p) => chip(`owner-${p.id}`, p.shortName, ownerParam === p.id, () => setParam('owner', ownerParam === p.id ? null : p.id)))}
      </div>
      <div className="seg waiting__seg" role="group" aria-label="Job">
        {chip('all-jobs', 'All jobs', !jobParam, () => setParam('job', null))}
        {jobs.map((j) => chip(`job-${j.id}`, j.name, jobParam === j.id, () => setParam('job', jobParam === j.id ? null : j.id)))}
      </div>
      <div className="seg waiting__seg" role="group" aria-label="Type">
        {chip('all-types', 'All types', !typeParam, () => setParam('type', null))}
        {typeOrder.map((t) => chip(`type-${t}`, ITEM_TYPE_LABELS[t], typeParam === t, () => setParam('type', typeParam === t ? null : t)))}
      </div>
    </div>
  );

  /** The row's controls: the one filled status button, with Call (a tel: link when the trade has a number) and Set date as quiet text beside it. */
  const actionsFor = (r: Row): ReactNode => {
    const next = nextStatus(r.item);
    if (!next) return null;
    const trade = tradeOf(r);
    const canSetDate = !r.item.shipmentId;
    if (dating?.id === r.item.id) {
      return (
        <span className="waiting__act waiting__act--dating">
          <label className="sr-only" htmlFor={`waiting-date-${r.item.id}`}>
            Expected date
          </label>
          <input
            id={`waiting-date-${r.item.id}`}
            type="date"
            className="waiting__date"
            value={dating.value}
            onChange={(e) => setDating({ id: r.item.id, value: e.target.value })}
            data-testid={`item-date-input-${r.item.id}`}
          />
          <button type="button" className="btn btn--fill btn--desktop waiting__advance" onClick={saveDate} data-testid={`item-date-save-${r.item.id}`}>
            Save date
          </button>
          <button type="button" className="btn btn--ghost btn--desktop waiting__quiet-btn" onClick={() => setDating(null)} data-testid={`item-date-cancel-${r.item.id}`}>
            Cancel
          </button>
        </span>
      );
    }
    return (
      <span className="waiting__act">
        {(trade?.phone || canSetDate) && (
          <span className="waiting__act-more">
            {trade?.phone && (
              <a
                className="btn btn--ghost btn--desktop waiting__call"
                href={`tel:${trade.phone.replace(/\s+/g, '')}`}
                data-testid={`item-call-${r.item.id}`}
                title={`${trade.name}, ${trade.phone}`}
              >
                Call
              </a>
            )}
            {canSetDate &&
              (offline ? (
                <span className="waiting__needs-signal">Date needs signal</span>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost btn--desktop waiting__quiet-btn"
                  onClick={() => setDating({ id: r.item.id, value: r.item.expectedDate ?? '' })}
                  data-testid={`item-set-date-${r.item.id}`}
                >
                  Set date
                </button>
              ))}
          </span>
        )}
        <button type="button" className="btn btn--fill btn--desktop waiting__advance" onClick={() => advance(r.item)} data-testid={`item-advance-${r.item.id}`}>
          {next.label}
        </button>
      </span>
    );
  };

  const emptyWords = (
    <p className="waiting__empty" data-testid="waiting-empty">
      Nothing waiting
      {jobFilter ? ` on ${jobFilter.name}` : ownerParam === 'me' ? ' with you' : ''}.
    </p>
  );

  return (
    <main className="page waiting" data-testid="waiting-on">
      <PageHeader
        title={title}
        meta={meta}
        back={jobFilter ? { to: `/jobs/${jobFilter.id}`, label: jobFilter.name } : undefined}
        actions={
          <Link to={addHref} className="btn btn--desktop" data-testid="waiting-add">
            Add item
          </Link>
        }
      />
      {filters}

      {layout === 'phone' ? (
        <div className="waiting__groups">
          {openCount === 0 && emptyWords}
          {groups.map(({ key, rows }) => {
            if (rows.length === 0 && key !== 'done') return null;
            const t = groupTitle(key, today);
            const list = (withAction: boolean) => (
              <ItemRowList>
                {rows.map((r) => (
                  <ItemRow
                    key={r.item.id}
                    item={r.item}
                    forecast={r.f}
                    ownerName={nameOf(r.item.ownerId)}
                    href={`/items/${r.item.id}`}
                    context={jobFilter ? undefined : r.job?.name}
                    when={withAction ? rowWhenWords(r.item, r.f, today) : undefined}
                    action={withAction ? actionsFor(r) : undefined}
                  />
                ))}
              </ItemRowList>
            );
            // Later and Done fold away: the thumb list is this fortnight.
            if (key === 'done' || key === 'later') {
              return (
                <details key={key} className={`waiting__group waiting__group--${key} waiting__group--folded`} data-testid={`waiting-group-${key}`}>
                  <summary className="waiting__group-head">
                    <span className="waiting__group-count">{rows.length}</span>
                    <span className="waiting__group-title">{t.title}</span>
                    <span className="waiting__group-toggle waiting__group-toggle--closed">show</span>
                    <span className="waiting__group-toggle waiting__group-toggle--open">hide</span>
                  </summary>
                  {rows.length === 0 ? <p className="waiting__quiet">Nothing done yet.</p> : list(key === 'later')}
                </details>
              );
            }
            return (
              <section key={key} className={`waiting__group waiting__group--${key}`} data-testid={`waiting-group-${key}`} aria-label={t.title}>
                <h2 className="waiting__group-head">
                  <span className="waiting__group-count">{rows.length}</span>
                  <span className="waiting__group-title">{t.title}</span>
                  {t.sub && <span className="waiting__group-sub">{t.sub}</span>}
                </h2>
                {list(true)}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="waiting__groups">
          {openCount === 0 && emptyWords}
          {openCount > 0 && (
            <div className="waiting__scroll">
              <table className="table waiting__table">
                <thead>
                  <tr>
                    <th scope="col">Act by</th>
                    <th scope="col">Item</th>
                    <th scope="col">Waiting on</th>
                    <th scope="col">Needed by</th>
                    <th scope="col">Expected</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                {groups
                  .filter((g) => g.key !== 'done' && g.rows.length > 0)
                  .map(({ key, rows }) => {
                    const t = groupTitle(key, today);
                    return (
                      <tbody key={key} className={`waiting__tgroup waiting__tgroup--${key}`} data-testid={`waiting-group-${key}`}>
                        <tr className="waiting__grouprow">
                          <th scope="rowgroup" colSpan={7}>
                            <span className="waiting__group-count">{rows.length}</span>
                            <span className="waiting__group-title">{t.title}</span>
                            {t.sub && <span className="waiting__group-sub">{t.sub}</span>}
                          </th>
                        </tr>
                        {rows.map((r) => (
                          <TableRow key={r.item.id} row={r} today={today} ownerName={nameOf(r.item.ownerId)} action={actionsFor(r)} />
                        ))}
                      </tbody>
                    );
                  })}
              </table>
            </div>
          )}
          <details className="waiting__group waiting__group--done" data-testid="waiting-group-done">
            <summary className="waiting__group-head">
              <span className="waiting__group-count">{groups[4].rows.length}</span>
              <span className="waiting__group-title">Done</span>
              <span className="waiting__group-toggle waiting__group-toggle--closed">show</span>
              <span className="waiting__group-toggle waiting__group-toggle--open">hide</span>
            </summary>
            {groups[4].rows.length === 0 ? (
              <p className="waiting__quiet">Nothing done yet.</p>
            ) : (
              <table className="table waiting__table">
                <tbody>
                  {groups[4].rows.map((r) => (
                    <TableRow key={r.item.id} row={r} today={today} ownerName={nameOf(r.item.ownerId)} action={null} />
                  ))}
                </tbody>
              </table>
            )}
          </details>
        </div>
      )}
    </main>
  );
}

function TableRow({ row, today, ownerName, action }: { row: Row; today: string; ownerName?: string; action: ReactNode }) {
  const { item, f, job } = row;
  const { personId } = useSession();
  const navigate = useNavigate();
  const open = item.status !== 'done';
  // The whole row opens the item; the link inside and the button keep their own targets.
  const onRowClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/items/${item.id}`);
  };
  const actPassed = open && !!f?.actBy && f.actBy < today && item.status !== 'confirmed';
  const late = f?.isLate ? itemWhenWords(f, item.status) : null;
  const lead = f?.leadTimeWeeks ?? item.leadTimeWeeks ?? 0;
  const owner = item.ownerId === personId ? 'you' : ownerName;
  const who = [item.waitingOn, owner ? `with ${owner}` : ''].filter(Boolean).join(', ');
  // The act-by column reads date first: the figure, then how far off it is and the lead that set it.
  const actAgo = open && item.status !== 'confirmed' && f?.actBy ? agoWords(f.actBy, today) : '';
  const actUnder = [actAgo, lead ? `${lead} wk lead` : ''].filter(Boolean);
  return (
    <tr className="waiting__row" data-testid={`item-row-${item.id}`} onClick={onRowClick}>
      <td className="waiting__cell-act num">
        {f?.actBy ? (
          <>
            <span className={`waiting__actby${actPassed ? ' waiting__actby--amber' : ''}${!open ? ' waiting__actby--quiet' : ''}`}>
              {actPassed ? <span className="waiting__mark" aria-hidden="true">!</span> : null}
              {formatShort(f.actBy)}
            </span>
            {actUnder.map((w) => (
              <span key={w} className={`waiting__cell-ago${actPassed ? ' waiting__cell-ago--amber' : ''}`}>
                {w}
              </span>
            ))}
          </>
        ) : (
          <span className="waiting__actby waiting__actby--none">No date</span>
        )}
      </td>
      <th scope="row" className="waiting__cell-item">
        <Link to={`/items/${item.id}`} className="waiting__title">
          {item.title}
        </Link>
        <span className="waiting__under">
          {ITEM_TYPE_WORDS[item.type]}
          {job ? `, ${job.name}` : ''}
        </span>
      </th>
      <td className="waiting__cell-wrap">{who}</td>
      <td className="num">{f?.neededBy ? formatShort(f.neededBy) : ''}</td>
      <td className="num">
        {late && f ? (
          <>
            <StatusText tone="late" className="waiting__chip">
              {f.expected ? formatShort(f.expected) : 'No date'}
            </StatusText>
            <span className="waiting__cell-ago waiting__cell-ago--late">{f.expected ? f.lateText : `needed ${formatShort(f.neededBy!)}, ${f.lateText}`}</span>
          </>
        ) : f?.expected && item.status === 'confirmed' && f.expected < today ? (
          <>
            <StatusText tone="amber" className="waiting__chip">
              {formatShort(f.expected)}
            </StatusText>
            <span className="waiting__cell-ago waiting__cell-ago--amber">{agoWords(f.expected, today)}</span>
          </>
        ) : f?.expected ? (
          formatShort(f.expected)
        ) : (
          ''
        )}
      </td>
      <td className="waiting__cell-status" data-testid={`item-status-word-${item.id}`}>
        {ITEM_STATUS_LABELS[item.status]}
      </td>
      <td className="waiting__cell-action">{action}</td>
    </tr>
  );
}
