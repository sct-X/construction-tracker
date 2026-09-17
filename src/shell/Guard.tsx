/**
 * Access is decided by `api.canSee`, not by hiding links. A typed URL the
 * role can't see shows "You don't have access to this", the same words for
 * every gated route (Monday for Alec included).
 */
import type { ReactNode } from 'react';
import { useApi } from '../data/context';
import type { ScreenKey } from '../data/api';
import '../screens/plainPage.css';

export function Guard({ screen, children }: { screen?: ScreenKey; children: ReactNode }) {
  const api = useApi();
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
