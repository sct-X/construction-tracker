import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

/** True below the phone breakpoint (768px). Mirrors the media query in the CSS. */
export function usePhoneWidth(): boolean {
  const [narrow, setNarrow] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(QUERY).matches));
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setNarrow(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
