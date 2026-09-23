/**
 * Daily notes (UI_PLAN 3.17): a dated one-line diary per job.
 *
 * Phone (Alec, Raff): today's entry first, as a page of the diary (a big text
 * box, weather and who-was-on-site as buttons, today's photos, one hi-vis
 * Save), then earlier days grouped by week. Desktop (Dominic, the partners):
 * the same days as a table with the entry in a side panel. Alec, Raff and
 * Dominic write; the partners read. A save without signal keeps the note on
 * the phone with the clock and the words "waiting to send"; the flag clears
 * by itself when signal returns. Nothing here has a price.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { DailyNote } from '../domain/types';
import { addCalendarDays, formatShort, formatWeekRange, lastMonday, relativeDate } from '../domain/dates';
import { NoteEntry, weatherLabel, type NoteDraft } from '../components/NoteEntry';
import { ClockGlyph, noSignal } from '../components/QueueBadge';
import { useLayout } from '../shell/AppShell';
import { JobHeader } from '../shell/JobHeader';
import NotFound from './NotFound';
import './dailyNotes.css';

interface WeekGroup {
  monday: string;
  label: string;
  notes: DailyNote[];
}

/** "This week, 14-18 Sep" / "Last week, 7-11 Sep" / "Week of 31 Aug-4 Sep". */
export function groupByWeek(notes: DailyNote[], today: string): WeekGroup[] {
  const thisMonday = lastMonday(today);
  const lastWeekMonday = addCalendarDays(thisMonday, -7);
  const groups = new Map<string, WeekGroup>();
  for (const n of notes) {
    const monday = lastMonday(n.date);
    let g = groups.get(monday);
    if (!g) {
      const range = formatWeekRange(monday);
      const label = monday === thisMonday ? `This week, ${range}` : monday === lastWeekMonday ? `Last week, ${range}` : `Week of ${range}`;
      g = { monday, label, notes: [] };
      groups.set(monday, g);
    }
    g.notes.push(n);
  }
  return [...groups.values()].sort((a, b) => (a.monday < b.monday ? 1 : -1));
}

/** "Overcast. On site: Alec, Cladder." */
function conditionsWords(n: DailyNote, whoName: (id: string) => string | undefined): string {
  const parts: string[] = [];
  const w = weatherLabel(n.weather);
  if (w) parts.push(w);
  const who = (n.onSite ?? []).map(whoName).filter(Boolean);
  if (who.length) parts.push(`On site: ${who.join(', ')}`);
  return parts.join('. ') + (parts.length ? '.' : '');
}

export default function DailyNotes() {
  const { id = '' } = useParams();
  const api = useApi();
  const { role, today, offline, personId } = useSession();
  const layout = useLayout();
  const canWrite = role === 'admin' || role === 'builder' || role === 'site';

  const data = useQuery(
    (api) => {
      const job = api.getJob(id);
      if (!job) return undefined;
      const memberships = api.listMemberships();
      const roleOf = (pid: string) => memberships.find((m) => m.personId === pid)?.role;
      const people = api.listPeople();
      const trades = api.listTrades();
      // Trades around this fortnight: the trade types of steps running within
      // two weeks of today (and what those steps need). The rest sit behind
      // "More trades". Steps are visible to every role, unlike trade items.
      const forecast = api.getForecast(id);
      const from = addCalendarDays(today, -14);
      const to = addCalendarDays(today, 14);
      const nearSteps = api.listSteps(id).filter((st) => {
        const sf = forecast?.steps[st.id];
        return !!sf && sf.forecastStart <= to && sf.forecastEnd >= from;
      });
      const nearIds = new Set(nearSteps.map((st) => st.id));
      const nearTypes = new Set<string>();
      for (const st of nearSteps) if (st.tradeType) nearTypes.add(st.tradeType.toLowerCase());
      for (const r of api.listRequirements(id)) if (nearIds.has(r.stepId) && r.tradeType) nearTypes.add(r.tradeType.toLowerCase());
      return {
        job,
        notes: api.listDailyNotes(id),
        people,
        /** The people who go to site: site, builder and admin roles. */
        sitePeople: people.filter((p) => ['site', 'builder', 'admin'].includes(roleOf(p.id) ?? '')),
        trades,
        jobTrades: trades.filter((t) => nearTypes.has(t.type.toLowerCase())),
        otherTrades: trades.filter((t) => !nearTypes.has(t.type.toLowerCase())),
        todayPhotos: api.listPhotos(id, { takenOn: today, uploadedById: personId }),
      };
    },
    [id, today, personId],
  );

  // Notes saved without signal send themselves once it is back.
  useEffect(() => {
    if (!offline) api.flushDailyNotes();
  }, [api, offline]);

  const [savedId, setSavedId] = useState<string | null>(null);

  const mine = useMemo(() => data?.notes.find((n) => n.date === today && n.authorId === personId), [data?.notes, today, personId]);
  const listed = useMemo(() => (data?.notes ?? []).filter((n) => n.id !== mine?.id), [data?.notes, mine?.id]);
  const groups = useMemo(() => groupByWeek(listed, today), [listed, today]);

  if (!data) return <NotFound />;
  const { job, people, sitePeople, trades, jobTrades, otherTrades, todayPhotos } = data;

  const nameOf = (pid: string) => people.find((p) => p.id === pid)?.shortName;
  const whoName = (wid: string) => nameOf(wid) ?? trades.find((t) => t.id === wid)?.type;

  const save = (draft: NoteDraft) => {
    const queued = noSignal(offline);
    const note = mine
      ? api.updateDailyNote(mine.id, { text: draft.text, weather: draft.weather, onSite: draft.onSite, photoIds: draft.photoIds, queued })
      : api.addDailyNote({ jobId: job.id, text: draft.text, weather: draft.weather, onSite: draft.onSite, photoIds: draft.photoIds, queued });
    setSavedId(note.id);
  };

  // The words under Save come from the saved record, so they stay true after a reload.
  const saved = savedId ? data.notes.find((n) => n.id === savedId) : mine;
  const status = saved ? (
    saved.queued ? (
      <span className="notes__queued" data-testid="note-queued">
        <ClockGlyph />
        Saved on this phone, waiting to send.
      </span>
    ) : (
      <span data-testid="note-saved">Saved{saved.id === savedId ? '' : ` ${relativeDate(saved.date, today)}`}.</span>
    )
  ) : undefined;

  const photoHref = `/jobs/${job.id}/upload?return=/jobs/${job.id}/notes`;
  const entry = canWrite ? (
    <NoteEntry
      date={today}
      existing={mine}
      people={sitePeople}
      jobTrades={jobTrades}
      otherTrades={otherTrades}
      todayPhotos={todayPhotos}
      photoHref={photoHref}
      onSave={save}
      status={status}
    />
  ) : null;

  const empty = listed.length === 0 && !mine;
  const photoWords = (n: DailyNote) => (n.photoIds?.length ? `${n.photoIds.length} photo${n.photoIds.length === 1 ? '' : 's'}` : '');

  const list =
    layout === 'phone' ? (
      <section className="notes__list" aria-label="Earlier notes" data-testid="notes-list">
        {empty && (
          <p className="notes__empty" data-testid="notes-empty">
            No notes yet. One line a day is plenty.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.monday} className="notes__week" data-testid={`notes-week-${g.monday}`}>
            <h2 className="notes__week-title">{g.label}</h2>
            <ul className="notes__days">
              {g.notes.map((n) => {
                const cond = conditionsWords(n, whoName);
                return (
                  <li key={n.id} className="notes__day" data-testid={`note-${n.id}`}>
                    <div className="notes__day-head">
                      <span className="notes__day-date display">{formatShort(n.date)}</span>
                      <span className="notes__day-who">
                        {nameOf(n.authorId) ?? 'site'}
                        , {relativeDate(n.date, today)}
                      </span>
                      {n.queued && (
                        <span className="notes__queued notes__day-queued">
                          <ClockGlyph />
                          waiting to send
                        </span>
                      )}
                    </div>
                    {cond && <p className="notes__day-cond">{cond}</p>}
                    <p className="notes__day-text">{n.text}</p>
                    {photoWords(n) && (
                      <Link to={`/jobs/${job.id}/photos?photo=${n.photoIds![0]}`} className="notes__day-photos">
                        {photoWords(n)}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    ) : (
      <section className="notes__list" aria-label="Notes" data-testid="notes-list">
        {empty ? (
          <p className="notes__empty" data-testid="notes-empty">
            No notes yet. One line a day is plenty.
          </p>
        ) : (
          <table className="table notes__table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Note</th>
                <th scope="col">Weather</th>
                <th scope="col">On site</th>
                <th scope="col">By</th>
              </tr>
            </thead>
            {(mine ? [{ monday: 'mine', label: 'Today', notes: [mine] }, ...groups] : groups).map((g) => (
              <tbody key={g.monday} data-testid={g.monday === 'mine' ? undefined : `notes-week-${g.monday}`}>
                <tr className="notes__week-row">
                  <th scope="rowgroup" colSpan={5}>
                    {g.label}
                  </th>
                </tr>
                {g.notes.map((n) => (
                  <tr key={n.id} data-testid={`note-${n.id}`}>
                    <td className="notes__cell-day">
                      <span className="display notes__day-date">{formatShort(n.date)}</span>
                      <span className="notes__day-who">{relativeDate(n.date, today)}</span>
                      {n.queued && (
                        <span className="notes__queued notes__day-queued">
                          <ClockGlyph />
                          waiting to send
                        </span>
                      )}
                    </td>
                    <td className="notes__cell-text">
                      {n.text}
                      {photoWords(n) && (
                        <>
                          {' '}
                          <Link to={`/jobs/${job.id}/photos?photo=${n.photoIds![0]}`}>{photoWords(n)}</Link>
                        </>
                      )}
                    </td>
                    <td>{weatherLabel(n.weather) ?? ''}</td>
                    <td>{(n.onSite ?? []).map(whoName).filter(Boolean).join(', ')}</td>
                    <td>{nameOf(n.authorId) ?? 'site'}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
      </section>
    );

  const noteCount = `${data.notes.length} note${data.notes.length === 1 ? '' : 's'}`;

  return (
    <main className={`page notes notes--${layout}`} data-testid="notes">
      <JobHeader
        job={job}
        section="notes"
        title="Daily notes"
        meta={`${job.name}, ${noteCount}`}
        switchMeta={`Daily notes, ${noteCount}`}
        back={{ to: `/jobs/${job.id}`, label: job.name }}
      />
      {layout === 'phone' ? (
        <>
          {entry && (
            <section className="notes__today" aria-label="Today" data-testid="note-today">
              {entry}
            </section>
          )}
          {list}
        </>
      ) : (
        <div className="notes__cols">
          {list}
          {entry && (
            <aside className="notes__panel" aria-label="Today" data-testid="note-today">
              {entry}
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
