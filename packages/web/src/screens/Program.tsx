/**
 * Program (v1 src/screens/Program.tsx, read-only): when every step happens,
 * what it waits for and what runs late. Timing only, no finish or slip.
 *
 * Desktop: the Gantt with All / Look-ahead / Late only, and Edit program
 * (the desktop Setup editor). Phone: the stages strip, the three-week
 * look-ahead and the stages list, with "Full program" for the Gantt.
 * Red only for a step past its own planned date (Dom's overdue cue).
 */
import { useState } from 'react';
import type { DashboardApi, ProgramView } from '@ct/core';
import { href } from '../app/router';
import { LoadError, LoadingRows } from '../components/bits';
import { Gantt, type GanttView } from '../components/gantt/Gantt';
import { LookAhead } from '../components/gantt/LookAhead';
import { StagesList, StagesStrip } from '../components/gantt/StagesStrip';
import { useJobQuery } from '../data/useJobQuery';
import { usePhoneWidth } from '../shell/useNarrow';
import { plural } from '../ui/format';
import '../styles/program.css';

export function loadProgram(api: DashboardApi, jobId: string): Promise<ProgramView> {
  return api.getProgram(jobId);
}

/** Timing first (SPEC revision): where the job is and how many open steps run later than planned. No finish. */
export function programSubWords(p: Pick<ProgramView, 'forecast' | 'steps'>): string {
  const late = p.steps.filter((s) => s.isLate && s.status !== 'done').length;
  const where = p.forecast.currentStageName ?? 'All stages done';
  return `${where}. ${late ? `${plural(late, 'step')} later than planned.` : 'Every step on plan.'}`;
}

const VIEWS: { key: GanttView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'lookahead', label: 'Look-ahead' },
  { key: 'late', label: 'Late only' },
];

export function ProgramScreen({ jobId }: { jobId: string }) {
  const q = useJobQuery(loadProgram, jobId);
  const phone = usePhoneWidth();
  const [ganttView, setGanttView] = useState<GanttView>('all');
  const [phoneView, setPhoneView] = useState<'lookahead' | 'gantt'>('lookahead');
  const p = q.status === 'ready' ? q.data : null;
  const hasProgram = !!p && p.steps.length > 0;
  const showGantt = !phone || phoneView === 'gantt';

  return (
    <div className="program" data-testid="program" data-layout={phone ? 'phone' : 'desktop'}>
      <div className="program__head">
        <div className="program__lead">
          <h2 className="program__title">
            Program{p && <span className="sr-only"> for {p.job.name}</span>}
          </h2>
          {p && (
            <p className="page-header__meta" data-testid="program-sub">
              {programSubWords(p)}
            </p>
          )}
        </div>
        {hasProgram && (
          <div className="program__actions">
            {phone ? (
              <span className="seg seg-touch program__phone-views" role="group" aria-label="Show">
                <button type="button" className="seg__btn" aria-pressed={phoneView === 'lookahead'} data-testid="program-lookahead-link" onClick={() => setPhoneView('lookahead')}>
                  Look-ahead
                </button>
                <button type="button" className="seg__btn" aria-pressed={phoneView === 'gantt'} data-testid="program-full-link" onClick={() => setPhoneView('gantt')}>
                  Full program
                </button>
              </span>
            ) : (
              <>
                <span className="seg" role="group" aria-label="Show">
                  {VIEWS.map((v) => (
                    <button key={v.key} type="button" className="seg__btn" aria-pressed={ganttView === v.key} data-testid={`program-view-${v.key}`} onClick={() => setGanttView(v.key)}>
                      {v.label}
                    </button>
                  ))}
                </span>
                <a className="btn btn--glass btn--desktop" href={href(`/setup/programs/${encodeURIComponent(jobId)}`)} data-testid="program-edit">
                  Edit program
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {q.status === 'loading' && <LoadingRows rows={6} label="Loading the program" />}
      {q.status === 'error' && <LoadError what="the program" error={q.error} retry={q.retry} />}
      {p && !hasProgram && (
        <p className="empty-line" data-testid="program-empty">
          No program yet.
        </p>
      )}
      {p && hasProgram && showGantt && <Gantt p={p} view={phone ? 'all' : ganttView} dense={phone} />}
      {p && hasProgram && !showGantt && (
        <>
          <StagesStrip p={p} />
          <LookAhead p={p} />
          <StagesList p={p} />
        </>
      )}
    </div>
  );
}
