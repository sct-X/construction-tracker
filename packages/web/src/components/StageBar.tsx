/**
 * Progress through a job's stages as one bar of equal segments (v1 StageBar):
 * done grey, the current one the label colour, the rest a pale trough. The bar
 * is a picture; the words beside it carry the meaning, so it reads as one
 * sentence ("Stage 5 of 8, Lock-up") to assistive tech.
 */
export interface BarStage {
  stageId: string;
  name: string;
  status: string;
}

export function StageBar({ stages, currentStageId, label, size = 'slim', testId }: { stages: BarStage[]; currentStageId: string | null; label: string; size?: 'slim' | 'large'; testId?: string }) {
  if (stages.length === 0) return null;
  return (
    <div className={`stagebar stagebar--${size}`} role="img" aria-label={label} data-testid={testId}>
      {stages.map((s) => {
        const state = s.stageId === currentStageId ? 'current' : s.status === 'done' ? 'done' : 'ahead';
        return <span key={s.stageId} className={`stagebar__seg stagebar__seg--${state}`} data-state={state} title={s.name} />;
      })}
    </div>
  );
}
