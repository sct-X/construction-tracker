/**
 * The phone's stages: a strip of chips across the top (the current stage in
 * bold on a concrete wash, never orange) that jump to a vertical list of
 * bands, one per stage, with its dates, its status in words, a thin
 * progress bar and any late step named under it. A Gantt turned ninety
 * degrees and simplified.
 */
import type { JobForecast } from '../../domain/forecast';
import { calendarDaysBetween, formatDayMonth, formatShort } from '../../domain/dates';
import { StatusText } from '../StatusText';
import { lateText } from './Gantt';
import './stagesStrip.css';

interface Props {
  forecast: JobForecast;
  today: string;
}

function progressOf(stage: JobForecast['stages'][number], today: string): number {
  if (stage.status === 'done') return 1;
  if (stage.status === 'not_started' || !stage.forecastStart || !stage.forecastEnd) return 0;
  const total = Math.max(1, calendarDaysBetween(stage.forecastStart, stage.forecastEnd) + 1);
  const gone = calendarDaysBetween(stage.forecastStart, today);
  return Math.min(1, Math.max(0, gone / total));
}

function statusWords(stage: JobForecast['stages'][number], today: string): string {
  if (stage.status === 'done') return 'Done';
  if (stage.status === 'in_progress' && stage.forecastStart && stage.forecastEnd) {
    const total = Math.max(1, Math.ceil((calendarDaysBetween(stage.forecastStart, stage.forecastEnd) + 1) / 7));
    const week = Math.min(total, Math.max(1, Math.floor(calendarDaysBetween(stage.forecastStart, today) / 7) + 1));
    return `In progress, week ${week} of ${total}`;
  }
  return stage.forecastStart ? `Starts ${formatShort(stage.forecastStart)}` : 'No dates yet';
}

export function StagesStrip({ forecast }: { forecast: JobForecast }) {
  const current = forecast.currentStageId;
  const jump = (id: string) => {
    document.getElementById(`stage-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="stages-strip" data-testid="stages-strip" aria-label="Stages">
      <ul className="stages-strip__list">
        {forecast.stages.map((s) => (
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

export function StagesList({ forecast, today }: Props) {
  const current = forecast.currentStageId;
  return (
    <section className="stages" data-testid="stages" aria-labelledby="stages-heading">
      <h2 id="stages-heading" className="stages__heading">
        <span>Stages</span>
        <span className="stages__heading-note">{forecast.stages.length} in order</span>
      </h2>
      {forecast.stages.map((s) => {
        const late = s.stepIds.map((id) => forecast.steps[id]).filter((st) => st && st.lateDays > 0);
        const pct = Math.round(progressOf(s, today) * 100);
        return (
          <article
            key={s.stageId}
            id={`stage-${s.stageId}`}
            className="stages__band"
            data-testid={`stage-band-${s.stageId}`}
            aria-current={s.stageId === current ? 'true' : undefined}
          >
            <div className="stages__top">
              <h3 className="stages__name">{s.name}</h3>
              <span className="stages__status">{statusWords(s, today)}</span>
            </div>
            {s.forecastStart && s.forecastEnd && (
              <p className="stages__dates num">
                {formatShort(s.forecastStart)} to {formatShort(s.forecastEnd)}
                {s.lateDays > 0 && (
                  <>
                    {' '}
                    <StatusText tone="late" plain>
                      {lateText(s.lateDays)}
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
                  <li key={st.stepId}>
                    <a href={`#/steps/${st.stepId}`} className="stages__late-link">
                      <StatusText tone="late">
                        {st.name}: {lateText(st.lateDays)}, now {formatShort(st.forecastStart)}
                      </StatusText>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </section>
  );
}
