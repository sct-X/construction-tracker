/**
 * The impact panel (UI_PLAN 3.13, flow d): what a new ETA would do, in words,
 * before it is saved. Reads as a chain of consequences, items to step to
 * finish, so it matches "Why it moved" once the change is real.
 *
 *   3 linked items would be expected Mon 16 Nov.
 *   Install windows would start Mon 16 Nov, not Mon 2 Nov.
 *   Park Rd finish  Fri 12 Mar 2027  (+14 days, $9,000)
 *
 * Money goes through <SlipText> and <Money>, so a row without the cost still
 * reads "+14 days". Everything is conditional ("would") because nothing has
 * been saved yet.
 */
import type { EtaPreview } from '../domain/forecast';
import { formatLong, formatShort } from '../domain/dates';
import { BigNumber } from './BigNumber';
import { SlipText, slipTone } from './SlipText';
import './etaImpact.css';

export interface EtaImpactProps {
  preview: EtaPreview;
  /** The job the shipment belongs to, named on the finish line. */
  jobName: string;
  testId?: string;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function EtaImpact({ preview, jobName, testId = 'shipment-eta-preview' }: EtaImpactProps) {
  const { linkedItemIds, movedSteps, finishBefore, finishAfter, deltaDays, costDelta, slipDaysAfter, slipCostAfter } = preview;
  const later = deltaDays > 0;
  const nothingMoves = movedSteps.length === 0 && deltaDays === 0;
  // The earliest-starting moved step is the one the shipment feeds; the rest follow it.
  const first = movedSteps[0];
  const rest = movedSteps.length - 1;
  const showSlipAfter = slipDaysAfter !== undefined && slipDaysAfter !== deltaDays;

  return (
    <div className={`eta-impact ${later ? 'eta-impact--later' : ''}`} data-testid={testId} aria-live="polite">
      <p className="eta-impact__title">If you save this ETA</p>
      <ol className="eta-impact__chain">
        <li className="eta-impact__line" data-testid="shipment-eta-preview-items">
          {linkedItemIds.length === 0
            ? 'No items are linked to this shipment, so nothing else moves.'
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
        {finishAfter && (
          <li className="eta-impact__line eta-impact__line--finish">
            <span className="eta-impact__finish-label">{jobName} finish</span>
            <BigNumber
              size="row"
              value={formatLong(finishAfter)}
              tone={later ? 'late' : deltaDays < 0 ? 'ok' : undefined}
              testId="shipment-eta-preview-finish"
            />
            {deltaDays === 0 ? (
              <span className="eta-impact__delta eta-impact__delta--muted" data-testid="shipment-eta-preview-slip">
                unchanged
              </span>
            ) : (
              <span className={`eta-impact__delta eta-impact__delta--${slipTone(deltaDays)}`}>
                (<SlipText days={deltaDays} cost={costDelta} testId="shipment-eta-preview-slip" />
                {finishBefore ? `, was ${formatShort(finishBefore)}` : ''})
              </span>
            )}
          </li>
        )}
        {showSlipAfter && (
          <li className="eta-impact__line eta-impact__line--quiet" data-testid="shipment-eta-preview-since-monday">
            Slip since Monday would then read <SlipText days={slipDaysAfter} cost={slipCostAfter} />.
          </li>
        )}
      </ol>
    </div>
  );
}
