/**
 * Progress through a job's stages as one bar of equal segments: done stages
 * in grey, the current one in the label colour, the rest in a pale trough.
 * The bar is a picture; the words beside it ("Lock-up", "Stage 5 of 8")
 * carry the meaning, so the segments are hidden from assistive tech and the
 * bar reads as one sentence.
 *
 *   <StageBar stages={row.stages} currentStageId={row.currentStageId} />
 *   <StageBar stages={f.stages} currentStageId={f.currentStageId} size="large" />
 */
import type { StageStatus } from '../domain/types';
import './stageBar.css';

export interface BarStage {
  stageId: string;
  name: string;
  status: StageStatus;
}

interface Props {
  stages: BarStage[];
  currentStageId?: string;
  size?: 'slim' | 'large';
  testId?: string;
}

/** Where the job is: 1-based position of the current stage, or every stage done. */
export function stagePosition(stages: BarStage[], currentStageId?: string): { n: number; of: number; allDone: boolean } {
  const of = stages.length;
  const i = stages.findIndex((s) => s.stageId === currentStageId);
  const allDone = of > 0 && stages.every((s) => s.status === 'done');
  return { n: i >= 0 ? i + 1 : allDone ? of : 0, of, allDone };
}

/** "Stage 5 of 8", "All 8 stages done". */
export function positionWords(stages: BarStage[], currentStageId?: string): string {
  const { n, of, allDone } = stagePosition(stages, currentStageId);
  if (of === 0) return 'No stages yet';
  if (allDone) return `All ${of} stages done`;
  return n > 0 ? `Stage ${n} of ${of}` : `${of} stages`;
}

export function StageBar({ stages, currentStageId, size = 'slim', testId }: Props) {
  if (stages.length === 0) return null;
  const current = stages.find((s) => s.stageId === currentStageId);
  const label = `${positionWords(stages, currentStageId)}${current ? `, ${current.name}` : ''}`;
  return (
    <div className={`stagebar stagebar--${size}`} role="img" aria-label={label} data-testid={testId}>
      {stages.map((s) => {
        const state = s.stageId === currentStageId ? 'current' : s.status === 'done' ? 'done' : 'ahead';
        return <span key={s.stageId} className={`stagebar__seg stagebar__seg--${state}`} data-state={state} title={s.name} />;
      })}
    </div>
  );
}
