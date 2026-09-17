/**
 * Photo upload (UI_PLAN 3.15, flow b, wireframe "Photo upload, phone").
 * Route `#/jobs/:id/upload?stage=<stageId>&category=<categoryId>`.
 *
 * Files photos under job, stage and category in as few taps as possible:
 * stage and category are tall buttons (never dropdowns), the phone's own
 * picker chooses many at once, thumbnails preview, one hi-vis button says
 * "Upload 11 photos". Every photo goes through the phone's queue first, on
 * or off signal, so the path is one: with signal the queue sends at once
 * and the line reads "Sending 6 of 11"; without it, a calm note says the
 * photos are saved on this phone and will send when signal returns. No
 * price anywhere: Alec's data never contains one.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import { sharedPhotoQueue, type QueuedPhoto } from '../data/photoQueue';
import type { PhotoCategory } from '../domain/types';
import { CategoryPicker } from '../components/CategoryPicker';
import { ClockGlyph, noSignal, useQueuedPhotos } from '../components/QueueBadge';
import { useLayout } from '../shell/AppShell';
import { PageHeader } from '../shell/PageHeader';
import NotFound from './NotFound';
import './photoUpload.css';

interface Picked {
  key: string;
  file: File;
  /** Object URL for the preview; revoked when the photo is removed or the screen closes. */
  url: string;
}

type Phase = 'pick' | 'saving' | 'sending' | 'sent' | 'held';

/** Uploaded-size and thumbnail caps. The mock keeps photos in localStorage, so 800px; the real server takes the Blob and the cap moves to 2,000px. */
const UPLOAD_MAX = 800;
const THUMB_MAX = 160;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}`));
    };
    img.src = url;
  });
}

/** Draws the image onto a canvas no wider or taller than `max` and returns a JPEG data URL. */
function downscale(img: HTMLImageElement, max: number, quality: number): string {
  const scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Both sizes from one decode. */
export async function shrinkForUpload(file: File): Promise<{ dataUrl: string; thumbDataUrl: string }> {
  const img = await loadImage(file);
  return { dataUrl: downscale(img, UPLOAD_MAX, 0.75), thumbDataUrl: downscale(img, THUMB_MAX, 0.7) };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function PhotoUpload() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const api = useApi();
  const { today, offline } = useSession();
  const layout = useLayout();
  const queued = useQueuedPhotos();

  const data = useQuery(
    (api) => {
      const job = api.getJob(id);
      if (!job) return undefined;
      const forecast = api.getForecast(id);
      return {
        job,
        stages: api.listStages(id),
        forecast,
        categories: api.listPhotoCategories(id),
        photos: api.listPhotos(id),
      };
    },
    [id],
  );

  const stageParam = params.get('stage');
  const categoryParam = params.get('category');
  const [stageId, setStageId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(categoryParam);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [phase, setPhase] = useState<Phase>('pick');
  const [batch, setBatch] = useState<string[]>([]);
  const [batchSize, setBatchSize] = useState(0);
  const [filedUnder, setFiledUnder] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const rollInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  // Stage defaults to the URL's, else the job's current stage (flow b step 2).
  const stages = data?.stages ?? [];
  const currentStageId = data?.forecast?.currentStageId;
  const effectiveStage = stageId ?? (stageParam && stages.some((s) => s.id === stageParam) ? stageParam : null) ?? currentStageId ?? stages[0]?.id ?? null;

  // Object URLs are released when the screen goes away.
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  useEffect(() => () => pickedRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const stageCategories = useMemo(() => {
    const all = data?.categories ?? [];
    const own = all.filter((c) => c.stageId === effectiveStage);
    const general = all.filter((c) => c.stageId === null);
    return { own, general, list: [...own, ...general] };
  }, [data?.categories, effectiveStage]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of data?.photos ?? []) out[p.categoryId] = (out[p.categoryId] ?? 0) + 1;
    return out;
  }, [data?.photos]);

  const queuedCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of queued) if (p.jobId === id) out[p.categoryId] = (out[p.categoryId] ?? 0) + 1;
    return out;
  }, [queued, id]);

  // Progress of this screen's batch: how many of its photos have left the queue.
  const stillQueued = batch.filter((qid) => queued.some((p) => p.id === qid)).length;
  const sentCount = batchSize - stillQueued;
  // Only once the batch has been seen in the queue does an empty queue mean
  // "sent" (the queue list refreshes a beat after each save). Covers signal
  // returning while the held note is on screen (flow b step 10).
  const batchSeen = useRef(false);
  if (stillQueued > 0) batchSeen.current = true;
  useEffect(() => {
    if ((phase === 'sending' || phase === 'held') && batchSeen.current && batchSize > 0 && stillQueued === 0) setPhase('sent');
  }, [phase, batchSize, stillQueued]);

  if (!data) return <NotFound />;
  const { job, forecast } = data;
  const category = stageCategories.list.find((c) => c.id === categoryId) ?? null;
  const stage = stages.find((s) => s.id === effectiveStage);
  const signalOff = noSignal(offline);

  const neededWords = (c: PhotoCategory): string | undefined => {
    const hp = forecast?.holdPoints.find((h) => h.required.some((r) => r.categoryId === c.id));
    if (!hp) return 'Needed for an inspection';
    const name = hp.stepName.charAt(0).toLowerCase() + hp.stepName.slice(1);
    return `Needed for the ${name}`;
  };

  const chooseStage = (sid: string) => {
    setStageId(sid);
    // A category belongs to one stage; General carries over.
    if (category && category.stageId !== null && category.stageId !== sid) setCategoryId(null);
  };

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/') || f.type === '');
    if (files.length) {
      setPicked((cur) => [
        ...cur,
        ...files.map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, url: URL.createObjectURL(file) })),
      ]);
      if (phase !== 'pick') {
        setPhase('pick');
        setBatch([]);
        setBatchSize(0);
      }
    }
    e.target.value = '';
  };

  const removePicked = (key: string) => {
    setPicked((cur) => {
      const gone = cur.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return cur.filter((p) => p.key !== key);
    });
  };

  const upload = async () => {
    if (!category || picked.length === 0 || !effectiveStage) return;
    setProblem(null);
    setPhase('saving');
    const stageLabel = category.stageId === null ? 'General' : `${stage?.name ?? ''}, ${category.name}`;
    setFiledUnder(stageLabel);
    const ids: string[] = [];
    try {
      // Saved on the phone first (flow b step 6): from this moment they can't be lost.
      for (const p of picked) {
        const { dataUrl, thumbDataUrl } = await shrinkForUpload(p.file);
        const q: QueuedPhoto = await api.queuePhoto({
          jobId: job.id,
          stageId: category.stageId === null ? null : effectiveStage,
          categoryId: category.id,
          dataUrl,
          takenOn: today,
        });
        await sharedPhotoQueue().update(q.id, { thumbDataUrl, blob: p.file });
        ids.push(q.id);
      }
    } catch (err) {
      // Keep what was picked; say what went wrong (UI_PLAN shared states: never clear a form on error).
      setProblem(err instanceof Error ? err.message : 'Could not save the photos on this phone.');
      setPhase('pick');
      return;
    }
    picked.forEach((p) => URL.revokeObjectURL(p.url));
    setPicked([]);
    batchSeen.current = false;
    setBatch(ids);
    setBatchSize(ids.length);
    if (noSignal(api.getSession().offline)) {
      setPhase('held');
      return;
    }
    setPhase('sending');
    await api.flushPhotoQueue();
    // Signal may have dropped part way: whatever is left is held, calmly.
    const left = (await api.listQueuedPhotos()).filter((p) => ids.includes(p.id)).length;
    setPhase(left === 0 ? 'sent' : 'held');
  };

  const n = picked.length;
  const canUpload = n > 0 && !!category && phase !== 'saving' && phase !== 'sending';
  const heldCount = batch.filter((qid) => queued.some((p) => p.id === qid)).length;
  const jobHref = `/jobs/${job.id}`;

  return (
    <main className="page upload" data-testid="photo-upload">
      <PageHeader
        title="Upload photos"
        meta={stage ? `${stage.name} stage${stage.id === currentStageId ? ' now' : ''}` : undefined}
        back={{ to: jobHref, label: job.name }}
        actions={
          <Link to="/jobs" className="upload__change-job">
            Different job
          </Link>
        }
      />

      <section className="upload__block" aria-labelledby="upload-stage-h">
        <h2 id="upload-stage-h" className="upload__label">
          Stage
        </h2>
        <div className="upload__stages" role="radiogroup" aria-label="Stage">
          {stages.map((s) => {
            const chosen = s.id === effectiveStage;
            const now = s.id === currentStageId;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={chosen}
                className={`upload__stage${chosen ? ' upload__stage--chosen' : ''}`}
                onClick={() => chooseStage(s.id)}
                data-testid={`upload-stage-${s.id}`}
              >
                <span>{s.name}</span>
                {now && <span className="upload__stage-now">now</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="upload__block" aria-labelledby="upload-category-h">
        <h2 id="upload-category-h" className="upload__label">
          Category
        </h2>
        {stageCategories.own.length === 0 && (
          <p className="upload__quiet" data-testid="upload-no-categories">
            Dominic hasn't set up photo categories for {stage?.name ?? 'this stage'} yet. File these under General for now.
          </p>
        )}
        <CategoryPicker
          categories={stageCategories.list}
          counts={counts}
          queued={queuedCounts}
          value={categoryId}
          onChange={setCategoryId}
          neededWords={neededWords}
        />
      </section>

      <section className="upload__block" aria-labelledby="upload-photos-h">
        <h2 id="upload-photos-h" className="upload__label">
          Photos
        </h2>
        <input
          ref={rollInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={addFiles}
          data-testid="upload-file-input"
          aria-label="Choose photos"
          tabIndex={-1}
        />
        {layout === 'phone' && (
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={addFiles}
            data-testid="upload-camera-input"
            aria-label="Take a photo"
            tabIndex={-1}
          />
        )}
        <div className="upload__choose">
          <button type="button" className="btn upload__choose-btn" onClick={() => rollInput.current?.click()} data-testid="upload-choose">
            {layout === 'phone' ? 'Choose from camera roll' : 'Choose photos'}
          </button>
          {layout === 'phone' && (
            <button type="button" className="btn upload__choose-btn" onClick={() => cameraInput.current?.click()} data-testid="upload-take">
              Take a photo
            </button>
          )}
        </div>

        {n > 0 && (
          <ul className="upload__grid" aria-label={`${plural(n, 'photo')} chosen`} data-testid="upload-previews">
            {picked.map((p, i) => (
              <li key={p.key} className="upload__tile" data-testid={`upload-preview-${i + 1}`}>
                <img src={p.url} alt={`Photo ${i + 1}, ${p.file.name}`} className="upload__thumb" />
                <button type="button" className="upload__remove" onClick={() => removePicked(p.key)} data-testid={`upload-remove-${i + 1}`}>
                  Remove
                  <span className="sr-only"> photo {i + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="upload__send" aria-live="polite">
        {problem && (
          <p className="upload__problem" role="alert" data-testid="upload-problem">
            {problem} Your photos are still here. Try again.
          </p>
        )}

        {phase === 'saving' && (
          <p className="upload__line" data-testid="upload-progress">
            Saving {plural(n, 'photo')} on this phone
          </p>
        )}

        {phase === 'sending' && (
          <div className="upload__progress" data-testid="upload-progress">
            <p className="upload__line">
              Sending <span className="display upload__figure">{Math.min(sentCount + 1, batchSize)}</span> of {batchSize}
            </p>
            <div className="upload__bar" aria-hidden="true">
              <div className="upload__bar-fill" style={{ width: `${batchSize ? (sentCount / batchSize) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {phase === 'held' && (
          <p className="upload__note" data-testid="upload-offline-note">
            <ClockGlyph className="upload__note-glyph" />
            <span>
              No signal: {plural(heldCount, 'photo')} saved on this phone, they'll send when you're back in range.
            </span>
          </p>
        )}

        {phase === 'sent' && (
          <p className="upload__done" data-testid="upload-done">
            All {plural(batchSize, 'photo')} uploaded to {filedUnder}.
          </p>
        )}

        {(phase === 'pick' || phase === 'saving' || phase === 'sending') && (
          <>
            {category && n > 0 && (
              <p className="upload__filing" data-testid="upload-filing">
                Filing under {category.stageId === null ? 'General' : `${stage?.name}: ${category.name}`}
              </p>
            )}
            {phase === 'pick' && n > 0 && !category && <p className="upload__hint">Pick a category first.</p>}
            {phase === 'pick' && n === 0 && <p className="upload__hint">Choose the photos to upload.</p>}
            <button type="button" className="btn btn--primary upload__submit" onClick={() => void upload()} disabled={!canUpload} data-testid="upload-submit">
              {n > 0 ? `Upload ${plural(n, 'photo')}` : 'Upload photos'}
            </button>
          </>
        )}

        {(phase === 'held' || phase === 'sent') && (
          <div className="upload__after">
            <Link to={jobHref} className="btn btn--primary upload__submit" data-testid="upload-finish">
              Done
            </Link>
            <button type="button" className="btn upload__more" onClick={() => rollInput.current?.click()} data-testid="upload-more">
              Add more photos
            </button>
          </div>
        )}
        {phase === 'held' && signalOff && (
          <p className="upload__hint">
            <Link to="/queue">See what's waiting to send</Link>
          </p>
        )}
      </section>
    </main>
  );
}
