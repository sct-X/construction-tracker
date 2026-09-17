/**
 * Alec's home is the build job he last opened. The shell records it whenever
 * a `/jobs/:id` route renders; the landing route and the Today tab read it.
 */
import type { TrackerApi } from '../data/api';

const KEY = 'construction-tracker.lastJob.v1';

export function rememberJob(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage blocked: the fallback below still finds a job */
  }
}

/** The last opened build job on this side, else the first build job, else undefined. */
export function currentJobId(api: TrackerApi): string | undefined {
  const builds = api.listJobs({ kind: 'build' });
  let last: string | null = null;
  try {
    last = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  if (last && builds.some((j) => j.id === last)) return last;
  return builds[0]?.id;
}
