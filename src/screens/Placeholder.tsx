/**
 * Stands in for a screen that arrives in a later stage, so every route in
 * src/screens/README.md resolves today. Small and honest: the title, the
 * stage, and a way back.
 */
import { PageHeader } from '../shell/PageHeader';

export default function Placeholder({ title, stage }: { title: string; stage: number }) {
  return (
    <main className="page" data-testid="placeholder">
      <PageHeader title={title} meta={`Coming in stage ${stage}`} />
      <p className="page__lede">
        This screen is in the plan and is not built yet. <a href="#/jobs">Back to the jobs list</a>
      </p>
    </main>
  );
}
