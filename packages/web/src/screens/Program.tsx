/**
 * Program: when every step happens, what it waits for and what is late.
 * Desktop: a Gantt, forecast bars solid over the planned outline, today line,
 * hold points as diamonds with the words "Hold point", the shutdown hatched.
 * Phone: the three-week look-ahead as a list, and the stages as a strip.
 * Nothing drags; a step name opens step detail.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  addCalendarDays,
  formatDate,
  formatLong,
  lastMonday,
  type DashboardApi,
  type ISODate,
  type ProgramStep,
  type ProgramView,
  type StageForecast,
  type WaitingRow,
} from '@ct/core';
import { href } from '../app/router';
import { LoadError, LoadingRows } from '../components/bits';
import { Bar, makeScale, TimeAxis, TimeGrid, TimelineKey, type BarTone, type Scale } from '../components/Timeline';
import { lateWords, plural, rangeWords, statusWords } from '../ui/format';
import { useJobQuery } from '../data/useJobQuery';

export function loadProgram(api: DashboardApi, jobId: string): Promise<ProgramView> {
  return api.getProgram(jobId);
}

type View = 'gantt' | 'lookahead' | 'stages';
const PHONE = '(max-width: 760px)';

function isPhone(): boolean {
  try {
    return globalThis.matchMedia?.(PHONE).matches ?? false;
  } catch {
    return false;
  }
}

/** Gantt on a desktop, look-ahead on a phone; the phone has no Gantt button. */
function useView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(() => (isPhone() ? 'lookahead' : 'gantt'));
  useEffect(() => {
    const mq = globalThis.matchMedia?.(PHONE);
    if (!mq) return;
    const on = () => setView((v) => (mq.matches && v === 'gantt' ? 'lookahead' : v));
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return [view, setView];
}

export function ProgramScreen({ jobId }: { jobId: string }) {
  const q = useJobQuery(loadProgram, jobId);
  const [view, setView] = useView();
  return (
    <div className="screen program">
      <header className="screen-head">
        <h1>
          Program{q.status === 'ready' && (
            <>
              {' '}
              <span className="sr-only">for {q.data.job.name}</span>
            </>
          )}
        </h1>
        {q.status === 'ready' && <ProgramSub p={q.data} />}
      </header>
      {q.status === 'loading' && <LoadingRows rows={6} label="Loading the program" />}
      {q.status === 'error' && <LoadError what="the program" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ProgramBody p={q.data} view={view} setView={setView} />}
    </div>
  );
}

function ProgramSub({ p }: { p: ProgramView }) {
  const f = p.forecast;
  const today = f.today;
  if (!f.forecastFinish) return null;
  return (
    <p className="screen-sub" data-testid="program-sub">
      Forecast finish <strong>{formatLong(f.forecastFinish)}</strong>
      {f.plannedFinish
        ? f.lateDays
          ? `, ${lateWords(f.lateDays)} against the planned ${formatDate(f.plannedFinish, today)}.`
          : ', as planned.'
        : '.'}
    </p>
  );
}

export function ProgramBody({ p, view, setView }: { p: ProgramView; view: View; setView: (v: View) => void }) {
  if (!p.steps.length) {
    return <p className="empty">No program yet. Steps are set up in the program editor on the desktop.</p>;
  }
  const views: { v: View; label: string }[] = [
    { v: 'gantt', label: 'Gantt' },
    { v: 'lookahead', label: 'Next 3 weeks' },
    { v: 'stages', label: 'Stages' },
  ];
  return (
    <>
      <div className="seg" role="group" aria-label="Show the program as">
        {views.map(({ v, label }) => (
          <button key={v} type="button" className={`seg-btn seg-${v}`} aria-pressed={view === v} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>
      {view === 'gantt' && <Gantt p={p} />}
      {view === 'lookahead' && <LookAhead p={p} />}
      {view === 'stages' && <StagesStrip p={p} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Gantt (desktop)
// ---------------------------------------------------------------------------

type GanttFilter = 'open' | 'all' | 'late';

function stepTone(s: ProgramStep): BarTone {
  if (s.status === 'done') return 'done';
  return s.isLate ? 'late' : 'open';
}

function Gantt({ p }: { p: ProgramView }) {
  const [filter, setFilter] = useState<GanttFilter>('open');
  const today = p.forecast.today;
  const doneStages = p.stages.filter((s) => s.status === 'done');
  const shown = useMemo(() => {
    const keep = (s: ProgramStep) =>
      filter === 'all' ? true : filter === 'late' ? s.isLate && s.status !== 'done' : !doneStages.some((d) => d.stageId === s.stageId);
    return p.stages
      .map((st) => ({ stage: st, steps: p.steps.filter((s) => s.stageId === st.stageId && keep(s)) }))
      .filter((g) => g.steps.length)
      .sort((a, b) => (a.stage.forecastStart ?? '').localeCompare(b.stage.forecastStart ?? '') || a.stage.order - b.stage.order);
  }, [p, filter, doneStages]);

  const scale = useMemo(() => {
    const steps = shown.flatMap((g) => g.steps);
    const dates = steps.flatMap((s) => [s.forecastStart, s.forecastEnd, s.plannedStart, s.plannedEnd]).filter((d): d is ISODate => !!d);
    if (!dates.length) return makeScale(today, addCalendarDays(today, 28));
    dates.sort();
    const from = dates[0]! < today || filter !== 'late' ? dates[0]! : today;
    return makeScale(from < today ? from : today, dates[dates.length - 1]!);
  }, [shown, today, filter]);

  const filters: { f: GanttFilter; label: string }[] = [
    { f: 'open', label: 'From the current stage' },
    { f: 'all', label: 'Whole program' },
    { f: 'late', label: 'Late steps only' },
  ];
  const lateCount = p.steps.filter((s) => s.isLate && s.status !== 'done').length;

  return (
    <section className="gantt-wrap" aria-labelledby="gantt-h">
      <div className="gantt-bar">
        <h2 id="gantt-h">Gantt</h2>
        <div className="seg seg-small" role="group" aria-label="Steps to show">
          {filters.map(({ f, label }) => (
            <button key={f} type="button" className="seg-btn" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <TimelineKey shutdown={p.shutdowns.some((s) => s.to >= scale.from && s.from < scale.to)} />
      {filter === 'open' && doneStages.length > 0 && (
        <p className="gantt-done" data-testid="gantt-done">
          Done: {doneStages.map((s) => s.name).join(', ')}
          {doneStages[0]!.forecastStart && doneStages[doneStages.length - 1]!.forecastEnd
            ? ` (${rangeWords(doneStages[0]!.forecastStart, doneStages[doneStages.length - 1]!.forecastEnd, today)})`
            : ''}
          .
        </p>
      )}
      {filter === 'late' && lateCount === 0 ? (
        <p className="empty">Nothing is late. Every open step starts on or before its planned date.</p>
      ) : (
        <div className="gantt-scroll">
          <div className="gantt" data-testid="gantt">
            <div className="gantt-head">
              <span className="gantt-corner">Step</span>
              <TimeAxis scale={scale} dense={scale.days > 200} />
            </div>
            <div className="gantt-body">
              <div className="gantt-layer">
                <TimeGrid scale={scale} today={today} shutdowns={p.shutdowns} />
              </div>
              {shown.map((g) => (
                <GanttStage key={g.stage.stageId} stage={g.stage} steps={g.steps} scale={scale} today={today} jobId={p.job.id} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function GanttStage({ stage, steps, scale, today, jobId }: { stage: StageForecast; steps: ProgramStep[]; scale: Scale; today: ISODate; jobId: string }) {
  return (
    <div className="g-stage" role="group" aria-label={`${stage.name}, ${statusWords(stage.status).toLowerCase()}`}>
      <div className={stage.isLate ? 'g-row g-row-stage is-late' : 'g-row g-row-stage'}>
        <div className="g-label">
          <span className="g-stage-name">{stage.name}</span>
          <span className="g-stage-status">{stage.isLate ? lateWords(stage.lateDays) : statusWords(stage.status)}</span>
        </div>
        <div className="g-track">
          {stage.forecastStart && stage.forecastEnd && (
            <Bar
              scale={scale}
              plannedStart={stage.plannedStart}
              plannedEnd={stage.plannedEnd}
              start={stage.forecastStart}
              end={stage.forecastEnd}
              tone={stage.status === 'done' ? 'done' : 'open'}
              thin
            />
          )}
        </div>
      </div>
      {steps.map((s) => (
        <GanttStep key={s.stepId} s={s} scale={scale} today={today} jobId={jobId} />
      ))}
    </div>
  );
}

function GanttStep({ s, scale, today, jobId }: { s: ProgramStep; scale: Scale; today: ISODate; jobId: string }) {
  const late = s.isLate && s.status !== 'done';
  return (
    <div className={`g-row g-row-step${late ? ' is-late' : ''}${s.status === 'done' ? ' is-done' : ''}`} data-testid={`g-step-${s.stepId}`}>
      <div className="g-label">
        <a className="g-step-name" href={href(`/jobs/${encodeURIComponent(jobId)}/steps/${encodeURIComponent(s.stepId)}`)}>
          {s.name}
        </a>
        {s.isHoldPoint && <span className="hp-tag">Hold point</span>}
        <span className="sr-only">
          , {statusWords(s.status)}, forecast {rangeWords(s.forecastStart, s.forecastEnd, today)}
          {late ? `, ${lateWords(s.lateDays)}, planned ${rangeWords(s.plannedStart, s.plannedEnd, today)}` : ''}
        </span>
      </div>
      <div className="g-track">
        <Bar
          scale={scale}
          plannedStart={s.plannedStart}
          plannedEnd={s.plannedEnd}
          start={s.forecastStart}
          end={s.forecastEnd}
          tone={stepTone(s)}
          hold={s.isHoldPoint}
          note={late ? lateWords(s.lateDays) : null}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Look-ahead (phone default)
// ---------------------------------------------------------------------------

interface Week {
  key: string;
  label: string;
  from: ISODate;
  to: ISODate;
}

export function lookAheadWeeks(today: ISODate): Week[] {
  const m = lastMonday(today);
  return ['This week', 'Next week', 'Week after'].map((label, i) => {
    const from = addCalendarDays(m, i * 7);
    return { key: `w${i}`, label, from, to: addCalendarDays(from, 6) };
  });
}

/** Steps for each week: those starting that week; the first week also lists steps already under way. */
export function lookAheadGroups(p: ProgramView) {
  const today = p.forecast.today;
  const weeks = lookAheadWeeks(today);
  const open = p.steps.filter((s) => s.status !== 'done');
  const groups = weeks.map((w, i) => ({
    week: w,
    steps: open
      .filter((s) => (s.forecastStart >= w.from && s.forecastStart <= w.to) || (i === 0 && s.forecastStart < w.from && s.forecastEnd >= w.from))
      .sort((a, b) => a.forecastStart.localeCompare(b.forecastStart) || a.order - b.order),
  }));
  const after = weeks[2]!.to;
  const lateLater = open.filter((s) => s.forecastStart > after && s.isLate).sort((a, b) => a.forecastStart.localeCompare(b.forecastStart));
  return { groups, lateLater };
}

function LookAhead({ p }: { p: ProgramView }) {
  const today = p.forecast.today;
  const { groups, lateLater } = lookAheadGroups(p);
  const needs = (stepId: string) => p.items.filter((i) => i.stepId === stepId && i.status !== 'confirmed');
  return (
    <section className="lookahead" aria-labelledby="la-h" data-testid="lookahead">
      <h2 id="la-h" className="sr-only">
        Next three weeks
      </h2>
      {groups.map(({ week, steps }) => (
        <section key={week.key} className="la-week" aria-labelledby={`la-${week.key}`}>
          <h3 id={`la-${week.key}`}>
            {week.label} <span className="h-note">{rangeWords(week.from, addCalendarDays(week.from, 4), today)}</span>
          </h3>
          {steps.length ? (
            <ul className="la-list">
              {steps.map((s) => (
                <LookAheadStep key={s.stepId} s={s} today={today} weekFrom={week.from} needs={needs(s.stepId)} jobId={p.job.id} />
              ))}
            </ul>
          ) : (
            <p className="la-none">{week.key === 'w0' ? 'Nothing on this week.' : 'Nothing starts that week.'}</p>
          )}
        </section>
      ))}
      {lateLater.length > 0 && (
        <section className="la-week la-later" aria-labelledby="la-later">
          <h3 id="la-later">Later, running late</h3>
          <ul className="la-list">
            {lateLater.map((s) => (
              <li key={s.stepId} className="la-step is-late">
                <a className="la-name" href={href(`/jobs/${encodeURIComponent(p.job.id)}/steps/${encodeURIComponent(s.stepId)}`)}>
                  {s.name}
                </a>
                <span className="la-late">
                  {lateWords(s.lateDays)}, now starts {formatDate(s.forecastStart, today)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function LookAheadStep({ s, today, weekFrom, needs, jobId }: { s: ProgramStep; today: ISODate; weekFrom: ISODate; needs: WaitingRow[]; jobId: string }) {
  const late = s.isLate;
  const underWay = s.forecastStart < weekFrom || s.status === 'in_progress';
  return (
    <li className={late ? 'la-step is-late' : 'la-step'} data-testid={`la-step-${s.stepId}`}>
      <div className="la-top">
        <a className="la-name" href={href(`/jobs/${encodeURIComponent(jobId)}/steps/${encodeURIComponent(s.stepId)}`)}>
          {s.name}
        </a>
        <span className="la-stage">{s.stageName}</span>
      </div>
      <p className="la-when">
        {underWay ? `Under way, finishes ${formatDate(s.forecastEnd, today)}` : rangeWords(s.forecastStart, s.forecastEnd, today)}
        {!underWay && s.durationDays > 1 ? `, ${plural(s.durationDays, 'working day')}` : ''}
        {s.tradeType ? `. ${s.tradeType}` : ''}
      </p>
      {s.isHoldPoint && <span className="hp-tag">Hold point</span>}
      {late && <p className="la-late">{s.reason}</p>}
      {needs.length > 0 && (
        <ul className="la-needs" aria-label={`What ${s.name} needs`}>
          <li className="la-needs-h" aria-hidden="true">
            Needs
          </li>
          {needs.map((i) => (
            <li key={i.itemId}>
              <span className="la-need-title">{i.title}</span>: {i.statusLabel.toLowerCase()}
              {i.isLate && i.lateText ? `, ${i.lateText}` : i.actByPassed && i.status === 'to_do' ? `, act-by was ${formatDate(i.actBy!, today)}` : ''}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Stages strip (phone)
// ---------------------------------------------------------------------------

function StagesStrip({ p }: { p: ProgramView }) {
  const today = p.forecast.today;
  const stages = [...p.stages].sort((a, b) => a.order - b.order);
  return (
    <section aria-labelledby="stages-h" data-testid="stages-strip">
      <h2 id="stages-h" className="sr-only">
        Stages
      </h2>
      <ol className="strip">
        {stages.map((st) => {
          const steps = p.steps.filter((s) => s.stageId === st.stageId);
          const done = steps.filter((s) => s.status === 'done').length;
          const late = steps.filter((s) => s.isLate && s.status !== 'done');
          return (
            <li key={st.stageId} className={`strip-stage strip-${st.status}`}>
              <div className="strip-top">
                <span className="strip-name">{st.name}</span>
                <span className="strip-status">{st.isLate ? lateWords(st.lateDays) : statusWords(st.status)}</span>
              </div>
              <p className="strip-dates">{rangeWords(st.forecastStart, st.forecastEnd, today)}</p>
              <div className="strip-progress">
                <span className="meter" aria-hidden="true">
                  <span className="meter-fill" style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }} />
                </span>
                <span className="strip-count">
                  {done} of {plural(steps.length, 'step')} done
                </span>
              </div>
              {late.length > 0 && (
                <ul className="strip-late">
                  {late.map((s) => (
                    <li key={s.stepId}>
                      <a href={href(`/jobs/${encodeURIComponent(p.job.id)}/steps/${encodeURIComponent(s.stepId)}`)}>{s.name}</a>: {lateWords(s.lateDays)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

