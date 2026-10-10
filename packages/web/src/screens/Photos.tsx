/**
 * Photos (v1 PhotoGallery look): one job's photos the way the bot filed them,
 * by stage and then category, each with its count in words.
 *
 *   Slab                    6 photos, 3 of 3 required sets
 *     Steel reinforcement in place   3 photos   needed for inspection
 *     [img] [img] [img]
 *   External works          No photos yet, 0 of 1 required set
 *     Stormwater before backfill     No photos yet   ! Needed before the stormwater inspection
 *
 * One dropdown picks a stage; on the desktop a second sorts newest or oldest
 * first. Tapping a photo opens it full size with when it was taken, when it
 * came in and where it was filed. Photos arrive through the bot: no upload
 * here (SPEC). The job header (shell) carries the job's name and tabs.
 */
import { useEffect, useRef, useState } from 'react';
import { formatDate, formatTime, sydneyDate, type DashboardApi, type JobListRow, type Photo, type PhotoGallery, type SideFilter, type StepForecast } from '@ct/core';
import { useData, useSideQuery } from '../data/DataContext';
import { usePhoneWidth } from '../shell/useNarrow';
import { LoadError, LoadingRows } from '../components/bits';
import { FilterSelect } from '../components/FilterSelect';
import { StatusText } from '../components/StatusText';
import { plural } from '../ui/itemWords';
import { shortRelative } from '../ui/when';
import '../styles/photos.css';

export interface PhotosData {
  today: string;
  jobs: JobListRow[];
  jobId: string | null;
  jobName: string | null;
  gallery: PhotoGallery | null;
  /** Hold-point steps by stage id (build jobs only). */
  holdPoints: Record<string, Pick<StepForecast, 'stepId' | 'name' | 'forecastStart' | 'status'>[]>;
}

/** With no job in the route, opens the first build on this side. */
export async function loadPhotos(api: DashboardApi, filter: SideFilter, routeJobId: string | null): Promise<PhotosData> {
  const [today, list] = await Promise.all([api.getToday(), api.listJobs(filter)]);
  const jobs = [...list.builds, ...list.design];
  const jobId = routeJobId ?? list.builds[0]?.jobId ?? jobs[0]?.jobId ?? null;
  if (!jobId) return { today, jobs, jobId: null, jobName: null, gallery: null, holdPoints: {} };
  const kind = jobs.find((j) => j.jobId === jobId)?.kind;
  const [gallery, program] = await Promise.all([api.getPhotos(jobId), kind === 'design' ? null : api.getProgram(jobId).catch(() => null)]);
  const holdPoints: PhotosData['holdPoints'] = {};
  for (const s of program?.steps ?? []) {
    if (s.isHoldPoint) (holdPoints[s.stageId] ??= []).push({ stepId: s.stepId, name: s.name, forecastStart: s.forecastStart, status: s.status });
  }
  const jobName = jobs.find((j) => j.jobId === jobId)?.name ?? program?.job.name ?? jobId;
  return { today, jobs, jobId, jobName, gallery, holdPoints };
}

type Group = PhotoGallery['groups'][number];
type Category = Group['categories'][number];

export function photoTotal(gallery: PhotoGallery | null): number {
  return (gallery?.groups ?? []).reduce((n, g) => n + g.categories.reduce((m, c) => m + c.photos.length, 0), 0);
}

export function PhotosScreen({ jobId }: { jobId: string }) {
  const q = useSideQuery((api, f) => loadPhotos(api, f, jobId));
  const total = q.status === 'ready' ? photoTotal(q.data.gallery) : null;
  return (
    <section className="photos" aria-labelledby="photos-title" data-testid="photos">
      <div className="photos__head">
        <h2 id="photos-title" className="photos__title">
          Photos
          {q.status === 'ready' && q.data.jobName && <span className="sr-only"> at {q.data.jobName}</span>}
        </h2>
        {total !== null && (
          <p className="page-header__meta" data-testid="photos-sub">
            {total === 0 ? 'No photos yet' : plural(total, 'photo')}
          </p>
        )}
      </div>
      {q.status === 'loading' && <LoadingRows rows={3} label="Loading photos" />}
      {q.status === 'error' && <LoadError what="the photos" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <PhotosBody data={q.data} />}
    </section>
  );
}

/** Required categories in this stage with at least one photo. */
export function holdProgress(g: Group): { filled: number; required: number; missing: string[] } | null {
  const req = g.categories.filter((c) => c.requiredForHoldPoint);
  if (!req.length) return null;
  const missing = req.filter((c) => !c.photos.length).map((c) => c.name);
  return { filled: req.length - missing.length, required: req.length, missing };
}

/** v1 stageCountWords: "6 photos, 3 of 3 required sets" / "2 photos" / "No photos yet, 0 of 1 required set". */
export function stageCountWords(g: Group): string {
  const n = g.categories.reduce((m, c) => m + c.photos.length, 0);
  const photos = n === 0 ? 'No photos yet' : plural(n, 'photo');
  const p = holdProgress(g);
  if (!p) return photos;
  return `${photos}, ${p.filled} of ${p.required} required set${p.required === 1 ? '' : 's'}`;
}

/** "Needed before the stormwater inspection" (v1 lower-cases the step's first letter). */
export function neededBeforeWords(holdName: string | null): string {
  if (!holdName) return 'Needed for the hold point';
  return `Needed before the ${holdName.charAt(0).toLowerCase()}${holdName.slice(1)}`;
}

export function PhotosBody({ data }: { data: PhotosData }) {
  const { api } = useData();
  const phone = usePhoneWidth();
  const [stage, setStage] = useState('');
  const [oldest, setOldest] = useState(false);
  const [open, setOpen] = useState<{ photo: Photo; category: string; stageName: string } | null>(null);
  if (!data.jobId) return <p className="empty-line">No jobs on this side yet.</p>;
  // Stages in order, the job-wide bucket last (v1 "General").
  const all = data.gallery?.groups ?? [];
  const groups = [...all.filter((g) => g.stageId), ...all.filter((g) => !g.stageId)];
  if (!groups.length) return <p className="empty-line">No photo sets on this job.</p>;
  const keyOf = (g: Group) => g.stageId ?? 'job';
  const visible = groups.filter((g) => !stage || keyOf(g) === stage);
  const total = photoTotal(data.gallery);
  return (
    <>
      <div className="filterbar photos__filters" data-testid="photos-filters">
        <FilterSelect
          label="Stage"
          value={stage}
          testId="photos-stage"
          onChange={setStage}
          options={[{ value: '', label: 'All stages' }, ...groups.map((g) => ({ value: keyOf(g), label: groupName(g) }))]}
        />
        {!phone && (
          <FilterSelect
            label="Sort"
            value={oldest ? 'oldest' : 'newest'}
            testId="photos-sort"
            onChange={(v) => setOldest(v === 'oldest')}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
            ]}
          />
        )}
      </div>
      {total === 0 && (
        <p className="photos__empty" data-testid="photos-empty">
          No photos on {data.jobName} yet.
        </p>
      )}
      <div className="photos__stages">
        {visible.map((g) => (
          <StageBlock
            key={keyOf(g)}
            group={g}
            data={data}
            oldest={oldest}
            onOpen={(photo, category) => setOpen({ photo, category, stageName: groupName(g) })}
            url={(p) => api.photoUrl(p)}
          />
        ))}
      </div>
      {open && <PhotoView photo={open.photo} category={open.category} stageName={open.stageName} src={api.photoUrl(open.photo)} today={data.today} onClose={() => setOpen(null)} />}
    </>
  );
}

function groupName(g: Group): string {
  return g.stageId ? g.stageName : 'General';
}

function StageBlock({ group, data, oldest, onOpen, url }: { group: Group; data: PhotosData; oldest: boolean; onOpen: (p: Photo, category: string) => void; url: (p: Photo) => string }) {
  const progress = holdProgress(group);
  const holds = group.stageId ? (data.holdPoints[group.stageId] ?? []) : [];
  const hold = holds.find((h) => h.status !== 'done') ?? holds[0] ?? null;
  const headId = `photos-stage-${group.stageId ?? 'job'}`;
  return (
    <section className="plate photos__stage" aria-labelledby={headId} data-testid={`photo-stage-${group.stageId ?? 'job'}`}>
      <div className="photos__stage-head">
        <h3 id={headId} className="photos__stage-name">
          {groupName(group)}
        </h3>
        <span className="photos__stage-count" data-testid={progress ? 'hold-progress' : 'stage-count'}>
          {stageCountWords(group)}
        </span>
      </div>
      {progress && hold && hold.status !== 'done' && (
        <p className="photos__hold" data-testid="hold-step">
          {hold.name}, {shortRelative(hold.forecastStart, data.today)}
        </p>
      )}
      {group.categories.map((c) => (
        <CategoryBlock key={c.categoryId} c={c} hold={hold} oldest={oldest} today={data.today} onOpen={onOpen} url={url} />
      ))}
    </section>
  );
}

function CategoryBlock({
  c,
  hold,
  oldest,
  today,
  onOpen,
  url,
}: {
  c: Category;
  hold: { name: string; status: string } | null;
  oldest: boolean;
  today: string;
  onOpen: (p: Photo, category: string) => void;
  url: (p: Photo) => string;
}) {
  const n = c.photos.length;
  const photos = oldest ? [...c.photos].reverse() : c.photos;
  return (
    <div className="photos__cat" data-testid={`photo-cat-${c.categoryId}`} data-required={c.requiredForHoldPoint ? 'true' : 'false'}>
      <h4 className="photos__cat-title">
        <span className="photos__cat-name">{c.name}</span>
        <span className="photos__cat-count">{n === 0 ? 'No photos yet' : plural(n, 'photo')}</span>
        {c.requiredForHoldPoint &&
          (n === 0 && hold?.status !== 'done' ? (
            <StatusText tone="note" testId="cat-needed">
              {neededBeforeWords(hold?.name ?? null)}
            </StatusText>
          ) : (
            <span className="photos__tag" data-testid="cat-needed">
              needed for inspection
            </span>
          ))}
      </h4>
      {n > 0 && (
        <ul className="photos__grid">
          {photos.map((p) => (
            <li key={p.id}>
              <button type="button" className="photos__thumb" onClick={() => onOpen(p, c.name)} aria-label={`Open photo: ${p.caption ?? c.name}, taken ${formatDate(p.takenOn, today)}`}>
                <img src={url(p)} alt="" loading="lazy" width={120} height={120} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "From the bot, Wed 16 Sep, 5:10pm" / "Filed Wed 16 Sep, 5:10pm". */
export function receivedWords(p: Pick<Photo, 'receivedAt' | 'messageId'>, today: string): string {
  const when = `${formatDate(sydneyDate(p.receivedAt), today)}, ${formatTime(p.receivedAt)}`;
  return p.messageId ? `From the bot, ${when}` : `Filed ${when}`;
}

/** v1 PhotoView: the photo full size on a plain panel over the page (media is content, so no glass). */
function PhotoView({ photo, category, stageName, src, today, onClose }: { photo: Photo; category: string; stageName: string; src: string; today: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // The latest onClose without re-running the effect (callers pass a new function each render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      // Focus stays inside the dialog: Tab and Shift+Tab cycle its controls.
      const items = [...boxRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === -1 || i === items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next]!.focus();
    };
    window.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      html.style.overflow = before;
      prev?.focus?.();
    };
  }, []);
  const title = photo.caption ?? category;
  return (
    <div ref={boxRef} className="photos__view" role="dialog" aria-modal="true" aria-labelledby="photos-view-title" data-testid="lightbox">
      <div className="photos__view-bar">
        <h2 id="photos-view-title" className="photos__view-title">
          {title}
        </h2>
        <button ref={closeRef} type="button" className="btn btn--desktop photos__close" onClick={onClose}>
          Close
        </button>
      </div>
      <img className="photos__view-img" src={src} alt={title} />
      <dl className="photos__facts">
        <div>
          <dt>Taken</dt>
          <dd data-testid="view-taken">{shortRelative(photo.takenOn, today)}</dd>
        </div>
        <div>
          <dt>Came in</dt>
          <dd data-testid="view-received">{receivedWords(photo, today)}</dd>
        </div>
        <div>
          <dt>Filed under</dt>
          <dd data-testid="view-category">
            {stageName}, {category}
          </dd>
        </div>
      </dl>
    </div>
  );
}
