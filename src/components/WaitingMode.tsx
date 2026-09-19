/**
 * The List | Call switch on Waiting on. Call is the same list worked as a
 * phone call with one person; only admin and partners ring people, so the
 * switch draws nothing for anyone else.
 */
import { Link } from 'react-router-dom';
import { useSession } from '../data/context';

export function WaitingMode({ mode }: { mode: 'list' | 'call' }) {
  const { role } = useSession();
  if (role !== 'admin' && role !== 'partner') return null;
  return (
    <span className="seg" role="group" aria-label="Mode" data-testid="waiting-mode">
      <Link to="/waiting" className="seg__btn" aria-pressed={mode === 'list'} data-testid="waiting-mode-list">
        List
      </Link>
      <Link to="/waiting?mode=call" className="seg__btn" aria-pressed={mode === 'call'} data-testid="waiting-mode-call">
        Call
      </Link>
    </span>
  );
}
