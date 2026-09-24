/**
 * The header every job page starts with (Dom's brief, change 1).
 *
 * For partners and admin the job's name is the page title and also a
 * dropdown of every job on the side, builds then design jobs as on the
 * Overview. Picking one opens the same page on that job when it has one
 * (Program to Program), else that job's overview. Builder and site job pages
 * keep the plain title, unchanged.
 *
 * The title is a button inside the h1 (so the heading still reads as the
 * job's name) that opens a Thick Liquid Glass menu growing out of it
 * (DESIGN.md "Material": the web's glassEffectID morph). The menu is a
 * listbox: arrow keys, Home and End, type-ahead, Enter or Space to pick,
 * Escape or a tap outside to close, focus back on the title; the current
 * job is aria-selected with a checkmark and overdue counts are in words.
 *
 *   <JobHeader job={job} section="program" meta="Framing stage" back={{ to: `/jobs/${job.id}`, label: job.name }} />
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useSession } from '../data/context';
import type { Job } from '../domain/types';
import { PageHeader } from './PageHeader';
import { jobSectionHref, jobSwitcherFor, type JobSection } from './nav';

interface Props {
  job: Job;
  section: JobSection;
  /** Title for roles without the switcher; defaults to the job's name. */
  title?: string;
  meta?: ReactNode;
  /** Meta for roles with the switcher, where the title is the job's name; defaults to `meta`. */
  switchMeta?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  children?: ReactNode;
}

export function JobHeader({ job, section, title, meta, switchMeta, actions, back, children }: Props) {
  const { role } = useSession();
  if (!jobSwitcherFor(role)) {
    return (
      <PageHeader title={title ?? job.name} meta={meta} actions={actions} back={back}>
        {children}
      </PageHeader>
    );
  }
  // Under the switcher the back link on a job sub-page would repeat the name
  // right above it; it names where it goes instead.
  const switchBack = back && section !== 'overview' && back.to === `/jobs/${job.id}` ? { to: back.to, label: 'Job overview' } : back;
  return (
    <PageHeader title={job.name} titleSlot={<JobSwitcher job={job} section={section} />} meta={switchMeta ?? meta} actions={actions} back={switchBack}>
      {children}
    </PageHeader>
  );
}

function ChevronIcon() {
  return (
    <svg className="job-switch__chevron" viewBox="0 0 26 26" width="26" height="26" aria-hidden="true">
      <circle className="job-switch__chevron-disc" cx="13" cy="13" r="13" />
      <path d="M8.6 11.2 13 15.6l4.4-4.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="job-menu__check" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A pick navigates to another page, which mounts a new switcher: it takes focus back. */
let refocusAfterPick = false;

/** How long type-ahead keeps adding keys to one search. */
const TYPEAHEAD_MS = 600;
/** What the open menu leaves clear at the foot of the viewport (the phone tab bar and a margin). */
const FOOT_CLEARANCE = 96;

interface Row {
  job: Job;
  overdue: number;
}

function JobSwitcher({ job, section }: { job: Job; section: JobSection }) {
  const navigate = useNavigate();
  const jobs = useQuery((api) => api.listJobs(), []);
  // The Overview's red cue travels into the list as words: "Park Rd (2 overdue)".
  const overdue = useQuery((api) => new Map(api.getOverviewRows().map((r) => [r.jobId, r.overdue])), []);

  const { groups, rows } = useMemo(() => {
    const row = (j: Job): Row => {
      return { job: j, overdue: overdue.get(j.id) ?? 0 };
    };
    const builds = jobs.filter((j) => j.kind === 'build').map(row);
    const designs = jobs.filter((j) => j.kind === 'design').map(row);
    // A job reached by a deep link is always in the list, so the menu shows it.
    const extra = jobs.some((j) => j.id === job.id) ? [] : [row(job)];
    const grouped: { label?: string; rows: Row[] }[] =
      builds.length > 0 && designs.length > 0
        ? [...(extra.length ? [{ rows: extra }] : []), { label: 'Builds', rows: builds }, { label: 'Design', rows: designs }]
        : [{ rows: [...extra, ...builds, ...designs] }];
    return { groups: grouped, rows: grouped.flatMap((g) => g.rows) };
  }, [jobs, overdue, job]);

  const uid = useId();
  const listId = `${uid}-list`;
  const hintId = `${uid}-hint`;
  const optionId = (i: number) => `${uid}-opt-${i}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  // closed -> open -> closing (the exit fade) -> closed
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<CSSProperties>({});
  const open = phase === 'open';
  const current = Math.max(0, rows.findIndex((r) => r.job.id === job.id));

  useEffect(() => {
    if (refocusAfterPick) {
      refocusAfterPick = false;
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const close = useCallback((refocus: boolean) => {
    setPhase((p) => (p === 'open' ? 'closing' : p));
    if (refocus) buttonRef.current?.focus({ preventScroll: true });
  }, []);

  const show = () => {
    const btn = buttonRef.current;
    const root = rootRef.current;
    if (btn && root) {
      const r = btn.getBoundingClientRect();
      const rootLeft = root.getBoundingClientRect().left;
      const chevron = btn.querySelector('.job-switch__chevron')?.getBoundingClientRect();
      // Grow out of the title: the morph's origin is the chevron, just above the menu.
      const originX = chevron ? Math.min(chevron.left + chevron.width / 2 - rootLeft, 320) : 24;
      const room = window.innerHeight - r.bottom - FOOT_CLEARANCE;
      setPlace({ '--job-menu-origin-x': `${Math.round(originX)}px`, maxHeight: `${Math.max(220, Math.round(room))}px` } as CSSProperties);
    }
    setActive(current);
    setPhase('open');
  };

  // Focus follows the active option; the menu scrolls to keep it in view.
  useLayoutEffect(() => {
    if (!open) return;
    const el = document.getElementById(optionId(active));
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // A tap outside closes it. Focus goes back to the title unless the tap landed on something that takes focus itself.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t && rootRef.current?.contains(t)) return;
      const focusable = !!t?.closest('a[href], button, input, select, textarea, [tabindex]');
      close(false);
      if (focusable) return;
      // The tap's own mousedown would blur the title again, so focus it once the tap has finished (its click).
      const refocus = () => buttonRef.current?.focus({ preventScroll: true });
      document.addEventListener('click', refocus, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', refocus, { capture: true }), 1000);
    };
    document.addEventListener('pointerdown', onDown, true);
    // The layer budget (DESIGN.md "Material"): the open menu is a blurred
    // layer, so a sticky glass strip under it (.glass--yields) goes static.
    document.documentElement.dataset.lgMenu = 'open';
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      delete document.documentElement.dataset.lgMenu;
    };
  }, [open, close]);

  // The exit fade ends in closed even if animationend never fires (reduced motion, a background tab).
  useEffect(() => {
    if (phase !== 'closing') return;
    const t = window.setTimeout(() => setPhase('closed'), 220);
    return () => window.clearTimeout(t);
  }, [phase]);

  const pick = (i: number) => {
    const next = rows[i]?.job;
    close(true);
    if (!next || next.id === job.id) return;
    refocusAfterPick = true;
    navigate(jobSectionHref(section, next));
  };

  const typeAhead = (key: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at < TYPEAHEAD_MS ? t.text + key.toLowerCase() : key.toLowerCase();
    t.at = now;
    // Repeating one letter steps through the jobs that start with it.
    const cycling = t.text.length > 1 && [...t.text].every((c) => c === t.text[0]);
    const needle = cycling ? t.text[0] : t.text;
    const matches = (r: Row) => {
      const name = r.job.name.toLowerCase();
      return name.startsWith(needle) || name.split(/[\s-]+/).some((w) => w.startsWith(needle));
    };
    const from = cycling || t.text.length === 1 ? active + 1 : active;
    for (let k = 0; k < rows.length; k++) {
      const i = (from + k) % rows.length;
      if (matches(rows[i])) {
        setActive(i);
        return;
      }
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = rows.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        setActive((a) => Math.min(last, a + 1));
        break;
      case 'ArrowUp':
        setActive((a) => Math.max(0, a - 1));
        break;
      case 'Home':
      case 'PageUp':
        setActive(0);
        break;
      case 'End':
      case 'PageDown':
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        if (e.key === ' ' && typed.current.text && Date.now() - typed.current.at < TYPEAHEAD_MS) {
          typeAhead(' ');
          break;
        }
        pick(active);
        break;
      case 'Escape':
        close(true);
        break;
      case 'Tab':
        close(true);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          typeAhead(e.key);
          break;
        }
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      show();
    }
  };

  let index = -1;
  return (
    <div className="job-switch" data-testid="job-switch" data-open={open || undefined} ref={rootRef}>
      <h1 className="page-header__title job-switch__title">
        <button
          ref={buttonRef}
          type="button"
          className="job-switch__name"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-describedby={hintId}
          data-value={job.id}
          data-testid="job-switcher"
          onClick={() => (open ? close(true) : show())}
          onKeyDown={onButtonKey}
        >
          <span className="job-switch__text">{job.name}</span>
          <ChevronIcon />
        </button>
      </h1>
      <span id={hintId} hidden>
        Switch job
      </span>
      {phase !== 'closed' && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Switch job"
          tabIndex={-1}
          className="job-menu glass glass--thick glass--float"
          data-state={phase}
          data-testid="job-switcher-menu"
          style={place}
          onKeyDown={onListKey}
          onAnimationEnd={() => phase === 'closing' && setPhase('closed')}
        >
          {groups.map((g, gi) => {
            const options = g.rows.map((r) => {
              index += 1;
              const i = index;
              const selected = r.job.id === job.id;
              return (
                <div
                  key={r.job.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  className="job-menu__option"
                  data-active={i === active || undefined}
                  data-value={r.job.id}
                  data-testid={`job-switcher-${r.job.id}`}
                  onClick={() => pick(i)}
                  onPointerMove={() => i !== active && setActive(i)}
                >
                  <span className="job-menu__mark">{selected && <CheckIcon />}</span>
                  <span className="job-menu__name">{r.job.name}</span>
                  {r.overdue > 0 && <span className="job-menu__overdue">{` (${r.overdue} overdue)`}</span>}
                </div>
              );
            });
            if (!g.label) return <div key={`g${gi}`} role="presentation">{options}</div>;
            const headId = `${uid}-group-${gi}`;
            return (
              <div key={g.label} role="group" aria-labelledby={headId} className="job-menu__group" data-group={g.label}>
                <div id={headId} role="presentation" className="job-menu__head">
                  {g.label}
                </div>
                {options}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
