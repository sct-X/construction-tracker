import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * The phone tab bar minimises on scroll down (iOS 26
 * `.tabBarMinimizeBehavior(.onScrollDown)`, DESIGN.md "Material").
 *
 * `nextMinimised` is the rule, kept pure so it is unit-tested:
 *  - it only minimises once the page is past `TOP` and has travelled
 *    `DOWN` px downward in one run (hysteresis: a small wobble does nothing);
 *  - it restores after `UP` px upward in one run, near the top, or at the
 *    bottom of the page (so the last row's actions are never under a
 *    compact bar the reader can't see coming back);
 *  - a change of direction starts a new run.
 */
export const TOP = 64;
export const DOWN = 32;
export const UP = 16;
export const BOTTOM_SLACK = 4;

export interface ScrollRun {
  minimised: boolean;
  lastY: number;
  /** Signed distance travelled in the current direction. */
  run: number;
}

export function nextMinimised(prev: ScrollRun, y: number, maxY: number): ScrollRun {
  const dy = y - prev.lastY;
  const run = dy === 0 ? prev.run : Math.sign(dy) === Math.sign(prev.run) ? prev.run + dy : dy;
  let minimised = prev.minimised;
  if (y <= TOP || y >= maxY - BOTTOM_SLACK) minimised = false;
  else if (run >= DOWN) minimised = true;
  else if (run <= -UP) minimised = false;
  return { minimised, lastY: y, run };
}

/**
 * Watches the window's scroll (passive listener, read once per animation
 * frame) and returns whether the bar should be compact. State changes only
 * when the answer changes. While anything inside `barRef` has focus it
 * stays full size, and `restore()` expands it (a tap on the bar, a new page).
 */
export function useTabBarMinimise(enabled: boolean, barRef: RefObject<HTMLElement | null>) {
  const [minimised, setMinimised] = useState(false);
  const state = useRef<ScrollRun>({ minimised: false, lastY: 0, run: 0 });

  useEffect(() => {
    if (!enabled) return;
    state.current = { minimised: false, lastY: window.scrollY, run: 0 };
    let frame = 0;
    const read = () => {
      frame = 0;
      const doc = document.documentElement;
      const maxY = Math.max(0, doc.scrollHeight - window.innerHeight);
      const next = nextMinimised(state.current, window.scrollY, maxY);
      const bar = barRef.current;
      if (next.minimised && bar && bar.contains(document.activeElement)) next.minimised = false;
      if (next.minimised !== state.current.minimised) setMinimised(next.minimised);
      state.current = next;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled, barRef]);

  const restore = () => {
    state.current = { ...state.current, minimised: false, run: 0 };
    setMinimised(false);
  };

  return { minimised: enabled && minimised, restore };
}
