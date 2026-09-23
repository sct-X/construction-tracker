import { describe, expect, it } from 'vitest';
import { advanceLabel, nextStatus } from './itemFlow';

describe('item flow: one status path for every list', () => {
  it("words each type's first move exactly, then confirmed, then done", () => {
    expect(nextStatus({ type: 'trade', status: 'to_do' })).toEqual({ status: 'booked', label: 'Mark booked' });
    expect(nextStatus({ type: 'inspection', status: 'to_do' })).toEqual({ status: 'booked', label: 'Mark booked' });
    expect(nextStatus({ type: 'defect', status: 'to_do' })).toEqual({ status: 'booked', label: 'Mark booked' });
    expect(nextStatus({ type: 'material', status: 'to_do' })).toEqual({ status: 'booked', label: 'Mark ordered' });
    expect(nextStatus({ type: 'consultant_report', status: 'to_do' })).toEqual({ status: 'booked', label: 'Mark requested' });
    expect(nextStatus({ type: 'council_request', status: 'to_do' })).toEqual({ status: 'booked', label: 'Mark requested' });
    expect(nextStatus({ type: 'material', status: 'booked' })).toEqual({ status: 'confirmed', label: 'Mark confirmed' });
    expect(nextStatus({ type: 'council_request', status: 'booked' })).toEqual({ status: 'confirmed', label: 'Mark received' });
    expect(nextStatus({ type: 'trade', status: 'confirmed' })).toEqual({ status: 'done', label: 'Mark done' });
    expect(nextStatus({ type: 'trade', status: 'done' })).toBeNull();
    expect(advanceLabel({ type: 'trade', status: 'done' })).toBeNull();
  });

  it('decisions, reminders and conditions of consent go straight to done', () => {
    for (const type of ['decision', 'manual_reminder', 'condition_of_consent'] as const) {
      expect(nextStatus({ type, status: 'to_do' })).toEqual({ status: 'done', label: 'Mark done' });
    }
  });
});
