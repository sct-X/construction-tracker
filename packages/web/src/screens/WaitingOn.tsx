/**
 * Waiting on: one list of everything that can hold a job up (v1, Dom 24 Sep:
 * "waiting on only needs one view, not list and call together. just
 * simplify"). The same list on the phone and the desktop, grouped Overdue
 * (exactly core isOverdue, the Overview's red count), This week and Later
 * (folded by default). Each row: the title, the job and who it is waiting on,
 * one date phrase with its relative time, and a Call button (a tel: link that
 * names the trade) when the trade has a number. This replaces To chase
 * (#/chase forwards here). Read-only: changes come through the bot.
 *
 * Filters: Everyone | Mine (Dominic's own items) and, across all jobs, a job
 * menu that opens that job's Waiting on tab. On the phone the filter bar
 * sticks under the nav bar as floating Regular glass.
 */
import { useState } from 'react';
import type { DashboardApi, OverviewRow, SideFilter, WaitingOnView, WaitingRow } from '@ct/core';
import { useSideQuery } from '../data/DataContext';
import { usePhoneWidth } from '../shell/useNarrow';
import { PhoneGlyph } from '../shell/icons';
import { LoadError, LoadingRows } from '../components/bits';
import { PageHeader } from '../components/PageHeader';
import { StatusText } from '../components/StatusText';
import { href } from '../app/router';
import { telHref } from '../ui/itemWords';
import { whenWords } from '../ui/when';
import '../styles/waiting.css';

/** Whose items "Mine" means: the app has one user (SPEC), and items carry their owner as plain text. */
export const ME = 'Dominic';

export interface WaitingData {
  today: string;
  view: WaitingOnView;
  jobs: Pick<OverviewRow, 'jobId' | 'name' | 'kind'>[];
  jobId: string | null;
}

export async function loadWaiting(api: DashboardApi, filter: SideFilter, jobId: string | null): Promise<WaitingData> {
  const [today, view, list] = await Promise.all([api.getToday(), api.getWaitingOn({ ...filter, ...(jobId ? { jobId } : {}) }), api.listJobs(filter)]);
  return { today, view, jobs: [...list.builds, ...list.design], jobId };
}

export function WaitingOnScreen({ jobId = null }: { jobId?: string | null }) {
  const q = useSideQuery((api, f) => loadWaiting(api, f, jobId));
  if (q.status === 'loading') return <LoadingRows rows={6} label="Loading the waiting-on list" />;
  if (q.status === 'error') return <LoadError what="the waiting-on list" error={q.error} retry={q.retry} />;
  return <WaitingBody data={q.data} />;
}

/** "47 to act on, 5 overdue", "Nothing waiting". */
export function waitingMeta(total: number, overdue: number): string {
  if (total === 0) return 'Nothing waiting';
  return `${total} to act on${overdue ? `, ${overdue} overdue` : ''}`;
}

export function WaitingBody({ data }: { data: WaitingData }) {
  const { today, view, jobs, jobId } = data;
  const phone = usePhoneWidth();
  const [mine, setMine] = useState(false);
  const keep = (r: WaitingRow) => !mine || (r.owner ?? '').toLowerCase() === ME.toLowerCase();
  const groups = view.groups.map((g) => ({ ...g, rows: g.rows.filter(keep) }));
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const overdue = groups.find((g) => g.key === 'overdue')?.rows.length ?? 0;
  const jobName = jobId ? jobs.find((j) => j.jobId === jobId)?.name : undefined;
  const meta = waitingMeta(total, overdue);

  return (
    <div className="waiting" data-testid="waiting-on">
      {jobId ? (
        <div className="waiting__head">
          <h2 className="waiting__title">
            Waiting on<span className="sr-only"> at {jobName}</span>
          </h2>
          <p className="page-header__meta" data-testid="waiting-sub">
            {meta}
          </p>
        </div>
      ) : (
        <PageHeader title="Waiting on" meta={<span data-testid="waiting-sub">{meta}</span>} />
      )}

      <div className={phone ? 'filterbar waiting__filters glass glass--regular glass--float' : 'filterbar waiting__filters'} data-testid="waiting-filters">
        <span className="seg waiting__owner" role="group" aria-label="Whose items">
          <button type="button" className="seg__btn" aria-pressed={!mine} onClick={() => setMine(false)} data-testid="waiting-owner-all">
            Everyone
          </button>
          <button type="button" className="seg__btn" aria-pressed={mine} onClick={() => setMine(true)} data-testid="waiting-owner-me">
            Mine
          </button>
        </span>
        {!jobId && (
          <label className="filter">
            <span className="sr-only">Job</span>
            <select
              className="filter__select"
              value=""
              data-testid="job-picker"
              onChange={(e) => {
                const v = e.target.value;
                if (v) globalThis.location.hash = href(`/jobs/${encodeURIComponent(v)}/waiting`);
              }}
            >
              <option value="">All jobs</option>
              {(['build', 'design'] as const).map((kind) => {
                const list = jobs.filter((j) => j.kind === kind);
                return list.length ? (
                  <optgroup key={kind} label={kind === 'build' ? 'Builds' : 'Design'}>
                    {list.map((j) => (
                      <option key={j.jobId} value={j.jobId}>
                        {j.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          </label>
        )}
      </div>

      {total === 0 ? (
        <p className="empty-line" data-testid="waiting-empty">
          Nothing waiting{jobName ? ` on ${jobName}` : mine ? ' with you' : ''}.
        </p>
      ) : (
        <div className="waiting__groups">
          {groups.map((g) => {
            if (g.rows.length === 0) return null;
            const list = (
              <ul className="group__list waiting__list">
                {g.rows.map((r) => (
                  <WaitingItem key={r.itemId} r={r} today={today} showJob={!jobId} />
                ))}
              </ul>
            );
            const head = (
              <>
                {g.label}
                <span className="waiting__count">{g.rows.length}</span>
              </>
            );
            // Later is long: folded by default, one tap opens it.
            if (g.key === 'later') {
              return (
                <details key={g.key} className="group waiting__group waiting__fold" data-testid={`waiting-group-${g.key}`} data-count={g.rows.length}>
                  <summary className="group__header group__header--large waiting__group-head">{head}</summary>
                  {list}
                </details>
              );
            }
            return (
              <section key={g.key} className="group waiting__group" aria-labelledby={`waiting-${g.key}-title`} data-testid={`waiting-group-${g.key}`} data-count={g.rows.length}>
                <h3 id={`waiting-${g.key}-title`} className="group__header group__header--large waiting__group-head">
                  {head}
                </h3>
                {list}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** "Park Rd · waiting on HiHaus (China), with Raff". */
export function detailWords(r: WaitingRow, showJob: boolean): string {
  const sameOwner = !!r.waitingOn && !!r.owner && r.waitingOn.toLowerCase() === r.owner.toLowerCase();
  const who = [r.waitingOn ? `waiting on ${r.waitingOn}` : '', r.owner && !sameOwner ? `with ${r.owner}` : ''].filter(Boolean).join(', ');
  return [showJob ? r.jobName : '', who].filter(Boolean).join(' · ');
}

export function WaitingItem({ r, today, showJob }: { r: WaitingRow; today: string; showJob: boolean }) {
  const when = whenWords(r, today);
  const tel = telHref(r.tradePhone);
  const detail = detailWords(r, showJob);
  const to = r.stepId ? href(`/jobs/${encodeURIComponent(r.jobId)}/steps/${encodeURIComponent(r.stepId)}`) : null;
  const words = (
    <>
      <span className="wrow__title">{r.title}</span>
      {detail && <span className="wrow__detail">{detail}</span>}
      <StatusText tone={when.tone === 'late' ? 'late' : when.tone === 'muted' ? 'muted' : 'plain'} plain className="wrow__when" testId="when">
        {when.text}
      </StatusText>
    </>
  );
  return (
    <li className={to ? 'wrow wrow--link' : 'wrow'} data-testid={`waiting-row-${r.itemId}`} data-overdue={r.overdue || undefined}>
      {to ? (
        <a href={to} className="wrow__open">
          {words}
        </a>
      ) : (
        <div className="wrow__open">{words}</div>
      )}
      {to && <span className="chevron wrow__chevron" aria-hidden="true" />}
      {tel && (
        <div className="wrow__actions">
          <a className="btn btn--glass wrow__btn wrow__call" href={tel} aria-label={`Call ${r.tradeName ?? 'the trade'}, ${r.tradePhone}`} title={r.tradePhone ?? undefined} data-testid="call">
            <PhoneGlyph />
            <span className="wrow__call-name">Call {r.tradeName ?? 'the trade'}</span>
          </a>
        </div>
      )}
    </li>
  );
}
