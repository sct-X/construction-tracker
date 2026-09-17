/**
 * Sign in, as a stub. The prototype has no login: the dev bar at the top of
 * the window sets who you are, what day it is, and whether there is signal.
 */
import { useSession } from '../data/context';
import { PageHeader } from '../shell/PageHeader';
import { ROLE_LABELS } from '../domain/types';

export default function SignIn() {
  const { person, role, side } = useSession();
  return (
    <main className="page" data-testid="sign-in">
      <PageHeader title="Sign in" meta="Not in the prototype" />
      <p className="page__lede">
        There is no login here. The dark dev bar at the top of the window stands in for it: pick a person under "As", set the date
        the app treats as today, and switch signal off to see the offline behaviour. Right now you are {person.shortName} (
        {ROLE_LABELS[role].toLowerCase()}) on {side.name}.
      </p>
      <p className="page__lede">
        <a className="btn btn--primary btn--desktop" href="#/" data-testid="sign-in-continue">
          Open the app as {person.shortName}
        </a>
      </p>
    </main>
  );
}
