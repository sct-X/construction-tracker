/**
 * Photos: gallery (UI_PLAN 3.14). A job's photos the way they were filed:
 * by stage, then category, each with its count in words.
 *
 *   Slab                      6 photos, 3 of 3 required sets
 *     Steel reinforcement in place   3 photos   needed for inspection
 *     [img] [img] [img]
 *     Plumbing under slab            2 photos   needed for inspection
 *     ...
 *   Lock-up                   5 photos, no required sets
 *     Windows installed              No photos yet     Upload here
 *
 * Filters are buttons (stage chips, then who uploaded), never dropdowns; on
 * the desktop a sort sits beside them. Photos still in the phone's queue are
 * drawn in their category with a clock and the words "waiting to send", so
 * nobody wonders where they went; they do not count for hold points.
 * Tapping a photo opens it full size with when, who and where it was filed.
 * Admin and partners can move it to another category in the stage or delete
 * it. The route carries the state: `?stage=`, `?by=`, `?sort=`, `?photo=`.
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import { ClockGlyph, useQueuedPhotos } from '../components/QueueBadge';
import type { Photo, PhotoCategory } from '../domain/types';
import { formatLongRelative, formatShort, formatTime } from '../domain/dates';
import { StatusText } from '../components/StatusText';
import NotFound from './NotFound';
import { JobHeader } from '../shell/JobHeader';
import { FilterBar, FilterSelect } from '../components/FilterSelect';
import { useLayout } from '../shell/AppShell';
import './photoGallery.css';

const GENERAL = 'general';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "6 photos, 3 of 3 required sets" / "2 photos" / "No photos yet". */
export function stageCountWords(photoCount: number, cats: PhotoCategory[], counts: Map<string, number>): string {
  const required = cats.filter((c) => c.requiredForHoldPoint);
  const filled = required.filter((c) => (counts.get(c.id) ?? 0) > 0).length;
  const photos = photoCount === 0 ? 'No photos yet' : plural(photoCount, 'photo');
  if (required.length === 0) return photos;
  return `${photos}, ${filled} of ${required.length} required set${required.length === 1 ? '' : 's'}`;
}

interface StageGroup {
  id: string;
  name: string;
  cats: PhotoCategory[];
  photos: Photo[];
  /** The hold-point step in this stage, for "Needed before the slab inspection". */
  holdPointName?: string;
}

export default function PhotoGallery() {
  const { id = '' } = useParams();
  const api = useApi();
  const { role } = useSession();
  const layout = useLayout();
  const [params, setParams] = useSearchParams();
  const data = useQuery(
    (api) => {
      const job = api.getJob(id);
      if (!job) return undefined;
      return {
        job,
        stages: api.listStages(id).sort((a, b) => a.order - b.order),
        steps: api.listSteps(id),
        cats: api.listPhotoCategories(id),
        photos: api.listPhotos(id),
        people: api.listPeople(),
        forecast: api.getForecast(id),
      };
    },
    [id],
  );
  const allQueued = useQueuedPhotos();
  const queued = allQueued.filter((p) => p.jobId === id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!data) return <NotFound />;
  const { job, stages, steps, cats, photos, people, forecast } = data;
  const canEdit = role === 'admin' || role === 'partner';

  const stageFilter = params.get('stage') ?? 'all';
  const byFilter = params.get('by') ?? 'anyone';
  const sort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const viewingId = params.get('photo');

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const nameOf = (pid: string) => people.find((p) => p.id === pid)?.shortName ?? 'someone';
  const uploaders = [...new Set(photos.map((p) => p.uploadedById))].map((pid) => ({ id: pid, name: nameOf(pid) }));

  // Every photo and queued photo, filtered by who; the stage filter picks groups.
  const shown = byFilter === 'anyone' ? photos : photos.filter((p) => p.uploadedById === byFilter);
  const shownQueued = byFilter === 'anyone' ? queued : queued.filter((p) => p.uploadedById === byFilter);
  const byUploaded = (a: Photo, b: Photo) => (sort === 'newest' ? b.uploadedAt.localeCompare(a.uploadedAt) : a.uploadedAt.localeCompare(b.uploadedAt));

  const groups: StageGroup[] = [
    ...stages.map((s) => ({
      id: s.id,
      name: s.name,
      cats: cats.filter((c) => c.stageId === s.id),
      photos: shown.filter((p) => p.stageId === s.id),
      holdPointName: steps.find((st) => st.stageId === s.id && st.isHoldPoint)?.name,
    })),
    { id: GENERAL, name: 'General', cats: cats.filter((c) => c.stageId === null), photos: shown.filter((p) => p.stageId === null) },
  ].filter((g) => g.cats.length > 0 || g.photos.length > 0);
  const visible = groups.filter((g) => stageFilter === 'all' || g.id === stageFilter);

  const currentStage = forecast?.currentStageId;
  const uploadStage = stageFilter !== 'all' && stageFilter !== GENERAL ? stageFilter : currentStage;
  const uploadHref = `/jobs/${id}/upload${uploadStage ? `?stage=${uploadStage}` : ''}`;

  const viewing = viewingId ? photos.find((p) => p.id === viewingId) : undefined;
  const closeView = () => {
    setConfirmDelete(false);
    setParam('photo', null);
  };

  const photoWords = `${photos.length === 0 ? 'no photos yet' : plural(photos.length, 'photo')}${queued.length > 0 ? `, ${queued.length} waiting to send` : ''}`;

  return (
    <main className="page gallery" data-testid="gallery">
      <JobHeader
        job={job}
        section="photos"
        title="Photos"
        meta={`${job.name}, ${photoWords}`}
        switchMeta={`Photos, ${photoWords}`}
        back={{ to: `/jobs/${id}`, label: role === 'site' ? 'Today' : job.name }}
        actions={
          <a className="btn btn--primary btn--desktop" href={`#${uploadHref}`} data-testid="gallery-upload">
            Add photos
          </a>
        }
      />

      <FilterBar testId="gallery-filters">
        <FilterSelect
          label="Stage"
          value={stageFilter === 'all' ? '' : stageFilter}
          options={[{ value: '', label: 'All stages' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
          onChange={(v) => setParam('stage', v || null)}
          testId="gallery-filter"
        />
        {uploaders.length > 1 && (
          <FilterSelect
            label="Uploaded by"
            value={byFilter === 'anyone' ? '' : byFilter}
            options={[{ value: '', label: 'Anyone' }, ...uploaders.map((u) => ({ value: u.id, label: u.name }))]}
            onChange={(v) => setParam('by', v || null)}
            testId="gallery-filter-by"
          />
        )}
        {layout === 'desktop' && (
          <FilterSelect
            label="Sort"
            value={sort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
            ]}
            onChange={(v) => setParam('sort', v === 'oldest' ? 'oldest' : null)}
            testId="gallery-sort"
          />
        )}
      </FilterBar>

      {photos.length === 0 && queued.length === 0 && (
        <p className="gallery__empty" data-testid="gallery-empty">
          No photos on {job.name} yet.
        </p>
      )}

      {visible.map((g) => {
        const counts = new Map(g.cats.map((c) => [c.id, g.photos.filter((p) => p.categoryId === c.id).length]));
        const orphans = g.photos.filter((p) => !g.cats.some((c) => c.id === p.categoryId));
        return (
          <section key={g.id} className="gallery__stage" aria-labelledby={`gallery-stage-${g.id}`} data-testid={`gallery-stage-${g.id}`}>
            <h2 id={`gallery-stage-${g.id}`} className="gallery__stage-title">
              <span className="gallery__stage-name">{g.name}</span>
              <span className="gallery__stage-count" data-testid={`gallery-stage-count-${g.id}`}>
                {stageCountWords(g.photos.length, g.cats, counts)}
              </span>
            </h2>
            {g.cats.map((c) => {
              const inCat = g.photos.filter((p) => p.categoryId === c.id).sort(byUploaded);
              const queuedHere = shownQueued.filter((p) => p.categoryId === c.id);
              const n = inCat.length;
              return (
                <div key={c.id} className="gallery__category" data-testid={`gallery-category-${c.id}`}>
                  <h3 className="gallery__category-title">
                    <span className="gallery__category-name">{c.name}</span>
                    <span className="gallery__category-count">{n === 0 ? 'No photos yet' : plural(n, 'photo')}</span>
                    {c.requiredForHoldPoint &&
                      (n === 0 ? (
                        <StatusText tone="amber">{g.holdPointName ? `Needed before the ${g.holdPointName.charAt(0).toLowerCase()}${g.holdPointName.slice(1)}` : 'Needed for the hold point'}</StatusText>
                      ) : (
                        <span className="gallery__tag">needed for inspection</span>
                      ))}
                  </h3>
                  {n === 0 && queuedHere.length === 0 ? (
                    <a
                      className="btn btn--glass btn--desktop gallery__upload-here"
                      href={`#/jobs/${id}/upload?stage=${c.stageId ?? ''}&category=${c.id}`}
                      data-testid={`gallery-upload-${c.id}`}
                    >
                      Upload here
                    </a>
                  ) : (
                    <ul className="gallery__grid">
                      {inCat.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="gallery__thumb"
                            onClick={() => setParam('photo', p.id)}
                            data-testid={`gallery-photo-${p.id}`}
                            aria-label={`${p.caption ?? c.name}, taken ${formatShort(p.takenOn)} by ${nameOf(p.uploadedById)}`}
                          >
                            <img src={p.dataUrl} alt="" loading="lazy" />
                          </button>
                        </li>
                      ))}
                      {queuedHere.map((q) => (
                        <li key={q.id}>
                          <div className="gallery__thumb gallery__thumb--queued" data-testid={`gallery-queued-${q.id}`}>
                            <img src={q.dataUrl} alt="" loading="lazy" />
                            <span className="gallery__queued-words">
                              <ClockGlyph className="gallery__queued-glyph" />
                              waiting to send
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {orphans.length > 0 && (
              <div className="gallery__category" data-testid={`gallery-category-none-${g.id}`}>
                <h3 className="gallery__category-title">
                  <span className="gallery__category-name">Uncategorised</span>
                  <span className="gallery__category-count">{plural(orphans.length, 'photo')}</span>
                </h3>
                <ul className="gallery__grid">
                  {orphans.sort(byUploaded).map((p) => (
                    <li key={p.id}>
                      <button type="button" className="gallery__thumb" onClick={() => setParam('photo', p.id)} data-testid={`gallery-photo-${p.id}`}>
                        <img src={p.dataUrl} alt={p.caption ?? 'Photo'} loading="lazy" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}

      {viewing && (
        <PhotoView
          photo={viewing}
          category={cats.find((c) => c.id === viewing.categoryId)}
          stageName={stages.find((s) => s.id === viewing.stageId)?.name ?? 'General'}
          who={nameOf(viewing.uploadedById)}
          canEdit={canEdit}
          moveTargets={cats.filter((c) => c.stageId === viewing.stageId && c.id !== viewing.categoryId)}
          confirmDelete={confirmDelete}
          onConfirmDelete={setConfirmDelete}
          onMove={(catId) => api.movePhoto(viewing.id, catId)}
          onDelete={() => {
            api.deletePhoto(viewing.id);
            closeView();
          }}
          onClose={closeView}
        />
      )}
    </main>
  );
}

function PhotoView({
  photo,
  category,
  stageName,
  who,
  canEdit,
  moveTargets,
  confirmDelete,
  onConfirmDelete,
  onMove,
  onDelete,
  onClose,
}: {
  photo: Photo;
  category?: PhotoCategory;
  stageName: string;
  who: string;
  canEdit: boolean;
  moveTargets: PhotoCategory[];
  confirmDelete: boolean;
  onConfirmDelete: (v: boolean) => void;
  onMove: (categoryId: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { today } = useSession();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="gallery__view" role="dialog" aria-modal="true" aria-labelledby="gallery-view-title" data-testid="gallery-view">
      <div className="gallery__view-bar">
        <h2 id="gallery-view-title" className="gallery__view-title">
          {photo.caption ?? category?.name ?? 'Photo'}
        </h2>
        <button type="button" className="btn gallery__close" onClick={onClose} data-testid="gallery-view-close">
          Close
        </button>
      </div>
      <img className="gallery__view-img" src={photo.dataUrl} alt={photo.caption ?? category?.name ?? 'Photo'} />
      <dl className="gallery__view-facts">
        <div>
          <dt>Taken</dt>
          <dd data-testid="gallery-view-taken">{formatLongRelative(photo.takenOn, today)}</dd>
        </div>
        <div>
          <dt>Uploaded</dt>
          <dd data-testid="gallery-view-who">
            {who}, {formatShort(photo.uploadedAt.slice(0, 10))} {formatTime(photo.uploadedAt)}
          </dd>
        </div>
        <div>
          <dt>Filed under</dt>
          <dd data-testid="gallery-view-category">
            {stageName}, {category?.name ?? 'no category'}
          </dd>
        </div>
      </dl>
      {canEdit && (
        <div className="gallery__view-actions">
          {moveTargets.length > 0 && (
            <div className="gallery__move" role="group" aria-label="Move to">
              <span className="gallery__move-label">Move to</span>
              {moveTargets.map((c) => (
                <button key={c.id} type="button" className="btn btn--desktop" onClick={() => onMove(c.id)} data-testid={`gallery-move-${c.id}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {confirmDelete ? (
            <p className="gallery__confirm" role="alert">
              Delete this photo for good?{' '}
              <button type="button" className="btn btn--desktop" onClick={onDelete} data-testid="gallery-delete-confirm">
                Delete it
              </button>{' '}
              <button type="button" className="btn btn--desktop" onClick={() => onConfirmDelete(false)}>
                Keep it
              </button>
            </p>
          ) : (
            <button type="button" className="btn btn--desktop gallery__delete" onClick={() => onConfirmDelete(true)} data-testid="gallery-delete">
              Delete photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
