import { useData } from '../data/DataContext';

/** Dominic sees both sides; switching reloads every screen for that side. */
export function SideSwitcher() {
  const { sides, sideId, setSideId } = useData();
  if (sides.length < 2) return sides[0] ? <span className="side-one">{sides[0].name}</span> : null;
  return (
    <label className="side">
      <span className="sr-only">Side</span>
      <select value={sideId ?? ''} onChange={(e) => setSideId(e.target.value)} data-testid="side-switcher">
        {sides.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
