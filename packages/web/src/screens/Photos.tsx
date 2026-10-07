/**
 * Photos: one job's photos the way the bot filed them, by stage and then
 * category. Categories needed before a hold point carry those words, and each
 * stage with a hold point says how many of its required categories have a
 * photo ("1 of 3"). Tap a photo to see it large. Photos arrive through the bot.
 */
import { useEffect, useRef, useState } from 'react';
import { formatDate, type DashboardApi, type JobListRow, type Photo, type PhotoGallery, type SideFilter, type StepForecast } from '@ct/core';
import { useData, useSideQuery } from '../data/DataContext';
import { LoadError, LoadingRows } from '../components/bits';
import '../styles/lists.css';
import { photoCount, plural } from '../ui/itemWords';

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

export function PhotosScreen({ jobId }: { jobId: string }) {
  const q = useSideQuery((api, f) => loadPhotos(api, f, jobId));
  return (
    <div className="screen photos">
      <header className="screen-head">
        <div>
          <h1>
            Photos{q.status === 'ready' && q.data.jobName && <span className="sr-only"> at {q.data.jobName}</span>}
          </h1>
          {q.status === 'ready' && q.data.gallery && (
            <p className="screen-sub" data-testid="photos-sub">
              {plural(q.data.gallery.groups.reduce((n, g) => n + g.categories.reduce((m, c) => m + c.photos.length, 0), 0), 'photo')}, filed by stage
              and category. New photos come in through the bot.
            </p>
          )}
        </div>
      </header>
      {q.status === 'loading' && <LoadingRows rows={4} label="Loading photos" />}
      {q.status === 'error' && <LoadError what="the photos" error={q.error} retry={q.retry} />}
      {q.status === 'ready' && <PhotosBody data={q.data} />}
    </div>
  );
}

type Group = PhotoGallery['groups'][number];

/** "1 of 3": required categories in this stage with at least one photo. */
export function holdProgress(g: Group): { filled: number; required: number; missing: string[] } | null {
  const req = g.categories.filter((c) => c.requiredForHoldPoint);
  if (!req.length) return null;
  const missing = req.filter((c) => !c.photos.length).map((c) => c.name);
  return { filled: req.length - missing.length, required: req.length, missing };
}

export function PhotosBody({ data }: { data: PhotosData }) {
  const { api } = useData();
  const [open, setOpen] = useState<{ photo: Photo; category: string } | null>(null);
  if (!data.jobId) return <p className="empty">No jobs on this side yet.</p>;
  // Stages in order, the job-wide General bucket last: the hold points matter most.
  const all = data.gallery?.groups ?? [];
  const groups = [...all.filter((g) => g.stageId), ...all.filter((g) => !g.stageId)];
  if (!groups.length) {
    return <p className="empty">This job has no photo categories. They come with the job's template, set up on the desktop.</p>;
  }
  return (
    <>
      {groups.map((g) => (
        <StageBlock key={g.stageId ?? 'job'} group={g} data={data} onOpen={(photo, category) => setOpen({ photo, category })} url={(p) => api.photoUrl(p)} />
      ))}
      {open && <Lightbox photo={open.photo} category={open.category} src={api.photoUrl(open.photo)} today={data.today} onClose={() => setOpen(null)} />}
    </>
  );
}

function StageBlock({ group, data, onOpen, url }: { group: Group; data: PhotosData; onOpen: (p: Photo, category: string) => void; url: (p: Photo) => string }) {
  const progress = holdProgress(group);
  const holds = group.stageId ? (data.holdPoints[group.stageId] ?? []) : [];
  const hold = holds.find((h) => h.status !== 'done') ?? holds[0] ?? null;
  const headId = `stage-${group.stageId ?? 'job'}`;
  return (
    <section className="block photo-stage" aria-labelledby={headId} data-testid={`photo-stage-${group.stageId ?? 'job'}`}>
      <div className="photo-stage-head">
        <h2 id={headId}>{group.stageName}</h2>
        {progress && (
          <div className={progress.filled < progress.required ? 'hold hold-open' : 'hold'} data-testid="hold-progress">
            <span className="hold-num">
              {progress.filled} of {progress.required}
            </span>
            <span className="hold-words">
              required categories have photos
              {hold ? (
                <>
                  {' '}
                  for <strong>{hold.name}</strong>
                  {hold.status === 'done' ? ', done' : ', '}
                  {hold.status !== 'done' && <span className="nowrap">{formatDate(hold.forecastStart, data.today)}</span>}
                </>
              ) : null}
              {progress.missing.length > 0 && hold?.status !== 'done' ? `. Still needed: ${progress.missing.join(', ')}.` : '.'}
            </span>
          </div>
        )}
      </div>
      {group.categories.map((c) => (
        <div key={c.categoryId} className="photo-cat" data-testid={`photo-cat-${c.categoryId}`}>
          <h3>
            {c.name}
            <span className="h-note">{photoCount(c.photos.length)}</span>
            {c.requiredForHoldPoint && <span className="tag">Needed for the hold point</span>}
          </h3>
          {c.photos.length ? (
            <ul className="thumbs">
              {c.photos.map((p) => (
                <li key={p.id}>
                  <button type="button" className="thumb" onClick={() => onOpen(p, c.name)} aria-label={`Open photo: ${p.caption ?? c.name}`}>
                    <img src={url(p)} alt="" loading="lazy" width={160} height={120} />
                  </button>
                  <span className="thumb-cap">{p.caption ?? 'No caption'}</span>
                  {p.takenOn && <span className="thumb-date">{formatDate(p.takenOn, data.today)}</span>}
                </li>
              ))}
            </ul>
          ) : c.requiredForHoldPoint && hold && hold.status !== 'done' ? (
            <p className="cat-empty cat-empty-needed">Needed before {hold.name}. Send one to the bot with this category in the caption.</p>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function Lightbox({ photo, category, src, today, onClose }: { photo: Photo; category: string; src: string; today: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={photo.caption ?? category} onClick={onClose} data-testid="lightbox">
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={photo.caption ?? category} />
        <figcaption>
          <span className="lb-cap">{photo.caption ?? 'No caption'}</span>
          <span className="lb-meta">
            {category}
            {photo.takenOn ? `, taken ${formatDate(photo.takenOn, today)}` : ''}
          </span>
        </figcaption>
        <button ref={closeRef} type="button" className="btn lb-close" onClick={onClose}>
          Close
        </button>
      </figure>
    </div>
  );
}
