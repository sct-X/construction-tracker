/**
 * Call list (UI_PLAN 3.11): Dominic's script for ringing Raff.
 *
 * Pick who you're ringing (buttons, Raff by default). The list is everything
 * that person owns that is still to do or ordered-or-booked with an act-by
 * inside the fortnight or already past, grouped by job, most urgent question
 * first. Each job's header says how stale its program is ("unconfirmed 9
 * days") and when it finishes. Each row is one question with one action in
 * words; handled rows fold into a "Done this call" strip so the script moves
 * on. "Finish call" lists the jobs with a "Confirmed today" tick each, stamps
 * them (rule 7's clock resets), logs "Dominic rang Raff: 3 items updated on
 * Park Rd" per job, and shows what changed.
 *
 * Desktop: people down the left, the script on the right, keys B C M N S on
 * the current row. Phone: people as a row of chips, rows as cards with one
 * 56px action each.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, ItemStatus, Job, Person, Step, Trade } from '../domain/types';
import type { JobForecast } from '../domain/forecast';
import { addCalendarWeeks, calendarDaysBetween, formatDelta, formatLong, formatShort } from '../domain/dates';
import { CallItem, type Handled } from '../components/CallItem';
import { nextStatus } from '../domain/itemFlow';
import { Money } from '../components/Money';
import { StatusText, type Tone } from '../components/StatusText';
import { useLayout } from '../shell/AppShell';
import { PageHeader } from '../shell/PageHeader';
import './callList.css';

interface Data {
  me: Person;
  people: Person[];
  jobs: Job[];
  items: Item[];
  steps: Record<string, Step>;
  trades: Record<string, Trade>;
  forecasts: Record<string, JobForecast | undefined>;
}

interface JobGroup {
  job: Job;
  forecast?: JobForecast;
  items: Item[];
}

/** UI_PLAN 3.11: to do or ordered-or-booked, act-by within 14 days or past. */
export function inCallCut(item: Item, actBy: string | undefined, today: string): boolean {
  if (item.status !== 'to_do' && item.status !== 'booked') return false;
  if (!actBy) return false;
  return actBy <= addCalendarWeeks(today, 2);
}

/** Rule 7 words from the calculator's freshness, reworded for a call: "unconfirmed 9 days" / "confirmed 2 days ago". */
function freshWords(f?: JobForecast): { tone: Tone; text: string } | null {
  if (!f) return null;
  const { amber, daysUnconfirmed, text } = f.freshness;
  if (daysUnconfirmed === undefined) return { tone: 'amber', text };
  if (amber) return { tone: 'amber', text: `unconfirmed ${daysUnconfirmed} days` };
  if (daysUnconfirmed === 0) return { tone: 'ok', text: 'confirmed today' };
  return { tone: 'muted', text: `confirmed ${daysUnconfirmed} day${daysUnconfirmed === 1 ? '' : 's'} ago` };
}

/** A short job name for sentences: "64-66 Park Rd" -> "Park Rd". */
function shortJob(name: string): string {
  return name.replace(/^[\d\-a-z]+\s+/i, '');
}

interface SummaryLine {
  jobId: string;
  name: string;
  confirmed: boolean;
  itemsUpdated: number;
  words: ReactNode[];
}

type Focus = { confirm: () => void; expected: () => void; note: () => void; advance: () => void; skip: () => void };

export default function CallList() {
  const api = useApi();
  const layout = useLayout();
  const phone = layout === 'phone';
  const { today, offline } = useSession();
  const [params, setParams] = useSearchParams();

  const data = useQuery<Data>(
    (api) => {
      const me = api.whoami().person;
      const jobs = api.listJobs();
      const steps: Record<string, Step> = {};
      const forecasts: Record<string, JobForecast | undefined> = {};
      for (const j of jobs) {
        forecasts[j.id] = api.getForecast(j.id);
        for (const s of api.listSteps(j.id)) steps[s.id] = s;
      }
      const trades: Record<string, Trade> = {};
      for (const t of api.listTrades()) trades[t.id] = t;
      return { me, people: api.listPeople().filter((p) => p.id !== me.id), jobs, items: api.listItems(), steps, trades, forecasts };
    },
    [],
  );

  // Who is on the phone: ?person=, else Raff, else the first other person.
  const personParam = params.get('person');
  const person = data.people.find((p) => p.id === personParam) ?? data.people.find((p) => p.id === 'raff') ?? data.people[0];
  const everything = params.get('scope') === 'all';

  // The call's own state: what was done to which item, and what it read as.
  // Handled rows keep their item: one marked done leaves listItems but stays in the "Done this call" strip.
  const [handled, setHandled] = useState<Record<string, Handled & { item: Item }>>({});
  const [finishing, setFinishing] = useState(false);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [noted, setNoted] = useState<Record<string, true>>({});
  const [summary, setSummary] = useState<{ personName: string; lines: SummaryLine[] } | null>(null);
  const focusFns = useRef<Record<string, Focus>>({});

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const pickPerson = (id: string) => {
    setHandled({});
    setNoted({});
    setFinishing(false);
    setSummary(null);
    setCallKey((k) => k + 1);
    setParam('person', id);
  };

  // Items per person, for the counts on the buttons.
  const countFor = useCallback(
    (pid: string) =>
      data.items.filter((i) => i.ownerId === pid && (everything ? i.status !== 'done' : inCallCut(i, data.forecasts[i.jobId]?.items[i.id]?.actBy, today))).length,
    [data, everything, today],
  );

  // The script is planned once per call (person, scope, today, or a new call) and then held still:
  // marking the pump booked or moving the tiler's date must not reorder the list or drop rows
  // out of the fortnight cut while Raff is still on the phone. Rows that leave the cut stay.
  const dataRef = useRef(data);
  dataRef.current = data;
  const [callKey, setCallKey] = useState(0);
  const plan = useMemo(() => {
    const d = dataRef.current;
    if (!person) return { jobIds: [] as string[], itemIds: [] as string[] };
    const cut = d.items.filter((i) => i.ownerId === person.id && (everything ? i.status !== 'done' : inCallCut(i, d.forecasts[i.jobId]?.items[i.id]?.actBy, today)));
    // Most urgent question first: something still to do (past or near its act-by) before something
    // already ordered or booked and only waiting on a confirmation; then act-by, then needed-by.
    const keyOf = (i: Item) => {
      const f = d.forecasts[i.jobId]?.items[i.id];
      return `${i.status === 'to_do' ? 0 : 1}|${f?.actBy ?? '9999-12-31'}|${f?.neededBy ?? '9999-12-31'}`;
    };
    const sorted = [...cut].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
    const firstKey = new Map<string, string>();
    for (const i of sorted) if (!firstKey.has(i.jobId)) firstKey.set(i.jobId, keyOf(i));
    const jobIds = d.jobs
      // Build jobs are always listed so they can be confirmed; design jobs only when there is something to chase.
      .filter((j) => j.kind === 'build' || firstKey.has(j.id))
      .sort((a, b) => (firstKey.get(a.id) ?? '9|').localeCompare(firstKey.get(b.id) ?? '9|') || a.name.localeCompare(b.name))
      .map((j) => j.id);
    return { jobIds, itemIds: sorted.map((i) => i.id) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callKey, person?.id, everything, today]);

  const groups = useMemo<JobGroup[]>(() => {
    const byId = new Map(data.items.map((i) => [i.id, i]));
    const planned = new Set(plan.itemIds);
    // Anything that entered the cut since the call started goes at the end of its job.
    const arrivals = person
      ? data.items.filter((i) => !planned.has(i.id) && i.ownerId === person.id && (everything ? i.status !== 'done' : inCallCut(i, data.forecasts[i.jobId]?.items[i.id]?.actBy, today)))
      : [];
    return plan.jobIds
      .map((jobId) => data.jobs.find((j) => j.id === jobId))
      .filter((j): j is Job => !!j)
      .map((job) => ({
        job,
        forecast: data.forecasts[job.id],
        items: [...plan.itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i && i.jobId === job.id), ...arrivals.filter((i) => i.jobId === job.id)],
      }));
  }, [data, plan, person, everything, today]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const jobsWithItems = groups.filter((g) => g.items.length).length;
  const currentId = groups.flatMap((g) => g.items).find((i) => !handled[i.id])?.id;

  const changedIds = (jobId: string) => {
    const ids = new Set<string>();
    for (const h of Object.values(handled)) if (h.item.jobId === jobId && !h.skipped) ids.add(h.item.id);
    for (const id of Object.keys(noted)) if (data.items.find((i) => i.id === id)?.jobId === jobId || handled[id]?.item.jobId === jobId) ids.add(id);
    return ids;
  };
  const touched = (jobId: string) => changedIds(jobId).size;

  // ---- actions, each writing through the api and folding the row in words ----
  const finishMoveWords = (jobId: string, before?: JobForecast): ReactNode => {
    const after = api.getForecast(jobId);
    if (!before?.forecastFinish || !after?.forecastFinish) return null;
    const delta = calendarDaysBetween(before.forecastFinish, after.forecastFinish);
    const name = shortJob(groups.find((g) => g.job.id === jobId)?.job.name ?? '');
    if (delta === 0) return ` ${name} finish doesn't move.`;
    const cost = before.slipCost !== undefined && after.slipCost !== undefined ? after.slipCost - before.slipCost : undefined;
    return (
      <span className="calls__moved" data-testid={`call-moved-${jobId}`}>
        {' '}
        {name} finish moves {formatDelta(delta)}
        {cost !== undefined && cost !== 0 ? (
          <>
            , <Money value={Math.abs(cost)} />
          </>
        ) : null}
        , now {formatShort(after.forecastFinish)}.
      </span>
    );
  };

  const advance = (item: Item, status: ItemStatus, confirmedFor?: string) => {
    const before = api.getForecast(item.jobId);
    if (status === 'confirmed' && confirmedFor && confirmedFor !== item.expectedDate) api.setItemExpectedDate(item.id, confirmedFor);
    api.updateItemStatus(item.id, status);
    // The folded sentence uses the button's own words ("Mark requested" -> "requested"), so the flow reads the same everywhere.
    const label = (nextStatus(item)?.label ?? 'Mark done').replace(/^Mark /, '').toLowerCase();
    const words = `${label}${status === 'confirmed' && confirmedFor ? ` for ${formatShort(confirmedFor)}` : ''}`;
    const moved = status === 'confirmed' && confirmedFor ? finishMoveWords(item.jobId, before) : null;
    setHandled((h) => ({ ...h, [item.id]: { item, words: <>{words}{moved}</> } }));
  };

  const setExpected = (item: Item, date: string) => {
    const before = api.getForecast(item.jobId);
    api.setItemExpectedDate(item.id, date);
    const moved = finishMoveWords(item.jobId, before);
    setHandled((h) => ({ ...h, [item.id]: { item, words: <>expected {item.expectedDate ? 'moved' : 'set'} to {formatShort(date)}.{moved}</> } }));
  };

  const setNote = (item: Item, text: string) => {
    api.updateItem(item.id, { notes: text || undefined });
    // A note alone does not fold the row (the question may still be open), but it counts as an update.
    setNoted((n) => ({ ...n, [item.id]: true }));
  };

  const skip = (item: Item) => setHandled((h) => ({ ...h, [item.id]: { item, words: 'skipped, stays for next call', skipped: true } }));
  const reopen = (item: Item) =>
    setHandled((h) => {
      const next = { ...h };
      delete next[item.id];
      return next;
    });

  // Desktop keys on the current row: B booked/ordered, C confirmed, M move date, N note, S skip.
  useEffect(() => {
    if (phone || finishing || summary) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (!currentId) return;
      const fns = focusFns.current[currentId];
      if (!fns) return;
      const key = e.key.toLowerCase();
      if (key === 'b') fns.advance();
      else if (key === 'c') fns.confirm();
      else if (key === 'm') fns.expected();
      else if (key === 'n') fns.note();
      else if (key === 's') fns.skip();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone, finishing, summary, currentId]);

  // ---- finish call ----
  const openFinish = () => {
    const t: Record<string, boolean> = {};
    for (const g of groups) t[g.job.id] = touched(g.job.id) > 0;
    setTicked(t);
    setFinishing(true);
    setTimeout(() => document.getElementById('calls-finish-panel')?.scrollIntoView({ block: 'nearest' }), 0);
  };
  const confirmFinish = () => {
    if (!person) return;
    const jobs = groups.filter((g) => ticked[g.job.id]).map((g) => ({ jobId: g.job.id, itemsUpdated: touched(g.job.id) }));
    api.finishCall({ personId: person.id, jobs });
    const lines: SummaryLine[] = groups
      .filter((g) => ticked[g.job.id] || touched(g.job.id) > 0)
      .map((g) => ({
        jobId: g.job.id,
        name: g.job.name,
        itemsUpdated: touched(g.job.id),
        confirmed: !!ticked[g.job.id],
        words: [...changedIds(g.job.id)].map((id) => {
          const h = handled[id];
          const title = h?.item.title ?? data.items.find((i) => i.id === id)?.title ?? id;
          return (
            <span key={id}>
              {title}: {h && !h.skipped ? h.words : 'note added'}
            </span>
          );
        }),
      }));
    setSummary({ personName: person.shortName, lines });
    setFinishing(false);
    setHandled({});
    setNoted({});
    setCallKey((k) => k + 1);
  };
  const anotherCall = () => {
    setSummary(null);
    setHandled({});
    setNoted({});
    setCallKey((k) => k + 1);
  };

  const meta = person
    ? total === 0
      ? `Nothing to chase with ${person.shortName} this fortnight`
      : `${total} item${total === 1 ? '' : 's'} across ${jobsWithItems} job${jobsWithItems === 1 ? '' : 's'} to chase with ${person.shortName}`
    : 'Nobody else on this side yet';

  return (
    <main className="page calls" data-testid="call-list">
      <PageHeader
        title="Call list"
        meta={<span data-testid="calls-count">{meta}</span>}
        actions={
          // On the phone the button sits at the foot of the script, where the call ends.
          person && !summary && !phone ? (
            <button type="button" className="btn btn--primary btn--desktop" onClick={openFinish} disabled={finishing} data-testid="calls-finish">
              Finish call
            </button>
          ) : undefined
        }
      />

      <div className="calls__body">
        <aside className="calls__people" aria-label="Who are you ringing">
          <h2 className="calls__people-title">Ringing</h2>
          <ul className="calls__people-list" data-testid="calls-people">
            {data.people.map((p) => {
              const n = countFor(p.id);
              const on = p.id === person?.id;
              return (
                <li key={p.id}>
                  <button type="button" className="calls__person" aria-pressed={on} onClick={() => pickPerson(p.id)} data-testid={`calls-person-${p.id}`}>
                    <span className="calls__person-name">{p.shortName}</span>
                    <span className="calls__person-count num">{n === 0 ? 'nothing' : `${n} item${n === 1 ? '' : 's'}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="calls__scope">
            <input type="checkbox" checked={everything} onChange={(e) => setParam('scope', e.target.checked ? 'all' : null)} data-testid="calls-scope" />
            <span>Every open item, not just this fortnight's</span>
          </label>
          {!phone && !summary && (
            <p className="calls__keys" data-testid="calls-keys">
              Keys on the marked row: <kbd>B</kbd> booked, <kbd>C</kbd> confirmed, <kbd>M</kbd> move date, <kbd>N</kbd> note, <kbd>S</kbd> skip.
            </p>
          )}
        </aside>

        <div className="calls__script">
          {summary ? (
            <section className="calls__summary" aria-labelledby="calls-summary-title" data-testid="calls-summary">
              <h2 id="calls-summary-title" className="calls__summary-title">
                Call with {summary.personName} finished
              </h2>
              {summary.lines.length === 0 ? (
                <p className="calls__quiet">Nothing was ticked or changed.</p>
              ) : (
                <ul className="calls__summary-list">
                  {summary.lines.map((l) => (
                    <li key={l.jobId} className="calls__summary-job" data-testid={`calls-summary-${l.jobId}`}>
                      <span className="calls__summary-name">
                        <Link to={`/jobs/${l.jobId}`}>{l.name}</Link>
                      </span>
                      <span className="calls__summary-words">
                        {l.confirmed ? 'Confirmed today. ' : 'Not confirmed. '}
                        {l.itemsUpdated === 0 ? 'Nothing changed.' : `${l.itemsUpdated} item${l.itemsUpdated === 1 ? '' : 's'} updated.`}
                      </span>
                      {l.words.length > 0 && <ul className="calls__summary-items">{l.words.map((w, i) => <li key={i}>{w}</li>)}</ul>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="calls__summary-foot">
                <button type="button" className="btn btn--desktop" onClick={anotherCall} data-testid="calls-again">
                  Start another call
                </button>
                <Link to="/monday" className="calls__summary-link">
                  Monday screen
                </Link>
              </p>
            </section>
          ) : !person ? (
            <p className="calls__empty" data-testid="calls-empty">
              Nobody else is on this side yet, so there is nobody to ring.
            </p>
          ) : (
            <>
              {total === 0 && (
                <p className="calls__empty" data-testid="calls-empty">
                  Nothing to chase with {person.shortName} this fortnight. Still worth confirming each job.
                </p>
              )}
              {groups.map((g) => {
                const fresh = freshWords(g.forecast);
                const open = g.items.filter((i) => !handled[i.id]);
                const done = Object.values(handled).filter((h) => h.item.jobId === g.job.id);
                return (
                  <section key={g.job.id} className="calls__job" aria-labelledby={`calls-job-title-${g.job.id}`} data-testid={`calls-job-${g.job.id}`}>
                    <header className="calls__job-head">
                      <h2 id={`calls-job-title-${g.job.id}`} className="calls__job-name">
                        <Link to={`/jobs/${g.job.id}`}>{g.job.name}</Link>
                      </h2>
                      <p className="calls__job-facts">
                        {fresh && (
                          <StatusText tone={fresh.tone} plain={fresh.tone === 'muted'} testId={`calls-fresh-${g.job.id}`}>
                            {fresh.text}
                          </StatusText>
                        )}
                        {g.forecast?.forecastFinish && (
                          <span className="calls__job-finish" data-testid={`calls-finish-${g.job.id}`}>
                            Finish <span className="num">{formatLong(g.forecast.forecastFinish)}</span>
                            {g.forecast.isLate ? `, ${g.forecast.lateDays} days late` : ''}
                          </span>
                        )}
                        <Money value={g.job.weeklyHoldingCost} label="Holding" suffix="/wk" className="calls__job-holding" testId={`calls-holding-${g.job.id}`} />
                      </p>
                    </header>
                    {g.items.length === 0 && done.length === 0 ? (
                      <p className="calls__quiet" data-testid={`calls-nothing-${g.job.id}`}>
                        Nothing to chase on {shortJob(g.job.name)} this fortnight.
                      </p>
                    ) : (
                      <>
                        <ul className="calls__items">
                          {open.map((i) => (
                            <CallItem
                              key={i.id}
                              item={i}
                              forecast={g.forecast?.items[i.id]}
                              step={i.stepId ? data.steps[i.stepId] : undefined}
                              trade={i.tradeId ? data.trades[i.tradeId] : undefined}
                              today={today}
                              offline={offline}
                              layout={layout}
                              personName={person.shortName}
                              current={!phone && i.id === currentId}
                              onAdvance={(status, confirmedFor) => advance(i, status, confirmedFor)}
                              onExpected={(date) => setExpected(i, date)}
                              onNote={(text) => setNote(i, text)}
                              onSkip={() => skip(i)}
                              onReopen={() => reopen(i)}
                              registerFocus={(fns) => {
                                focusFns.current[i.id] = fns;
                              }}
                            />
                          ))}
                        </ul>
                        {done.length > 0 && (
                          <div className="calls__done" data-testid={`calls-done-${g.job.id}`}>
                            <h3 className="calls__done-title">Done this call</h3>
                            <ul>
                              {done.map((h) => (
                                <CallItem
                                  key={h.item.id}
                                  item={h.item}
                                  today={today}
                                  offline={offline}
                                  layout={layout}
                                  handled={h}
                                  onAdvance={() => undefined}
                                  onExpected={() => undefined}
                                  onNote={() => undefined}
                                  onSkip={() => undefined}
                                  onReopen={() => reopen(h.item)}
                                />
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                );
              })}

              {phone && !finishing && (
                <p className="calls__finish-foot">
                  <button type="button" className="btn btn--primary" onClick={openFinish} data-testid="calls-finish">
                    Finish call
                  </button>
                </p>
              )}

              {finishing && (
                <section id="calls-finish-panel" className="calls__finish" aria-labelledby="calls-finish-title" data-testid="calls-finish-panel">
                  <h2 id="calls-finish-title" className="calls__finish-title">
                    Finish the call with {person.shortName}
                  </h2>
                  <p className="calls__finish-lede">Tick each job {person.shortName} confirmed is on track. Its program counts as checked today.</p>
                  <ul className="calls__finish-jobs">
                    {groups.map((g) => {
                      const n = touched(g.job.id);
                      return (
                        <li key={g.job.id}>
                          <label className="calls__tick">
                            <input
                              type="checkbox"
                              checked={!!ticked[g.job.id]}
                              onChange={(e) => setTicked((t) => ({ ...t, [g.job.id]: e.target.checked }))}
                              data-testid={`calls-confirm-${g.job.id}`}
                            />
                            <span className="calls__tick-words">
                              <span className="calls__tick-name">{g.job.name}</span>
                              <span className="calls__tick-note">
                                {ticked[g.job.id] ? 'Confirmed today' : 'Not confirmed'}
                                {n > 0 ? `, ${n} item${n === 1 ? '' : 's'} updated` : ''}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="calls__finish-btns">
                    <button type="button" className="btn btn--primary btn--desktop" onClick={confirmFinish} data-testid="calls-finish-confirm">
                      Confirm {Object.values(ticked).filter(Boolean).length} job{Object.values(ticked).filter(Boolean).length === 1 ? '' : 's'}
                    </button>
                    <button type="button" className="btn btn--desktop" onClick={() => setFinishing(false)} data-testid="calls-finish-cancel">
                      Back to the list
                    </button>
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
