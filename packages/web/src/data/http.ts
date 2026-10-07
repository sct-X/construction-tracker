/**
 * HttpDashboardApi: DashboardApi over the local server.
 * Contract: POST /api/rpc/:method with {"args": [...]} -> {"result": value} or {"error": "..."}.
 * Relative URLs, so the same build works wherever the server mounts it.
 */
import { apiPhotoUrl, placeholderPhotoUrl, type DashboardApi } from '@ct/core';

type Fetch = typeof fetch;

export class ApiError extends Error {
  constructor(
    readonly method: string,
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** JSON turns `undefined` in an array into `null`; drop trailing ones so optional args keep their defaults. */
export function trimArgs(args: unknown[]): unknown[] {
  const out = [...args];
  while (out.length && out[out.length - 1] === undefined) out.pop();
  return out.map((a) => (a === undefined ? null : a));
}

export class HttpDashboardApi implements DashboardApi {
  constructor(
    private readonly base = 'api',
    private readonly fetchImpl: Fetch = (...a) => fetch(...a),
  ) {}

  private async call<T>(method: keyof DashboardApi, ...args: unknown[]): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}/rpc/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ args: trimArgs(args) }),
      });
    } catch {
      throw new ApiError(method, 'The tracker server is not answering. Check it is running, then try again.', null);
    }
    let body: { result?: unknown; error?: string } | null = null;
    try {
      body = (await res.json()) as { result?: unknown; error?: string };
    } catch {
      body = null;
    }
    if (!res.ok || !body || 'error' in body) {
      const why = body?.error ?? `The server answered ${res.status} ${res.statusText}`.trim();
      throw new ApiError(method, why, res.status);
    }
    return body.result as T;
  }

  getToday: DashboardApi['getToday'] = () => this.call('getToday');
  listSides: DashboardApi['listSides'] = () => this.call('listSides');
  getMonday: DashboardApi['getMonday'] = (filter) => this.call('getMonday', filter);
  getWhyItMoved: DashboardApi['getWhyItMoved'] = (jobId) => this.call('getWhyItMoved', jobId);
  listJobs: DashboardApi['listJobs'] = (filter) => this.call('listJobs', filter);
  getJobOverview: DashboardApi['getJobOverview'] = (jobId) => this.call('getJobOverview', jobId);
  getProgram: DashboardApi['getProgram'] = (jobId) => this.call('getProgram', jobId);
  getStep: DashboardApi['getStep'] = (stepId) => this.call('getStep', stepId);
  getDesignChecklist: DashboardApi['getDesignChecklist'] = (jobId) => this.call('getDesignChecklist', jobId);
  getWaitingOn: DashboardApi['getWaitingOn'] = (filter) => this.call('getWaitingOn', filter);
  getToChase: DashboardApi['getToChase'] = (filter) => this.call('getToChase', filter);
  getShipments: DashboardApi['getShipments'] = (filter) => this.call('getShipments', filter);
  getPhotos: DashboardApi['getPhotos'] = (jobId) => this.call('getPhotos', jobId);
  getDailyNotes: DashboardApi['getDailyNotes'] = (jobId, opts) => this.call('getDailyNotes', jobId, opts);
  getChangeHistory: DashboardApi['getChangeHistory'] = (filter) => this.call('getChangeHistory', filter);
  listTrades: DashboardApi['listTrades'] = (filter) => this.call('listTrades', filter);
  listTemplates: DashboardApi['listTemplates'] = (filter) => this.call('listTemplates', filter);
  previewSetup: DashboardApi['previewSetup'] = (op, args) => this.call('previewSetup', op, args);
  applySetup: DashboardApi['applySetup'] = (op, args) => this.call('applySetup', op, args);
  undo: DashboardApi['undo'] = (changeSetId) => this.call('undo', changeSetId);

  /** Seed photos have no file on disk, so they get the same flat placeholder as the mock. */
  photoUrl: DashboardApi['photoUrl'] = (photo) => (photo.isPlaceholder ? placeholderPhotoUrl(photo) : apiPhotoUrl(photo.id));
}
