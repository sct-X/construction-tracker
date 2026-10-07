/**
 * The time axis shared by the program Gantt and the overview's stage bars.
 * Bars are positioned in percent of the visible range, so the chart fills
 * whatever width it gets. Forecast bars are solid; the planned position stays
 * behind as a dashed outline, so slip shows without reading a date.
 */
import type { ReactNode } from 'react';
import { addCalendarDays, calendarDaysBetween, formatDayMonth, lastMonday, type ISODate } from '@ct/core';

export interface Scale {
  from: ISODate;
  /** Exclusive end. */
  to: ISODate;
  days: number;
  /** Left edge of a day, percent. */
  x(d: ISODate): number;
  /** Width of an inclusive day range, percent. */
  w(start: ISODate, end: ISODate): number;
  contains(d: ISODate): boolean;
}

/** A scale from the Monday on or before `from` to the Monday after `to`. */
export function makeScale(from: ISODate, to: ISODate): Scale {
  const start = lastMonday(from);
  const end = addCalendarDays(lastMonday(to), 7);
  const days = Math.max(1, calendarDaysBetween(start, end));
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  return {
    from: start,
    to: end,
    days,
    x: (d) => clamp((calendarDaysBetween(start, d) / days) * 100),
    w: (s, e) => clamp(((calendarDaysBetween(start, e) + 1) / days) * 100) - clamp((calendarDaysBetween(start, s) / days) * 100),
    contains: (d) => d >= start && d < end,
  };
}

function mondays(scale: Scale): ISODate[] {
  const out: ISODate[] = [];
  for (let d = scale.from; d < scale.to; d = addCalendarDays(d, 7)) out.push(d);
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthStarts(scale: Scale, short = false): { date: ISODate; label: string }[] {
  const out: { date: ISODate; label: string }[] = [];
  let [y, m] = scale.from.split('-').map(Number) as [number, number];
  let first = true;
  for (;;) {
    const iso = `${y}-${String(m).padStart(2, '0')}-01`;
    if (iso >= scale.to) break;
    const showYear = !short && (first || m === 1);
    out.push({ date: iso < scale.from ? scale.from : iso, label: showYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1]! });
    first = false;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  // A month that only shows its last days would collide with the next label: drop it, and give the next one the year.
  if (out.length > 1 && calendarDaysBetween(out[0]!.date, out[1]!.date) < 12) {
    out.shift();
    const [yy, mm] = out[0]!.date.split('-').map(Number) as [number, number];
    if (!short) out[0]!.label = `${MONTHS[mm - 1]} ${yy}`;
  }
  return out;
}

/** Month names over Monday dates. `dense` drops every other Monday number when weeks are narrow. */
export function TimeAxis({ scale, dense = false, short = false }: { scale: Scale; dense?: boolean; short?: boolean }) {
  const weeks = mondays(scale);
  return (
    <div className="axis" aria-hidden="true">
      <div className="axis-months">
        {monthStarts(scale, short).map((m) => (
          <span key={m.date} className="axis-month" style={{ left: `${scale.x(m.date)}%` }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="axis-weeks">
        {weeks.map((d, i) =>
          dense && i % 2 ? null : (
            <span key={d} className="axis-week" style={{ left: `${scale.x(d)}%` }}>
              {Number(d.slice(8))}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/** Week lines, month lines, shutdown hatching and the today line, behind every row. */
export function TimeGrid({ scale, today, shutdowns }: { scale: Scale; today: ISODate; shutdowns: { from: ISODate; to: ISODate }[] }) {
  return (
    <div className="grid-layer" aria-hidden="true">
      {mondays(scale).map((d) => (
        <span key={d} className={Number(d.slice(8)) <= 7 ? 'grid-week grid-month' : 'grid-week'} style={{ left: `${scale.x(d)}%` }} />
      ))}
      {shutdowns
        .filter((s) => s.to >= scale.from && s.from < scale.to)
        .map((s) => (
          <span key={s.from} className="grid-shutdown" style={{ left: `${scale.x(s.from)}%`, width: `${scale.w(s.from, s.to)}%` }}>
            <span className="grid-shutdown-label">Shutdown</span>
          </span>
        ))}
      {scale.contains(today) && (
        <span className="grid-today" style={{ left: `${scale.x(today)}%` }}>
          <span className="grid-today-label">Today {formatDayMonth(today)}</span>
        </span>
      )}
    </div>
  );
}

export type BarTone = 'done' | 'open' | 'late';

/** One row's marks: the planned outline behind, the forecast bar (or a hold-point diamond) in front. */
export function Bar(props: {
  scale: Scale;
  plannedStart: ISODate | null;
  plannedEnd: ISODate | null;
  start: ISODate;
  end: ISODate;
  tone: BarTone;
  hold?: boolean;
  thin?: boolean;
  /** Words placed beside the bar ("7 days late"). */
  note?: ReactNode;
}) {
  const { scale, start, end, tone } = props;
  const showPlan = props.plannedStart && props.plannedEnd && (props.plannedStart !== start || props.plannedEnd !== end);
  const right = scale.x(end) + scale.w(end, end);
  const noteLeft = right < 78;
  return (
    <div className={props.thin ? 'bar-row bar-row-thin' : 'bar-row'} aria-hidden="true">
      {showPlan &&
        (props.hold ? (
          <span className="bar-plan-hold" style={{ left: `${scale.x(props.plannedStart!) + scale.w(props.plannedStart!, props.plannedStart!) / 2}%` }} />
        ) : (
          <span className="bar-plan" style={{ left: `${scale.x(props.plannedStart!)}%`, width: `${scale.w(props.plannedStart!, props.plannedEnd!)}%` }} />
        ))}
      {props.hold ? (
        <span className={`bar-hold bar-${tone}`} style={{ left: `${scale.x(start) + scale.w(start, start) / 2}%` }} />
      ) : (
        <span className={`bar bar-${tone}`} style={{ left: `${scale.x(start)}%`, width: `${scale.w(start, end)}%` }} />
      )}
      {props.note && (
        <span
          className="bar-note"
          style={noteLeft ? { left: `calc(${right}% + 8px)` } : { right: `calc(${100 - Math.min(scale.x(start), props.plannedStart ? scale.x(props.plannedStart) : 100)}% + 8px)` }}
        >
          {props.note}
        </span>
      )}
    </div>
  );
}

/** The key, in words: the chart's marks must read without colour. */
export function TimelineKey({ shutdown = true }: { shutdown?: boolean }) {
  return (
    <ul className="tl-key">
      <li>
        <span className="key-mark key-bar" aria-hidden="true" /> Forecast
      </li>
      <li>
        <span className="key-mark key-plan" aria-hidden="true" /> Planned, where it has moved
      </li>
      <li>
        <span className="key-mark key-late" aria-hidden="true" /> Late, with the days written beside it
      </li>
      <li>
        <span className="key-mark key-hold" aria-hidden="true" /> Hold point (inspection)
      </li>
      {shutdown && (
        <li>
          <span className="key-mark key-shutdown" aria-hidden="true" /> Shutdown, no work
        </li>
      )}
    </ul>
  );
}
