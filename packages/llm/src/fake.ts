import type { LlmProvider, LlmRequest, LlmResponse } from './types.js';

type Step = LlmResponse | ((req: LlmRequest) => LlmResponse);

/**
 * Scripted provider for tests: each complete() call returns the next scripted response
 * (or calls the function with the request). Records every request in `requests`.
 * Throws when the script runs out.
 */
export class FakeLlm implements LlmProvider {
  readonly id = 'fake';
  readonly model = 'fake';
  readonly requests: LlmRequest[] = [];
  private index = 0;

  constructor(private readonly script: Array<Step>) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.requests.push(req);
    const step = this.script[this.index++];
    if (step === undefined) throw new Error(`FakeLlm: script exhausted after ${this.script.length} call(s)`);
    return typeof step === 'function' ? step(req) : step;
  }

  /** How many scripted responses are left. */
  get remaining(): number {
    return this.script.length - this.index;
  }
}

/** Shorthand for scripts: `toolCall('confirm_job', { job: 'Park Rd' })`. */
export function toolCall(name: string, args: Record<string, unknown> = {}): LlmResponse {
  return { toolCalls: [{ name, args }], usage: { inputTokens: 0, outputTokens: 0 } };
}

/** Shorthand for scripts: a plain text answer with no tool call. */
export function textReply(text: string): LlmResponse {
  return { toolCalls: [], text, usage: { inputTokens: 0, outputTokens: 0 } };
}
