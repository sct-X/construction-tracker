import { useData } from '../data/DataContext';
import { hashPath, href } from '../app/router';

/** A page about one job belongs to one side: switching side leaves it for that page's list. */
function leaveJobPage(): void {
  const path = hashPath();
  if (/^\/jobs\/[^/]+/.test(path)) globalThis.location?.replace(href('/jobs'));
  else if (/^\/history\/[^/]+/.test(path)) globalThis.location?.replace(href('/history'));
}

/** Dominic sees both sides; switching reloads every screen for that side. */
export function SideSwitcher() {
  const { sides, sideId, setSideId } = useData();
  if (sides.length < 2) return sides[0] ? <span className="side-one">{sides[0].name}</span> : null;
  return (
    <label className="side">
      <span className="sr-only">Side</span>
      <select value={sideId ?? ''} onChange={(e) => {
          leaveJobPage();
          setSideId(e.target.value);
        }} data-testid="side-switcher">
        {sides.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
