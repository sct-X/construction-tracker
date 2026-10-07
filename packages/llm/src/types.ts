// Public interface of @ct/llm. Other packages (packages/bot) depend on these shapes:
// fields may be added, never renamed.

/** A tool the model may call. `parameters` is a JSON schema (object). */
export interface ToolDef {
  name: string;
  description: string;
  parameters: object /* JSON schema */;
}

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export interface LlmRequest {
  system: string;
  messages: ChatMsg[];
  tools: ToolDef[];
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmToolCall {
  name: string;
  args: Record<string, unknown>;
  /** Set by a provider when the model's arguments were not a JSON object (args is then {}). */
  malformed?: boolean;
  /** The raw argument text when it could not be parsed. */
  rawArgs?: string;
}

export interface LlmResponse {
  toolCalls: LlmToolCall[];
  text?: string;
  usage: LlmUsage;
}

export interface LlmProvider {
  readonly id: string;
  readonly model: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

export type ParseResult =
  | { kind: 'ops'; calls: { op: string; args: Record<string, unknown> }[] } // day-to-day change(s) via core operations
  | { kind: 'read'; tool: string; args: Record<string, unknown> } // read-only question
  | { kind: 'question'; text: string } // model needs a detail
  | { kind: 'reply'; text: string }; // chit-chat / can't help

export interface ParseContext {
  today: string /* YYYY-MM-DD Sydney */;
  jobs: string[];
  trades: string[];
  shipments: string[];
  history?: ChatMsg[];
}

export interface Parser {
  parse(text: string, ctx: ParseContext): Promise<ParseResult>;
}

/** Thrown by providers on HTTP / transport failure. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}
