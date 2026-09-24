import type { PointerEvent } from 'react';

/**
 * Interactive illumination (Liquid Glass, DESIGN.md "Material"): a pressed
 * glass item lights from the point of contact. Put this on the glass group
 * as one delegated `onPointerDown`; it writes the point to the pressed
 * `.lg-press` item and CSS (`.glass .lg-press` in base.css) draws and
 * spreads the glow while it is held.
 */
export function lightFromTouch(e: PointerEvent<HTMLElement>) {
  const el = (e.target as Element).closest<HTMLElement>('.lg-press');
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--press-x', `${e.clientX - r.left}px`);
  el.style.setProperty('--press-y', `${e.clientY - r.top}px`);
}
