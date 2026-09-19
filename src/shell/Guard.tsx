/**
 * Access is decided by `api.canSee`, not by hiding links. A typed URL the
 * role can't see shows "You don't have access to this", the same words for
 * every gated route. Nobody signed in goes to the sign-in page first, unless
 * the hash carries `?as=` and the provider is about to apply it.
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useApi } from '../data/context';
import type { ScreenKey } from '../data/api';
import { sessionFromHash } from '../data/session';
import '../screens/plainPage.css';

export function Guard({ screen, children }: { screen?: ScreenKey; children: ReactNode }) {
  const api = useApi();
  if (!api.signedIn()) {
    if (sessionFromHash(window.location.hash).personId) return null;
    return <Navigate to="/sign-in" replace />;
  }
  if (!screen || api.canSee(screen)) return <>{children}</>;
  return (
    <main className="plain" data-testid="no-access">
      <h1 className="plain__title">You don't have access to this</h1>
      <p className="plain__action">
        <a className="btn btn--desktop" href="#/">
          Home
        </a>
      </p>
    </main>
  );
}
