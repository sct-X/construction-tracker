/**
 * Item sheet (UI_PLAN 3.10): one screen to read, add and change any item.
 * `#/items/:id` edits; `#/items/new?job=<id>&step=<id>` adds.
 *
 *   Book plasterer                     Park Rd, Trade to book
 *   Act by Fri 18 Sep                  <- the sheet's one hero figure
 *   tomorrow: needed Fri 11 Dec for Plasterboard, minus 12 weeks
 *
 *   Title      [Book plasterer                 ]
 *   Type       [Trade to book|Material to order|...]   segmented troughs
 *   Job        [Park Rd|Seaview St|...]
 *   Step       [Plasterboard, starts Fri 11 Dec  v]
 *   Waiting on [CJ Linea (plasterer)  v] or [free text]   Ring 0412 ...
 *   Owner      [Dominic|Dom|Norm|Raff|Alec]
 *   Lead time  [12] weeks
 *   Needed by  Fri 11 Dec, from the step         (or a date when no step)
 *   Expected   [date]  or  Comes from shipment: Park Rd windows
 *   Status     [To do|Ordered or booked|Confirmed|Done]
 *   Notes      [                                ]
 *   [Save]  [Undo]                                Delete
 *   History
 *
 * Every field is a control, so reading and editing are the same screen; Save
 * writes once. Act-by is never typed: it is needed-by minus the lead time,
 * and needed-by comes from the step's forecast start when a step is linked
 * (rule 1), otherwise it is typed. Offline, the dates go grey with "Needs
 * signal"; status still saves because status ticks queue. Validation is
 * words under the buttons, never a red outline alone.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { ItemPatch, NewItemInput } from '../data/api';
import type { Item, ItemStatus, ItemType } from '../domain/types';
import { ITEM_STATUS_LABELS, ITEM_STATUS_ORDER, ITEM_TYPE_LABELS } from '../domain/types';
import { addCalendarWeeks, formatDayMonth, formatLongRelative, formatShort, formatShortRelative, formatStamp, isISODate, relativeDate } from '../domain/dates';
import { BigNumber } from '../components/BigNumber';
import { ItemTypePicker } from '../components/ItemTypePicker';
import { StatusText } from '../components/StatusText';
import NotFound from './NotFound';
import { PageHeader } from '../shell/PageHeader';
import { shipmentHref } from '../shell/nav';
import { isOverdue } from '../domain/forecast';
import { BOOKED_NEEDS_DATE, needsExpectedDate } from '../domain/itemFlow';
import './itemSheet.css';

interface Draft {
  title: string;
  type: ItemType;
  jobId: string;
  stepId: string;
  tradeId: string;
  waitingOn: string;
  ownerId: string;
  leadTimeWeeks: string;
  neededBy: string;
  expectedDate: string;
  status: ItemStatus;
  confirmedDate: string;
  notes: string;
  photoId: string;
}

function draftFrom(item: Item | undefined, params: URLSearchParams, personId: string): Draft {
  if (item) {
    return {
      title: item.title,
      type: item.type,
      jobId: item.jobId,
      stepId: item.stepId ?? '',
      tradeId: item.tradeId ?? '',
      waitingOn: item.waitingOn ?? '',
      ownerId: item.ownerId ?? '',
      leadTimeWeeks: item.leadTimeWeeks === undefined ? '' : String(item.leadTimeWeeks),
      neededBy: item.neededBy ?? '',
      expectedDate: item.expectedDate ?? '',
      status: item.status,
      confirmedDate: item.confirmedDate ?? '',
      notes: item.notes ?? '',
      photoId: item.photoId ?? '',
    };
  }
  const type = (params.get('type') as ItemType | null) ?? 'trade';
  return {
    title: '',
    type: ITEM_TYPE_LABELS[type] ? type : 'trade',
    jobId: params.get('job') ?? '',
    stepId: params.get('step') ?? '',
    tradeId: '',
    waitingOn: '',
    ownerId: personId,
    leadTimeWeeks: '',
    neededBy: '',
    expectedDate: '',
    status: 'to_do',
    confirmedDate: '',
    notes: '',
    photoId: params.get('photo') ?? '',
  };
}

/** Whole weeks, 0 or more; undefined for blank; null for nonsense. */
function parseWeeks(s: string): number | undefined | null {
  if (s.trim() === '') return undefined;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export default function ItemSheet() {
  const { id } = useParams();
  const isNew = !id;
  const api = useApi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { personId, role, today, offline } = useSession();

  const item = useQuery((api) => (id ? api.getItem(id) : undefined), [id]);
  const jobs = useQuery((api) => api.listJobs(), []);
  const people = useQuery((api) => api.listPeople(), []);
  const trades = useQuery((api) => api.listTrades(), []);
  const history = useQuery((api) => (id ? api.listActivity({ itemId: id }) : []), [id]);

  const [draft, setDraft] = useState<Draft>(() => draftFrom(item, params, personId));
  const [saved, setSaved] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A different item (or a fresh "new") starts a fresh draft. A new item's
  // owner defaults to the current person, who the provider applies from the
  // URL just after the first render, so the person is a dependency too.
  useEffect(() => {
    setDraft(draftFrom(item, params, personId));
    setSaved(false);
    setProblems([]);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, personId]);

  const job = jobs.find((j) => j.id === draft.jobId);
  const steps = useQuery((api) => (draft.jobId ? api.listSteps(draft.jobId) : []), [draft.jobId]);
  const forecast = useQuery((api) => (draft.jobId ? api.getForecast(draft.jobId) : undefined), [draft.jobId]);
  const shipment = useQuery((api) => (item?.shipmentId ? api.getShipment(item.shipmentId) : undefined), [item?.shipmentId]);
  const photo = useQuery((api) => (draft.photoId ? api.getPhoto(draft.photoId) : undefined), [draft.photoId]);
  // A defect asks for a photo: the job's newest few to pick from, or a link to take one.
  const jobPhotos = useQuery((api) => (draft.type === 'defect' && draft.jobId ? api.listPhotos(draft.jobId).slice(0, 6) : []), [draft.type, draft.jobId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(draftFrom(item, params, personId)), [draft, item, params, personId]);

  if (!isNew && !item) return <NotFound />;

  const step = steps.find((s) => s.id === draft.stepId);
  const stepForecast = step ? forecast?.steps[step.id] : undefined;
  const isBuild = job?.kind === 'build';
  const trade = trades.find((t) => t.id === draft.tradeId);
  const lead = parseWeeks(draft.leadTimeWeeks);
  const leadWeeks = lead ?? 0;

  // Needed-by: from the step when linked (the saved item's own figure when
  // nothing about the link changed, else the step's forecast start), else typed.
  const neededBy = step
    ? item && item.stepId === step.id && forecast?.items[item.id]?.neededBy
      ? forecast.items[item.id].neededBy
      : stepForecast?.forecastStart
    : draft.neededBy || undefined;
  const actBy = neededBy ? addCalendarWeeks(neededBy, -leadWeeks) : undefined;
  const actByPassed = !!actBy && actBy < today && draft.status !== 'done';
  const savedForecast = item ? forecast?.items[item.id] : undefined;
  const expectedFromShipment = shipment ? (savedForecast?.expected ?? shipment.eta) : undefined;

  const canDelete = !isNew && (role === 'admin' || role === 'partner');

  const validate = (): string[] => {
    const out: string[] = [];
    if (!draft.title.trim()) out.push('Give it a title.');
    if (!draft.jobId) out.push('Pick a job.');
    if (!step && !draft.neededBy) out.push(isBuild ? 'Pick a step, or set a needed-by date.' : 'Set a needed-by date.');
    if (lead === null) out.push('Lead time is whole weeks, 0 or more.');
    if (draft.status === 'confirmed' && draft.confirmedDate && draft.confirmedDate > today) out.push('The confirmed date is after today.');
    if (needsExpectedDate({ shipmentId: shipment?.id, expectedDate: draft.expectedDate || undefined }, draft.status)) out.push(BOOKED_NEEDS_DATE);
    return out;
  };

  const save = () => {
    const errs = validate();
    setProblems(errs);
    if (errs.length) return;
    const common = {
      title: draft.title.trim(),
      type: draft.type,
      stepId: step ? step.id : undefined,
      tradeId: trade ? trade.id : undefined,
      waitingOn: (trade ? trade.name : draft.waitingOn.trim()) || undefined,
      ownerId: draft.ownerId || undefined,
      leadTimeWeeks: lead ?? undefined,
      neededBy: step ? undefined : draft.neededBy || undefined,
      expectedDate: shipment ? undefined : draft.expectedDate || undefined,
      notes: draft.notes.trim() || undefined,
      photoId: draft.photoId || undefined,
    };
    if (isNew) {
      const input: NewItemInput = { ...common, jobId: draft.jobId, status: draft.status };
      const created = api.addItem(input);
      if (draft.status === 'confirmed') api.updateItemStatus(created.id, 'confirmed', draft.confirmedDate || today);
      navigate(`/waiting?job=${draft.jobId}`);
      return;
    }
    const before = item!;
    const patch: ItemPatch = { ...common, jobId: draft.jobId };
    if (draft.status === 'confirmed') patch.confirmedDate = draft.confirmedDate || before.confirmedDate || today;
    // Fields first, so a booking lands with its expected date already on it.
    api.updateItem(before.id, patch);
    if (draft.status !== before.status) {
      api.updateItemStatus(before.id, draft.status, draft.status === 'confirmed' ? draft.confirmedDate || today : undefined);
    }
    const after = api.getItem(before.id) ?? before;
    setDraft(draftFrom(after, params, personId));
    setSaved(true);
  };

  const cancel = () => {
    if (isNew) {
      navigate(draft.jobId ? `/waiting?job=${draft.jobId}` : '/waiting');
      return;
    }
    setDraft(draftFrom(item, params, personId));
    setProblems([]);
    setSaved(false);
  };

  const remove = () => {
    if (!item) return;
    const jobId = item.jobId;
    api.deleteItem(item.id);
    navigate(`/waiting?job=${jobId}`);
  };

  const dateLocked = offline; // dates need signal (UI_PLAN shared states)
  const needsSignal = <span className="sheet__needs-signal">Needs signal</span>;

  const actByFigure = actBy ? (
    <BigNumber
      size="hero"
      value={`Act by ${formatShort(actBy)}`}
      label={
        draft.status === 'done'
          ? 'Done'
          : `${relativeDate(actBy, today, { deadline: draft.status === 'to_do' })}${neededBy ? `: needed ${formatShort(neededBy)}${step ? ` for ${step.name}` : ''}, minus ${leadWeeks} week${leadWeeks === 1 ? '' : 's'}` : ''}`
      }
      tone={actByPassed && draft.status === 'to_do' ? 'late' : undefined}
      testId="item-act-by"
    />
  ) : (
    <BigNumber size="hero" value="No act-by yet" label={isBuild && !step ? 'Pick a step or set a needed-by date' : 'Set a needed-by date'} tone="muted" testId="item-act-by" />
  );

  const backTo = draft.jobId ? `/waiting?job=${draft.jobId}` : '/waiting';

  /** A row of pressed buttons in a segmented trough. */
  const pick = (key: string, label: string, pressed: boolean, onClick: () => void) => (
    <button key={key} type="button" className="seg__btn" aria-pressed={pressed} onClick={onClick} data-testid={key}>
      {label}
    </button>
  );

  return (
    <main className="page sheet" data-testid="item-sheet">
      <PageHeader
        title={isNew ? 'New item' : item!.title}
        meta={job ? `${job.name}, ${ITEM_TYPE_LABELS[draft.type]}` : ITEM_TYPE_LABELS[draft.type]}
        back={{ to: backTo, label: 'Waiting on' }}
      />

      <section className="sheet__figure" aria-label="Act by">
        {actByFigure}
        {savedForecast?.isLate && (
          <StatusText tone={isOverdue(savedForecast, today) ? 'late' : 'plain'} plain={!isOverdue(savedForecast, today)} testId="item-late">
            {savedForecast.expected ? `Expected ${formatShortRelative(savedForecast.expected, today)}` : `Needed ${formatShort(savedForecast.neededBy!)}, nothing expected`},{' '}
            {savedForecast.lateText}
          </StatusText>
        )}
      </section>

      <form
        className="sheet__form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor="item-title">
            Title
          </label>
          <input id="item-title" className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Book plasterer" data-testid="item-title" />
        </div>

        <div className="field">
          <span className="field__label" id="item-type-label">
            Type
          </span>
          <ItemTypePicker value={draft.type} onChange={(t) => set('type', t)} />
        </div>

        <div className="field">
          <span className="field__label" id="item-job-label">
            Job
          </span>
          <div className="seg sheet__seg" role="group" aria-labelledby="item-job-label">
            {jobs.map((j) =>
              pick(`item-job-${j.id}`, j.name, j.id === draft.jobId, () => {
                set('jobId', j.id);
                set('stepId', '');
              }),
            )}
          </div>
        </div>

        {isBuild && (
          <div className="field">
            <label className="field__label" htmlFor="item-step">
              Step
            </label>
            <select id="item-step" className="sheet__select" value={draft.stepId} onChange={(e) => set('stepId', e.target.value)} data-testid="item-step">
              <option value="">No step</option>
              {steps.map((s) => {
                const f = forecast?.steps[s.id];
                return (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {f?.forecastStart ? `, starts ${formatShortRelative(f.forecastStart, today)}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="item-trade">
            Waiting on
          </label>
          <div className="sheet__waiting">
            <select
              id="item-trade"
              className="sheet__select"
              value={draft.tradeId}
              onChange={(e) => {
                const t = trades.find((x) => x.id === e.target.value);
                set('tradeId', e.target.value);
                if (t) set('waitingOn', t.name);
              }}
              data-testid="item-trade"
            >
              <option value="">Someone else</option>
              {trades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type}){t.phone ? `, ${t.phone}` : ''}
                </option>
              ))}
            </select>
            {!trade && (
              <input
                className="input"
                value={draft.waitingOn}
                onChange={(e) => set('waitingOn', e.target.value)}
                placeholder="Council, a supplier, Dom"
                aria-label="Waiting on, free text"
                data-testid="item-waiting-on"
              />
            )}
            {trade?.phone && (
              <a className="btn btn--ghost btn--desktop sheet__ring" href={`tel:${trade.phone.replace(/\s+/g, '')}`} data-testid="item-ring">
                Ring {trade.name}, {trade.phone}
              </a>
            )}
          </div>
        </div>

        <div className="field">
          <span className="field__label" id="item-owner-label">
            Owner
          </span>
          <div className="seg sheet__seg" role="group" aria-labelledby="item-owner-label">
            {people.map((p) => pick(`item-owner-${p.id}`, p.id === personId ? `${p.shortName} (you)` : p.shortName, p.id === draft.ownerId, () => set('ownerId', p.id)))}
          </div>
        </div>

        <div className="sheet__row">
          <div className="field sheet__field--short">
            <label className="field__label" htmlFor="item-lead-time">
              Lead time, weeks
            </label>
            <input
              id="item-lead-time"
              className="input num"
              inputMode="numeric"
              value={draft.leadTimeWeeks}
              onChange={(e) => set('leadTimeWeeks', e.target.value)}
              placeholder="0"
              data-testid="item-lead-time"
            />
          </div>

          <div className="field">
            {step ? (
              <>
                <span className="field__label">Needed by</span>
                <p className="sheet__derived" data-testid="item-needed-by">
                  {neededBy ? formatLongRelative(neededBy, today, { deadline: draft.status !== 'done' }) : 'No date yet'}
                  <span className="sheet__derived-from">from step {step.name}</span>
                </p>
              </>
            ) : (
              <>
                <label className="field__label" htmlFor="item-needed-by">
                  Needed by
                </label>
                <input
                  id="item-needed-by"
                  className="input num"
                  type="date"
                  value={draft.neededBy}
                  onChange={(e) => set('neededBy', e.target.value)}
                  disabled={dateLocked}
                  data-testid="item-needed-by"
                />
                {dateLocked
                  ? needsSignal
                  : isISODate(draft.neededBy) && (
                      <span className="sheet__hint">{relativeDate(draft.neededBy, today, { deadline: draft.status !== 'done' })}</span>
                    )}
              </>
            )}
          </div>
        </div>

        <div className="field">
          {shipment ? (
            <>
              <span className="field__label">Expected</span>
              <p className="sheet__derived" data-testid="item-expected">
                {expectedFromShipment ? formatLongRelative(expectedFromShipment, today) : 'No ETA yet'}
                <span className="sheet__derived-from">
                  Comes from shipment:{' '}
                  <Link to={shipmentHref(shipment)} data-testid="item-shipment-link">
                    {shipment.name}
                  </Link>
                </span>
              </p>
            </>
          ) : (
            <>
              <label className="field__label" htmlFor="item-expected">
                Expected
              </label>
              <input
                id="item-expected"
                className="input num sheet__input--date"
                type="date"
                value={draft.expectedDate}
                onChange={(e) => set('expectedDate', e.target.value)}
                disabled={dateLocked}
                data-testid="item-expected"
              />
              {dateLocked ? needsSignal : isISODate(draft.expectedDate) && <span className="sheet__hint">{relativeDate(draft.expectedDate, today)}</span>}
            </>
          )}
        </div>

        <div className="field">
          <span className="field__label" id="item-status-label">
            Status
          </span>
          <div className="seg sheet__seg" role="group" aria-labelledby="item-status-label">
            {ITEM_STATUS_ORDER.map((st) => pick(`item-status-${st}`, ITEM_STATUS_LABELS[st], st === draft.status, () => set('status', st)))}
          </div>
        </div>

        {(draft.status === 'confirmed' || draft.status === 'done') && (
          <div className="field sheet__field--short">
            <label className="field__label" htmlFor="item-confirmed">
              Confirmed on
            </label>
            <input
              id="item-confirmed"
              className="input num sheet__input--date"
              type="date"
              value={draft.confirmedDate}
              onChange={(e) => set('confirmedDate', e.target.value)}
              disabled={dateLocked}
              data-testid="item-confirmed"
            />
            <span className="sheet__hint">{isISODate(draft.confirmedDate) ? relativeDate(draft.confirmedDate, today) : 'Blank means today'}</span>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="item-notes">
            Notes
          </label>
          <textarea id="item-notes" className="input sheet__textarea" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} data-testid="item-notes" />
        </div>

        {(photo || draft.type === 'defect') && (
          <div className="field">
            <span className="field__label">Photo</span>
            {photo ? (
              <span className="sheet__photo-row">
                <Link to={`/jobs/${photo.jobId}/photos?photo=${photo.id}`} className="sheet__photo" data-testid="item-photo-link">
                  <img src={photo.dataUrl} alt={`Photo taken ${formatDayMonth(photo.takenOn)}`} />
                  <span>Taken {formatShortRelative(photo.takenOn, today)}</span>
                </Link>
                <button type="button" className="btn btn--ghost btn--desktop" onClick={() => set('photoId', '')} data-testid="item-photo-clear">
                  Change photo
                </button>
              </span>
            ) : (
              <span className="sheet__photo-pick">
                {jobPhotos.length > 0 && (
                  <span className="sheet__photo-grid" role="group" aria-label="Pick a photo">
                    {jobPhotos.map((p) => (
                      <button key={p.id} type="button" className="sheet__photo-thumb" onClick={() => set('photoId', p.id)} data-testid={`item-photo-pick-${p.id}`}>
                        <img src={p.dataUrl} alt={`Photo taken ${formatDayMonth(p.takenOn)}`} />
                      </button>
                    ))}
                  </span>
                )}
                {draft.jobId && (
                  <Link to={`/jobs/${draft.jobId}/upload${item ? `?item=${item.id}` : ''}`} className="btn btn--desktop" data-testid="item-photo-take">
                    Take a photo
                  </Link>
                )}
              </span>
            )}
          </div>
        )}

        {problems.length > 0 && (
          <ul className="sheet__problems" role="alert" data-testid="item-problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <div className="sheet__actions">
          <button type="submit" className="btn btn--primary" disabled={!isNew && !dirty} data-testid="item-save">
            {isNew ? `Add to ${job?.name ?? 'the job'}` : 'Save'}
          </button>
          <button type="button" className="btn" onClick={cancel} data-testid="item-cancel">
            {isNew ? 'Cancel' : dirty ? 'Undo' : 'Back'}
          </button>
          {saved && !dirty && (
            <span className="sheet__saved" role="status" data-testid="item-saved">
              Saved
            </span>
          )}
          {canDelete && !confirmDelete && (
            <button type="button" className="btn btn--ghost sheet__delete" onClick={() => setConfirmDelete(true)} data-testid="item-delete">
              Delete
            </button>
          )}
          {canDelete && confirmDelete && (
            <span className="sheet__delete-confirm">
              <span>Delete {item!.title}?</span>
              <button type="button" className="btn btn--desktop" onClick={remove} data-testid="item-delete-confirm">
                Delete it
              </button>
              <button type="button" className="btn btn--desktop" onClick={() => setConfirmDelete(false)} data-testid="item-delete-keep">
                Keep it
              </button>
            </span>
          )}
        </div>
      </form>

      {!isNew && (
        <section className="sheet__history" aria-label="History" data-testid="item-history">
          <h2 className="sheet__h2">History</h2>
          {history.length === 0 ? (
            <p className="sheet__quiet">Nothing yet.</p>
          ) : (
            <ul className="sheet__history-list">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="sheet__stamp num">
                    {formatDayMonth(h.at.slice(0, 10))} {formatStamp(h.at).split(' ')[1]}
                  </span>{' '}
                  {h.text} <span className="sheet__who">({people.find((p) => p.id === h.personId)?.shortName ?? h.personId})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
