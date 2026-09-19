/**
 * Sign in: a name, no password. One button per person, with the role they
 * hold; someone on two sides shows both. Picking a name sets the session and
 * lands on that person's home. This is also how the view for each person is
 * checked: sign out from My settings, pick another name.
 */
import { useNavigate } from 'react-router-dom';
import { useApi, useQuery } from '../data/context';
import { ROLE_LABELS } from '../domain/types';
import './plainPage.css';
import './signIn.css';

export default function SignIn() {
  const api = useApi();
  const navigate = useNavigate();
  const options = useQuery((api) => api.listSignIns(), []);

  const pick = (personId: string) => {
    api.setSession({ personId });
    navigate('/', { replace: true });
  };

  return (
    <main className="plain signin" data-testid="sign-in">
      <h1 className="plain__title">Who are you?</h1>
      <p className="plain__line">Pick your name. There is no password in the prototype.</p>
      <ul className="signin__list">
        {options.map(({ person, roles }) => (
          <li key={person.id}>
            <button type="button" className="signin__person" onClick={() => pick(person.id)} data-testid={`sign-in-as-${person.id}`}>
              <span className="signin__name">{person.name}</span>
              <span className="signin__role">
                {roles.length > 1 ? roles.map((r) => `${ROLE_LABELS[r.role]} on ${r.side.name}`).join(', ') : roles[0] ? ROLE_LABELS[roles[0].role] : 'No side yet'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
