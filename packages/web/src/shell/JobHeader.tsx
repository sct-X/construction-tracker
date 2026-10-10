/**
 * The header every job page starts with (v1 JobHeader, Dom's brief change 1):
 * an iOS back link, the job's name as the Large Title and a menu of every job
 * on the side (the job switcher), then the job's tabs from the route table.
 *
 * The title is a button inside the h1 that opens a Thick Liquid Glass listbox
 * growing out of it (v1 "job switcher morph"): Builds then Design, the current
 * job checked, overdue counts in words ("(4 overdue)"). Arrow keys, Home/End,
 * type-ahead, Enter or Space pick; Escape, Tab or a tap outside close it and
 * focus returns to the title. Picking a job opens the same tab on it when it
 * has one (Program to Program), else its home.
 *
 * A deep link to a job on the other side switches the side (once per route);
 * the side switcher itself leaves a job page, so no screen mixes two sides.
 * The tabs are a floating Regular glass capsule on the phone (sticky under the
 * nav bar) and an underlined strip in flow on the desktop.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { OverviewRow } from '@ct/core';
import { useData } from '../data/DataContext';
import { hashPath, href } from '../app/router';
import type { RouteDef } from '../app/routes';
import { activeTabPath, fillPath, jobHome, jobTabs, switchJobHref, tabLabel } from '../app/jobNav';
import { ROUTES } from '../app/routes';

type JobRow = Pick<OverviewRow, 'jobId' | 'sideId' | 'name' | 'kind' | 'path' | 'overdue' | 'stageLabel'>;

export function JobHeader(props: { jobId: string; job: JobRow | null; sideJobs: JobRow[]; current: RouteDef | undefined; loading: boolean; phone: boolean }) {
  const { job, sideJobs, current, jobId, phone } = props;
  const { sideId, setSideId } = useData();
  const synced = useRef<string | null>(null);
  const routeKey = `${jobId}|${current?.path ?? ''}`;

  useEffect(() => {
    if (!job || synced.current === routeKey) return;
    // Only while this job's route is still the one showing (a side switch may have just replaced it).
    if (!hashPath().startsWith(`/jobs/${encodeURIComponent(jobId)}`)) return;
    synced.current = routeKey;
    if (sideId && job.sideId !== sideId) setSideId(job.sideId);
  }, [job, jobId, routeKey, sideId, setSideId]);

  // On the phone the tab capsule scrolls sideways: keep the current tab in view.
  const tabsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const strip = tabsRef.current;
    const cur = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !cur) return;
    const left = cur.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
    if (left < strip.scrollLeft || left + cur.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = Math.max(0, left - 16);
  }, [routeKey, job]);

  if (!job) return props.loading ? <div className="jobbar-loading" aria-hidden="true" /> : null;

  const tabs = jobTabs(job.kind);
  const active = activeTabPath(current);
  const home = tabs[0];
  const back = backLink(job, current, active, home);
  const meta = job.kind === 'design' ? ['Design', job.path, job.stageLabel].filter(Boolean).join(', ') : null;

  return (
    <div className="jobhead" data-testid="job-bar">
      <header className="page-header">
        <a className="page-header__back" href={back.href} data-testid="back">
          {back.label}
        </a>
        <div className="page-header__row">
          <div className="page-header__lead">
            <JobSwitcher job={job} jobs={sideJobs} current={current} heading={!current?.ownHeading} />
            {meta && <p className="page-header__meta">{meta}</p>}
          </div>
        </div>
      </header>
      <nav ref={tabsRef} className={phone ? 'job__tabs glass glass--regular glass--float glass--yields' : 'job__tabs'} aria-label={`${job.name} pages`} data-testid="job-tabs">
        {tabs.map((t) => (
          <a
            key={t.path}
            className={phone ? 'job__tab lg-press' : 'job__tab'}
            href={href(fillPath(t.path, { jobId }))}
            aria-current={t.path === active ? 'page' : undefined}
            data-testid={`job-tab-${tabLabel(t).toLowerCase().replace(/\s+/g, '-')}`}
          >
            {tabLabel(t)}
          </a>
        ))}
      </nav>
    </div>
  );
}

/** Home tab: back to the Overview. Another tab: back to the job's home. A deeper page: back to its tab. */
function backLink(job: JobRow, current: RouteDef | undefined, active: string | null, home: RouteDef | undefined): { href: string; label: string } {
  if (current?.parent) {
    const parent = ROUTES.find((r) => r.path === current.parent);
    if (parent) return { href: href(fillPath(parent.path, { jobId: job.jobId })), label: tabLabel(parent) };
  }
  if (!home || active === home.path) return { href: href('/'), label: 'Overview' };
  return { href: jobHome(job), label: job.kind === 'design' ? 'Checklist' : 'Job overview' };
}

function ChevronIcon() {
  return (
    <svg className="job-switch__chevron" viewBox="0 0 26 26" width="26" height="26" aria-hidden="true" focusable="false">
      <circle className="job-switch__chevron-disc" cx="13" cy="13" r="13" />
      <path d="M8.6 11.2 13 15.6l4.4-4.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="job-menu__check" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M5 12.5 10 17.5 19 6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** How long type-ahead keeps adding keys to one search. */
const TYPEAHEAD_MS = 600;
/** What the open menu leaves clear at the foot of the viewport (the phone tab bar and a margin). */
const FOOT_CLEARANCE = 96;

export function JobSwitcher({ job, jobs, current, heading }: { job: JobRow; jobs: JobRow[]; current: RouteDef | undefined; heading: boolean }) {
  const { groups, rows } = useMemo(() => {
    const builds = jobs.filter((j) => j.kind === 'build');
    const design = jobs.filter((j) => j.kind === 'design');
    // A job reached by a deep link is always in the list, so the menu shows it.
    const extra = jobs.some((j) => j.jobId === job.jobId) ? [] : [job];
    const grouped: { label?: string; rows: JobRow[] }[] =
      builds.length > 0 && design.length > 0
        ? [...(extra.length ? [{ rows: extra }] : []), { label: 'Builds', rows: builds }, { label: 'Design', rows: design }]
        : [{ rows: [...extra, ...builds, ...design] }];
    return { groups: grouped, rows: grouped.flatMap((g) => g.rows) };
  }, [jobs, job]);

  const uid = useId();
  const listId = `${uid}-list`;
  const hintId = `${uid}-hint`;
  const optionId = (i: number) => `${uid}-opt-${i}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const typed = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  // closed -> open -> closing (the exit fade) -> closed
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<CSSProperties>({});
  const open = phase === 'open';
  const currentIndex = Math.max(0, rows.findIndex((r) => r.jobId === job.jobId));

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
    setActive(currentIndex);
    setPhase('open');
  };

  // Focus follows the active option; the menu scrolls to keep it in view.
  useLayoutEffect(() => {
    if (!open) return;
    const el = document.getElementById(optionId(active));
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // A tap outside closes it; focus goes back to the title unless the tap landed on something focusable.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t && rootRef.current?.contains(t)) return;
      const focusable = !!t?.closest('a[href], button, input, select, textarea, [tabindex]');
      close(false);
      if (focusable) return;
      const refocus = () => buttonRef.current?.focus({ preventScroll: true });
      document.addEventListener('click', refocus, { capture: true, once: true });
      window.setTimeout(() => document.removeEventListener('click', refocus, { capture: true }), 1000);
    };
    document.addEventListener('pointerdown', onDown, true);
    // The layer budget: the open menu is a blurred layer, so the sticky glass tabs under it go static.
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
    const next = rows[i];
    close(true);
    if (!next || next.jobId === job.jobId) return;
    globalThis.location.hash = switchJobHref(current, next);
  };

  const typeAhead = (key: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at < TYPEAHEAD_MS ? t.text + key.toLowerCase() : key.toLowerCase();
    t.at = now;
    // Repeating one letter steps through the jobs that start with it.
    const cycling = t.text.length > 1 && [...t.text].every((c) => c === t.text[0]);
    const needle = cycling ? t.text[0]! : t.text;
    const matches = (r: JobRow) => {
      const name = r.name.toLowerCase();
      return name.startsWith(needle) || name.split(/[\s-]+/).some((w) => w.startsWith(needle));
    };
    const from = cycling || t.text.length === 1 ? active + 1 : active;
    for (let k = 0; k < rows.length; k++) {
      const i = (from + k) % rows.length;
      if (matches(rows[i]!)) {
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

  const Title = heading ? 'h1' : 'div';
  let index = -1;
  return (
    <div className="job-switch" data-testid="job-switch" data-open={open || undefined} ref={rootRef}>
      <Title className="page-header__title job-switch__title">
        <button
          ref={buttonRef}
          type="button"
          className="job-switch__name"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-describedby={hintId}
          data-value={job.jobId}
          data-testid="job-switcher"
          onClick={() => (open ? close(true) : show())}
          onKeyDown={onButtonKey}
        >
          <span className="job-switch__text">{job.name}</span>
          <ChevronIcon />
        </button>
      </Title>
      <span id={hintId} hidden>
        Switch job
      </span>
      {phase !== 'closed' && (
        <div
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
              const selected = r.jobId === job.jobId;
              return (
                <div
                  key={r.jobId}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  className="job-menu__option"
                  data-active={i === active || undefined}
                  data-value={r.jobId}
                  data-testid={`job-switcher-${r.jobId}`}
                  onClick={() => pick(i)}
                  onPointerMove={() => i !== active && setActive(i)}
                >
                  <span className="job-menu__mark">{selected && <CheckIcon />}</span>
                  <span className="job-menu__name">{r.name}</span>
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
