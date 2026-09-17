/**
 * `#/` sends each role to the screen it opens the app for: partners and
 * admin to Monday, the builder to My items, the site hand to Today.
 *
 * URL params (`?as=raff`) are applied by the provider in an effect after the
 * first render, so this waits until the session matches what the hash asks
 * for before redirecting; otherwise it would redirect the previous person.
 */
import { Navigate } from 'react-router-dom';
import { useApi, useSession } from '../data/context';
import { sessionFromHash } from '../data/session';
import { homeFor } from './nav';

export function Landing() {
  const api = useApi();
  const session = useSession();
  const pending = sessionFromHash(window.location.hash);
  const waiting =
    (pending.personId !== undefined && pending.personId !== session.personId) ||
    (pending.sideId !== undefined && pending.sideId !== session.sideId) ||
    (pending.today !== undefined && pending.today !== session.today) ||
    (pending.offline !== undefined && pending.offline !== session.offline);
  if (waiting) return null;
  return <Navigate to={homeFor(session.role, api)} replace />;
}
