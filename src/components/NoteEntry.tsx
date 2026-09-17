/**
 * One day's diary entry, as a form: a big text box, the weather as buttons,
 * who was on site as chips (people first, then the trades this job books),
 * today's photos, and Save. Used at the top of the phone notes screen and in
 * the desktop side panel. It knows nothing about the queue: the screen says
 * whether the save went through or is waiting on the phone.
 *
 *   Thursday 17 September
 *   [ What happened on site today?                    ]
 *   Weather   [Fine] [Overcast] [Rain] [Windy] [Hot]
 *   On site   [Alec] [Raff] [Roof plumber] [Cladder] ... [More trades]
 *   Photos    [thumb] [thumb]  Add a photo
 *   [Save today's note]
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { DailyNote, Person, Photo, Trade, Weather } from '../domain/types';
import { dateInWords } from '../screens/AlecToday';
import './noteEntry.css';

export const WEATHER: { key: Weather; label: string }[] = [
  { key: 'fine', label: 'Fine' },
  { key: 'overcast', label: 'Overcast' },
  { key: 'rain', label: 'Rain' },
  { key: 'wind', label: 'Windy' },
  { key: 'hot', label: 'Hot' },
];

export function weatherLabel(key?: Weather): string | undefined {
  return WEATHER.find((w) => w.key === key)?.label;
}

export interface NoteDraft {
  text: string;
  weather?: Weather;
  onSite: string[];
  photoIds: string[];
}

export interface NoteEntryProps {
  date: string;
  /** Today's note by this person, when there is one: the form edits it. */
  existing?: DailyNote;
  people: Person[];
  /** Trades this job has booked or is booking: shown first. */
  jobTrades: Trade[];
  /** The rest of the side's trades, behind "More trades". */
  otherTrades: Trade[];
  /** Photos this person uploaded today: they attach to the note on save. */
  todayPhotos: Photo[];
  /** Where "Add a photo" goes (the upload screen, coming back here). */
  photoHref: string;
  onSave: (draft: NoteDraft) => void;
  /** Words under the button after a save: "Saved." or the queued words. */
  status?: ReactNode;
  /** The whole day in words as the heading; off in the desktop panel where the panel has its own. */
  heading?: boolean;
}

export function NoteEntry({ date, existing, people, jobTrades, otherTrades, todayPhotos, photoHref, onSave, status, heading = true }: NoteEntryProps) {
  const [text, setText] = useState(existing?.text ?? '');
  const [weather, setWeather] = useState<Weather | undefined>(existing?.weather);
  const [onSite, setOnSite] = useState<string[]>(existing?.onSite ?? []);
  const [moreTrades, setMoreTrades] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // A different day or a different saved note re-seeds the draft.
  useEffect(() => {
    setText(existing?.text ?? '');
    setWeather(existing?.weather);
    setOnSite(existing?.onSite ?? []);
    setProblem(null);
  }, [existing?.id, existing?.text, existing?.weather, existing?.onSite?.join(','), date]);

  const toggle = (id: string) => setOnSite((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const chosenOthers = otherTrades.filter((t) => onSite.includes(t.id));
  const shownOthers = moreTrades ? otherTrades : chosenOthers;

  const save = () => {
    if (!text.trim()) {
      setProblem('Write a line first.');
      return;
    }
    setProblem(null);
    onSave({ text: text.trim(), weather, onSite, photoIds: todayPhotos.map((p) => p.id) });
  };

  return (
    <form
      className="note-entry"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {heading && <h2 className="note-entry__day display">{dateInWords(date)}</h2>}
      <label className="sr-only" htmlFor="note-text">
        Today's note
      </label>
      <textarea
        id="note-text"
        className="note-entry__text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What happened on site today?"
        rows={4}
        data-testid="note-text"
      />

      <div className="note-entry__group" role="radiogroup" aria-label="Weather">
        <span className="note-entry__label">Weather</span>
        <div className="note-entry__weather">
          {WEATHER.map((w) => {
            const chosen = weather === w.key;
            return (
              <button
                key={w.key}
                type="button"
                role="radio"
                aria-checked={chosen}
                className={`note-entry__chip${chosen ? ' note-entry__chip--chosen' : ''}`}
                onClick={() => setWeather(chosen ? undefined : w.key)}
                data-testid={`note-weather-${w.key}`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="note-entry__group" role="group" aria-label="On site">
        <span className="note-entry__label">On site</span>
        <div className="note-entry__chips">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={onSite.includes(p.id)}
              className={`note-entry__chip${onSite.includes(p.id) ? ' note-entry__chip--chosen' : ''}`}
              onClick={() => toggle(p.id)}
              data-testid={`note-onsite-${p.id}`}
            >
              {p.shortName}
            </button>
          ))}
          {jobTrades.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={onSite.includes(t.id)}
              className={`note-entry__chip${onSite.includes(t.id) ? ' note-entry__chip--chosen' : ''}`}
              onClick={() => toggle(t.id)}
              data-testid={`note-onsite-${t.id}`}
            >
              {t.type}
            </button>
          ))}
          {shownOthers.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={onSite.includes(t.id)}
              className={`note-entry__chip${onSite.includes(t.id) ? ' note-entry__chip--chosen' : ''}`}
              onClick={() => toggle(t.id)}
              data-testid={`note-onsite-${t.id}`}
            >
              {t.type}
            </button>
          ))}
          {otherTrades.length > chosenOthers.length && (
            <button type="button" className="note-entry__chip note-entry__chip--more" onClick={() => setMoreTrades((m) => !m)} data-testid="note-more-trades">
              {moreTrades ? 'Fewer trades' : `More trades (${otherTrades.length - chosenOthers.length})`}
            </button>
          )}
        </div>
      </div>

      <div className="note-entry__group">
        <span className="note-entry__label">Photos</span>
        <div className="note-entry__photos">
          {todayPhotos.map((p) => (
            <img key={p.id} src={p.dataUrl} alt="" className="note-entry__thumb" data-testid={`note-photo-${p.id}`} />
          ))}
          <a className="note-entry__add-photo" href={`#${photoHref}`} data-testid="note-add-photo">
            {todayPhotos.length ? 'Add another photo' : 'Add a photo'}
          </a>
        </div>
      </div>

      {problem && (
        <p className="note-entry__problem" role="alert" data-testid="note-problem">
          {problem}
        </p>
      )}
      <div className="note-entry__save">
        <button type="submit" className="btn btn--primary note-entry__button" data-testid="note-save">
          {existing ? 'Save changes' : "Save today's note"}
        </button>
        {status && (
          <span className="note-entry__status" aria-live="polite">
            {status}
          </span>
        )}
      </div>
    </form>
  );
}
