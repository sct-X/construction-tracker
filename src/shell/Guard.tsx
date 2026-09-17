/**
 * Access is decided by `api.canSee`, not by hiding links. A typed URL the
 * role can't see shows "You don't have access to this", the same words for
 * every gated route (Monday for Alec included).
 */
import type { ReactNode } from 'react';
import { useApi } from '../data/context';
import type { ScreenKey } from '../data/api';
import { PageHeader } from './PageHeader';

export function Guard({ screen, children }: { screen?: ScreenKey; children: ReactNode }) {
  const api = useApi();
  if (!screen || api.canSee(screen)) return <>{children}</>;
  return (
    <main className="page" data-testid="no-access">
      <PageHeader title="You don't have access to this" />
      <p className="page__lede">
        <a href="#/">Home</a>
      </p>
    </main>
  );
}
