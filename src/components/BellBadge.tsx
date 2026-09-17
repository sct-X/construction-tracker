/**
 * The unread count on the nav bell: a number in steel with sr-only "unread",
 * nothing at zero. Reads the current person's unread notifications and
 * updates on every api change, so a fired reminder or "Mark all read" moves
 * it at once. The shell passes its own class for placement.
 */
import { useQuery } from '../data/context';

export function BellBadge({ className }: { className?: string }) {
  const unread = useQuery((api) => api.listNotifications({ unreadOnly: true }).length, []);
  if (!unread) return null;
  return (
    <span className={className} data-testid="bell-badge">
      {unread}
      <span className="sr-only"> unread</span>
    </span>
  );
}
