/**
 * The phone program: the next three weeks as a list, grouped by week, with
 * the steps that start or finish in each. Every row says its dates, its
 * trade, planned against forecast in words, and anything it needs that is
 * not confirmed yet. Hold points carry a diamond and the words. Rows are
 * 56px links to the step. Below the three weeks, "Later" names anything
 * late further out, and the rest fold away.
 */
import { Fragment } from 'react';
import type { ItemForecast, JobForecast, StepForecast } from '../../domain/forecast';
import type { Item, Step } from '../../domain/types';
import { ITEM_STATUS_LABELS } from '../../domain/types';
import { addCalendarDays, formatShort, formatWeekRange, lastMonday, weekday } from '../../domain/dates';
import { StatusText } from '../StatusText';
import { lateText } from './Gantt';
import './lookahead.css';

interface Props {
  forecast: JobForecast;
  steps: Step[];
  items: Item[];
  today: string;
}

interface Week {
  n: number;
  title: string;
  from: string;
  to: string;
  starts: StepForecast[];
  finishes: StepForecast[];
}

const WEEK_TITLES = ['This week', 'Next week', 'Week after'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function lengthWords(days: number): string {
  if (days >= 10) return `${Math.round(days / 5)} wks`;
  if (days >= 5) return '1 wk';
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function LookAhead({ forecast, steps, items, today }: Props) {
  const monday = lastMonday(today);
  const tradeOf = new Map(steps.map((s) => [s.id, s.tradeType]));
  const all = Object.values(forecast.steps).sort((a, b) => (a.forecastStart < b.forecastStart ? -1 : a.forecastStart > b.forecastStart ? 1 : 0));
  const stageName = new Map(forecast.stages.map((s) => [s.stageId, s.name]));
  const itemsByStep = new Map<string, Item[]>();
  for (const it of items) {
    if (!it.stepId || it.status === 'done') continue;
    itemsByStep.set(it.stepId, [...(itemsByStep.get(it.stepId) ?? []), it]);
  }

  const weeks: Week[] = [0, 1, 2].map((i) => {
    const from = addCalendarDays(monday, 7 * i);
    const to = addCalendarDays(from, 6);
    return {
      n: i + 1,
      title: WEEK_TITLES[i],
      from,
      to,
      starts: all.filter((s) => s.forecastStart >= from && s.forecastStart <= to),
      finishes: all.filter((s) => s.forecastStart < from && s.forecastEnd >= from && s.forecastEnd <= to),
    };
  });
  const horizon = weeks[2].to;
  const later = all.filter((s) => s.forecastStart > horizon);
  const laterLate = later.filter((s) => s.lateDays > 0);
  const laterRest = later.filter((s) => s.lateDays === 0);

  return (
    <section className="lookahead" data-testid="lookahead" aria-label="Three-week look-ahead">
      {weeks.map((w) => (
        <Fragment key={w.n}>
          <h2 className="lookahead__week" data-testid={`lookahead-week-${w.n}`}>
            <span>{w.title}</span>
            <span className="lookahead__range num">{formatWeekRange(w.from)}</span>
          </h2>
          {w.starts.length === 0 && w.finishes.length === 0 ? (
            <p className="lookahead__nothing">Nothing starts or finishes.</p>
          ) : (
            <ul className="lookahead__list">
              {w.starts.map((s) => (
                <StepRow
                  key={s.stepId}
                  step={s}
                  week={w}
                  mode="starts"
                  stage={stageName.get(s.stageId)}
                  needs={itemsByStep.get(s.stepId) ?? []}
                  itemForecasts={forecast.items}
                  trade={tradeOf.get(s.stepId)}
                />
              ))}
              {w.finishes.map((s) => (
                <StepRow
                  key={s.stepId}
                  step={s}
                  week={w}
                  mode="finishes"
                  stage={stageName.get(s.stageId)}
                  needs={itemsByStep.get(s.stepId) ?? []}
                  itemForecasts={forecast.items}
                  trade={tradeOf.get(s.stepId)}
                />
              ))}
            </ul>
          )}
        </Fragment>
      ))}

      <h2 className="lookahead__week" data-testid="lookahead-later">
        <span>Later</span>
        <span className="lookahead__range num">after {formatShort(horizon)}</span>
      </h2>
      {later.length === 0 ? (
        <p className="lookahead__nothing">Nothing after that.</p>
      ) : (
        <>
          {laterLate.length > 0 && (
            <ul className="lookahead__list">
              {laterLate.map((s) => (
                <li key={s.stepId}>
                  <a href={`#/steps/${s.stepId}`} className="lookahead__row" data-testid={`lookahead-step-${s.stepId}`}>
                    <span className="lookahead__top">
                      <span className="lookahead__name">
                        {s.isHoldPoint && <HoldMark />}
                        {s.name}
                      </span>
                      <span className="lookahead__stage">{stageName.get(s.stageId)}</span>
                    </span>
                    <span className="lookahead__line">
                      <StatusText tone="late">
                        moved to {formatShort(s.forecastStart)}, {lateText(s.lateDays)}
                      </StatusText>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {laterRest.length > 0 && (
            <details className="lookahead__more" data-testid="lookahead-more">
              <summary className="lookahead__summary">
                {laterLate.length > 0 ? `Show the other ${laterRest.length} later steps` : `Show ${laterRest.length} later steps`}
              </summary>
              <ul className="lookahead__list">
                {laterRest.map((s) => (
                  <li key={s.stepId}>
                    <a href={`#/steps/${s.stepId}`} className="lookahead__row" data-testid={`lookahead-step-${s.stepId}`}>
                      <span className="lookahead__top">
                        <span className="lookahead__name">
                          {s.isHoldPoint && <HoldMark />}
                          {s.name}
                        </span>
                        <span className="lookahead__stage">{stageName.get(s.stageId)}</span>
                      </span>
                      <span className="lookahead__line lookahead__muted">
                        Starts {formatShort(s.forecastStart)}, {lengthWords(s.durationDays)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

/** "Book roof plumber" reads as "needs roof plumber"; "Order cladding" as "needs cladding". */
function needWords(title: string): string {
  return title.replace(/^(book|order|get|arrange)\s+/i, '').replace(/^\w/, (c) => c.toLowerCase());
}

function HoldMark() {
  return (
    <span className="lookahead__hold">
      <span aria-hidden="true">◇</span> Hold point:
    </span>
  );
}

function StepRow({
  step,
  week,
  mode,
  stage,
  needs,
  itemForecasts,
  trade,
}: {
  step: StepForecast;
  trade?: string;
  week: Week;
  mode: 'starts' | 'finishes';
  stage?: string;
  needs: Item[];
  itemForecasts: Record<string, ItemForecast>;
}) {
  const endsThisWeek = step.forecastEnd <= week.to;
  let when: string;
  if (mode === 'finishes') when = `Finishes ${DAY[weekday(step.forecastEnd)]}`;
  else if (endsThisWeek)
    when =
      step.forecastStart === step.forecastEnd ? DAY[weekday(step.forecastStart)] : `${DAY[weekday(step.forecastStart)]} to ${DAY[weekday(step.forecastEnd)]}`;
  else when = `from ${DAY[weekday(step.forecastStart)]}, ${lengthWords(step.durationDays)}`;

  const bits = [when];
  if (trade) bits.push(trade);
  if (step.status === 'done') bits.push('done');
  else if (step.status === 'in_progress') bits.push('started');

  return (
    <li>
      <a href={`#/steps/${step.stepId}`} className="lookahead__row" data-testid={`lookahead-step-${step.stepId}`}>
        <span className="lookahead__top">
          <span className="lookahead__name">
            {step.isHoldPoint && <HoldMark />}
            {step.name}
          </span>
          {stage && <span className="lookahead__stage">{stage}</span>}
        </span>
        <span className="lookahead__line">{bits.join(' · ')}</span>
        <span className="lookahead__line">
          {step.lateDays > 0 ? (
            <StatusText tone="late" testId={`lookahead-late-${step.stepId}`}>
              planned {formatShort(step.plannedStart ?? step.forecastStart)}, now {formatShort(step.forecastStart)}, {lateText(step.lateDays)}
            </StatusText>
          ) : (
            <span className="lookahead__muted">on plan{step.plannedStart ? `, ${formatShort(step.plannedStart)}` : ''}</span>
          )}
        </span>
        {needs.map((it) => {
          const f = itemForecasts[it.id];
          if (!f?.isLate && it.status === 'confirmed') return null;
          const what = needWords(it.title);
          return (
            <span className="lookahead__line" key={it.id}>
              {f?.isLate ? (
                <StatusText tone="late">
                  needs {what}, {f.lateText}
                </StatusText>
              ) : (
                <StatusText tone="amber">
                  needs {what}, {ITEM_STATUS_LABELS[it.status].toLowerCase()}, not confirmed
                </StatusText>
              )}
            </span>
          );
        })}
      </a>
    </li>
  );
}
