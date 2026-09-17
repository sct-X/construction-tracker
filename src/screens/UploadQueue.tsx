/**
 * Upload queue (UI_PLAN 3.16): what hasn't been sent yet, so nobody wonders
 * whether their photos made it. Read from the phone's own storage, never
 * the server. Grouped by job, then by stage and category, each photo with
 * its thumbnail and its state in words: waiting, sending, or failed with
 * the reason. "Send now" sends everything; Retry and Remove act on one.
 *
 * One sentence explains why the screen exists: iPhones send only while the
 * app is open (UI_PLAN section 6).
 */
import { Link } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import { sharedPhotoQueue, type QueuedPhoto } from '../data/photoQueue';
import { formatShort } from '../domain/dates';
import { ClockGlyph, noSignal, useQueuedPhotos } from '../components/QueueBadge';
import { StatusText } from '../components/StatusText';
import { currentJobId } from '../shell/lastJob';
import { PageHeader } from '../shell/PageHeader';
import './uploadQueue.css';

interface Group {
  key: string;
  jobId: string;
  jobName: string;
  where: string;
  photos: QueuedPhoto[];
}

function stateWords(p: QueuedPhoto): { tone: 'muted' | 'plain' | 'amber'; text: string } {
  if (p.state === 'sending') return { tone: 'plain', text: 'Sending' };
  if (p.state === 'failed') return { tone: 'amber', text: p.error === 'No signal' ? "Didn't send, no signal" : `Didn't send: ${p.error ?? 'unknown'}` };
  return { tone: 'muted', text: 'Waiting' };
}

export default function UploadQueue() {
  const api = useApi();
  const { offline } = useSession();
  const queued = useQueuedPhotos();
  const signalOff = noSignal(offline);

  // Names for the groups, from the api (photos for a job this side can't see keep their ids).
  const jobIds = [...new Set(queued.map((p) => p.jobId))].join(',');
  const names = useQuery(
    (api) => {
      const out: Record<string, { name: string; stages: Record<string, string>; categories: Record<string, string> }> = {};
      for (const jobId of jobIds ? jobIds.split(',') : []) {
        const job = api.getJob(jobId);
        out[jobId] = {
          name: job?.name ?? jobId,
          stages: Object.fromEntries(api.listStages(jobId).map((s) => [s.id, s.name])),
          categories: Object.fromEntries(api.listPhotoCategories(jobId).map((c) => [c.id, c.name])),
        };
      }
      return out;
    },
    [jobIds],
  );
  const homeJob = useQuery((api) => currentJobId(api), []);

  const groups: Group[] = [];
  for (const p of queued) {
    const key = `${p.jobId}|${p.stageId ?? ''}|${p.categoryId}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const n = names[p.jobId];
      const stageName = p.stageId ? n?.stages[p.stageId] : undefined;
      const catName = n?.categories[p.categoryId] ?? p.categoryId;
      g = { key, jobId: p.jobId, jobName: n?.name ?? p.jobId, where: stageName ? `${stageName}: ${catName}` : catName, photos: [] };
      groups.push(g);
    }
    g.photos.push(p);
  }

  const total = queued.length;
  const failed = queued.filter((p) => p.state === 'failed').length;
  const sending = queued.some((p) => p.state === 'sending');

  const sendNow = () => void api.flushPhotoQueue();
  const retry = async (id: string) => {
    await sharedPhotoQueue().update(id, { state: 'queued', error: undefined });
    void api.flushPhotoQueue();
  };
  const remove = (id: string) => void api.removeQueuedPhoto(id);

  const meta =
    total === 0
      ? "Everything's uploaded."
      : failed > 0
        ? `${total} photo${total === 1 ? '' : 's'} waiting to send, ${failed} didn't go`
        : `${total} photo${total === 1 ? '' : 's'} waiting to send`;

  return (
    <main className="page queue" data-testid="upload-queue">
      <PageHeader
        title="Upload queue"
        meta={meta}
        actions={
          total > 0 ? (
            <button type="button" className="btn btn--primary" onClick={sendNow} disabled={signalOff || sending} data-testid="queue-send-now">
              {sending ? 'Sending' : 'Send now'}
            </button>
          ) : undefined
        }
      />

      <p className="queue__why">On an iPhone, photos send only while the app is open, so keep it open until this list is empty.</p>

      {signalOff && total > 0 && (
        <p className="queue__note" data-testid="queue-offline-note">
          <ClockGlyph className="queue__note-glyph" />
          <span>No signal. These are saved on this phone and will send by themselves when you're back in range.</span>
        </p>
      )}

      {total === 0 ? (
        <div className="queue__empty" data-testid="queue-empty">
          <p className="queue__empty-line">Everything's uploaded.</p>
          <Link to={homeJob ? `/jobs/${homeJob}/upload` : '/jobs'} className="btn queue__empty-btn">
            Upload more photos
          </Link>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="queue__group" aria-label={`${g.jobName}, ${g.where}`} data-testid={`queue-group-${g.jobId}-${g.photos[0].categoryId}`}>
            <h2 className="queue__group-title">
              <span className="queue__group-job">{g.jobName}</span>
              <span className="queue__group-where">{g.where}</span>
              <span className="queue__group-count">
                {g.photos.length} photo{g.photos.length === 1 ? '' : 's'}
              </span>
            </h2>
            <ul className="queue__list">
              {g.photos.map((p) => {
                const w = stateWords(p);
                return (
                  <li key={p.id} className="queue__item" data-testid={`queue-item-${p.id}`} data-state={p.state}>
                    <img src={p.thumbDataUrl ?? p.dataUrl} alt="" className="queue__thumb" />
                    <div className="queue__words">
                      <span className="queue__taken">Taken {formatShort(p.takenOn)}</span>
                      <StatusText tone={w.tone} plain={w.tone === 'plain'} className="queue__state">
                        {p.state === 'queued' && <ClockGlyph className="queue__state-glyph" />}
                        {w.text}
                      </StatusText>
                    </div>
                    <div className="queue__actions">
                      {p.state === 'failed' && (
                        <button type="button" className="btn queue__btn" onClick={() => void retry(p.id)} disabled={signalOff} data-testid={`queue-retry-${p.id}`}>
                          Retry
                        </button>
                      )}
                      <button type="button" className="btn queue__btn" onClick={() => remove(p.id)} disabled={p.state === 'sending'} data-testid={`queue-remove-${p.id}`}>
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
