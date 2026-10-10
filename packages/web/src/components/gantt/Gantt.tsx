/**
 * The desktop program (ported from v1 src/components/gantt/Gantt.tsx): rows
 * grouped by stage, one bar per step, laid over a calendar-day axis
 * (timeScale.ts). The forecast bar is a dark fill on the well; where the step
 * was planned stays behind it as a thin outline, so a slip shows without
 * reading a date. "7 days late" is written beside a late bar: red only when
 * the step is past its own planned date and not done (Dom's overdue cue),
 * plain words when both dates are still ahead. Hold points are a drawn
 * diamond plus the words "hold point". Step links are thin elbows, named in
 * the caption on hover and focus. Nothing drags; a bar is a link to the step.
 *
 * Only the chart scrolls (both ways): the label column and the axis stay put.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  addCalendarDays,
  daysLateWords,
  formatLong,
  formatShort,
  isStageOverdue,
  isStepOverdue,
  stepWhenWords,
  type ISODate,
  type ProgramStep,
  type ProgramView,
  type StageForecast,
} from '@ct/core';
import { href } from '../../app/router';
import { StatusText } from '../StatusText';
import { makeTimeScale, type TimeScale } from './timeScale';

export type GanttView = 'all' | 'lookahead' | 'late';

interface StepRow {
  kind: 'step';
  key: string;
  label: string;
  step: ProgramStep;
  /** A stage with one placeholder step, drawn as the stage's own bar. */
  isStageBar: boolean;
}
interface StageRow {
  kind: 'stage';
  key: string;
  label: string;
  stage: StageForecast;
}
type Row = StepRow | StageRow;

const LABEL_W = 248;
const LABEL_W_DENSE = 164;

/** The hold-point mark: a drawn diamond, one stroke weight with the app's glyphs. */
export function HoldDiamond({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M6 1 11 6 6 11 1 6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function stepHref(jobId: string, stepId: string): string {
  return href(`/jobs/${encodeURIComponent(jobId)}/steps/${encodeURIComponent(stepId)}`);
}

function stepShows(s: ProgramStep, view: GanttView, today: ISODate, horizon: ISODate): boolean {
  if (view === 'late') return s.lateDays > 0 && s.status !== 'done';
  if (view === 'lookahead') return s.forecastStart <= horizon && s.forecastEnd >= today;
  return true;
}

export function ganttRows(p: Pick<ProgramView, 'stages' | 'steps'>, view: GanttView, today: ISODate): Row[] {
  const horizon = addCalendarDays(today, 21);
  const byId = new Map(p.steps.map((s) => [s.stepId, s]));
  const rows: Row[] = [];
  for (const stage of [...p.stages].sort((a, b) => a.order - b.order)) {
    const steps = stage.stepIds.map((id) => byId.get(id)).filter((s): s is ProgramStep => !!s && stepShows(s, view, today, horizon));
    if (!steps.length) continue;
    const only = steps.length === 1 ? steps[0]! : undefined;
    if (only?.isPlaceholder && stage.stepIds.length === 1) {
      rows.push({ kind: 'step', key: stage.stageId, label: stage.name, step: only, isStageBar: true });
      continue;
    }
    rows.push({ kind: 'stage', key: stage.stageId, label: stage.name, stage });
    for (const s of steps) rows.push({ kind: 'step', key: s.stepId, label: s.name, step: s, isStageBar: false });
  }
  return rows;
}

/** "Mon 2 Nov to Fri 13 Nov, starts in 6 weeks. 7 days late: planned Mon 26 Oct. Waits for External cladding." */
export function stepSentence(s: ProgramStep, names: Map<string, string>, today: ISODate): string {
  const span = s.forecastStart === s.forecastEnd ? formatShort(s.forecastStart) : `${formatShort(s.forecastStart)} to ${formatShort(s.forecastEnd)}`;
  const late = s.lateDays > 0 && s.status !== 'done' ? `${daysLateWords(s.lateDays)}: planned ${formatShort(s.plannedStart ?? s.forecastStart)}.` : '';
  const waits = s.waitsFor.length ? `Waits for ${s.waitsFor.map((id) => names.get(id) ?? id).join(', ')}.` : '';
  return [`${span}, ${stepWhenWords(s, today)}.`, late, waits].filter(Boolean).join(' ');
}

/**
 * `onPickStep` (the Setup program editor, Stage 6d): a bar picks its step instead of opening the step page,
 * and `pickedStepId` rings the picked bar. The Program screen passes neither, so it is unchanged.
 */
export function Gantt({
  p,
  view = 'all',
  dense,
  onPickStep,
  pickedStepId,
}: {
  p: ProgramView;
  view?: GanttView;
  dense?: boolean;
  onPickStep?: (stepId: string) => void;
  pickedStepId?: string | null;
}) {
  const today = p.forecast.today;
  const horizon = useMemo(() => addCalendarDays(today, 21), [today]);
  const scale: TimeScale = useMemo(() => {
    const dates: ISODate[] = [];
    for (const s of p.steps) {
      dates.push(s.forecastStart, s.forecastEnd);
      if (s.plannedStart) dates.push(s.plannedStart);
      if (s.plannedEnd) dates.push(s.plannedEnd);
    }
    return makeTimeScale({ dates, today, shutdowns: p.shutdowns });
  }, [p, today]);

  const rows = useMemo(() => ganttRows(p, view, today), [p, view, today]);
  const byId = useMemo(() => new Map(p.steps.map((s) => [s.stepId, s])), [p]);
  const names = useMemo(() => new Map(p.steps.map((s) => [s.stepId, s.name])), [p]);
  const rowIndex = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.kind === 'step') m.set(r.step.stepId, i);
    });
    return m;
  }, [rows]);

  const [active, setActive] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const empty = rows.length === 0;
  const labelW = dense ? LABEL_W_DENSE : LABEL_W;
  const rowH = dense ? 44 : 36;
  const firstLive = rows.findIndex((r) => r.kind === 'step' && r.step.forecastEnd >= today);

  // Open with today a quarter of the way in and the running stage at the top, so the
  // first view is the work, not the rows that are done. Again whenever the view changes.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, scale.x(today) - Math.round((el.clientWidth - labelW) / 4));
    let top = Math.max(0, firstLive);
    while (top > 0 && rows[top]!.kind !== 'stage') top -= 1;
    el.scrollTop = Math.max(0, top * rowH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty, view]);

  const bodyH = rows.length * rowH;

  // Elbows from the end of every "waits for" step to the start of the step that waits.
  const links = useMemo(() => {
    const out: { key: string; d: string; from: string; to: string }[] = [];
    for (const r of rows) {
      if (r.kind !== 'step') continue;
      const toRow = rowIndex.get(r.step.stepId)!;
      for (const fromId of r.step.waitsFor) {
        const fromRow = rowIndex.get(fromId);
        const from = byId.get(fromId);
        if (fromRow === undefined || !from) continue;
        const x1 = scale.x(from.forecastEnd) + scale.pxPerDay;
        const y1 = fromRow * rowH + rowH / 2;
        const x2 = scale.x(r.step.forecastStart);
        const y2 = toRow * rowH + rowH / 2;
        const d = x2 >= x1 + 8 ? `M${x1} ${y1} H${x1 + 4} V${y2} H${x2}` : `M${x1} ${y1} H${x1 + 4} V${y1 + rowH / 2} H${x2 - 4} V${y2} H${x2}`;
        out.push({ key: `${fromId}-${r.step.stepId}`, d, from: fromId, to: r.step.stepId });
      }
    }
    return out;
  }, [rows, rowIndex, byId, scale, rowH]);

  const activeStep = active ? byId.get(active) : undefined;
  const todayX = scale.x(today);

  if (empty) {
    return (
      <div className="gantt gantt--empty" data-testid="gantt">
        <p data-testid="gantt-empty">{view === 'late' ? 'Nothing is late.' : 'Nothing in the next three weeks.'}</p>
      </div>
    );
  }

  return (
    <figure
      className={dense ? 'gantt gantt--dense' : 'gantt'}
      data-testid="gantt"
      data-view={view}
      style={{ '--gantt-row': `${rowH}px`, '--gantt-label': `${labelW}px` } as CSSProperties}
    >
      <div className="gantt__scroll" ref={scroller} tabIndex={-1}>
        <div className="gantt__inner" style={{ width: labelW + scale.width }}>
          <div className="gantt__head">
            <div className="gantt__corner" />
            <div className="gantt__axis" style={{ width: scale.width }} aria-hidden="true">
              <div className="gantt__months">
                {scale.months.map((m) => (
                  <span key={m.label + m.x} className="gantt__month" style={{ left: m.x, width: m.width }}>
                    {m.label}
                  </span>
                ))}
              </div>
              <div className="gantt__weeks">
                <span className="gantt__lookahead-wash" style={{ left: todayX, width: scale.span(today, horizon) }} />
                {scale.weeks.map((w) => (
                  <span key={w.date} className="gantt__week num" style={{ left: w.x, width: 7 * scale.pxPerDay }} title={`Week of ${formatLong(w.date)}`}>
                    {w.label}
                  </span>
                ))}
                <span className="gantt__today-label" style={{ left: todayX }}>
                  Today
                </span>
              </div>
            </div>
          </div>

          <div className="gantt__body" style={{ height: bodyH }}>
            <div className="gantt__under" style={{ left: labelW, width: scale.width }} aria-hidden="true">
              {scale.weeks.map((w) => (
                <span key={w.date} className="gantt__gridline" style={{ left: w.x }} />
              ))}
              {scale.shutdowns.map((b) => (
                <span key={b.label} className="gantt__shutdown" style={{ left: b.x, width: b.width }}>
                  <span className="gantt__shutdown-label">{b.label}</span>
                </span>
              ))}
            </div>

            {rows.map((row, i) =>
              row.kind === 'stage' ? (
                <StageBandRow key={row.key} row={row} scale={scale} top={i * rowH} today={today} />
              ) : (
                <StepBarRow
                  key={row.key}
                  row={row}
                  scale={scale}
                  top={i * rowH}
                  today={today}
                  jobId={p.job.id}
                  names={names}
                  active={active === row.step.stepId || (activeStep?.waitsFor.includes(row.step.stepId) ?? false)}
                  onActive={setActive}
                  onPick={onPickStep}
                  picked={!!pickedStepId && pickedStepId === row.step.stepId}
                />
              ),
            )}

            <svg className="gantt__links" style={{ left: labelW, width: scale.width, height: bodyH }} aria-hidden="true">
              {links.map((l) => (
                <path key={l.key} d={l.d} className={active && (l.from === active || l.to === active) ? 'gantt__link gantt__link--active' : 'gantt__link'} />
              ))}
            </svg>

            <span className="gantt__today" style={{ left: labelW + todayX }} data-testid="gantt-today" aria-hidden="true" />
          </div>
        </div>
      </div>

      <figcaption className="gantt__caption" data-testid="gantt-caption" aria-live="polite">
        {activeStep ? (
          <>
            <strong>{activeStep.name}.</strong> {stepSentence(activeStep, names, today)}
          </>
        ) : (
          <span className="gantt__legend">
            <span className="gantt__legend-item">
              <span className="gantt__key gantt__key--bar" aria-hidden="true" />
              Forecast
            </span>
            <span className="gantt__legend-item">
              <span className="gantt__key gantt__key--planned" aria-hidden="true" />
              Planned
            </span>
            <span className="gantt__legend-item">
              <HoldDiamond className="gantt__key gantt__key--hold" />
              Hold point
            </span>
            <span className="gantt__legend-item">
              <span className="gantt__key gantt__key--today" aria-hidden="true" />
              Today
            </span>
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function StageBandRow({ row, scale, top, today }: { row: StageRow; scale: TimeScale; top: number; today: ISODate }) {
  const { stage } = row;
  const has = stage.forecastStart && stage.forecastEnd;
  const late = stage.lateDays > 0 && stage.status !== 'done';
  return (
    <div className="gantt__row gantt__row--stage" style={{ top }} data-testid={`gantt-stage-${stage.stageId}`}>
      <div className="gantt__label">
        <span className="gantt__stage-name">{row.label}</span>
      </div>
      <div className="gantt__track">
        {has && (
          <>
            <span
              className="gantt__band"
              style={{ left: scale.x(stage.forecastStart!), width: scale.span(stage.forecastStart!, stage.forecastEnd!) }}
              title={`${stage.name}: ${formatShort(stage.forecastStart!)} to ${formatShort(stage.forecastEnd!)}`}
            />
            {late && (
              <span className="gantt__late" style={{ left: scale.x(stage.forecastEnd!) + scale.pxPerDay + 8 }}>
                <StatusText tone={isStageOverdue(stage, today) ? 'late' : 'plain'} plain>
                  {daysLateWords(stage.lateDays)}
                </StatusText>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepBarRow({
  row,
  scale,
  top,
  today,
  jobId,
  names,
  active,
  onActive,
  onPick,
  picked,
}: {
  row: StepRow;
  scale: TimeScale;
  top: number;
  today: ISODate;
  jobId: string;
  names: Map<string, string>;
  active: boolean;
  onActive: (id: string | null) => void;
  onPick?: (stepId: string) => void;
  picked?: boolean;
}) {
  const { step } = row;
  const hold = step.isHoldPoint;
  const fx = scale.x(step.forecastStart);
  const fw = scale.span(step.forecastStart, step.forecastEnd);
  const px = step.plannedStart ? scale.x(step.plannedStart) : undefined;
  const pw = step.plannedStart && step.plannedEnd ? scale.span(step.plannedStart, step.plannedEnd) : undefined;
  const moved = px !== undefined && (px !== fx || pw !== fw);
  const late = step.lateDays > 0 && step.status !== 'done';
  const overdue = isStepOverdue(step, today);
  const sentence = stepSentence(step, names, today);
  const cls = ['gantt__bar', `gantt__bar--${step.status}`, hold ? 'gantt__bar--hold' : '', active ? 'gantt__bar--active' : '', picked ? 'gantt__bar--picked' : ''].filter(Boolean).join(' ');
  const rowCls = ['gantt__row', 'gantt__row--step', row.isStageBar ? 'gantt__row--stagebar' : '', active ? 'gantt__row--active' : '', picked ? 'gantt__row--picked' : '']
    .filter(Boolean)
    .join(' ');
  const barStyle = hold ? { left: fx + scale.pxPerDay / 2 } : { left: fx, width: fw };

  return (
    <div className={rowCls} style={{ top }} data-testid={`g-step-${step.stepId}`} data-overdue={overdue ? 'true' : 'false'}>
      <div className="gantt__label">
        {hold && <HoldDiamond className="gantt__hold-glyph" />}
        <span className={row.isStageBar ? 'gantt__stage-name' : 'gantt__step-name'}>
          {row.label}
          {hold && <span className="gantt__hold-word">hold point</span>}
        </span>
      </div>
      <div className="gantt__track">
        {px !== undefined && pw !== undefined && (
          <span
            className={hold ? 'gantt__planned gantt__planned--hold' : 'gantt__planned'}
            style={hold ? { left: px + scale.pxPerDay / 2 } : { left: px, width: pw }}
            data-testid={`gantt-planned-${step.stepId}`}
            data-moved={moved ? 'true' : 'false'}
            title={`Planned ${formatShort(step.plannedStart!)} to ${formatShort(step.plannedEnd!)}`}
          />
        )}
        <a
          href={stepHref(jobId, step.stepId)}
          className={cls}
          style={barStyle}
          data-testid={`gantt-bar-${step.stepId}`}
          title={`${step.name}${hold ? ', hold point' : ''}. ${sentence}`}
          onMouseEnter={() => onActive(step.stepId)}
          onMouseLeave={() => onActive(null)}
          onFocus={() => onActive(step.stepId)}
          onBlur={() => onActive(null)}
          aria-current={picked ? 'true' : undefined}
          onClick={
            onPick
              ? (e) => {
                  e.preventDefault();
                  onPick(step.stepId);
                }
              : undefined
          }
        >
          <span className="sr-only">
            {step.name}
            {hold ? ', hold point' : ''}. {sentence}
          </span>
        </a>
        {late && (
          <span className="gantt__late" style={{ left: (hold ? fx + scale.pxPerDay / 2 + 9 : fx + fw) + 8 }} data-testid={`gantt-late-${step.stepId}`} aria-hidden="true">
            <StatusText tone={overdue ? 'late' : 'plain'} plain>
              {daysLateWords(step.lateDays)}
            </StatusText>
          </span>
        )}
      </div>
    </div>
  );
}
