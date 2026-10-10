/**
 * Interactive illumination (Liquid Glass, DESIGN.md "Material"): a pressed
 * glass item lights from the point of contact. The point is written to the
 * pressed item as --press-x/--press-y and CSS (base.css) draws and spreads
 * the glow while it is held.
 *
 * `installGlassPress` is the one passive, capturing document listener,
 * installed by the shell. It lights `.lg-press` items inside glass (the tab
 * bar, the phone job tabs) and the glass buttons (`.btn--glass`,
 * `.btn--glass-prominent`) wherever they sit, so no row or group needs a
 * handler of its own.
 */
const PRESSABLE = '.lg-press, .btn--glass, .btn--glass-prominent';

function light(target: EventTarget | null, x: number, y: number) {
  const el = target instanceof Element ? target.closest<HTMLElement>(PRESSABLE) : null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--press-x', `${x - r.left}px`);
  el.style.setProperty('--press-y', `${y - r.top}px`);
}

export function installGlassPress(doc: Document = document): () => void {
  const onDown = (e: PointerEvent) => light(e.target, e.clientX, e.clientY);
  doc.addEventListener('pointerdown', onDown, { passive: true, capture: true });
  return () => doc.removeEventListener('pointerdown', onDown, { capture: true });
}
