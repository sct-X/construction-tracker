/**
 * The side switcher: a select for people who belong to more than one side
 * (Dominic and Norm). Everyone else sees the side's name as plain text.
 * Switching side changes `session.sideId`; every screen re-reads.
 */
import { useSession } from '../data/context';

export function SideSwitcher({ className }: { className?: string }) {
  const { side, sides, setSession } = useSession();
  if (sides.length < 2) {
    return (
      <span className={['side-name', className ?? ''].join(' ')} data-testid="side-name">
        {side.name}
      </span>
    );
  }
  return (
    <label className={['side-switcher', className ?? ''].join(' ')}>
      <span className="sr-only">Side</span>
      <select data-testid="side-switcher" value={side.id} onChange={(e) => setSession({ sideId: e.target.value })}>
        {sides.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
