/**
 * "No signal" is a thin calm bar under the header: amber wash, one sentence,
 * no modal, no red. Shows the time the saved copy dates from, captured when
 * the signal dropped.
 */
import { useEffect, useRef } from 'react';
import { useSession } from '../data/context';

function clock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
}

export function OfflineBar() {
  const { offline } = useSession();
  const since = useRef<string | null>(null);
  useEffect(() => {
    if (offline && !since.current) since.current = clock(new Date());
    if (!offline) since.current = null;
  }, [offline]);
  if (!offline) return null;
  const at = since.current ?? clock(new Date());
  return (
    <div className="offline-bar" data-testid="offline-bar" role="status">
      No signal. Showing what loaded at {at}. Photos, notes and ticks wait in the queue.
    </div>
  );
}
