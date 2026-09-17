/**
 * The impact panel (UI_PLAN 3.13, flow d): what a new ETA would do, read
 * before it is saved. A calm before-and-after readout of the job's finish,
 * then the chain under it in one line each, so it matches "Why it moved"
 * once the change is real.
 *
 *   If saved
 *   Fri 26 Feb 2027  ->  Fri 12 Mar 2027   +14 days, $9,000
 *   Finish now           Park Rd finish
 *   3 linked items would be expected Mon 16 Nov.
 *   Install windows would start Mon 16 Nov, not Mon 2 Nov.
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

function Arrow() {
  return (
    <svg className="eta-impact__arrow" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
      <p className="eta-impact__title">If saved</p>
      {finishAfter && (
        <div className="eta-impact__finish">
          {finishBefore && (
            <>
              <BigNumber size="row" value={formatLong(finishBefore)} label="Finish now" tone="muted" className="eta-impact__before" />
              <Arrow />
            </>
          )}
          <BigNumber
            size="row"
            value={formatLong(finishAfter)}
            label={`${jobName} finish`}
            tone={later ? 'late' : deltaDays < 0 ? 'ok' : undefined}
            testId="shipment-eta-preview-finish"
          />
          {deltaDays === 0 ? (
            <span className="eta-impact__delta eta-impact__delta--muted" data-testid="shipment-eta-preview-slip">
              unchanged
            </span>
          ) : (
            <span className={`eta-impact__delta eta-impact__delta--${slipTone(deltaDays)}`}>
              <SlipText days={deltaDays} cost={costDelta} testId="shipment-eta-preview-slip" />
            </span>
          )}
        </div>
      )}
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
        {showSlipAfter && (
          <li className="eta-impact__line" data-testid="shipment-eta-preview-since-monday">
            Slip since Monday would then read <SlipText days={slipDaysAfter} cost={slipCostAfter} />.
          </li>
        )}
      </ul>
    </div>
  );
}
