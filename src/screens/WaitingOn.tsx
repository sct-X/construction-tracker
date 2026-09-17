/**
 * Waiting-on list (UI_PLAN 3.8, wireframe "Waiting-on list, phone"): the one
 * list of everything that can hold a job up, built for Raff to tick off with
 * a thumb between calls. `#/waiting?owner=me` is his home.
 *
 *   3  Overdue                       <- the one loud thing on the screen
 *      act-by date passed
 *   Material  Windows                        Park Rd
 *             waiting on Hangzhou Glazing Co, with you
 *             Expected Mon 26 Oct  Ordered or booked
 *   ! Act by Mon 10 Aug, 5 weeks ago            [Mark confirmed]
 *
 *   This week  14-20 Sep                     2
 *   Next week  21-27 Sep                     1
 *   Later                                   12
 *   Done (9)                             show
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
import { useMemo, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, ItemStatus, ItemType, Job, Person } from '../domain/types';
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '../domain/types';
import type { ItemForecast, JobForecast } from '../domain/forecast';
import { addCalendarDays, calendarDaysBetween, formatDayMonth, formatShort, formatWeekRange, lastMonday } from '../domain/dates';
import { ITEM_TYPE_WORDS, ItemRow, ItemRowList, itemWhenWords } from '../components/ItemRow';
import { StatusText, type Tone } from '../components/StatusText';
import { useLayout } from '../shell/AppShell';
import { PageHeader } from '../shell/PageHeader';
import './waitingOn.css';

export type GroupKey = 'overdue' | 'this-week' | 'next-week' | 'later' | 'done';

const GROUP_ORDER: GroupKey[] = ['overdue', 'this-week', 'next-week', 'later', 'done'];

/** "today", "tomorrow", "in 3 days", "in 2 weeks", "3 days ago", "5 weeks ago". Whole weeks past a fortnight. */
export function agoWords(iso: string, today: string): string {
  const n = calendarDaysBetween(iso, today); // positive when iso is in the past
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n === -1) return 'tomorrow';
  const abs = Math.abs(n);
  const unit = abs >= 14 ? `${Math.floor(abs / 7)} weeks` : `${abs} day${abs === 1 ? '' : 's'}`;
  return n > 0 ? `${unit} ago` : `in ${unit}`;
}

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

/** "N days" / "N weeks" past a date. */
function overdueWords(iso: string, today: string): string {
  const n = calendarDaysBetween(iso, today);
  if (n >= 14) return `${Math.floor(n / 7)} weeks overdue`;
  return `${n} day${n === 1 ? '' : 's'} overdue`;
}

/**
 * The words on the phone row's action strip, relative to today. The shared
 * row already gives one dated phrase, so this says how soon that is ("Due
 * tomorrow", "5 weeks overdue") and only repeats a date the row does not
 * show (a booked item's act-by: "Act by 10 Aug, 5 weeks ago"; no weekday,
 * because it shares a 390px line with a 56px button).
 */
export function stripWords(item: Item, f: ItemForecast | undefined, today: string): { text: string; tone: Tone } | null {
  if (!f) return null;
  if (item.status === 'confirmed') {
    const when = f.expected ?? f.neededBy;
    if (!when) return null;
    if (when < today)
      return {
        text: `${f.expected ? 'Expected' : 'Needed'} ${agoWords(when, today)}`,
        tone: 'amber',
      };
    return {
      text: `${f.expected ? 'Expected' : 'Needed'} ${agoWords(when, today)}`,
      tone: 'plain',
    };
  }
  if (!f.actBy) return null;
  const passed = f.actBy < today;
  const rowSaysActBy = itemWhenWords(f, item.status)?.text.startsWith('Act by');
  if (rowSaysActBy) {
    if (passed) return { text: overdueWords(f.actBy, today), tone: 'amber' };
    return { text: `Due ${agoWords(f.actBy, today)}`, tone: 'plain' };
  }
  return {
    text: `Act by ${formatDayMonth(f.actBy)}, ${agoWords(f.actBy, today)}`,
    tone: passed ? 'amber' : 'plain',
  };
}

/** What the one button does, in words: the status it moves the item to. */
export function advanceWords(item: Item): { label: string; to: ItemStatus } | null {
  switch (item.status) {
    case 'to_do':
      if (item.type === 'material') return { label: 'Mark ordered', to: 'booked' };
      if (item.type === 'decision' || item.type === 'manual_reminder' || item.type === 'condition_of_consent') return { label: 'Mark done', to: 'done' };
      return { label: 'Mark booked', to: 'booked' };
    case 'booked':
      return { label: 'Mark confirmed', to: 'confirmed' };
    case 'confirmed':
      return { label: 'Mark done', to: 'done' };
    default:
      return null;
  }
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
      return { title: 'Overdue', sub: 'act-by passed, or late' };
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
    return { jobs, items, forecasts, people: api.listPeople() };
  }, []);
  const { jobs, items, forecasts, people } = data;
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
    const a = advanceWords(item);
    if (!a) return;
    api.updateItemStatus(item.id, a.to);
  };

  const jobFilter = jobParam ? jobs.find((j) => j.id === jobParam) : undefined;
  const addHref = `/items/new${jobParam ? `?job=${jobParam}` : ''}`;
  const title = ownerParam === 'me' ? 'My items' : 'Waiting on';
  const meta =
    openCount === 0
      ? 'Nothing waiting.'
      : `${openCount} to act on${overdueCount ? `, ${overdueCount} overdue` : ''}${jobFilter ? ` on ${jobFilter.name}` : ''}`;

  const chip = (key: string, label: string, pressed: boolean, onClick: () => void) => (
    <button key={key} type="button" className="waiting__chip" aria-pressed={pressed} onClick={onClick} data-testid={`waiting-filter-${key}`}>
      {label}
    </button>
  );

  const filters = (
    <div className="waiting__filters" data-testid="waiting-filters">
      <div className="waiting__chips" role="group" aria-label="Owner">
        {chip('mine', 'Mine', ownerParam === 'me', () => setParam('owner', ownerParam === 'me' ? null : 'me'))}
        {chip('anyone', 'Anyone', !ownerParam, () => setParam('owner', null))}
        {role !== 'builder' &&
          people
            .filter((p) => p.id !== personId)
            .map((p) => chip(`owner-${p.id}`, p.shortName, ownerParam === p.id, () => setParam('owner', ownerParam === p.id ? null : p.id)))}
      </div>
      <div className="waiting__chips" role="group" aria-label="Job">
        {chip('all-jobs', 'All jobs', !jobParam, () => setParam('job', null))}
        {jobs.map((j) => chip(`job-${j.id}`, j.name, jobParam === j.id, () => setParam('job', jobParam === j.id ? null : j.id)))}
      </div>
      <div className="waiting__chips" role="group" aria-label="Type">
        {chip('all-types', 'All types', !typeParam, () => setParam('type', null))}
        {typeOrder.map((t) => chip(`type-${t}`, ITEM_TYPE_LABELS[t], typeParam === t, () => setParam('type', typeParam === t ? null : t)))}
      </div>
    </div>
  );

  const actionFor = (r: Row): ReactNode => {
    const a = advanceWords(r.item);
    if (!a) return null;
    return (
      <button type="button" className="waiting__advance" onClick={() => advance(r.item)} data-testid={`item-advance-${r.item.id}`}>
        {a.label}
      </button>
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
            if (key === 'done') {
              return (
                <details key={key} className="waiting__group waiting__group--done" data-testid="waiting-group-done">
                  <summary className="waiting__group-head">
                    <span className="waiting__group-count">{rows.length}</span>
                    <span className="waiting__group-title">Done</span>
                    <span className="waiting__group-toggle waiting__group-toggle--closed">show</span>
                    <span className="waiting__group-toggle waiting__group-toggle--open">hide</span>
                  </summary>
                  {rows.length === 0 ? (
                    <p className="waiting__quiet">Nothing done yet.</p>
                  ) : (
                    <ItemRowList>
                      {rows.map((r) => (
                        <ItemRow
                          key={r.item.id}
                          item={r.item}
                          forecast={r.f}
                          ownerName={nameOf(r.item.ownerId)}
                          href={`/items/${r.item.id}`}
                          context={jobFilter ? undefined : r.job?.name}
                        />
                      ))}
                    </ItemRowList>
                  )}
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
                <ItemRowList>
                  {rows.map((r) => {
                    const words = stripWords(r.item, r.f, today);
                    return (
                      <ItemRow
                        key={r.item.id}
                        item={r.item}
                        forecast={r.f}
                        ownerName={nameOf(r.item.ownerId)}
                        href={`/items/${r.item.id}`}
                        context={jobFilter ? undefined : r.job?.name}
                        action={
                          <span className="waiting__act">
                            {words ? (
                              <StatusText
                                tone={words.tone}
                                plain={words.tone === 'plain' || words.tone === 'muted'}
                                className="waiting__actby"
                                testId={`waiting-actby-${r.item.id}`}
                              >
                                {words.text}
                              </StatusText>
                            ) : (
                              <span className="waiting__actby waiting__actby--none">No act-by date</span>
                            )}
                            {actionFor(r)}
                          </span>
                        }
                      />
                    );
                  })}
                </ItemRowList>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="waiting__groups">
          {openCount === 0 && emptyWords}
          {openCount > 0 && (
            <div className="waiting__scroll">
              <table className="waiting__table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Job</th>
                    <th scope="col">Type</th>
                    <th scope="col">Waiting on</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Needed by</th>
                    <th scope="col">Act by</th>
                    <th scope="col">Lead</th>
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
                          <th scope="rowgroup" colSpan={11}>
                            <span className="waiting__group-count">{rows.length}</span>
                            <span className="waiting__group-title">{t.title}</span>
                            {t.sub && <span className="waiting__group-sub">{t.sub}</span>}
                          </th>
                        </tr>
                        {rows.map((r) => (
                          <TableRow key={r.item.id} row={r} today={today} ownerName={nameOf(r.item.ownerId)} action={actionFor(r)} />
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
              <table className="waiting__table">
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
  return (
    <tr className="waiting__row" data-testid={`item-row-${item.id}`} onClick={onRowClick}>
      <th scope="row" className="waiting__cell-item">
        <Link to={`/items/${item.id}`} className="waiting__title">
          {item.title}
        </Link>
      </th>
      <td>{job?.name}</td>
      <td>{ITEM_TYPE_WORDS[item.type]}</td>
      <td className="waiting__cell-wrap">{item.waitingOn}</td>
      <td className="waiting__cell-nowrap">{item.ownerId === personId ? 'you' : ownerName}</td>
      <td className="num">{f?.neededBy ? formatShort(f.neededBy) : ''}</td>
      <td className="num">
        {f?.actBy ? (
          <>
            {actPassed ? (
              <StatusText tone="amber" className="waiting__actby">
                {formatShort(f.actBy)}
              </StatusText>
            ) : (
              formatShort(f.actBy)
            )}
            {open && item.status !== 'confirmed' && (
              <span className={`waiting__cell-ago${actPassed ? ' waiting__cell-ago--amber' : ''}`}>{agoWords(f.actBy, today)}</span>
            )}
          </>
        ) : (
          <span className="waiting__actby--none">No date</span>
        )}
      </td>
      <td className="num">{lead ? `${lead} wk` : ''}</td>
      <td className="num">
        {late && f ? (
          <>
            <StatusText tone="late" className="waiting__actby">
              {f.expected ? formatShort(f.expected) : 'No date'}
            </StatusText>
            <span className="waiting__cell-ago waiting__cell-ago--late">{f.expected ? f.lateText : `needed ${formatShort(f.neededBy!)}, ${f.lateText}`}</span>
          </>
        ) : f?.expected ? (
          formatShort(f.expected)
        ) : (
          ''
        )}
      </td>
      <td data-testid={`item-status-word-${item.id}`}>{ITEM_STATUS_LABELS[item.status]}</td>
      <td className="waiting__cell-action">{action}</td>
    </tr>
  );
}
