import { operationCatalogue } from '@ct/core';
import type { ToolDef } from './types.js';

/**
 * Args the bot sets itself, never the model: they are removed from the op tools the model
 * sees, and the bot merges them into the call (`attach_photo.filePath`, `messageId`).
 */
export const BOT_SET_ARGS: readonly string[] = ['filePath', 'messageId'];

/** The model's way to ask Dominic for a missing detail. Maps to ParseResult `question`. */
export const ASK_QUESTION_TOOL: ToolDef = {
  name: 'ask_question',
  description:
    'Ask Dominic one short question when a needed detail is missing or unclear (which job, which item, what date). Use instead of guessing.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'One short plain-English question.' },
    },
    required: ['question'],
    additionalProperties: false,
  },
};

const jobArg = { type: 'string', description: 'Job name as said, e.g. "Park Rd". Fuzzy-matched.' };

/**
 * Read-only tools. The bot answers these from core read models (no change is ever made).
 * Names are passed as said; the bot fuzzy-matches them like the operations do.
 */
export const READ_TOOLS: ToolDef[] = [
  {
    name: 'get_job_finish',
    description:
      "Answer when a build job will finish: forecast finish, planned finish, slip since last Monday and its cost (e.g. \"what's Park Rd's finish?\").",
    parameters: { type: 'object', properties: { job: jobArg }, required: ['job'], additionalProperties: false },
  },
  {
    name: 'get_why_it_moved',
    description: 'Answer why a job\'s finish moved since last Monday (e.g. "why did Beatty slip?").',
    parameters: { type: 'object', properties: { job: jobArg }, required: ['job'], additionalProperties: false },
  },
  {
    name: 'get_waiting_on',
    description:
      'List what is outstanding (items not done), optionally for one job or one owner (e.g. "what are we waiting on at Beatty?").',
    parameters: {
      type: 'object',
      properties: {
        job: jobArg,
        owner: { type: 'string', description: 'Who chases it, as said, e.g. "Dominic".' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_to_chase',
    description:
      'List what needs chasing or booking soon across all jobs (act-by dates within two weeks or passed), e.g. "what do I need to chase?".',
    parameters: {
      type: 'object',
      properties: { owner: { type: 'string', description: 'Who chases it, as said.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_shipments',
    description: 'List shipments with ETA and status, optionally for one job (e.g. "when are the Park Rd windows landing?").',
    parameters: { type: 'object', properties: { job: jobArg }, additionalProperties: false },
  },
  {
    name: 'get_next_hold_point',
    description:
      "Answer a job's next hold point: its date and which required photo categories are still empty (e.g. \"are we right for the slab inspection at Seaview?\").",
    parameters: { type: 'object', properties: { job: jobArg }, required: ['job'], additionalProperties: false },
  },
];

export const READ_TOOL_NAMES: readonly string[] = READ_TOOLS.map((t) => t.name);

function stripBotArgs(parameters: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _schema, ...rest } = parameters;
  const props = { ...((rest.properties as Record<string, unknown> | undefined) ?? {}) };
  for (const k of BOT_SET_ARGS) delete props[k];
  const required = Array.isArray(rest.required)
    ? (rest.required as string[]).filter((k) => !BOT_SET_ARGS.includes(k))
    : undefined;
  return { ...rest, properties: props, ...(required ? { required } : {}) };
}

/** Core's day-to-day operations as tools (bot-set args removed). */
export function opTools(): ToolDef[] {
  return operationCatalogue('daily').map((o) => ({
    name: o.name,
    description: o.description,
    parameters: stripBotArgs(o.parameters as Record<string, unknown>),
  }));
}

export function opToolNames(): string[] {
  return operationCatalogue('daily').map((o) => o.name);
}

/** Every tool the parser offers: day-to-day ops, read-only tools, ask_question. */
export function parserTools(): ToolDef[] {
  return [...opTools(), ...READ_TOOLS, ASK_QUESTION_TOOL];
}
