/**
 * Sign in, as a stub. The prototype has no login: the dev bar at the top of
 * the window sets who you are, what day it is, and whether there is signal.
 */
import { useSession } from '../data/context';
import { ROLE_LABELS } from '../domain/types';
import './plainPage.css';

export default function SignIn() {
  const { person, role, side } = useSession();
  return (
    <main className="plain" data-testid="sign-in">
      <h1 className="plain__title">Sign in</h1>
      <p className="plain__line">
        No login in the prototype. The dev bar picks who you are: {person.shortName}, {ROLE_LABELS[role].toLowerCase()} on {side.name}.
      </p>
      <p className="plain__action">
        <a className="btn btn--primary btn--desktop" href="#/" data-testid="sign-in-continue">
          Open the app as {person.shortName}
        </a>
      </p>
    </main>
  );
}
