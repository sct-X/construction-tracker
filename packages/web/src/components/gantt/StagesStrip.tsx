/**
 * The phone's stages (ported from v1 src/components/gantt/StagesStrip.tsx): a
 * strip of plate chips across the top (the current stage on the dark chosen
 * fill, never orange) that jump to a list of plates, one per stage, with its
 * dates, its status in words, a thin bar for how far through its time it is,
 * and any late step named under it. A Gantt turned ninety degrees.
 */
import { useEffect, useRef } from 'react';
import {
  daysLateWords,
  formatDayMonth,
  formatShort,
  isStageOverdue,
  isStepOverdue,
  shortWithRelative,
  stageProgressWords,
  stageTimeThrough,
  type ProgramView,
} from '@ct/core';
import { StatusText } from '../StatusText';
import { stepHref } from './Gantt';

export function StagesStrip({ p }: { p: ProgramView }) {
  const current = p.forecast.currentStageId;
  const strip = useRef<HTMLElement>(null);
  const stages = [...p.stages].sort((a, b) => a.order - b.order);
  const jump = (id: string) => {
    const el = document.getElementById(`stage-${id}`);
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  // Open with the current stage's chip in view (the strip scrolls, the page does not).
  useEffect(() => {
    const el = strip.current;
    const chip = el?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!el || !chip) return;
    el.scrollLeft = Math.max(0, chip.offsetLeft - el.clientWidth / 2 + chip.offsetWidth / 2);
  }, [current]);

  return (
    <nav className="stages-strip" data-testid="stages-strip" aria-label="Stages" ref={strip}>
      <ul className="stages-strip__list">
        {stages.map((s) => (
          <li key={s.stageId}>
            <button
              type="button"
              className="stages-strip__chip"
              aria-current={s.stageId === current ? 'true' : undefined}
              data-testid={`stage-chip-${s.stageId}`}
              onClick={() => jump(s.stageId)}
            >
              <span className="stages-strip__chip-name">{s.name}</span>
              <span className="stages-strip__chip-when num">{s.status === 'done' ? 'done' : s.forecastStart ? formatDayMonth(s.forecastStart) : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function StagesList({ p }: { p: ProgramView }) {
  const today = p.forecast.today;
  const current = p.forecast.currentStageId;
  const byId = new Map(p.steps.map((s) => [s.stepId, s]));
  return (
    <section className="stages" data-testid="stages" aria-labelledby="stages-heading">
      <h3 id="stages-heading" className="stages__heading">
        Stages
      </h3>
      <div className="stages__list">
        {[...p.stages]
          .sort((a, b) => a.order - b.order)
          .map((s) => {
            const late = s.stepIds.map((id) => byId.get(id)).filter((st) => st && st.lateDays > 0 && st.status !== 'done');
            const pct = Math.round(stageTimeThrough(s, today) * 100);
            return (
              <article
                key={s.stageId}
                id={`stage-${s.stageId}`}
                className="stages__band"
                data-testid={`stage-band-${s.stageId}`}
                aria-current={s.stageId === current ? 'true' : undefined}
                data-status={s.status}
              >
                <div className="stages__top">
                  <h4 className="stages__name">{s.name}</h4>
                  <span className="stages__status">{stageProgressWords(s, today)}</span>
                </div>
                {s.forecastStart && s.forecastEnd && (
                  <p className="stages__dates num">
                    {formatShort(s.forecastStart)} to {formatShort(s.forecastEnd)}
                    {s.lateDays > 0 && s.status !== 'done' && (
                      <>
                        {' '}
                        <StatusText tone={isStageOverdue(s, today) ? 'late' : 'plain'} plain>
                          {daysLateWords(s.lateDays)}
                        </StatusText>
                      </>
                    )}
                  </p>
                )}
                <div className="stages__progress" role="img" aria-label={`${pct}% of the time through`}>
                  <span className="stages__progress-fill" style={{ width: `${pct}%` }} />
                </div>
                {late.length > 0 && (
                  <ul className="stages__late">
                    {late.map((st) => (
                      <li key={st!.stepId}>
                        <a href={stepHref(p.job.id, st!.stepId)} className="stages__late-link">
                          <StatusText tone={isStepOverdue(st!, today) ? 'late' : 'plain'} plain={!isStepOverdue(st!, today)}>
                            {st!.name}: {daysLateWords(st!.lateDays)}, now {shortWithRelative(st!.forecastStart, today)}
                          </StatusText>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}
