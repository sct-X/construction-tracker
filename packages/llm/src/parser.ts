import { buildSystemPrompt } from './prompt.js';
import { normalizeMessages } from './providers/common.js';
import { ASK_QUESTION_TOOL, READ_TOOL_NAMES, opToolNames, parserTools } from './tools.js';
import type { LlmProvider, LlmResponse, ParseContext, ParseResult, Parser } from './types.js';

export const REPHRASE_QUESTION = "Sorry, I didn't catch that. Can you say it another way?";
export const FALLBACK_REPLY = "I can't help with that one. Tell me a change (ETA, booking, step done, note) or ask about a job.";

export interface ParserOptions {
  /** Called with every raw model response (usage logging, eval). */
  onResponse?: (res: LlmResponse) => void;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Map a model response to a ParseResult. Precedence:
 * malformed args -> question (rephrase); ask_question -> question; any op -> ops (reads ignored:
 * changes don't need reads); else first read -> read; else text -> reply. Unknown tool names are ignored.
 */
export function mapResponse(res: LlmResponse): ParseResult {
  const ops = new Set(opToolNames());
  const reads = new Set(READ_TOOL_NAMES);
  const known = res.toolCalls.filter(
    (c) => ops.has(c.name) || reads.has(c.name) || c.name === ASK_QUESTION_TOOL.name,
  );

  if (known.some((c) => c.malformed || !isPlainObject(c.args))) return { kind: 'question', text: REPHRASE_QUESTION };

  const ask = known.find((c) => c.name === ASK_QUESTION_TOOL.name);
  if (ask) {
    const q = typeof ask.args.question === 'string' ? ask.args.question.trim() : '';
    return { kind: 'question', text: q || REPHRASE_QUESTION };
  }

  const opCalls = known.filter((c) => ops.has(c.name));
  if (opCalls.length) return { kind: 'ops', calls: opCalls.map((c) => ({ op: c.name, args: c.args })) };

  const read = known.find((c) => reads.has(c.name));
  if (read) return { kind: 'read', tool: read.name, args: read.args };

  if (res.toolCalls.length) return { kind: 'question', text: REPHRASE_QUESTION }; // only unknown tools
  const text = res.text?.trim();
  return { kind: 'reply', text: text || FALLBACK_REPLY };
}

export function createParser(provider: LlmProvider, options: ParserOptions = {}): Parser {
  const tools = parserTools();
  return {
    async parse(text: string, ctx: ParseContext): Promise<ParseResult> {
      const messages = normalizeMessages([...(ctx.history ?? []), { role: 'user', content: text }]);
      const res = await provider.complete({ system: buildSystemPrompt(ctx), messages, tools });
      options.onResponse?.(res);
      return mapResponse(res);
    },
  };
}
