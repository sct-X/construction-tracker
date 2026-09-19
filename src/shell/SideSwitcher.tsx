/**
 * The side switcher: a select for people who belong to more than one side
 * (Dominic and Norm). Everyone else is on one side and never sees its name:
 * to Dom the app is just the app. Switching side changes `session.sideId`;
 * every screen re-reads.
 */
import { useSession } from '../data/context';

export function SideSwitcher({ className }: { className?: string }) {
  const { side, sides, setSession } = useSession();
  if (sides.length < 2) return null;
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
