import { describe, expect, it } from 'vitest';
import { createMockApi } from '../../data/mockApi';
import { MemoryStorage } from '../../data/storage';
import { DEFAULT_TODAY, PARK_RD } from '../../seed';
import { applyProgramDraft, cyclePath, cycleWords, diffProgram, draftId, makeStage, makeStep, nextPlannedStart, readProgram, withPlannedEnd } from './programDraft';

function dominic() {
  return createMockApi({ storage: new MemoryStorage(), session: { personId: 'dominic', today: DEFAULT_TODAY } });
}

describe('program draft: cycles', () => {
  it('refuses a link that would loop and names the chain', () => {
    const api = dominic();
    const p = readProgram(api, PARK_RD);
    const names = new Map(p.steps.map((s) => [s.id, s.name]));
    // Install windows waits for Cladding; Cladding waiting for Install windows would loop.
    expect(cyclePath(p.links, 'pr-cladding', 'pr-install-windows')).toEqual(['pr-install-windows', 'pr-cladding']);
    expect(cycleWords(cyclePath(p.links, 'pr-cladding', 'pr-install-windows')!, 'pr-cladding', names)).toBe(
      "External cladding can't wait for Install windows: Install windows already waits for External cladding. That would loop.",
    );
    // Further apart: the refusal names what it goes through.
    const far = cyclePath(p.links, 'pr-cladding', 'pr-external-doors')!;
    expect(far[0]).toBe('pr-external-doors');
    expect(far[far.length - 1]).toBe('pr-cladding');
    expect(cycleWords(far, 'pr-cladding', names)).toContain('through Install windows');
    // A step cannot wait for itself; an honest link is fine.
    expect(cyclePath(p.links, 'pr-cladding', 'pr-cladding')).toEqual(['pr-cladding']);
    expect(cyclePath(p.links, 'pr-install-windows', 'pr-site-setup')).toBeNull();
  });
});

describe('program draft: new records', () => {
  it('a new step starts the working day after the latest planned end, a template step has no date', () => {
    const api = dominic();
    const p = readProgram(api, PARK_RD);
    const stage = p.stages[p.stages.length - 1];
    const step = makeStep(p, stage, { today: DEFAULT_TODAY, dated: true });
    expect(step.id.startsWith('draft-step-')).toBe(true);
    expect(step.durationDays).toBe(5);
    expect(step.plannedStart).toBe(nextPlannedStart(p.steps.filter((s) => s.stageId === stage.id), DEFAULT_TODAY));
    expect(step.plannedEnd).toBeDefined();
    const bare = makeStep(p, stage, { today: DEFAULT_TODAY, dated: false });
    expect(bare.plannedStart).toBeUndefined();
    expect(nextPlannedStart([], '2026-09-19')).toBe('2026-09-21'); // a Saturday snaps to Monday
  });

  it('planned end derives from planned start over working days', () => {
    const api = dominic();
    const step = api.getStep('pr-install-windows')!;
    expect(withPlannedEnd({ ...step, durationDays: 15 }).plannedEnd).toBe('2026-11-20');
    expect(withPlannedEnd({ ...step, plannedStart: undefined }).plannedEnd).toBeUndefined();
  });
});

describe('program draft: diff and save', () => {
  it('an unchanged draft is no changes', () => {
    const api = dominic();
    const p = readProgram(api, PARK_RD);
    expect(diffProgram(p, p)).toEqual([]);
  });

  it('saves a longer step, a new stage with a step, a link, a need and a required photo set, remapping draft ids', () => {
    const api = dominic();
    const saved = readProgram(api, PARK_RD);
    const draft = structuredClone(saved);
    draft.steps = draft.steps.map((s) => (s.id === 'pr-install-windows' ? withPlannedEnd({ ...s, durationDays: 15 }) : s));
    const stage = makeStage(draft, { sideId: 'side-nd', jobId: PARK_RD }, 'Pool');
    draft.stages.push(stage);
    const step = makeStep(draft, stage, { today: DEFAULT_TODAY, dated: true, name: 'Dig pool' });
    draft.steps.push(step);
    draft.links.push({ id: draftId('link'), sideId: 'side-nd', jobId: PARK_RD, stepId: step.id, waitsForStepId: 'pr-handover' });
    draft.requirements.push({ id: draftId('rq'), sideId: 'side-nd', jobId: PARK_RD, stepId: step.id, kind: 'trade', name: 'Pool builder', leadTimeWeeks: 6 });
    draft.photoCategories!.push({ id: draftId('pc'), sideId: 'side-nd', jobId: PARK_RD, stageId: stage.id, name: 'Pool shell', requiredForHoldPoint: true, order: 1 });

    const kinds = diffProgram(saved, draft).map((c) => c.kind);
    expect(kinds).toEqual(['stage_added', 'step_edited', 'step_added', 'link_added', 'requirement_added', 'category_added']);

    const activityBefore = api.listActivity({ jobId: PARK_RD }).length;
    const ids = applyProgramDraft(api, PARK_RD, saved, draft);
    const realStage = ids.get(stage.id)!;
    const realStep = ids.get(step.id)!;
    expect(realStage.startsWith('draft-')).toBe(false);
    expect(api.getStep('pr-install-windows')!.durationDays).toBe(15);
    expect(api.getStep('pr-install-windows')!.plannedEnd).toBe('2026-11-20');
    const stages = api.listStages(PARK_RD);
    expect(stages[stages.length - 1]).toMatchObject({ id: realStage, name: 'Pool' });
    expect(api.getStep(realStep)).toMatchObject({ stageId: realStage, name: 'Dig pool', durationDays: 5 });
    expect(api.listStepLinks(PARK_RD).some((l) => l.stepId === realStep && l.waitsForStepId === 'pr-handover')).toBe(true);
    expect(api.listRequirements(PARK_RD).some((r) => r.stepId === realStep && r.name === 'Pool builder')).toBe(true);
    expect(api.listPhotoCategories(PARK_RD, realStage).some((c) => c.name === 'Pool shell' && c.requiredForHoldPoint)).toBe(true);
    expect(api.listActivity({ jobId: PARK_RD }).length).toBeGreaterThan(activityBefore);
    // The forecast moved with it: Dig pool runs after Handover.
    expect(api.getForecast(PARK_RD)!.forecastFinish! > '2027-03-05').toBe(true);
    // Saved once, the program reads back as the draft: no further changes.
    expect(diffProgram(readProgram(api, PARK_RD), readProgram(api, PARK_RD))).toEqual([]);
  });

  it('deleting a stage takes its steps with it, and reordering stages sticks', () => {
    const api = dominic();
    const saved = readProgram(api, PARK_RD);
    const draft = structuredClone(saved);
    const last = [...draft.stages].sort((a, b) => a.order - b.order).pop()!;
    draft.stages = draft.stages.filter((s) => s.id !== last.id);
    draft.steps = draft.steps.filter((s) => s.stageId !== last.id);
    // Swap the first two stages.
    const [a, b] = [...draft.stages].sort((x, y) => x.order - y.order);
    draft.stages = draft.stages.map((s) => (s.id === a.id ? { ...s, order: b.order } : s.id === b.id ? { ...s, order: a.order } : s));
    const kinds = diffProgram(saved, draft).map((c) => c.kind);
    expect(kinds).toContain('stages_reordered');
    expect(kinds).toContain('stage_deleted');
    expect(kinds).not.toContain('step_deleted'); // the stage takes them
    applyProgramDraft(api, PARK_RD, saved, draft);
    expect(api.listStages(PARK_RD).map((s) => s.id)).not.toContain(last.id);
    expect(api.listSteps(PARK_RD).some((s) => s.stageId === last.id)).toBe(false);
    expect(api.listStages(PARK_RD)[0].id).toBe(b.id);
  });
});
