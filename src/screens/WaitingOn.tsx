/**
 * Waiting on: one list of everything that can hold a job up, the same on the
 * phone and the desktop (the desktop is only wider). `#/waiting?owner=me` is
 * Raff's home, titled My items.
 *
 *   Waiting on
 *   12 to act on, 4 overdue
 *   [ Everyone | Mine ]  [All jobs v]
 *
 *   Overdue 4
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Glazing certificate                                 >│
 *   │ 64-66 Park Rd · waiting on Glassworks, with Dominic  │
 *   │ ! Act by Mon 10 Aug, overdue by 5 weeks              │
 *   │ (Call Glassworks)       Set date  [Mark requested]   │
 *   └──────────────────────────────────────────────────────┘
 *   This week 3
 *   Later 18
 *
 * Overdue is exactly isOverdue (the Overview's red count); the rest go by
 * their key date: this week, then later (and anything without a date). Each
 * row opens the item sheet; its controls are Call (a tel: link naming the
 * trade, or the person it is with, when they have a number), Set date (wide
 * screens only; the phone sets it on the sheet), and the one button that
 * moves the status on. Booking asks for the expected date first.
 * Done items leave the list. Alec never reaches this screen (the guard
 * refuses the site role); his deliveries list is his version.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import { FilterBar, FilterSelect } from '../components/FilterSelect';
import type { Item, ItemStatus, Job, Person, Trade } from '../domain/types';
import type { ItemForecast, JobForecast } from '../domain/forecast';
import { isOverdue } from '../domain/forecast';
import { addCalendarDays, formatShortRelative, lastMonday } from '../domain/dates';
import { BOOKED_NEEDS_DATE, needsExpectedDate, nextStatus } from '../domain/itemFlow';
import { StatusText, type Tone } from '../components/StatusText';
import { PageHeader } from '../shell/PageHeader';
import { useLayout } from '../shell/AppShell';
import './waitingOn.css';

export type GroupKey = 'overdue' | 'this-week' | 'later';

const GROUPS: { key: GroupKey; title: string }[] = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'this-week', title: 'This week' },
  { key: 'later', title: 'Later' },
];

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
 * Which group an open item sits in. Overdue is exactly isOverdue; anything
 * else due before next Monday (an arrival already gone but not ticked off
 * included) is this week; the rest, and anything without a date, is later.
 */
export function groupFor(item: Item, f: ItemForecast | undefined, today: string): GroupKey {
  if (f && isOverdue(f, today)) return 'overdue';
  const key = keyDate(item, f);
  if (key && key < addCalendarDays(lastMonday(today), 7)) return 'this-week';
  return 'later';
}

/**
 * The row's one date phrase, always with its relative time. Red (late) only
 * when isOverdue says so, and then the words say "overdue" too.
 */
export function whenWords(item: Item, f: ItemForecast | undefined, today: string): { text: string; tone: Tone } | null {
  if (!f) return { text: 'No date', tone: 'muted' };
  if (isOverdue(f, today)) {
    if (item.status === 'to_do' && f.actBy && f.actBy < today) return { text: `Act by ${formatShortRelative(f.actBy, today, { deadline: true })}`, tone: 'late' };
    if (f.neededBy) return { text: `Needed ${formatShortRelative(f.neededBy, today, { deadline: true })}`, tone: 'late' };
  }
  // Expected after it is needed, both still ahead: a clash in plain words, never red.
  if (f.isLate && f.expected) return { text: `Expected ${formatShortRelative(f.expected, today)}, ${f.lateText}`, tone: 'plain' };
  if (item.status === 'to_do' && f.actBy) return { text: `Act by ${formatShortRelative(f.actBy, today, { deadline: true })}`, tone: 'plain' };
  if (f.expected) return { text: `Expected ${formatShortRelative(f.expected, today)}`, tone: 'plain' };
  if (f.neededBy) return { text: `Needed ${formatShortRelative(f.neededBy, today, { deadline: true })}`, tone: 'plain' };
  return { text: 'No date', tone: 'muted' };
}

interface Row {
  item: Item;
  f?: ItemForecast;
  job?: Job;
  group: GroupKey;
}

/** phone: the call glyph, drawn like the chrome's (24px grid, 1.7 stroke). */
function PhoneGlyph() {
  return (
    <svg className="wrow__glyph" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 3.8h2.6l1.5 4-1.9 1.3a11 11 0 0 0 6.1 6.1l1.3-1.9 4 1.5v2.6a2 2 0 0 1-2.2 2A16.3 16.3 0 0 1 4.6 6a2 2 0 0 1 2-2.2Z" />
    </svg>
  );
}

export default function WaitingOn() {
  const api = useApi();
  const { personId, today, offline } = useSession();
  const [params, setParams] = useSearchParams();
  // The phone keeps each row to Call and the status step; Set date lives on the item sheet there.
  const wide = useLayout() === 'desktop';

  // `?mode=call` (the old Call mode) and `?type=` are ignored: there is one list.
  const ownerParam = params.get('owner'); // "me" or a person id
  const jobParam = params.get('job');

  const { jobs, items, forecasts, people, trades } = useQuery((api) => {
    const jobs = api.listJobs();
    const forecasts = new Map<string, JobForecast | undefined>();
    for (const j of jobs) forecasts.set(j.id, api.getForecast(j.id));
    return { jobs, items: api.listItems(), forecasts, people: api.listPeople(), trades: api.listTrades() };
  }, []);

  // Inline date: which row is editing its expected date, and the draft.
  // `book` is set when the status button asked for the date first: saving then books it too.
  const [dating, setDating] = useState<{ id: string; value: string; book?: ItemStatus; problem?: boolean } | null>(null);

  const ownerId = ownerParam === 'me' ? personId : (ownerParam ?? undefined);
  const personOf = (pid?: string): Person | undefined => people.find((p) => p.id === pid);

  const rows = useMemo<Row[]>(() => {
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    return items
      .filter((i) => i.status !== 'done' && (!ownerId || i.ownerId === ownerId) && (!jobParam || i.jobId === jobParam))
      .map((item) => {
        const f = forecasts.get(item.jobId)?.items[item.id];
        return { item, f, job: jobById.get(item.jobId), group: groupFor(item, f, today) };
      })
      .sort((a, b) => (keyDate(a.item, a.f) ?? '9999').localeCompare(keyDate(b.item, b.f) ?? '9999') || a.item.title.localeCompare(b.item.title));
  }, [items, forecasts, jobs, ownerId, jobParam, today]);

  const groups = GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.group === g.key) }));
  const overdueCount = groups[0].rows.length;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('mode');
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
    if (offline || (bookedNow && !dating.value && !item?.shipmentId)) {
      setDating({ ...dating, problem: true });
      return;
    }
    api.setItemExpectedDate(dating.id, dating.value || undefined);
    if (dating.book) api.updateItemStatus(dating.id, dating.book);
    setDating(null);
  };

  const jobFilter = jobParam ? jobs.find((j) => j.id === jobParam) : undefined;
  const otherOwner = ownerParam && ownerParam !== 'me' ? personOf(ownerParam) : undefined;
  const title = ownerParam === 'me' ? 'My items' : otherOwner ? `${otherOwner.shortName}'s items` : 'Waiting on';
  const meta =
    rows.length === 0 ? 'Nothing waiting' : `${rows.length} to act on${overdueCount ? `, ${overdueCount} overdue` : ''}${jobFilter ? ` on ${jobFilter.name}` : ''}`;

  /** Who to ring: the trade on the item, else the person it is with (never yourself). */
  const callFor = (item: Item): { name: string; phone: string } | undefined => {
    const trade: Trade | undefined = item.tradeId ? trades.find((t) => t.id === item.tradeId) : undefined;
    if (trade?.phone) return { name: trade.name, phone: trade.phone };
    const owner = item.ownerId !== personId ? personOf(item.ownerId) : undefined;
    if (owner?.phone) return { name: owner.shortName, phone: owner.phone };
    return undefined;
  };

  const renderRow = (r: Row) => {
    const { item, f, job } = r;
    const next = nextStatus(item);
    const when = whenWords(item, f, today);
    const call = callFor(item);
    const owner = item.ownerId === personId ? 'you' : personOf(item.ownerId)?.shortName;
    const sameOwner = !!item.waitingOn && item.waitingOn === personOf(item.ownerId)?.shortName;
    const who = [item.waitingOn ? `waiting on ${item.waitingOn}` : '', owner && !sameOwner ? `with ${owner}` : ''].filter(Boolean).join(', ');
    const detail = [jobFilter ? '' : job?.name, who].filter(Boolean).join(' · ');
    const isDating = dating?.id === item.id;
    const canSetDate = wide && !item.shipmentId;

    return (
      <li key={item.id} className={`wrow${isDating ? ' wrow--dating' : ''}`} data-testid={`item-row-${item.id}`} data-overdue={r.group === 'overdue' || undefined}>
        <Link to={`/items/${item.id}`} className="wrow__open" data-testid={`item-open-${item.id}`}>
          <span className="wrow__title">{item.title}</span>
          {detail && <span className="wrow__detail">{detail}</span>}
          {when && (
            <StatusText tone={when.tone} plain className="wrow__when" testId={`item-when-${item.id}`}>
              {when.text}
            </StatusText>
          )}
        </Link>
        <span className="chevron wrow__chevron" aria-hidden="true" />

        {isDating && next ? (
          <div className="wrow__actions wrow__actions--dating">
            <label className="sr-only" htmlFor={`waiting-date-${item.id}`}>
              Expected date
            </label>
            <input
              id={`waiting-date-${item.id}`}
              type="date"
              className="input wrow__date"
              value={dating.value}
              onChange={(e) => setDating({ ...dating, value: e.target.value, problem: false })}
              disabled={offline}
              data-testid={`item-date-input-${item.id}`}
            />
            <button type="button" className="btn wrow__btn wrow__btn--strong" onClick={saveDate} data-testid={`item-date-save-${item.id}`}>
              {dating.book ? next.label : 'Save date'}
            </button>
            <button type="button" className="btn btn--ghost wrow__btn" onClick={() => setDating(null)} data-testid={`item-date-cancel-${item.id}`}>
              Cancel
            </button>
            {(dating.book || dating.problem || offline) && (
              <p className="wrow__problem" role="alert">
                <StatusText tone="amber" plain testId={`item-date-problem-${item.id}`}>
                  {offline ? 'Needs signal' : BOOKED_NEEDS_DATE}
                </StatusText>
              </p>
            )}
          </div>
        ) : next ? (
          <div className="wrow__actions">
            {call && (
              <a className="btn btn--tinted wrow__btn wrow__call" href={`tel:${call.phone.replace(/\s+/g, '')}`} aria-label={`Call ${call.name}, ${call.phone}`} data-testid={`item-call-${item.id}`}>
                <PhoneGlyph />
                <span className="wrow__call-name">Call {call.name}</span>
              </a>
            )}
            <span className="wrow__trail">
              {canSetDate &&
                (offline ? (
                  <span className="wrow__quiet">Date needs signal</span>
                ) : (
                  <button type="button" className="btn btn--ghost wrow__btn" onClick={() => setDating({ id: item.id, value: item.expectedDate ?? '' })} data-testid={`item-set-date-${item.id}`}>
                    Set date
                  </button>
                ))}
              <button type="button" className="btn wrow__btn wrow__btn--strong" onClick={() => advance(item)} data-testid={`item-advance-${item.id}`}>
                {next.label}
              </button>
            </span>
          </div>
        ) : null}
      </li>
    );
  };

  const ownerSeg = [
    { value: '', label: 'Everyone' },
    { value: 'me', label: 'Mine' },
    ...(otherOwner ? [{ value: otherOwner.id, label: otherOwner.shortName }] : []),
  ];

  return (
    <main className="page waiting" data-testid="waiting-on">
      <PageHeader
        title={title}
        meta={meta}
        back={jobFilter ? { to: `/jobs/${jobFilter.id}`, label: jobFilter.name } : undefined}
        actions={
          <Link to={`/items/new${jobParam ? `?job=${jobParam}` : ''}`} className={wide ? 'btn btn--desktop' : 'btn btn--ghost waiting__add'} data-testid="waiting-add">
            Add item
          </Link>
        }
      />

      {/* On the phone the filter sticks under the nav bar as floating Regular glass. */}
      <FilterBar testId="waiting-filters" className={wide ? undefined : 'waiting__filters glass glass--regular glass--float'}>
        <span className="seg waiting__owner" role="group" aria-label="Whose items" data-testid="waiting-filter-owner">
          {ownerSeg.map((o) => (
            <button
              key={o.value || 'all'}
              type="button"
              className="seg__btn"
              aria-pressed={(ownerParam ?? '') === o.value}
              onClick={() => setParam('owner', o.value || null)}
              data-testid={`waiting-owner-${o.value || 'all'}`}
            >
              {o.label}
            </button>
          ))}
        </span>
        <FilterSelect
          label="Job"
          value={jobParam ?? ''}
          options={[{ value: '', label: 'All jobs' }, ...jobs.map((j) => ({ value: j.id, label: j.name }))]}
          onChange={(v) => setParam('job', v || null)}
          testId="waiting-filter-job"
          className="waiting__job"
        />
      </FilterBar>

      {rows.length === 0 ? (
        <p className="waiting__empty" data-testid="waiting-empty">
          Nothing waiting{jobFilter ? ` on ${jobFilter.name}` : ownerParam === 'me' ? ' with you' : ''}.
        </p>
      ) : (
        <div className="waiting__groups">
          {groups.map(({ key, title, rows }) =>
            rows.length === 0 ? null : (
              <section key={key} className="group waiting__group" aria-labelledby={`waiting-${key}-title`} data-testid={`waiting-group-${key}`}>
                <h2 id={`waiting-${key}-title`} className="group__header group__header--large waiting__group-head">
                  {title}
                  <span className="waiting__count" data-testid={`waiting-count-${key}`}>
                    {rows.length}
                  </span>
                </h2>
                <ul className="group__list waiting__list">{rows.map(renderRow)}</ul>
              </section>
            ),
          )}
        </div>
      )}
    </main>
  );
}
