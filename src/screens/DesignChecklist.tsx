/**
 * Design job checklist (UI_PLAN 3.7, rule 9): where an approval is up to and
 * who owes what. Stages are a checklist, no steps, no Gantt.
 *
 *  - The one big figure is what is outstanding: "2 outstanding, oldest 23
 *    days", the same words as the jobs list and the Monday screen, from the
 *    same calculator field (`getForecast(id).checklist`).
 *  - Each stage is a row with a drawn tick box and its status in words. The
 *    admin and the builder set the status with three buttons (never a
 *    dropdown); partners read the words.
 *  - Under the current stage, every open item with who owes it and how long
 *    it has sat ("outstanding 23 days"); done items fold away at the foot.
 */
import { Link, useParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { Item, Job, Person, StageStatus } from '../domain/types';
import type { JobForecast } from '../domain/forecast';
import { ItemRow, ItemRowList } from '../components/ItemRow';
import { StatusText, type Tone } from '../components/StatusText';
import { ClockGlyph } from '../components/QueueBadge';
import { outstandingWords as overviewOutstanding } from './Overview';
import { PageHeader } from '../shell/PageHeader';
import NotFound from './NotFound';
import './designChecklist.css';

const STAGE_STATUS_ORDER: StageStatus[] = ['not_started', 'in_progress', 'done'];
const STAGE_STATUS_WORDS: Record<StageStatus, string> = { not_started: 'Not started', in_progress: 'Under way', done: 'Done' };
const STAGE_BUTTON_WORDS: Record<StageStatus, string> = { not_started: 'Not started', in_progress: 'In progress', done: 'Done' };

interface Data {
  job: Job;
  forecast?: JobForecast;
  items: Item[];
  people: Person[];
}

/** "2 outstanding, oldest 23 days" / "Nothing outstanding": the overview's own helper, so the two screens always agree. */
export function outstandingWords(f?: JobForecast): { count: number; rest: string; tone: Tone } {
  const { tone, text } = overviewOutstanding(f?.checklist?.outstanding, f?.checklist?.oldestDays);
  const m = /^(\d+) (.*)$/.exec(text);
  return m ? { count: Number(m[1]), rest: m[2], tone } : { count: 0, rest: text, tone };
}

/** "outstanding 23 days", in plain words: time sitting is not a missed date, so never coloured. */
export function sittingWords(days: number): { text: string; tone: Tone } {
  return { text: `outstanding ${days} day${days === 1 ? '' : 's'}`, tone: 'plain' };
}

/** DA goes through council; CDC through a private certifier. */
function pathWords(job: Job): string {
  if (job.path === 'DA') return 'DA, through council';
  if (job.path === 'CDC') return 'CDC, through a certifier';
  return 'No approval path set';
}

function TickBox({ status }: { status: StageStatus }) {
  return (
    <svg className={`checklist__box checklist__box--${status}`} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="3" />
      {status === 'done' && <path className="checklist__tick" d="M7 12.5l3.2 3.2L17 9" />}
      {status === 'in_progress' && <rect className="checklist__half" x="7" y="7" width="10" height="10" rx="1.5" />}
    </svg>
  );
}

export default function DesignChecklist() {
  const { id = '' } = useParams();
  const api = useApi();
  const { role, offline } = useSession();
  const data = useQuery<Data | undefined>(
    (api) => {
      const job = api.getJob(id);
      if (!job) return undefined;
      return { job, forecast: api.getForecast(id), items: api.listItems({ jobId: id, includeDone: true }), people: api.listPeople() };
    },
    [id],
  );
  if (!data) return <NotFound />;
  const { job, forecast, items, people } = data;
  const checklist = forecast?.checklist;
  const canEdit = role === 'admin' || role === 'builder';
  const nameOf = (pid?: string) => people.find((p) => p.id === pid)?.shortName;
  const out = outstandingWords(forecast);
  const open = items.filter((i) => i.status !== 'done');
  const done = items.filter((i) => i.status === 'done');
  const sitting = new Map(checklist?.outstandingItems.map((c) => [c.itemId, c.daysSitting]) ?? []);
  const openSorted = [...open].sort((a, b) => (sitting.get(b.id) ?? 0) - (sitting.get(a.id) ?? 0));
  const stages = checklist?.stages ?? [];
  const currentId = checklist?.currentStageId;
  const freshness = forecast?.freshness;

  const setStatus = (stageId: string, status: StageStatus) => {
    api.updateStage(stageId, { status });
  };

  const tabs = [
    { label: 'Checklist', to: `/jobs/${job.id}`, here: true },
    { label: 'Waiting on', to: `/waiting?job=${job.id}`, here: false },
  ];

  const itemList = (list: Item[], done: boolean) => (
    <ItemRowList>
      {list.map((item) => {
        const days = sitting.get(item.id);
        return (
          <ItemRow
            key={item.id}
            item={item}
            forecast={forecast?.items[item.id]}
            ownerName={nameOf(item.ownerId)}
            href={`/items/${item.id}`}
            when={done ? null : days === undefined ? undefined : sittingWords(days)}
            testId={`checklist-item-${item.id}`}
          />
        );
      })}
    </ItemRowList>
  );

  return (
    <main className="page checklist" data-testid="checklist">
      <PageHeader
        title={job.name}
        meta={
          <span className="checklist__meta">
            <span data-testid="checklist-path">{pathWords(job)}</span>
            {checklist?.currentStageName ? <span data-testid="checklist-current">Now: {checklist.currentStageName.toLowerCase()}</span> : <span>Every stage done</span>}
          </span>
        }
        back={{ to: '/jobs', label: 'Jobs' }}
      />

      <nav className="checklist__tabs" aria-label="Job sections" data-testid="job-tabs">
        {tabs.map((t) => (
          <Link key={t.label} to={t.to} className="checklist__tab" aria-current={t.here ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      <section className="checklist__hero" aria-label="Outstanding">
        <div className="checklist__figure">
          <p className={`checklist__outstanding checklist__outstanding--${out.tone}`} data-testid="checklist-outstanding">
            {out.count > 0 ? (
              <>
                <span className="checklist__count display">{out.count}</span> <span className="checklist__count-words">{out.rest}</span>
              </>
            ) : (
              <span className="checklist__count checklist__count--words display">{out.rest}</span>
            )}
          </p>
        </div>
        <div className="checklist__facts">
          {freshness && (
            <StatusText tone="muted" testId="checklist-fresh">
              {freshness.text}
            </StatusText>
          )}
          {role !== 'site' && (
            <Link to={`/items/new?job=${job.id}`} className="btn btn--primary btn--desktop" data-testid="checklist-add">
              Add item
            </Link>
          )}
        </div>
      </section>
      {offline && canEdit && (
        <p className="checklist__offline" data-testid="checklist-offline">
          <ClockGlyph className="checklist__clock" /> No signal: stage ticks wait to send
        </p>
      )}

      <ol className="checklist__stages" aria-label="Stages">
        {stages.map((s) => {
          const current = s.stageId === currentId;
          const showItems = current && openSorted.length > 0;
          return (
            <li
              key={s.stageId}
              className={['checklist__stage', `checklist__stage--${s.status}`, current ? 'checklist__stage--current' : ''].filter(Boolean).join(' ')}
              data-testid={`checklist-stage-${s.stageId}`}
              data-status={s.status}
              aria-current={current ? 'step' : undefined}
            >
              <div className="checklist__row">
                <TickBox status={s.status} />
                <span className="checklist__name">{s.name}</span>
                {canEdit ? (
                  <div className="seg checklist__status" role="group" aria-label={`${s.name}: status`}>
                    {STAGE_STATUS_ORDER.map((st) => (
                      <button
                        key={st}
                        type="button"
                        className="seg__btn"
                        aria-pressed={s.status === st}
                        data-testid={`checklist-stage-status-${s.stageId}-${st}`}
                        onClick={() => s.status !== st && setStatus(s.stageId, st)}
                      >
                        {STAGE_BUTTON_WORDS[st]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="checklist__words" data-testid={`checklist-stage-words-${s.stageId}`}>
                    {STAGE_STATUS_WORDS[s.status]}
                  </span>
                )}
              </div>
              {current && (
                <div className="checklist__items">
                  {showItems ? (
                    itemList(openSorted, false)
                  ) : (
                    <p className="checklist__empty" data-testid="checklist-empty">
                      Nothing outstanding at this stage.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!currentId && openSorted.length > 0 && (
        <section className="checklist__leftover" aria-label="Open items">
          <h2 className="checklist__section-title">Still open</h2>
          {itemList(openSorted, false)}
        </section>
      )}

      {done.length > 0 && (
        <details className="checklist__done" data-testid="checklist-done">
          <summary className="checklist__done-summary">Done ({done.length})</summary>
          {itemList(done, true)}
        </details>
      )}
    </main>
  );
}
