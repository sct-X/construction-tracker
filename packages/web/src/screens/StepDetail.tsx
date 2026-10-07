/**
 * Step detail: one step's planned and forecast dates, the one sentence that
 * says what sets its start, what it waits for, what it holds up, the items it
 * needs (needed-by, act-by, expected), and for a hold point how many of the
 * required photo categories have a photo.
 */
import { formatDate, type DashboardApi, type ISODate, type StepDetail, type WaitingRow } from '@ct/core';
import { href } from '../app/router';
import { CellLabel, LoadError, LoadingRows } from '../components/bits';
import { useJobQuery } from '../data/useJobQuery';
import { useData } from '../data/DataContext';
import { lateWords, plural, rangeWords, statusWords, UNKNOWN_TODAY } from '../ui/format';
import { tabHref } from '../app/jobNav';
import { CallLink } from '../components/listBits';
import { photoCount, urgencyWords } from '../ui/itemWords';

export function loadStep(api: DashboardApi, stepId: string): Promise<StepDetail> {
  return api.getStep(stepId);
}

export function StepDetailScreen({ jobId, stepId }: { jobId: string; stepId: string }) {
  const q = useJobQuery(loadStep, stepId);
  const { today } = useData();
  return (
    <div className="screen step">
      <p className="crumb">
        <a href={href(`/jobs/${encodeURIComponent(jobId)}/program`)}>Program</a>
        {q.status === 'ready' && <span className="crumb-here"> / {q.data.stageName}</span>}
      </p>
      {q.status === 'loading' && (
        <>
          <h1>Step</h1>
          <LoadingRows rows={4} label="Loading the step" />
        </>
      )}
      {q.status === 'error' && (
        <>
          <h1>Step</h1>
          <LoadError what="this step" error={q.error} retry={q.retry} />
        </>
      )}
      {q.status === 'ready' && <StepBody d={q.data} today={today ?? UNKNOWN_TODAY} />}
    </div>
  );
}

export function StepBody({ d, today }: { d: StepDetail; today: ISODate }) {
  const s = d.step;
  const late = s.isLate && s.status !== 'done';
  const meta = [d.stageName, s.tradeType, statusWords(s.status)].filter(Boolean).join(', ');
  return (
    <>
      <header className="screen-head step-head">
        <h1>
          {s.name}
          <span className="sr-only">, {d.jobName}</span>
        </h1>
        <p className="screen-sub">
          {meta}
          {s.isHoldPoint && (
            <>
              {' '}
              <span className="hp-tag">Hold point</span>
            </>
          )}
        </p>
      </header>

      <section className="step-dates" aria-label="Dates" data-testid="step-dates">
        <div className="sd-cell">
          <span className="sd-label">Forecast</span>
          <span className={late ? 'num-md sd-forecast is-late' : 'num-md sd-forecast'} data-testid="step-forecast">
            {rangeWords(s.forecastStart, s.forecastEnd, today)}
          </span>
        </div>
        <div className="sd-cell">
          <span className="sd-label">Planned</span>
          <span className="num-md sd-planned" data-testid="step-planned">
            {rangeWords(s.plannedStart, s.plannedEnd, today)}
          </span>
        </div>
        <div className="sd-cell">
          <span className="sd-label">Length</span>
          <span className="num-md">{plural(s.durationDays, 'working day')}</span>
        </div>
        <p className={late ? 'sd-reason is-late' : 'sd-reason'} data-testid="step-reason">
          {late && <strong className="late-words">{lateWords(s.lateDays)}. </strong>}
          {s.reason}
        </p>
      </section>

      {d.holdPoint && <HoldPointBlock d={d} />}

      <section className="block" aria-labelledby="needs-h">
        <h2 id="needs-h">What it needs</h2>
        {d.items.length ? <NeedsTable rows={d.items} today={today} /> : <p className="empty">No items are linked to this step.</p>}
        {d.requirements.length > 0 && (
          <p className="req-line">
            Lead times:{' '}
            {d.requirements
              .map((r) => `${r.name} ${r.leadTimeWeeks ? `${plural(r.leadTimeWeeks, 'week')}` : 'no lead time'}`)
              .join('; ')}
            .
          </p>
        )}
      </section>

      <div className="links-pair">
        <section className="block" aria-labelledby="waits-h">
          <h2 id="waits-h">Waits for</h2>
          {d.waitsFor.length ? (
            <ul className="link-list" data-testid="waits-for">
              {d.waitsFor.map((w) => (
                <li key={w.stepId}>
                  <a href={href(`/jobs/${encodeURIComponent(d.jobId)}/steps/${encodeURIComponent(w.stepId)}`)}>{w.name}</a>
                  <span className="sub">finishes {formatDate(w.forecastEnd, today)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No earlier step. It can start on its planned date.</p>
          )}
        </section>
        <section className="block" aria-labelledby="holds-h">
          <h2 id="holds-h">Holds up</h2>
          {d.holdsUp.length ? (
            <ul className="link-list" data-testid="holds-up">
              {d.holdsUp.map((w) => (
                <li key={w.stepId}>
                  <a href={href(`/jobs/${encodeURIComponent(d.jobId)}/steps/${encodeURIComponent(w.stepId)}`)}>{w.name}</a>
                  <span className="sub">starts {formatDate(w.forecastStart, today)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Nothing waits for this step.</p>
          )}
        </section>
      </div>
    </>
  );
}

function HoldPointBlock({ d }: { d: StepDetail }) {
  const h = d.holdPoint!;
  const photos = tabHref({ jobId: d.jobId, kind: 'build' }, 'Photos');
  return (
    <section className="block hp-block" aria-labelledby="hold-h" data-testid="hold-point">
      <h2 id="hold-h">
        Hold point photos{' '}
        <span className="h-note">
          {h.filledCount} of {h.required.length} required categories have photos
        </span>
      </h2>
      <p className="hold-rule">
        {h.ok
          ? 'Every required category has a photo, so this step can be marked done.'
          : `It can't be marked done until ${h.missingCategories.length === 1 ? 'this category has' : 'these categories have'} a photo: ${h.missingCategories.join('; ')}.`}
      </p>
      <ul className="cats">
        {h.required.map((c) => (
          <li key={c.categoryId} className={c.photoCount ? 'cat cat-ok' : 'cat cat-missing'} data-testid="hold-category">
            <span className="cat-name">{c.name}</span>
            <span className="cat-count">{photoCount(c.photoCount)}</span>
          </li>
        ))}
      </ul>
      {photos && (
        <p className="more-link">
          <a href={photos}>See the photos</a>
        </p>
      )}
    </section>
  );
}

export function NeedsTable({ rows, today }: { rows: WaitingRow[]; today: ISODate }) {
  return (
    <table className="board needs" data-testid="needs">
      <thead>
        <tr>
          <th scope="col">Item</th>
          <th scope="col">Status</th>
          <th scope="col">Needed by</th>
          <th scope="col">Act by</th>
          <th scope="col">Expected</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.itemId} className={`need-row${urgencyWords(r, today) ? ' is-late' : ''}`} data-testid={`need-${r.itemId}`}>
            <th scope="row" className="c-item">
              <span className="need-title">{r.title}</span>
              {urgencyWords(r, today) && (
                <span className="sub strong late-words" data-testid="urgency">
                  {urgencyWords(r, today)!.text}
                </span>
              )}
              <span className="sub">
                {[r.typeLabel, r.owner, r.waitingOn ? `waiting on ${r.waitingOn}` : null].filter(Boolean).join(', ')}
              </span>
              {r.tradePhone && <CallLink name={r.tradeName ?? r.waitingOn} phone={r.tradePhone} />}
            </th>
            <td className="c-status">
              <CellLabel>Status</CellLabel>
              {r.statusLabel}
            </td>
            <td className="c-needed">
              <CellLabel>Needed by</CellLabel>
              {r.neededBy ? formatDate(r.neededBy, today) : 'No date'}
            </td>
            <td className="c-actby">
              <CellLabel>Act by</CellLabel>
              {r.actBy ? formatDate(r.actBy, today) : 'No date'}

            </td>
            <td className="c-expected">
              <CellLabel>Expected</CellLabel>
              {r.expected ? formatDate(r.expected, today) : 'Not set'}
              {r.shipmentName && <span className="sub">from {r.shipmentName}</span>}

            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
