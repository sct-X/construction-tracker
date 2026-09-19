/**
 * The impact panel (UI_PLAN 3.13, flow d): what a new ETA would do, read
 * before it is saved. The chain in one line each, conditional ("would")
 * because nothing has been saved yet.
 *
 *   If saved
 *   3 linked items would be expected Mon 16 Nov.
 *   Install windows would start Mon 16 Nov, not Mon 2 Nov.
 */
import type { EtaPreview } from '../domain/forecast';
import { formatShort } from '../domain/dates';
import './etaImpact.css';

export interface EtaImpactProps {
  preview: EtaPreview;
  testId?: string;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function EtaImpact({ preview, testId = 'shipment-eta-preview' }: EtaImpactProps) {
  const { linkedItemIds, movedSteps, deltaDays } = preview;
  const later = deltaDays > 0;
  const nothingMoves = movedSteps.length === 0 && deltaDays === 0;
  // The earliest-starting moved step is the one the shipment feeds; the rest follow it.
  const first = movedSteps[0];
  const rest = movedSteps.length - 1;

  return (
    <div className={`eta-impact ${later ? 'eta-impact--later' : ''}`} data-testid={testId} aria-live="polite">
      <p className="eta-impact__title">If saved</p>
      <ul className="eta-impact__chain">
        <li className="eta-impact__line" data-testid="shipment-eta-preview-items">
          {linkedItemIds.length === 0
            ? 'No items are linked, so nothing else moves.'
            : `${plural(linkedItemIds.length, 'linked item', 'linked items')} would be expected ${formatShort(preview.newEta)}.`}
        </li>
        {first && (
          <li className="eta-impact__line" data-testid="shipment-eta-preview-step">
            {first.name} would start {formatShort(first.to)}, not {formatShort(first.from)}
            {rest > 0 ? `, and ${plural(rest, 'step after it moves', 'steps after it move')} with it.` : '.'}
          </li>
        )}
        {nothingMoves && linkedItemIds.length > 0 && (
          <li className="eta-impact__line" data-testid="shipment-eta-preview-step">
            No step moves: the items would still arrive before their step needs them.
          </li>
        )}
      </ul>
    </div>
  );
}
