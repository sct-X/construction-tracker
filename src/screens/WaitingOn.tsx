/**
 * Waiting-on list (UI_PLAN 3.8, wireframe "Waiting-on list, phone"): the one
 * list of everything that can hold a job up, built for Raff to tick off with
 * a thumb between calls. `#/waiting?owner=me` is his home.
 *
 *   [Anyone v]  [All jobs v]  [All types v]          List | Call
 *
 *   9  Overdue                        <- a plate: the one loud thing
 *   ! Act by Mon 10 Aug, overdue by 5 weeks   Ordered or booked
 *   Windows  Park Rd                      Material
 *   waiting on HiHaus, with you
 *   Call  Set date                        [Mark confirmed]
 *
 *   2  This week  14-20 Sep
 *   1  Next week  21-27 Sep
 *   18 Later                              show
 *   11 Done                               show
 *
 * Groups are by act-by date (the reminder date) while an item is to do, then
 * by its expected date: Overdue is exactly what is past its date (isOverdue,
 * the Overview's red count); then this week, next week, later; done items sit
 * collapsed at the foot. Filters are dropdowns: owner (anyone / mine / a
 * person), job, type; the side is automatic. The Call mode (`?mode=call`,
 * admin and partners) is the same list worked as a phone call with one
 * person: their fortnight, one action per row, Finish the call. Every row is the shared <ItemRow> (a link to
 * the item sheet) with one action that moves the status forward, labelled
 * with exactly what it does. The desktop draws the same rows as a table with
 * the extra columns. Alec never reaches this screen (the guard refuses the
 * site role); his deliveries list is his version.
 */
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import { FilterBar, FilterSelect } from '../components/FilterSelect';
import CallList from './CallList';
import { WaitingMode } from '../components/WaitingMode';
import type { Item, ItemStatus, ItemType, Job, Person, Trade } from '../domain/types';
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '../domain/types';
import type { ItemForecast, JobForecast } from '../domain/forecast';
import { isOverdue } from '../domain/forecast';
import { addCalendarDays, formatShort, formatShortRelative, formatWeekRange, lastMonday, relativeDate } from '../domain/dates';
import { BOOKED_NEEDS_DATE, needsExpectedDate, nextStatus } from '../domain/itemFlow';
import { ITEM_TYPE_WORDS, ItemRow, ItemRowList, itemWhenWords } from '../components/ItemRow';
import { StatusText, type Tone } from '../components/StatusText';
import { useLayout } from '../shell/AppShell';
import { PageHeader } from '../shell/PageHeader';
import './waitingOn.css';

export type GroupKey = 'overdue' | 'this-week' | 'next-week' | 'later' | 'done';

const GROUP_ORDER: GroupKey[] = ['overdue', 'this-week', 'next-week', 'later', 'done'];

/**
 * The date an open item is grouped and sorted by: the act-by date (the
 * reminder) while it is still to do, then the date it is expected or needed,
 * since once it is booked the acting is done and only the arrival is left.
 */
export function keyDate(item: Item, f: ItemForecast | undefined): string | undefined {
  if (!f) return undefined;
  return item.status === 'to_do' ? f.actBy : (f.expected ?? f.neededBy);
}

/**
 * Which group an item sits in. Overdue is exactly isOverdue (the Overview's
 * red count); anything else goes by its key date, a key date already gone
 * (an arrival still to be ticked off) sitting in this week.
 */
export function groupFor(item: Item, f: ItemForecast | undefined, today: string): GroupKey {
  if (item.status === 'done') return 'done';
  if (f && isOverdue(f, today)) return 'overdue';
  const key = keyDate(item, f);
  if (!key) return 'later';
  const monday = lastMonday(today);
  const nextMon = addCalendarDays(monday, 7);
  const afterNext = addCalendarDays(monday, 14);
  if (key < nextMon) return 'this-week';
  if (key < afterNext) return 'next-week';
  return 'later';
}

/**
 * The row's one date phrase, relative to today, replacing the shared row's
 * default: "Act by Mon 10 Aug, overdue by 5 weeks" while the item is to do,
 * then "Expected Wed 16 Sep, yesterday". A late item keeps the calculator's
 * own late phrase (undefined leaves the default in place). Red only when
 * isOverdue says so.
 */
export function rowWhenWords(item: Item, f: ItemForecast | undefined, today: string): { text: string; tone: Tone } | undefined {
  if (!f || f.isLate || item.status === 'done') return undefined;
  if (item.status !== 'to_do') {
    // Needed-by and expected both gone, still not ticked off: overdue on the needed-by.
    if (f.neededBy && isOverdue(f, today)) return { text: `Needed ${formatShortRelative(f.neededBy, today, { deadline: true })}`, tone: 'late' };
    const when = f.expected ?? f.neededBy;
    if (!when) return undefined;
    return { text: `${f.expected ? 'Expected' : 'Needed'} ${formatShortRelative(when, today, { deadline: !f.expected })}`, tone: isOverdue(f, today) ? 'late' : 'plain' };
  }
  if (!f.actBy) return undefined;
  return { text: `Act by ${formatShortRelative(f.actBy, today, { deadline: true })}`, tone: isOverdue(f, today) ? 'late' : 'plain' };
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
  const callMode = params.get('mode') === 'call' && (role === 'admin' || role === 'partner');

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
  // `book` is set when "Mark booked" asked for the date first: saving then books it too.
  const [dating, setDating] = useState<{ id: string; value: string; book?: ItemStatus; problem?: boolean } | null>(null);
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
    if (!next) return;
    // Booked needs an expected date: ask for it inline instead of saving.
    if (needsExpectedDate(item, next.status)) {
      setDating({ id: item.id, value: '', book: next.status });
      return;
    }
    api.updateItemStatus(item.id, next.status);
  };
  const saveDate = () => {
    if (!dating) return;
    const item = items.find((i) => i.id === dating.id);
    const bookedNow = !!dating.book || item?.status === 'booked';
    if (bookedNow && !dating.value && !item?.shipmentId) {
      setDating({ ...dating, problem: true });
      return;
    }
    api.setItemExpectedDate(dating.id, dating.value || undefined);
    if (dating.book) api.updateItemStatus(dating.id, dating.book);
    setDating(null);
  };

  const jobFilter = jobParam ? jobs.find((j) => j.id === jobParam) : undefined;
  const addHref = `/items/new${jobParam ? `?job=${jobParam}` : ''}`;
  const title = ownerParam === 'me' ? 'My items' : 'Waiting on';
  const meta =
    openCount === 0
      ? 'Nothing waiting.'
      : `${openCount} to act on${overdueCount ? `, ${overdueCount} overdue` : ''}${jobFilter ? ` on ${jobFilter.name}` : ''}`;

  const ownerOptions = [
    { value: '', label: 'Anyone' },
    { value: 'me', label: 'Mine' },
    ...(role === 'builder' ? [] : people.filter((p) => p.id !== personId).map((p) => ({ value: p.id, label: p.shortName }))),
  ];
  const filters = (
    <FilterBar testId="waiting-filters">
      <FilterSelect label="Owner" value={ownerParam ?? ''} options={ownerOptions} onChange={(v) => setParam('owner', v || null)} testId="waiting-filter-owner" />
      <FilterSelect label="Job" value={jobParam ?? ''} options={[{ value: '', label: 'All jobs' }, ...jobs.map((j) => ({ value: j.id, label: j.name }))]} onChange={(v) => setParam('job', v || null)} testId="waiting-filter-job" />
      <FilterSelect
        label="Type"
        value={typeParam ?? ''}
        options={[{ value: '', label: 'All types' }, ...typeOrder.map((t) => ({ value: t, label: ITEM_TYPE_LABELS[t] }))]}
        onChange={(v) => setParam('type', v || null)}
        testId="waiting-filter-type"
      />
    </FilterBar>
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
            onChange={(e) => setDating({ ...dating, value: e.target.value, problem: false })}
            disabled={offline}
            data-testid={`item-date-input-${r.item.id}`}
          />
          <button type="button" className="btn btn--fill btn--desktop waiting__advance" onClick={saveDate} data-testid={`item-date-save-${r.item.id}`}>
            {dating.book ? next.label : 'Save date'}
          </button>
          <button type="button" className="btn btn--ghost btn--desktop waiting__quiet-btn" onClick={() => setDating(null)} data-testid={`item-date-cancel-${r.item.id}`}>
            Cancel
          </button>
          {(dating.book || dating.problem) && (
            <span role="alert">
              <StatusText tone="amber" testId={`item-date-problem-${r.item.id}`}>
                {offline ? 'Needs signal' : BOOKED_NEEDS_DATE}
              </StatusText>
            </span>
          )}
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

  if (callMode) return <CallList />;

  return (
    <main className="page waiting" data-testid="waiting-on">
      <PageHeader
        title={title}
        meta={meta}
        back={jobFilter ? { to: `/jobs/${jobFilter.id}`, label: jobFilter.name } : undefined}
        actions={
          <>
            <WaitingMode mode="list" />
            <Link to={addHref} className="btn btn--desktop" data-testid="waiting-add">
              Add item
            </Link>
          </>
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
  const actPassed = !!f?.actBy && f.actBy < today && item.status === 'to_do';
  const late = f?.isLate ? itemWhenWords(f, item.status, today) : null;
  // Expected after needed is plain words; red only for what is past its date.
  const overdue = !!f && isOverdue(f, today);
  const lead = f?.leadTimeWeeks ?? item.leadTimeWeeks ?? 0;
  const owner = item.ownerId === personId ? 'you' : ownerName;
  const who = [item.waitingOn, owner ? `with ${owner}` : ''].filter(Boolean).join(', ');
  // The act-by column reads date first: the figure, then how far off it is and the lead that set it.
  const actAgo = open && f?.actBy ? relativeDate(f.actBy, today, { deadline: item.status === 'to_do' }) : '';
  const actUnder = [actAgo, lead ? `${lead} wk lead` : ''].filter(Boolean);
  return (
    <tr className="waiting__row" data-testid={`item-row-${item.id}`} onClick={onRowClick}>
      <td className="waiting__cell-act num">
        {f?.actBy ? (
          <>
            <span className={`waiting__actby${actPassed ? ' waiting__actby--late' : ''}${!open ? ' waiting__actby--quiet' : ''}`}>
              {actPassed ? <span className="waiting__mark" aria-hidden="true">!</span> : null}
              {formatShort(f.actBy)}
            </span>
            {actUnder.map((w) => (
              <span key={w} className={`waiting__cell-ago${actPassed ? ' waiting__cell-ago--late' : ''}`}>
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
      <td className="num">
        {f?.neededBy ? (
          <>
            {formatShort(f.neededBy)}
            {!(late && !f.expected) && <span className="waiting__cell-ago">{relativeDate(f.neededBy, today, { deadline: open })}</span>}
          </>
        ) : (
          ''
        )}
      </td>
      <td className="num">
        {late && f && !f.expected ? (
          <>
            <StatusText tone={overdue ? 'late' : 'plain'} plain={!overdue} className="waiting__chip">
              No date
            </StatusText>
            <span className={`waiting__cell-ago${overdue ? ' waiting__cell-ago--late' : ''}`}>{`needed ${formatShort(f.neededBy!)}, ${f.lateText}`}</span>
          </>
        ) : late && f?.expected ? (
          <>
            {formatShort(f.expected)}
            <span className="waiting__cell-ago">{`${relativeDate(f.expected, today)}, ${f.lateText}`}</span>
          </>
        ) : f?.expected ? (
          <>
            {formatShort(f.expected)}
            <span className="waiting__cell-ago">{relativeDate(f.expected, today)}</span>
          </>
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
