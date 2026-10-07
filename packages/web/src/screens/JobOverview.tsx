/**
 * Build job overview: how is this job going, on one screen. The forecast
 * finish and the slip lead; below them the stages on a small time chart, the
 * next hold point with its empty photo categories, the top five waiting-on
 * items, shipments, this week's daily notes and the latest photos.
 * A design job has no overview: it opens its checklist.
 */
import { useEffect } from 'react';
import {
  formatDate,
  formatLong,
  formatStamp,
  relativeDays,
  type DashboardApi,
  type ISODate,
  type JobOverview,
  type WaitingRow,
} from '@ct/core';
import { useData } from '../data/DataContext';
import { useJobQuery } from '../data/useJobQuery';
import { href } from '../app/router';
import { jobHome, tabHref } from '../app/jobNav';
import { Freshness, LoadError, LoadingRows, Money } from '../components/bits';
import { Bar, makeScale, TimeAxis, TimeGrid } from '../components/Timeline';
import { lateWords, plural, rangeWords, slipWords, statusWords } from '../ui/format';

export function loadOverview(api: DashboardApi, jobId: string): Promise<JobOverview> {
  return api.getJobOverview(jobId);
}

export function JobOverviewScreen({ jobId }: { jobId: string }) {
  const q = useJobQuery(loadOverview, jobId);
  const isDesign = q.status === 'ready' && q.data.job.kind === 'design';
  useEffect(() => {
    if (isDesign) globalThis.location?.replace(jobHome({ jobId, kind: 'design' }));
  }, [isDesign, jobId]);
  return (
    <div className="screen overview">
      {q.status === 'loading' && (
        <>
          <h1 className="sr-only">Overview</h1>
          <LoadingRows rows={4} label="Loading the job" />
        </>
      )}
      {q.status === 'error' && (
        <>
          <h1>Overview</h1>
          <LoadError what="this job" error={q.error} retry={q.retry} />
        </>
      )}
      {q.status === 'ready' && !isDesign && <OverviewBody o={q.data} />}
    </div>
  );
}

export function OverviewBody({ o }: { o: JobOverview }) {
  const f = o.forecast;
  const today = f.today;
  const slip = slipWords(f.slipDays, f.snapshot?.date ?? null, today);
  const ref = { jobId: o.job.id, kind: o.job.kind };
  const waitingHref = tabHref(ref, 'Waiting on');
  const photosHref = tabHref(ref, 'Photos');
  const notesHref = tabHref(ref, 'Notes');
  return (
    <>
      <h1 className="sr-only">{o.job.name} overview</h1>
      <section className="ov-hero" aria-label="Forecast" data-testid="overview-hero">
        <div className="ov-fig ov-finish">
          <span className="ov-label">Forecast finish</span>
          <span className="num" data-testid="ov-finish">
            {f.forecastFinish ? formatLong(f.forecastFinish) : 'No finish date'}
          </span>
          {f.plannedFinish && (
            <span className="sub">{f.lateDays ? `Planned ${formatDate(f.plannedFinish, today)}, ${lateWords(f.lateDays)}` : 'On the original plan'}</span>
          )}
        </div>
        <div className="ov-fig">
          <span className="ov-label">Against last Monday</span>
          <span className={`num slip slip-${slip.direction}`} data-testid="ov-slip">
            {slip.big}
          </span>
          <span className="sub">{slip.small}</span>
        </div>
        <div className="ov-fig">
          <span className="ov-label">Slip cost</span>
          {f.slipCost ? (
            <Money amount={f.slipCost} className="num" testId="ov-slip-cost" />
          ) : f.slipCost === 0 ? (
            <span className="cost-none" data-testid="ov-slip-cost">
              Nothing this week
            </span>
          ) : null}
          {f.weeklyHoldingCost !== null && (
            <span className="sub">
              <Money amount={f.weeklyHoldingCost} /> a week to hold
            </span>
          )}
        </div>
        <div className="ov-fig ov-fresh ov-fig-nolabel">
          <span className="ov-label sr-only">Last confirmed</span>
          <Freshness amber={f.freshness.amber} daysUnconfirmed={f.freshness.daysUnconfirmed} freshnessText={f.freshness.text} testId="ov-freshness" />
          {f.currentStageName && <span className="sub">Now in {f.currentStageName}</span>}
        </div>
      </section>

      <StageChart o={o} />

      <div className="ov-cols">
        <div className="ov-col">
          <section className="block" aria-labelledby="ov-wait-h" data-testid="ov-waiting">
            <h2 id="ov-wait-h">Waiting on</h2>
            {o.waitingOn.length ? (
              <ul className="wl">
                {o.waitingOn.map((r) => (
                  <WaitingLine key={r.itemId} r={r} today={today} />
                ))}
              </ul>
            ) : (
              <p className="empty">Nothing open on this job.</p>
            )}
            {waitingHref && (
              <p className="more-link">
                <a href={waitingHref}>Everything this job is waiting on</a>
              </p>
            )}
          </section>

          {o.shipments.length > 0 && (
            <section className="block" aria-labelledby="ov-ship-h" data-testid="ov-shipments">
              <h2 id="ov-ship-h">Shipments</h2>
              <ul className="wl">
                {o.shipments.map((s) => (
                  <li key={s.shipmentId} className={s.isLate ? 'wl-row is-late' : 'wl-row'}>
                    <span className="wl-title">{s.name}</span>
                    <span className="wl-when">
                      {s.eta ? `Expected ${formatDate(s.eta, today)}` : 'No ETA yet'}, {s.statusLabel.toLowerCase()}
                    </span>
                    <span className="wl-who">
                      {s.isLate ? <strong className="late-words">{s.lateDays} days after it is needed</strong> : s.earliestNeededBy ? `Needed ${formatDate(s.earliestNeededBy, today)}` : null}
                      {s.linkedCount ? `${s.isLate || s.earliestNeededBy ? ', ' : ''}${plural(s.linkedCount, 'item')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="ov-col">
          <HoldPoint o={o} photosHref={photosHref} />

          <section className="block" aria-labelledby="ov-notes-h" data-testid="ov-notes">
            <h2 id="ov-notes-h">This week's notes</h2>
            {o.notesThisWeek.length ? (
              <ul className="notes">
                {o.notesThisWeek.map((n) => (
                  <li key={n.id}>
                    <span className="note-date">{formatDate(n.date, today)}</span>
                    <p>{n.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No notes this week. Send one to the bot and it lands here.</p>
            )}
            {notesHref && (
              <p className="more-link">
                <a href={notesHref}>All daily notes</a>
              </p>
            )}
          </section>

          <Photos o={o} photosHref={photosHref} />
        </div>
      </div>
    </>
  );
}

function WaitingLine({ r, today }: { r: WaitingRow; today: ISODate }) {
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const when =
    r.isLate && r.lateText
      ? cap(r.lateText)
      : r.status === 'to_do' && r.actBy
        ? `Act by ${formatDate(r.actBy, today)}, ${relativeDays(r.actBy, today, { deadline: true })}`
        : r.expected
          ? `Expected ${formatDate(r.expected, today)}${r.neededBy ? `, needed ${formatDate(r.neededBy, today)}` : ''}`
          : r.neededBy
            ? `Needed ${formatDate(r.neededBy, today)}, ${relativeDays(r.neededBy, today, { deadline: true })}`
            : 'No date';
  return (
    <li className={r.isLate || r.overdue ? 'wl-row is-late' : 'wl-row'} data-testid="ov-waiting-row">
      <span className="wl-title">{r.title}</span>
      <span className="wl-when">{r.isLate || r.overdue ? <strong className="late-words">{when}</strong> : when}</span>
      <span className="wl-who">
        {[r.statusLabel, r.owner, r.waitingOn && r.waitingOn !== r.owner ? `waiting on ${r.waitingOn}` : null].filter(Boolean).join(', ')}
      </span>
    </li>
  );
}

function StageChart({ o }: { o: JobOverview }) {
  const today = o.forecast.today;
  const stages = o.stages.filter((s) => s.forecastStart && s.forecastEnd);
  if (!stages.length) return <p className="empty">No program yet. Steps are set up in the program editor on the desktop.</p>;
  const dates = stages.flatMap((s) => [s.forecastStart!, s.forecastEnd!, s.plannedStart, s.plannedEnd]).filter((d): d is ISODate => !!d).sort();
  const scale = makeScale(dates[0]!, dates[dates.length - 1]!);
  const programHref = tabHref({ jobId: o.job.id, kind: o.job.kind }, 'Program');
  return (
    <section className="block ov-stages" aria-labelledby="ov-stages-h" data-testid="ov-stages">
      <h2 id="ov-stages-h">
        Stages
        {programHref && (
          <a className="h-link" href={programHref}>
            Full program
          </a>
        )}
      </h2>
      <div className="gantt gantt-mini">
        <div className="gantt-head">
          <span className="gantt-corner" />
          <TimeAxis scale={scale} dense short />
        </div>
        <div className="gantt-body">
          <div className="gantt-layer">
            <TimeGrid scale={scale} today={today} shutdowns={[]} />
          </div>
          {stages.map((s) => (
            <div key={s.stageId} className={`g-row g-row-step${s.isLate ? ' is-late' : ''}${s.status === 'done' ? ' is-done' : ''}`}>
              <div className="g-label">
                <span className="g-step-name g-plain">{s.name}</span>
                <span className="g-stage-status">{s.isLate ? lateWords(s.lateDays) : statusWords(s.status)}</span>
                <span className="sr-only">, {rangeWords(s.forecastStart, s.forecastEnd, today)}</span>
              </div>
              <div className="g-track">
                <Bar
                  scale={scale}
                  plannedStart={s.plannedStart}
                  plannedEnd={s.plannedEnd}
                  start={s.forecastStart!}
                  end={s.forecastEnd!}
                  tone={s.status === 'done' ? 'done' : s.isLate ? 'late' : 'open'}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HoldPoint({ o, photosHref }: { o: JobOverview; photosHref: string | null }) {
  const h = o.nextHoldPoint;
  const today = o.forecast.today;
  if (!h) return null;
  return (
    <section className="block hp-block" aria-labelledby="ov-hold-h" data-testid="ov-hold">
      <h2 id="ov-hold-h">Next hold point</h2>
      <p className="hold-what">
        <a href={href(`/jobs/${encodeURIComponent(o.job.id)}/steps/${encodeURIComponent(h.stepId)}`)}>{h.stepName}</a>
        {h.forecastStart && (
          <span className="sub">
            {formatDate(h.forecastStart, today)}, {relativeDays(h.forecastStart, today)}. {h.filledCount} of {plural(h.required.length, 'photo category', 'photo categories')} filled.
          </span>
        )}
      </p>
      <ul className="cats">
        {h.required.map((c) => (
          <li key={c.categoryId} className={c.photoCount ? 'cat cat-ok' : 'cat cat-missing'}>
            <span className="cat-box" aria-hidden="true" />
            <span className="cat-name">{c.name}</span>
            <span className="cat-count">{c.photoCount ? plural(c.photoCount, 'photo') : 'No photo yet'}</span>
          </li>
        ))}
      </ul>
      {photosHref && !h.ok && (
        <p className="more-link">
          <a href={photosHref}>Photos for this job</a>
        </p>
      )}
    </section>
  );
}

function Photos({ o, photosHref }: { o: JobOverview; photosHref: string | null }) {
  const { api } = useData();
  if (!o.latestPhotos.length) return null;
  return (
    <section className="block" aria-labelledby="ov-photos-h" data-testid="ov-photos">
      <h2 id="ov-photos-h">
        Latest photos
        {photosHref && (
          <a className="h-link" href={photosHref}>
            All photos
          </a>
        )}
      </h2>
      <ul className="ov-thumbs">
        {o.latestPhotos.map((p) => (
          <li key={p.id}>
            <img src={api.photoUrl(p)} alt={p.caption ?? 'Site photo'} loading="lazy" width={160} height={120} />
            <span className="thumb-when">{formatStamp(p.receivedAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
