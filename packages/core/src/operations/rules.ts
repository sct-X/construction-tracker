/**
 * Rules re-checked when a change set is saved (Confirm, or apply-op), against the data as it is THEN.
 * A card is made from the data at proposal time; by Confirm the world may have moved (a photo undone,
 * a step deleted in Setup). Stale before-values are ChangeConflictError (changes.ts); a rule a stale
 * proposal would now break is RuleRefusalError. Both stores run this inside their write, so nothing is
 * written on a refusal and the change set stays proposed (the bot then cancels it and says why).
 */
import { holdPointCheck } from '../calculator.js';
import type { Change } from '../changes.js';
import type { Dataset } from '../types.js';
import { holdPointSignOffRefusal } from './daily.js';

export class RuleRefusalError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'RuleRefusalError';
  }
}

/** References a saved row must still have, per table: field -> Dataset key it points into. */
const REFERENCES: Record<string, Record<string, keyof Dataset>> = {
  photo: { jobId: 'jobs', stageId: 'stages', categoryId: 'photoCategories' },
  item: { jobId: 'jobs', stepId: 'steps', shipmentId: 'shipments', tradeId: 'trades', requirementId: 'requirements', photoId: 'photos' },
  daily_note: { jobId: 'jobs' },
};

const LABELS: Record<string, string> = {
  jobs: 'job',
  stages: 'stage',
  photoCategories: 'photo category',
  steps: 'step',
  shipments: 'shipment',
  trades: 'trade',
  requirements: 'requirement',
  photos: 'photo',
};

/**
 * The reason saving `changes` would break a rule, judged on `after` (the data with them applied), or null.
 * - Rule 6: a hold-point step set to done needs a photo in every required category.
 * - A new row (photo, item, daily note), or an item's link, must point at rows that still exist.
 */
export function ruleRefusalOnSave(after: Dataset, changes: Change[]): string | null {
  for (const c of changes) {
    if (c.table === 'step' && c.kind === 'update' && c.field === 'status' && c.after === 'done') {
      const step = after.steps.find((s) => s.id === c.rowId);
      if (step?.isHoldPoint) {
        const check = holdPointCheck(step, after.photoCategories, after.photos);
        if (!check.ok) return holdPointSignOffRefusal(check);
      }
    }
    const refs = REFERENCES[c.table];
    if (!refs) continue;
    const pairs: [string, unknown][] =
      c.kind === 'insert' ? Object.entries(c.row as Record<string, unknown>) : c.kind === 'update' ? [[c.field, c.after]] : [];
    for (const [field, value] of pairs) {
      const key = refs[field];
      if (!key || typeof value !== 'string') continue;
      const rows = after[key] as unknown as { id: string }[];
      if (!rows.some((r) => r.id === value)) return `The ${LABELS[key] ?? key} this change points at no longer exists, so it can't be saved.`;
    }
  }
  return null;
}

/** Throws RuleRefusalError when ruleRefusalOnSave finds a reason. */
export function assertRulesOnSave(after: Dataset, changes: Change[]): void {
  const reason = ruleRefusalOnSave(after, changes);
  if (reason) throw new RuleRefusalError(reason);
}
