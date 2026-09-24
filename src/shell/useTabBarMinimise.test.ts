import { describe, expect, it } from 'vitest';
import { DOWN, TOP, UP, nextMinimised, type ScrollRun } from './useTabBarMinimise';

const start: ScrollRun = { minimised: false, lastY: 0, run: 0 };
const scroll = (from: ScrollRun, ys: number[], maxY = 5000) => ys.reduce((s, y) => nextMinimised(s, y, maxY), from);

describe('tab bar minimise on scroll down', () => {
  it('stays full size near the top however far it moves', () => {
    expect(scroll(start, [20, 40, TOP]).minimised).toBe(false);
  });

  it('minimises after a run of DOWN px past the top', () => {
    const s = scroll({ ...start, lastY: 100 }, [100 + DOWN - 1]);
    expect(s.minimised).toBe(false);
    expect(nextMinimised(s, 100 + DOWN + 1, 5000).minimised).toBe(true);
  });

  it('ignores a small wobble up (hysteresis) and restores after UP px up', () => {
    const down = scroll(start, [200, 400]);
    expect(down.minimised).toBe(true);
    expect(scroll(down, [400 - UP + 2]).minimised).toBe(true);
    expect(scroll(down, [400 - UP + 2, 400 - UP - 2]).minimised).toBe(false);
  });

  it('a change of direction starts a new run', () => {
    const s = scroll(start, [200, 400, 390, 400 + DOWN - 5]);
    // up 10, then down 15 + 10: the down run restarted at 390
    expect(s.run).toBe(400 + DOWN - 5 - 390);
  });

  it('restores at the bottom of the page', () => {
    const s = scroll(start, [200, 900], 1000);
    expect(s.minimised).toBe(true);
    expect(nextMinimised(s, 999, 1000).minimised).toBe(false);
  });

  it('restores on reaching the top', () => {
    const s = scroll(start, [200, 900]);
    expect(nextMinimised(s, 10, 5000).minimised).toBe(false);
  });
});
