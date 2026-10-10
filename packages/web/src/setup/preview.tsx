/**
 * Dry runs for Setup: every change is previewed with DashboardApi.previewSetup
 * before Save, and these pieces say what it would do in words.
 */
import { useEffect, useState } from 'react';
import { formatDate, type JobImpact, type SetupPreview } from '@ct/core';
import { useData } from '../data/DataContext';
import { plural } from '../ui/itemWords';

export interface SetupCall {
  op: string;
  args: Record<string, unknown>;
}

export type PreviewState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ready'; preview: SetupPreview }
  | { status: 'error'; error: string };

/** Previews `call` (debounced) whenever it changes; idle while it is null. */
export function usePreview(call: SetupCall | null, delayMs = 200): PreviewState {
  const { api, version } = useData();
  const [state, setState] = useState<PreviewState>({ status: 'idle' });
  const key = call ? JSON.stringify(call) : null;
  useEffect(() => {
    if (!key || !call) {
      setState({ status: 'idle' });
      return;
    }
    let live = true;
    setState({ status: 'checking' });
    const t = setTimeout(() => {
      api
        .previewSetup(call.op, call.args)
        .then((preview) => live && setState({ status: 'ready', preview }))
        .catch((e: unknown) => live && setState({ status: 'error', error: e instanceof Error ? e.message : String(e) }));
    }, delayMs);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // key stands for call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key, version, delayMs]);
  return state;
}

/** Why a preview can't be saved, in words; null when it can. */
export function previewProblem(p: PreviewState): string | null {
  if (p.status === 'error') return `Couldn't check this change. ${p.error}`;
  if (p.status !== 'ready') return null;
  const r = p.preview.result;
  if (r.kind === 'refusal') return r.reason;
  if (r.kind === 'question') return r.question;
  return null;
}

export function canSave(p: PreviewState): boolean {
  return p.status === 'ready' && p.preview.result.kind === 'proposal';
}

/** "3 steps move: Tiling Mon 1 Feb to Mon 8 Feb, ...". */
export function MovedSteps({ impact, today, max = 4 }: { impact: JobImpact; today: string; max?: number }) {
  const moved = impact.movedSteps;
  const acts = new Set(impact.movedItems.filter((m) => m.field === 'actBy').map((m) => m.itemId)).size;
  if (!moved.length && !acts) return <p className="su-moved-none">No step's forecast dates move.</p>;
  return (
    <div className="su-moved" data-testid="preview-moved">
      {moved.length > 0 && (
        <>
          <p className="su-moved-head">{plural(moved.length, 'step')} {moved.length === 1 ? 'moves' : 'move'}:</p>
          <ul className="su-moved-list">
            {moved.slice(0, max).map((m) => (
              <li key={m.stepId}>
                <span className="su-moved-name">{m.name}</span> {formatDate(m.from, today)} to {formatDate(m.to, today)}
              </li>
            ))}
            {moved.length > max && <li className="su-moved-more">and {plural(moved.length - max, 'more step')}</li>}
          </ul>
        </>
      )}
      {acts > 0 && <p className="su-moved-acts">{plural(acts, 'act-by date')} {acts === 1 ? 'moves' : 'move'} with it.</p>}
    </div>
  );
}
