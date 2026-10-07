/**
 * Design checklist: where an approval is up to and who owes what. Design jobs
 * have no program and no Gantt (rule 9): the stages are a checklist, and under
 * the current stage sits each outstanding item with who owes it and how many
 * days it has been sitting.
 */
import { formatDate, type DashboardApi, type DesignChecklist } from '@ct/core';
import { useData } from '../data/DataContext';
import { useJobQuery } from '../data/useJobQuery';
import { Freshness, LoadError, LoadingRows } from '../components/bits';
import { plural, statusWords, UNKNOWN_TODAY } from '../ui/format';

export function loadChecklist(api: DashboardApi, jobId: string): Promise<DesignChecklist> {
  return api.getDesignChecklist(jobId);
}

const PATH_WORDS: Record<string, string> = {
  DA: 'DA: development application, decided by council',
  CDC: 'CDC: complying development, approved by a private certifier',
};

export function DesignChecklistScreen({ jobId }: { jobId: string }) {
  const q = useJobQuery(loadChecklist, jobId);
  const { today } = useData();
  return (
    <div className="screen checklist">
      <header className="screen-head">
        <h1>
          Checklist{q.status === 'ready' && (
            <>
              {' '}
              <span className="sr-only">for {q.data.name}</span>
            </>
          )}
        </h1>
        {q.status === 'ready' && q.data.path && <p className="screen-sub">{PATH_WORDS[q.data.path] ?? q.data.path}</p>}
      </header>
      {q.status === 'loading' && <LoadingRows rows={4} label="Loading the checklist" />}
      {q.status === 'error' && <LoadError what="the checklist" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ChecklistBody c={q.data} today={today ?? UNKNOWN_TODAY} />}
    </div>
  );
}

export function ChecklistBody({ c, today }: { c: DesignChecklist; today: string }) {
  return (
    <>
      <section className="ck-summary" aria-label="Summary" data-testid="ck-summary">
        <div className="ov-fig">
          <span className="ov-label">Stage</span>
          <span className="num-md">{c.currentStageName ?? 'All stages done'}</span>
        </div>
        <div className="ov-fig">
          <span className="ov-label">Outstanding</span>
          <span className="num-md" data-testid="ck-outstanding">
            {c.outstanding ? plural(c.outstanding, 'item') : 'Nothing'}
          </span>
        </div>
        <div className="ov-fig">
          <span className="ov-label">Oldest</span>
          <span className="num-md" data-testid="ck-oldest">
            {c.oldestDays !== null ? plural(c.oldestDays, 'day') : 'Nothing waiting'}
          </span>
        </div>
        <div className="ov-fig ov-fig-nolabel">
          <span className="ov-label sr-only">Last confirmed</span>
          <Freshness amber={c.amber} daysUnconfirmed={c.daysUnconfirmed} freshnessText={c.freshnessText} testId="ck-freshness" />
        </div>
      </section>

      <ol className="ck-stages" data-testid="ck-stages">
        {c.stages.map((s, i) => (
          <li key={s.stageId} className={`ck-stage ck-${s.status}${s.isCurrent ? ' is-current' : ''}`} data-testid={`ck-stage-${s.order}`}>
            <span className="ck-mark" aria-hidden="true">
              {s.status === 'done' ? '✓' : i + 1}
            </span>
            <div className="ck-body">
              <p className="ck-name">
                {s.name}
                <span className="ck-status">{s.isCurrent ? (s.status === 'not_started' ? 'Next' : 'Current stage') : statusWords(s.status)}</span>
              </p>
              {s.isCurrent && (
                <div className="ck-items">
                  {c.items.length ? (
                    <ul data-testid="ck-items">
                      {c.items.map((it) => (
                        <li key={it.itemId} className="ck-item" data-testid="ck-item">
                          <span className="ck-age">
                            <span className="num-md">{it.daysSitting}</span> {it.daysSitting === 1 ? 'day' : 'days'}
                          </span>
                          <div className="ck-item-body">
                            <span className="ck-item-title">{it.title}</span>
                            <span className="sub">
                              {[
                                it.typeLabel,
                                it.statusLabel.toLowerCase(),
                                it.waitingOn ? `waiting on ${it.waitingOn}` : null,
                                it.neededBy ? `needed ${formatDate(it.neededBy, today)}` : null,
                                it.expected ? `expected ${formatDate(it.expected, today)}` : null,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                            {it.notes && <span className="sub ck-note">{it.notes}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty">Nothing outstanding at this stage.</p>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {c.done.length > 0 && (
        <details className="ck-done">
          <summary>{plural(c.done.length, 'item')} done on this job</summary>
          <ul>
            {c.done.map((d) => (
              <li key={d.itemId}>
                {d.title}
                <span className="sub">
                  {d.typeLabel}
                  {d.doneAt ? `, done ${formatDate(d.doneAt, today)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
