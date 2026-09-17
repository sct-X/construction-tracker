/**
 * People and roles (UI_PLAN 3.22), admin only. Everyone on this side with
 * their role as a row of four buttons; pressing one changes the membership
 * on the spot, so the dev bar and the navigation follow immediately. Adding
 * a person takes a name, a role and a side. The site role is explained in
 * words because it is the one that matters: Alec never sees prices.
 *
 * Roles are per side, and every read here is scoped to the current side, so
 * Dominic switches side at the top to set roles on Norm.
 */
import { useState, type FormEvent } from 'react';
import { useApi, useQuery, useSession } from '../data/context';
import type { Person, Role } from '../domain/types';
import { ROLE_LABELS } from '../domain/types';
import { PageHeader } from '../shell/PageHeader';
import { useLayout } from '../shell/AppShell';
import './people.css';

export const ROLES: Role[] = ['admin', 'partner', 'builder', 'site'];

export const ROLE_WORDS: Record<Role, string> = {
  admin: 'Sets up jobs, trades and people. Sees everything.',
  partner: 'The Monday screen, the money and every job.',
  builder: 'His own items, the programs, photos and notes. Sees money.',
  site: 'Today, photos and deliveries for one job. Never sees prices: the data sent to a site phone has no money in it.',
};

/** Screen 19's three ticks, in words, for the people list. */
export function setupWords(p: Person): string {
  const parts: string[] = [];
  parts.push(p.installedToHomeScreen ? 'on home screen' : 'not installed');
  parts.push(p.notificationsEnabled ? 'notifications on' : 'notifications off');
  if (p.notificationsEnabled) parts.push(p.testBuzzReceived ? 'test buzz received' : 'no test buzz yet');
  const words = parts.join(', ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Why a change is refused, or null when it is allowed. The acting admin can never take admin off themselves. */
export function roleChangeRefusal(actingPersonId: string, target: Person, current: Role | undefined, next: Role | null): string | null {
  if (target.id !== actingPersonId || current !== 'admin' || next === 'admin') return null;
  return next === null
    ? `You can't remove yourself from this side while you're its admin. Ask another admin to do it.`
    : `You can't take admin off yourself. Make someone else admin first, then they can change your role.`;
}

export default function People() {
  const api = useApi();
  const { side, sides, personId, offline } = useSession();
  const layout = useLayout();
  const people = useQuery((api) => api.listPeople(), []);
  const memberships = useQuery((api) => api.listMemberships(), []);
  const [adding, setAdding] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const roleOf = (id: string) => memberships.find((m) => m.personId === id)?.role;

  function setRole(person: Person, role: Role | null) {
    if (offline) return;
    const words = roleChangeRefusal(personId, person, roleOf(person.id), role);
    setRefusal(words);
    if (words) return;
    api.setMembership(person.id, side.id, role);
  }

  const count = people.length === 1 ? '1 person' : `${people.length} people`;
  const addButton = !adding ? (
    <button type="button" className="btn btn--primary btn--desktop" data-testid="person-add" disabled={offline} onClick={() => { setAdding(true); setAdded(null); }}>
      {offline ? 'Add a person: needs signal' : 'Add a person'}
    </button>
  ) : undefined;

  return (
    <main className="page people" data-testid="people">
      <PageHeader title="People and roles" meta={`${count} on ${side.name}`} actions={addButton} />
      {offline && (
        <p className="people__offline" data-testid="people-offline">
          Needs signal. Roles and people can be read here, but changing them waits until you are back in range.
        </p>
      )}
      {adding && (
        <AddPerson
          onDone={(words) => {
            setAdding(false);
            setAdded(words);
          }}
        />
      )}
      {added && (
        <p className="people__added" data-testid="person-added">
          {added}
        </p>
      )}
      {refusal && (
        <p className="people__refusal" role="alert" data-testid="people-refusal">
          {refusal}
        </p>
      )}
      {layout === 'desktop' ? (
        <PeopleTable people={people} roleOf={roleOf} setRole={setRole} sideName={side.name} disabled={offline} />
      ) : (
        <PeopleCards people={people} roleOf={roleOf} setRole={setRole} sideName={side.name} disabled={offline} />
      )}
      {sides.length > 1 && (
        <p className="people__note">Roles are per side. Switch side at the top to set who does what on {sides.filter((s) => s.id !== side.id).map((s) => s.name).join(' and ')}.</p>
      )}
      <section className="people__roles" aria-labelledby="people-roles-title">
        <h2 id="people-roles-title" className="people__roles-title">
          What each role sees
        </h2>
        <dl className="people__roles-list" data-testid="people-role-words">
          {ROLES.map((r) => (
            <div key={r} className="people__role-def">
              <dt>{ROLE_LABELS[r]}</dt>
              <dd>{ROLE_WORDS[r]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

interface ListProps {
  people: Person[];
  roleOf: (id: string) => Role | undefined;
  setRole: (person: Person, role: Role | null) => void;
  sideName: string;
  /** Offline: every control reads but does nothing. */
  disabled: boolean;
}

function RoleButtons({ person, role, setRole, disabled }: { person: Person; role: Role | undefined; setRole: ListProps['setRole']; disabled: boolean }) {
  return (
    <div className="people__picker" role="group" aria-label={`${person.shortName}'s role`}>
      {ROLES.map((r) => (
        <button key={r} type="button" className="people__pick" aria-pressed={role === r} disabled={disabled} data-testid={`person-role-${person.id}-${r}`} onClick={() => setRole(person, r)}>
          {ROLE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

function RemoveButton({ person, setRole, sideName, disabled }: { person: Person; setRole: ListProps['setRole']; sideName: string; disabled: boolean }) {
  return (
    <button type="button" className="people__remove" data-testid={`person-remove-${person.id}`} disabled={disabled} onClick={() => setRole(person, null)}>
      {disabled ? 'Needs signal' : `Remove from ${sideName}`}
    </button>
  );
}

function PeopleTable({ people, roleOf, setRole, sideName, disabled }: ListProps) {
  return (
    <table className="people__table">
      <thead>
        <tr>
          <th scope="col">Person</th>
          <th scope="col">Role on {sideName}</th>
          <th scope="col">Phone setup</th>
          <th scope="col">
            <span className="people__sr">Remove</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {people.map((p) => (
          <tr key={p.id} data-testid={`person-${p.id}`} data-role={roleOf(p.id)}>
            <td className="people__cell-name">
              <span className="people__name">{p.name}</span>
              {p.phone && <span className="people__phone">{p.phone}</span>}
            </td>
            <td>
              <RoleButtons person={p} role={roleOf(p.id)} setRole={setRole} disabled={disabled} />
            </td>
            <td className="people__cell-setup" data-testid={`person-setup-${p.id}`}>
              {setupWords(p)}
            </td>
            <td className="people__cell-remove">
              <RemoveButton person={p} setRole={setRole} sideName={sideName} disabled={disabled} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PeopleCards({ people, roleOf, setRole, sideName, disabled }: ListProps) {
  return (
    <ul className="people__cards">
      {people.map((p) => (
        <li key={p.id} className="people__card" data-testid={`person-${p.id}`} data-role={roleOf(p.id)}>
          <div className="people__card-top">
            <span className="people__name">{p.name}</span>
            {p.phone && <span className="people__phone">{p.phone}</span>}
          </div>
          <RoleButtons person={p} role={roleOf(p.id)} setRole={setRole} disabled={disabled} />
          <div className="people__card-foot">
            <span className="people__setup" data-testid={`person-setup-${p.id}`}>
              {setupWords(p)}
            </span>
            <RemoveButton person={p} setRole={setRole} sideName={sideName} disabled={disabled} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Name, phone, role and side. The person lands on the chosen side with that role. */
function AddPerson({ onDone }: { onDone: (words: string) => void }) {
  const api = useApi();
  const { side, sides, offline } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('builder');
  const [sideId, setSideId] = useState(side.id);
  const ready = name.trim().length > 0 && !offline;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    const full = name.trim();
    const person = api.addPerson({
      name: full,
      shortName: full.split(/\s+/)[0],
      phone: phone.trim() || undefined,
      notificationsEnabled: false,
      installedToHomeScreen: false,
      testBuzzReceived: false,
    });
    api.setMembership(person.id, sideId, role);
    const sideName = sides.find((s) => s.id === sideId)?.name ?? sideId;
    onDone(sideId === side.id ? `Added ${person.shortName} as ${ROLE_LABELS[role].toLowerCase()} on ${sideName}.` : `Added ${person.shortName} as ${ROLE_LABELS[role].toLowerCase()} on ${sideName}. Switch side at the top to see them there.`);
  }

  return (
    <form className="people__form" data-testid="person-add-form" onSubmit={submit}>
      <h2 className="people__form-title">New person</h2>
      <div className="people__field">
        <label htmlFor="person-add-name">Name</label>
        <input id="person-add-name" className="people__input" value={name} data-testid="person-add-name" onChange={(e) => setName(e.target.value)} placeholder="Jo Nguyen" />
      </div>
      <div className="people__field">
        <label htmlFor="person-add-phone">Phone (optional)</label>
        <input id="person-add-phone" className="people__input" type="tel" inputMode="tel" value={phone} data-testid="person-add-phone" onChange={(e) => setPhone(e.target.value)} placeholder="0400 000 000" />
      </div>
      <div className="people__field">
        <span className="people__field-label" id="person-add-role-label">
          Role
        </span>
        <div className="people__picker" role="group" aria-labelledby="person-add-role-label">
          {ROLES.map((r) => (
            <button key={r} type="button" className="people__pick" aria-pressed={r === role} data-testid={`person-add-role-${r}`} onClick={() => setRole(r)}>
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <p className="people__hint">{ROLE_WORDS[role]}</p>
      </div>
      {sides.length > 1 && (
        <div className="people__field">
          <span className="people__field-label" id="person-add-side-label">
            Side
          </span>
          <div className="people__picker" role="group" aria-labelledby="person-add-side-label">
            {sides.map((s) => (
              <button key={s.id} type="button" className="people__pick" aria-pressed={s.id === sideId} data-testid={`person-add-side-${s.id}`} onClick={() => setSideId(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="people__form-actions">
        <button type="submit" className="btn btn--primary" data-testid="person-add-save" disabled={!ready}>
          {offline ? 'Needs signal' : `Add ${name.trim() ? name.trim().split(/\s+/)[0] : 'person'}`}
        </button>
        <button type="button" className="btn" data-testid="person-add-cancel" onClick={() => onDone('')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
