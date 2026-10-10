/**
 * The phone program (ported from v1 src/components/gantt/LookAhead.tsx): the
 * next three weeks as plates, one per week, with the steps that start or
 * finish in each. A row is the step's name and one line (its days, its trade,
 * started or done); a late step or a need that isn't confirmed adds its words.
 * Red only for what is overdue (Dom's cue), with the words saying so. Hold
 * points carry a drawn diamond and the words. Rows are links to the step.
 * Below the three weeks, "Later" names anything late further out, and the
 * rest fold away.
 */
import type { ReactNode } from 'react';
import { lookAhead, type ISODate, type ProgramStep, type ProgramView, type WaitingRow } from '@ct/core';
import { StatusText } from '../StatusText';
import { whenWords } from '../../ui/when';
import { HoldDiamond, stepHref } from './Gantt';

/** v1: "Book roof plumber" reads "needs roof plumber"; "Order cladding" reads "needs cladding". */
export function needWords(title: string): string {
  return title.replace(/^(book|order|get|arrange)\s+/i, '').replace(/^\w/, (c) => c.toLowerCase());
}

const lower = (s: string) => s.replace(/^\w/, (c) => c.toLowerCase());

/** What a step still needs, one line each: overdue in red with its words, late in plain words, booked but not confirmed. */
export function needLines(rows: WaitingRow[], today: ISODate): { itemId: string; text: string; overdue: boolean }[] {
  const out: { itemId: string; text: string; overdue: boolean }[] = [];
  for (const r of rows) {
    if (r.status === 'done') continue;
    const what = needWords(r.title);
    if (r.overdue || r.isLate) out.push({ itemId: r.itemId, text: `needs ${what}, ${lower(whenWords(r, today).text)}`, overdue: r.overdue });
    else if (r.status !== 'confirmed') out.push({ itemId: r.itemId, text: `needs ${what}, ${r.statusLabel.toLowerCase()}, not confirmed`, overdue: false });
  }
  return out;
}

function HoldMark() {
  return (
    <span className="lookahead__hold">
      <HoldDiamond className="lookahead__hold-glyph" /> Hold point:
    </span>
  );
}

export function LookAhead({ p }: { p: ProgramView }) {
  const today = p.forecast.today;
  const view = lookAhead(p.steps, today);
  const stageName = new Map(p.stages.map((s) => [s.stageId, s.name]));
  const needsOf = (stepId: string) => needLines(p.items.filter((i) => i.stepId === stepId), today);

  return (
    <section className="lookahead" data-testid="lookahead" aria-label="Three-week look-ahead">
      {view.weeks.map((w) => (
        <section key={w.n} className="lookahead__plate" aria-labelledby={`la-week-${w.n}`}>
          <h3 className="lookahead__week" id={`la-week-${w.n}`} data-testid={`lookahead-week-${w.n}`}>
            <span>{w.title}</span>
            <span className="lookahead__range num">{w.range}</span>
          </h3>
          {w.rows.length === 0 ? (
            <p className="lookahead__nothing">Nothing starts or finishes.</p>
          ) : (
            <ul className="lookahead__list">
              {w.rows.map((r) => (
                <li key={`${r.mode}-${r.step.stepId}`}>
                  <a href={stepHref(p.job.id, r.step.stepId)} className="lookahead__row" data-testid={`la-step-${r.step.stepId}`}>
                    <span className="lookahead__top">
                      <span className="lookahead__name">
                        {r.step.isHoldPoint && <HoldMark />}
                        {r.step.name}
                      </span>
                      <span className="lookahead__stage">{stageName.get(r.step.stageId)}</span>
                    </span>
                    <span className="lookahead__line">{r.line}</span>
                    {r.late && (
                      <span className="lookahead__line">
                        <StatusText tone={r.overdue ? 'late' : 'plain'} testId={`lookahead-late-${r.step.stepId}`}>
                          {r.late}
                        </StatusText>
                      </span>
                    )}
                    {needsOf(r.step.stepId).map((n) => (
                      <span className="lookahead__line" key={n.itemId}>
                        <StatusText tone={n.overdue ? 'late' : 'plain'}>{n.text}</StatusText>
                      </span>
                    ))}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="lookahead__plate" aria-labelledby="la-later">
        <h3 className="lookahead__week" id="la-later" data-testid="lookahead-later">
          <span>Later</span>
          <span className="lookahead__range num">after {view.horizonWords}</span>
        </h3>
        {view.laterLate.length === 0 && view.laterRest.length === 0 ? (
          <p className="lookahead__nothing">Nothing after that.</p>
        ) : (
          <>
            {view.laterLate.length > 0 && (
              <ul className="lookahead__list">
                {view.laterLate.map(({ step, text, overdue }) => (
                  <LaterRow key={step.stepId} jobId={p.job.id} step={step} stage={stageName.get(step.stageId)}>
                    <StatusText tone={overdue ? 'late' : 'plain'}>{text}</StatusText>
                  </LaterRow>
                ))}
              </ul>
            )}
            {view.laterRest.length > 0 && (
              <details className="lookahead__more" data-testid="lookahead-more">
                <summary className="lookahead__summary">
                  {view.laterLate.length > 0 ? `Show ${view.laterRest.length} more` : `Show ${view.laterRest.length} steps`}
                </summary>
                <ul className="lookahead__list">
                  {view.laterRest.map(({ step, text }) => (
                    <LaterRow key={step.stepId} jobId={p.job.id} step={step} stage={stageName.get(step.stageId)} muted>
                      {text}
                    </LaterRow>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
    </section>
  );
}

function LaterRow({ jobId, step, stage, muted, children }: { jobId: string; step: ProgramStep; stage?: string; muted?: boolean; children: ReactNode }) {
  return (
    <li>
      <a href={stepHref(jobId, step.stepId)} className="lookahead__row" data-testid={`la-step-${step.stepId}`}>
        <span className="lookahead__top">
          <span className="lookahead__name">
            {step.isHoldPoint && <HoldMark />}
            {step.name}
          </span>
          {stage && <span className="lookahead__stage">{stage}</span>}
        </span>
        <span className={muted ? 'lookahead__line lookahead__muted' : 'lookahead__line'}>{children}</span>
      </a>
    </li>
  );
}
