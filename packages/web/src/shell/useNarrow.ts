import { useEffect, useState } from 'react';

/** The phone breakpoint (v1): below 768px. Mirrors `@media (max-width: 767.98px)` in the CSS. */
export const PHONE_QUERY = '(max-width: 767.98px)';

/** True below the phone breakpoint. False where matchMedia is missing (jsdom). */
export function usePhoneWidth(): boolean {
  const [narrow, setNarrow] = useState(() => globalThis.matchMedia?.(PHONE_QUERY).matches ?? false);
  useEffect(() => {
    const mql = globalThis.matchMedia?.(PHONE_QUERY);
    if (!mql) return;
    const onChange = () => setNarrow(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
