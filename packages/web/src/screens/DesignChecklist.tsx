/**
 * Design job checklist (v1 src/screens/DesignChecklist.tsx, read-only): where
 * an approval is up to and who owes what. Design jobs have no program and no
 * Gantt (rule 9): the stages are a checklist.
 *
 *  - The one big figure is what is outstanding: "2 outstanding, oldest 23
 *    days". How long something has sat is not a date it has missed, so it is
 *    never coloured; an item past its needed-by with nothing expected is
 *    overdue and says so in red (Dom's cue).
 *  - Each stage is a row with a drawn tick box and its status in words (the
 *    bot sets it; the web only reads).
 *  - Under the current stage, every open item with who owes it and how long
 *    it has sat; done items fold away at the foot.
 */
import { isOverdue, stageDisplayName, workStatusWords, type DashboardApi, type DesignChecklist, type ISODate, type StageStatus } from '@ct/core';
import { useData } from '../data/DataContext';
import { useJobQuery } from '../data/useJobQuery';
import { LoadError, LoadingRows } from '../components/bits';
import { ItemRow, ItemRowList } from '../components/ItemRow';
import { StatusText, type Tone } from '../components/StatusText';
import { freshnessWords, UNKNOWN_TODAY } from '../ui/format';
import { shortRelative } from '../ui/when';
import '../styles/checklist.css';

export function loadChecklist(api: DashboardApi, jobId: string): Promise<DesignChecklist> {
  return api.getDesignChecklist(jobId);
}

/** "2 outstanding, oldest 23 days" / "Nothing outstanding", in plain words whatever the age. */
export function outstandingWords(c: Pick<DesignChecklist, 'outstanding' | 'oldestDays'>): { count: number; rest: string } {
  if (!c.outstanding) return { count: 0, rest: 'Nothing outstanding' };
  const d = c.oldestDays;
  return { count: c.outstanding, rest: d === null ? 'outstanding' : `outstanding, oldest ${d} day${d === 1 ? '' : 's'}` };
}

type CkItem = DesignChecklist['items'][number];

/** Overdue (needed-by gone, nothing expected or that gone too) in red words; else how long it has sat, plain. */
export function checklistWhen(it: CkItem, today: ISODate): { text: string; tone: Tone } {
  if (it.neededBy && isOverdue({ status: it.status, neededBy: it.neededBy, expected: it.expected, actBy: null }, today)) {
    return { text: `Needed ${shortRelative(it.neededBy, today, { deadline: true })}`, tone: 'late' };
  }
  return { text: `outstanding ${it.daysSitting} day${it.daysSitting === 1 ? '' : 's'}`, tone: 'plain' };
}

function TickBox({ status }: { status: StageStatus }) {
  return (
    <svg className={`checklist__box checklist__box--${status}`} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <rect x="2.5" y="2.5" width="19" height="19" rx="3" />
      {status === 'done' && <path className="checklist__tick" d="M7 12.5l3.2 3.2L17 9" />}
      {status === 'in_progress' && <rect className="checklist__half" x="7" y="7" width="10" height="10" rx="1.5" />}
    </svg>
  );
}

export function DesignChecklistScreen({ jobId }: { jobId: string }) {
  const q = useJobQuery(loadChecklist, jobId);
  const { today } = useData();
  return (
    <div className="checklist" data-testid="checklist">
      <h2 className="sr-only">Checklist{q.status === 'ready' ? ` for ${q.data.name}` : ''}</h2>
      {q.status === 'loading' && <LoadingRows rows={4} label="Loading the checklist" />}
      {q.status === 'error' && <LoadError what="the checklist" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <ChecklistBody c={q.data} today={today ?? UNKNOWN_TODAY} />}
    </div>
  );
}

export function ChecklistBody({ c, today }: { c: DesignChecklist; today: ISODate }) {
  const out = outstandingWords(c);
  const list = (items: CkItem[]) => (
    <ItemRowList>
      {items.map((it) => (
        <ItemRow key={it.itemId} row={it} when={checklistWhen(it, today)} testId={`ck-item-${it.itemId}`} call={false} />
      ))}
    </ItemRowList>
  );
  return (
    <>
      <section className="checklist__hero" aria-label="Outstanding" data-testid="ck-summary">
        <p className={out.count ? 'checklist__outstanding' : 'checklist__outstanding checklist__outstanding--none'} data-testid="ck-outstanding">
          {out.count > 0 ? (
            <>
              <span className="checklist__count display">{out.count}</span> <span className="checklist__count-words">{out.rest}</span>
            </>
          ) : (
            <span className="checklist__count checklist__count--words display">{out.rest}</span>
          )}
        </p>
        <StatusText tone="muted" testId="ck-freshness">
          <span data-unconfirmed={c.amber ? 'true' : 'false'}>{freshnessWords(c)}</span>
        </StatusText>
      </section>

      <ol className="checklist__stages" aria-label="Stages" data-testid="ck-stages">
        {c.stages.map((s) => (
          <li
            key={s.stageId}
            className={['checklist__stage', `checklist__stage--${s.status}`, s.isCurrent ? 'checklist__stage--current' : ''].filter(Boolean).join(' ')}
            data-testid={`ck-stage-${s.order}`}
            data-status={s.status}
            aria-current={s.isCurrent ? 'step' : undefined}
          >
            <div className="checklist__row">
              <TickBox status={s.status} />
              <span className="checklist__name">{stageDisplayName(s.name)}</span>
              <span className="checklist__words" data-testid={`ck-stage-words-${s.order}`}>
                {workStatusWords(s.status)}
              </span>
            </div>
            {s.isCurrent && (
              <div className="checklist__items">
                {c.items.length ? (
                  list(c.items)
                ) : (
                  <p className="checklist__empty" data-testid="ck-empty">
                    Nothing outstanding at this stage.
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {!c.currentStageId && c.items.length > 0 && (
        <section className="checklist__leftover" aria-labelledby="ck-open">
          <h3 id="ck-open" className="checklist__section-title">
            Still open
          </h3>
          {list(c.items)}
        </section>
      )}

      {c.done.length > 0 && (
        <details className="checklist__done" data-testid="ck-done">
          <summary className="checklist__done-summary">Done ({c.done.length})</summary>
          <ItemRowList>
            {c.done.map((d) => (
              <ItemRow
                key={d.itemId}
                row={{ itemId: d.itemId, type: d.type, title: d.title, waitingOn: null, owner: null, statusLabel: '' }}
                when={d.doneAt ? { text: `Done ${shortRelative(d.doneAt, today)}`, tone: 'muted' } : null}
                testId={`ck-done-${d.itemId}`}
                call={false}
              />
            ))}
          </ItemRowList>
        </details>
      )}
    </>
  );
}
