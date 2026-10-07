/**
 * The operation registry and the machine-readable catalogue the LLM layer
 * turns into tool definitions.
 */
import { z } from 'zod';
import type { Dataset } from '../types.js';
import { DAILY_OPS } from './daily.js';
import { runOp, type OpContext, type OpDef, type OpGroup, type OpResult } from './framework.js';
import { SETUP_OPS } from './setup.js';

export * from './framework.js';
export * from './daily.js';
export * from './setup.js';

export const OPERATIONS: readonly OpDef[] = [...DAILY_OPS, ...SETUP_OPS] as unknown as OpDef[];

export const OPERATION_NAMES = OPERATIONS.map((o) => o.name);

export function getOperation(name: string): OpDef | undefined {
  return OPERATIONS.find((o) => o.name === name);
}

/** Run an operation by name with raw (unvalidated) args. Unknown name: refusal. */
export function runOperation(ds: Dataset, name: string, args: unknown, ctx: OpContext): OpResult {
  const def = getOperation(name);
  if (!def) return { kind: 'refusal', op: name, reason: `There is no operation called ${name}.` };
  return runOp(def, ds, args, ctx);
}

export interface OperationSpec {
  name: string;
  description: string;
  group: OpGroup;
  /** JSON Schema (draft 2020-12) for the args object. */
  parameters: Record<string, unknown>;
}

/** Every operation as {name, description, group, JSON schema}. Filter by group for the bot ('daily'). */
export function operationCatalogue(group?: OpGroup): OperationSpec[] {
  return OPERATIONS.filter((o) => !group || o.group === group).map((o) => {
    const parameters = z.toJSONSchema(o.schema, { target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>;
    return { name: o.name, description: o.description, group: o.group, parameters };
  });
}
