/**
 * The desktop program: rows grouped by stage, one bar per step, laid over a
 * calendar-day axis (timeScale.ts). The chart is a dark instrument face: the
 * forecast bar is light steel, where the step was planned stays behind it as
 * a thin timber ghost, so slip is visible without reading a date. Late steps
 * say so in words beside the bar. Hold points are a diamond plus the words
 * "hold point". Step links are drawn as thin elbows and named ("Waits for X")
 * in the caption on hover and focus. Nothing drags; a bar is a link to the
 * step.
 *
 * Only the chart scrolls sideways: the label column and the axis stay put.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { JobForecast, StepForecast } from '../../domain/forecast';
import type { Step } from '../../domain/types';
import { addCalendarDays, formatLong, formatShort } from '../../domain/dates';
import { StatusText } from '../StatusText';
import { makeTimeScale, type TimeScale } from './timeScale';
import './gantt.css';

export type GanttView = 'all' | 'lookahead' | 'late';

/** Where a step's bar sits in its track, in px from the track's left edge. Hold points are a diamond centred on `x`. */
export interface BarGeometry {
  x: number;
  width: number;
  plannedX?: number;
  plannedWidth?: number;
  isHoldPoint: boolean;
  pxPerDay: number;
  rowHeight: number;
}

interface Props {
  forecast: JobForecast;
  steps: Step[];
  today: string;
  view?: GanttView;
  /** Rows are 36px on the desktop; the phone's "full program" gets 44px rows. */
  dense?: boolean;
  /**
   * Stage 6 reuse (program editor). When set, a bar is a button that calls
   * this instead of a link to `#/steps/:id`. Hover and focus still name the
   * step in the caption.
   */
  onSelectStep?: (stepId: string) => void;
  /**
   * Stage 6 reuse. Replaces what is drawn in a step's track: return your own
   * node (handles, a drag ghost) or wrap `defaultBar`. The planned outline is
   * drawn behind whatever you return, and the late text after it.
   */
  renderBar?: (step: StepForecast, geometry: BarGeometry, defaultBar: ReactNode) => ReactNode;
}

interface StepRow {
  kind: 'step';
  key: string;
  label: string;
  step: StepForecast;
  /** A stage-level placeholder drawn as the stage's own bar. */
  isStageBar: boolean;
}
interface StageRow {
  kind: 'stage';
  key: string;
  label: string;
  stage: JobForecast['stages'][number];
}
type Row = StepRow | StageRow;

const LABEL_W = 248;
const LABEL_W_DENSE = 164;

/** The hold-point mark: a drawn diamond, one stroke weight with the rest of the app's icons. */
export function HoldDiamond({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M6 1 11 6 6 11 1 6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function lateText(days: number): string {
  return `${days} day${days === 1 ? '' : 's'} late`;
}

function stepShows(step: StepForecast, view: GanttView, today: string, horizon: string): boolean {
  if (view === 'late') return step.lateDays > 0;
  if (view === 'lookahead') return step.forecastStart <= horizon && step.forecastEnd >= today;
  return true;
}

function buildRows(forecast: JobForecast, steps: Step[], view: GanttView, today: string, horizon: string): Row[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const rows: Row[] = [];
  for (const stage of forecast.stages) {
    const stepIds = stage.stepIds.filter((id) => forecast.steps[id] && stepShows(forecast.steps[id], view, today, horizon));
    if (stepIds.length === 0) continue;
    const only = stepIds.length === 1 ? byId.get(stepIds[0]) : undefined;
    if (only?.isPlaceholder && stage.stepIds.length === 1) {
      rows.push({ kind: 'step', key: stage.stageId, label: stage.name, step: forecast.steps[only.id], isStageBar: true });
      continue;
    }
    rows.push({ kind: 'stage', key: stage.stageId, label: stage.name, stage });
    for (const id of stepIds) {
      rows.push({ kind: 'step', key: id, label: forecast.steps[id].name, step: forecast.steps[id], isStageBar: false });
    }
  }
  return rows;
}

function stepSentence(step: StepForecast, names: Map<string, string>): string {
  const when = `${formatShort(step.forecastStart)} to ${formatShort(step.forecastEnd)}`;
  const waits = step.waitsFor.length ? `Waits for ${step.waitsFor.map((id) => names.get(id) ?? id).join(', ')}.` : '';
  const late = step.lateDays > 0 ? `${lateText(step.lateDays)}: planned ${formatShort(step.plannedStart ?? step.forecastStart)}.` : '';
  return [when + '.', late, waits].filter(Boolean).join(' ');
}

export function Gantt({ forecast, steps, today, view = 'all', dense, onSelectStep, renderBar }: Props) {
  const horizon = useMemo(() => addCalendarDays(today, 21), [today]);
  const scale: TimeScale = useMemo(() => {
    const dates: string[] = [];
    for (const s of Object.values(forecast.steps)) {
      dates.push(s.forecastStart, s.forecastEnd);
      if (s.plannedStart) dates.push(s.plannedStart);
      if (s.plannedEnd) dates.push(s.plannedEnd);
    }
    return makeTimeScale({ dates, today });
  }, [forecast, today]);

  const rows = useMemo(() => buildRows(forecast, steps, view, today, horizon), [forecast, steps, view, today, horizon]);
  const names = useMemo(() => new Map(Object.values(forecast.steps).map((s) => [s.stepId, s.name])), [forecast]);
  const rowIndex = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.kind === 'step') m.set(r.step.stepId, i);
    });
    return m;
  }, [rows]);

  const [active, setActive] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Open with today a quarter of the way in, so this week and the look-ahead
  // are in view, and scrolled down to the stage that is running, so the first
  // viewport shows the work rather than the rows that are done. Runs when the
  // chart (re)appears and when the view changes: an empty "Late only" unmounts
  // the scroller, so a mount-only effect would leave the next view at
  // scrollLeft 0. The person's own scrolling wins in between.
  const empty = rows.length === 0;
  const labelW = dense ? LABEL_W_DENSE : LABEL_W;
  const rowH = dense ? 44 : 36;
  const firstLive = rows.findIndex((r) => r.kind === 'step' && r.step.forecastEnd >= today);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const visible = el.clientWidth - labelW;
    el.scrollLeft = Math.max(0, scale.x(today) - Math.round(visible / 4));
    if (firstLive > 0) {
      // Start at the stage row above the first step still to finish.
      let top = firstLive;
      while (top > 0 && rows[top].kind !== 'stage') top -= 1;
      el.scrollTop = Math.max(0, top * rowH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty, view]);

  const bodyH = rows.length * rowH;

  // Elbows from the end of every "waits for" step to the start of the waiting one.
  const links = useMemo(() => {
    const out: { key: string; d: string; from: string; to: string }[] = [];
    for (const r of rows) {
      if (r.kind !== 'step') continue;
      const toRow = rowIndex.get(r.step.stepId);
      if (toRow === undefined) continue;
      for (const fromId of r.step.waitsFor) {
        const fromRow = rowIndex.get(fromId);
        const from = forecast.steps[fromId];
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
  }, [rows, rowIndex, forecast, scale, rowH]);

  const activeStep = active ? forecast.steps[active] : undefined;
  const todayX = scale.x(today);

  if (empty) {
    return (
      <div className="gantt gantt--empty" data-testid="gantt">
        <p data-testid="gantt-empty">{view === 'late' ? 'Nothing is late.' : 'Nothing in the next three weeks.'}</p>
      </div>
    );
  }

  return (
    <figure className={dense ? 'gantt gantt--dense' : 'gantt'} data-testid="gantt" data-view={view} style={{ '--gantt-row': `${rowH}px`, '--gantt-label': `${labelW}px` } as CSSProperties}>
      <div className="gantt__scroll" ref={scroller}>
        <div className="gantt__inner" style={{ width: labelW + scale.width }}>
          <div className="gantt__head">
            <div className="gantt__corner" />
            <div className="gantt__axis" style={{ width: scale.width }}>
              <div className="gantt__months">
                {scale.months.map((m) => (
                  <span key={m.label + m.x} className="gantt__month" style={{ left: m.x, width: m.width }}>
                    {m.label}
                  </span>
                ))}
              </div>
              <div className="gantt__weeks">
                <span className="gantt__lookahead-wash" style={{ left: todayX, width: scale.span(today, horizon) }} aria-hidden="true" />
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
                <StageBandRow key={row.key} row={row} scale={scale} top={i * rowH} />
              ) : (
                <StepBarRow
                  key={row.key}
                  row={row}
                  scale={scale}
                  top={i * rowH}
                  names={names}
                  active={active === row.step.stepId || (activeStep?.waitsFor.includes(row.step.stepId) ?? false)}
                  onActive={setActive}
                  rowH={rowH}
                  onSelectStep={onSelectStep}
                  renderBar={renderBar}
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
            <strong>{activeStep.name}.</strong> {stepSentence(activeStep, names)}
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

function StageBandRow({ row, scale, top }: { row: StageRow; scale: TimeScale; top: number }) {
  const { stage } = row;
  const has = stage.forecastStart && stage.forecastEnd;
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
            {stage.lateDays > 0 && (
              <span className="gantt__late" style={{ left: scale.x(stage.forecastEnd!) + scale.pxPerDay + 8 }}>
                <StatusText tone="late" plain>
                  {lateText(stage.lateDays)}
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
  names,
  active,
  onActive,
  rowH,
  onSelectStep,
  renderBar,
}: {
  row: StepRow;
  scale: TimeScale;
  top: number;
  names: Map<string, string>;
  active: boolean;
  onActive: (id: string | null) => void;
  rowH: number;
  onSelectStep?: Props['onSelectStep'];
  renderBar?: Props['renderBar'];
}) {
  const { step } = row;
  const hold = step.isHoldPoint;
  const fx = scale.x(step.forecastStart);
  const fw = scale.span(step.forecastStart, step.forecastEnd);
  const px = step.plannedStart ? scale.x(step.plannedStart) : undefined;
  const pw = step.plannedStart && step.plannedEnd ? scale.span(step.plannedStart, step.plannedEnd) : undefined;
  const moved = px !== undefined && (px !== fx || pw !== fw);
  const sentence = stepSentence(step, names);
  const label = `${step.name}${hold ? ', hold point' : ''}. ${sentence}`;
  const cls = ['gantt__bar', `gantt__bar--${step.status}`, hold ? 'gantt__bar--hold' : '', active ? 'gantt__bar--active' : ''].filter(Boolean).join(' ');
  const rowCls = ['gantt__row', 'gantt__row--step', row.isStageBar ? 'gantt__row--stagebar' : '', active ? 'gantt__row--active' : ''].filter(Boolean).join(' ');

  return (
    <div className={rowCls} style={{ top }} data-testid={`gantt-row-${step.stepId}`}>
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
        {(() => {
          const barStyle = hold ? { left: fx + scale.pxPerDay / 2 } : { left: fx, width: fw };
          const handlers = {
            onMouseEnter: () => onActive(step.stepId),
            onMouseLeave: () => onActive(null),
            onFocus: () => onActive(step.stepId),
            onBlur: () => onActive(null),
          };
          const defaultBar = onSelectStep ? (
            <button
              type="button"
              className={cls}
              style={barStyle}
              data-testid={`gantt-bar-${step.stepId}`}
              aria-label={label}
              title={label}
              onClick={() => onSelectStep(step.stepId)}
              {...handlers}
            />
          ) : (
            <a
              href={`#/steps/${step.stepId}`}
              className={cls}
              style={barStyle}
              data-testid={`gantt-bar-${step.stepId}`}
              aria-label={label}
              title={label}
              {...handlers}
            />
          );
          if (!renderBar) return defaultBar;
          return renderBar(
            step,
            { x: fx, width: fw, plannedX: px, plannedWidth: pw, isHoldPoint: hold, pxPerDay: scale.pxPerDay, rowHeight: rowH },
            defaultBar,
          );
        })()}
        {step.lateDays > 0 && (
          <span className="gantt__late" style={{ left: (hold ? fx + scale.pxPerDay / 2 + 9 : fx + fw) + 8 }} data-testid={`gantt-late-${step.stepId}`}>
            <StatusText tone="late" plain>
              {lateText(step.lateDays)}
            </StatusText>
          </span>
        )}
      </div>
    </div>
  );
}
