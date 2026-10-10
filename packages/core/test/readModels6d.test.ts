/**
 * Stage 6d read-model additions for the v1 Setup screens: the trades list's
 * "On jobs" names and the templates list's counts and stage sequence. Seed.
 */
import { describe, expect, it } from 'vitest';
import { buildSeed, templatesList, tradesList } from '../src/index.js';

describe('Stage 6d read models', () => {
  const ds = buildSeed();

  it('tradesList names the live jobs each trade has open items on', () => {
    const rows = tradesList(ds, { sideId: ds.jobs.find((j) => j.id === 'park-rd')!.sideId });
    const tiling = rows.find((t) => t.id === 'tr-harbour-tiling')!;
    expect(tiling.jobNames).toEqual(['Beatty St', 'Park Rd']);
    expect(tiling.openItems).toBeGreaterThan(0);
    for (const t of rows) {
      expect(t.jobNames.length > 0).toBe(t.openItems > 0);
      expect([...t.jobNames].sort((a, b) => a.localeCompare(b))).toEqual(t.jobNames);
    }
  });

  it('templatesList counts needs and photo sets and lists the stages in order', () => {
    const duplex = templatesList(ds).find((t) => t.jobId === 'tpl-duplex')!;
    expect(duplex).toMatchObject({ stages: 8, steps: 29, needs: 25, photoSets: 13 });
    expect(duplex.stageNames).toEqual(['Site establishment', 'Slab', 'Frame', 'Roof', 'Lock-up', 'External works', 'Fit-out', 'Handover']);
    expect(duplex.path).toBe(ds.jobs.find((j) => j.id === 'tpl-duplex')!.path);
  });
});
