/**
 * My settings (UI_PLAN 3.19). Doubles as the phone setup checklist Dominic
 * runs when he hands someone the app: three numbered steps with their state
 * in words (home screen, notifications, test buzz), then what to be told
 * about, the install steps, and the "this phone" tools.
 *
 * Push is honest: there is no push server in the prototype, so "Allow
 * notifications" asks the browser for permission (a real tap, because
 * iPhones only prompt after one) and records a placeholder subscription
 * through the API. Nothing buzzes the phone yet; the app's own list stands in.
 *
 * Nothing here draws money, so Alec's settings look the same as everyone's.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useQuery, useSession } from '../data/context';
import type { NotificationPrefKey } from '../data/api';
import { NOTIFICATION_PREF_KEYS } from '../data/api';
import { ROLE_LABELS } from '../domain/types';
import { formatStamp } from '../domain/dates';
import { DEFAULT_PERSON, DEFAULT_SIDE } from '../data/session';
import { SEED_VERSION } from '../seed';
import { InstallSteps, detectPlatform, deviceWords, isStandalone } from '../components/InstallSteps';
import { PageHeader } from '../shell/PageHeader';
import './settings.css';

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export const PREF_WORDS: Record<NotificationPrefKey, { label: string; detail: string }> = {
  reminders: { label: 'Reminders', detail: 'Your items at their act-by date' },
  hold_points: { label: 'Hold points', detail: 'A week before an inspection' },
  eta_changes: { label: 'ETA changes', detail: 'A shipment your items wait on moves' },
  unconfirmed_jobs: { label: 'Unconfirmed jobs', detail: 'A job over a week unconfirmed' },
};

/** Which preferences a role can receive; the site and builder roles never get "unconfirmed jobs". */
export function prefsFor(role: string): NotificationPrefKey[] {
  return NOTIFICATION_PREF_KEYS.filter((k) => k !== 'unconfirmed_jobs' || role === 'admin' || role === 'partner');
}

export function readPermission(): PermissionState {
  if (typeof Notification === 'undefined' || typeof Notification.permission !== 'string') return 'unsupported';
  return Notification.permission;
}

export type Platform = 'iphone' | 'android' | 'other';

/** The permission state in words that fit the device, and whether the ask button does anything. */
export function permissionWords(state: PermissionState, platform: Platform): { text: string; canAsk: boolean } {
  if (platform === 'other') {
    if (state === 'granted') return { text: 'Allowed in this browser.', canAsk: true };
    return {
      text: `Notifications aren't set up on a desktop browser in this prototype. Allow them on your phone.${state === 'denied' ? ' This browser has them blocked too.' : ''}`,
      canAsk: false,
    };
  }
  switch (state) {
    case 'granted':
      // Still askable: the tap records this phone against the person when that has not happened yet.
      return { text: 'Allowed on this phone.', canAsk: true };
    case 'denied':
      return {
        text:
          platform === 'android'
            ? 'Blocked on this phone. To unblock: hold the Tracker icon, tap App info, then Notifications, and turn them on.'
            : 'Blocked on this phone. To unblock: Settings, Notifications, Tracker, Allow Notifications.',
        canAsk: false,
      };
    case 'default':
      return { text: 'Not asked yet.', canAsk: true };
    case 'unsupported':
      return {
        text: platform === 'iphone' ? "This browser can't ask yet. Open the app from the home screen (iOS 16.4 or later)." : "This browser can't show notifications.",
        canAsk: false,
      };
  }
}

/** Old Safari takes a callback; everything else returns a promise. */
function requestPermission(): Promise<PermissionState> {
  return new Promise((resolve) => {
    try {
      const result = Notification.requestPermission((p) => resolve(p));
      if (result && typeof (result as Promise<NotificationPermission>).then === 'function') (result as Promise<NotificationPermission>).then(resolve, () => resolve(readPermission()));
    } catch {
      resolve(readPermission());
    }
  });
}

export default function Settings() {
  const api = useApi();
  const navigate = useNavigate();
  const { person, role, side, sides, personId } = useSession();
  const prefs = useQuery((api) => api.getNotificationPrefs(), [personId]);
  const lastSync = useQuery((api) => api.getLastSync(), []);
  const subscriptions = useQuery((api) => api.listPushSubscriptions(), [personId]);
  const me = useQuery((api) => api.getPerson(personId), [personId]);
  const [permission, setPermission] = useState<PermissionState>(() => readPermission());
  const [asking, setAsking] = useState(false);
  const [buzzed, setBuzzed] = useState(false);
  const [resetStep, setResetStep] = useState<'idle' | 'confirm' | 'done'>('idle');
  const standalone = isStandalone();
  const platform = detectPlatform();
  const device = deviceWords();
  const permWords = permissionWords(permission, platform);
  const thisPhone = subscriptions.find((s) => s.device === device);

  // The Permissions API is the live read: it also changes when someone unblocks in phone settings and comes back.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query || readPermission() === 'unsupported') return;
    let status: PermissionStatus | undefined;
    const apply = () => {
      if (status) setPermission(status.state === 'prompt' ? 'default' : status.state);
    };
    navigator.permissions
      .query({ name: 'notifications' as PermissionName })
      .then((st) => {
        status = st;
        apply();
        st.addEventListener('change', apply);
      })
      .catch(() => {
        /* keep Notification.permission */
      });
    return () => status?.removeEventListener('change', apply);
  }, []);

  // Opened from the home screen: record it against the person, once.
  useEffect(() => {
    if (standalone && me && !me.installedToHomeScreen) api.updatePerson(personId, { installedToHomeScreen: true });
  }, [api, standalone, me, personId]);

  async function allow() {
    setAsking(true);
    const state = permission === 'unsupported' ? 'unsupported' : await requestPermission();
    setPermission(state);
    setAsking(false);
    if (state === 'granted') api.savePushSubscription({ device, subscription: 'placeholder: no push server in the prototype', enabled: true });
  }

  function testBuzz() {
    api.sendTestBuzz();
    api.updatePerson(personId, { testBuzzReceived: true });
    setBuzzed(true);
  }

  function reset() {
    api.reset();
    setResetStep('done');
  }

  /** No login in the prototype: signing out drops back to the default person and the sign-in page, which explains the dev bar. */
  function signOut() {
    api.setSession({ personId: DEFAULT_PERSON, sideId: DEFAULT_SIDE });
    navigate('/sign-in');
  }

  const otherSides = sides.filter((s) => s.id !== side.id);
  const homeDone = standalone || !!me?.installedToHomeScreen;
  const notifDone = permission === 'granted' || (!!thisPhone && thisPhone.enabled);
  const buzzDone = buzzed || !!me?.testBuzzReceived;

  return (
    <main className="page settings" data-testid="settings">
      <PageHeader title="My settings" />

      <section className="settings__section" aria-labelledby="settings-who-title">
        <h2 id="settings-who-title" className="settings__title">
          You
        </h2>
        <div className="settings__plate settings__you">
          <p className="settings__who" data-testid="settings-who">
            <span className="settings__who-name">{person.name}</span>
            <span className="settings__who-role">
              {ROLE_LABELS[role]} on {side.name}
              {otherSides.length > 0 && `. Also on ${otherSides.map((s) => s.name).join(' and ')}`}.
            </span>
            {person.phone && <span className="settings__who-phone">{person.phone}</span>}
          </p>
          <button type="button" className="btn btn--desktop settings__signout" data-testid="settings-sign-out" onClick={signOut}>
            Sign out
          </button>
        </div>
      </section>

      <section className="settings__section" aria-labelledby="settings-setup-title">
        <h2 id="settings-setup-title" className="settings__title">
          Phone setup
        </h2>
        <ol className="settings__steps settings__plate" data-testid="settings-steps">
          <li className="settings__step" data-done={homeDone}>
            <span className="settings__step-n" aria-hidden="true">
              1
            </span>
            <div className="settings__step-body">
              <span className="settings__step-name">Added to the home screen</span>
              <span className="settings__step-state" data-testid="settings-step-home">
                {homeDone ? 'Done.' : 'Not yet.'}
              </span>
            </div>
          </li>
          <li className="settings__step" data-done={notifDone}>
            <span className="settings__step-n" aria-hidden="true">
              2
            </span>
            <div className="settings__step-body">
              <span className="settings__step-name">Notifications allowed</span>
              <span className="settings__step-state" data-testid="settings-permission-state">
                {permWords.text}
              </span>
              <button type="button" className="btn btn--primary btn--desktop settings__allow" data-testid="settings-allow-notifications" disabled={asking || !permWords.canAsk || (permission === 'granted' && !!thisPhone)} onClick={allow}>
                {permission === 'granted' && thisPhone ? 'Notifications are allowed' : asking ? 'Asking the phone' : permission === 'granted' ? 'Record this phone' : 'Allow notifications'}
              </button>
              <span className="settings__push-note" data-testid="settings-push-note">
                {thisPhone ? `This phone (${thisPhone.device}) is recorded against your name. ` : ''}
                There's no push server in this prototype: reminders show in the app's own list.
              </span>
            </div>
          </li>
          <li className="settings__step" data-done={buzzDone}>
            <span className="settings__step-n" aria-hidden="true">
              3
            </span>
            <div className="settings__step-body">
              <span className="settings__step-name">Test buzz received</span>
              <span className="settings__step-state" data-testid="settings-step-buzz">
                {buzzed ? 'Sent. Under the bell.' : buzzDone ? 'Received.' : 'Not yet.'}
              </span>
              <button type="button" className="btn btn--desktop settings__buzz" data-testid="settings-test-buzz" onClick={testBuzz}>
                Send a test buzz
              </button>
            </div>
          </li>
        </ol>
      </section>

      <section className="settings__section" aria-labelledby="settings-prefs-title">
        <h2 id="settings-prefs-title" className="settings__title">
          What to tell me about
        </h2>
        <ul className="settings__prefs settings__plate">
          {prefsFor(role).map((key) => (
            <li key={key} className="settings__pref">
              <div className="settings__pref-words">
                <span className="settings__pref-label">{PREF_WORDS[key].label}</span>
                <span className="settings__pref-detail">{PREF_WORDS[key].detail}</span>
              </div>
              <button
                type="button"
                className="settings__toggle"
                role="switch"
                aria-checked={prefs[key]}
                aria-label={PREF_WORDS[key].label}
                data-testid={`settings-pref-${key}`}
                onClick={() => api.setNotificationPref(key, !prefs[key])}
              >
                <span className="settings__toggle-knob">{prefs[key] ? 'On' : 'Off'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings__section" aria-labelledby="settings-install-title">
        <h2 id="settings-install-title" className="settings__title">
          Install to your home screen
        </h2>
        <div className="settings__plate">
          <InstallSteps />
        </div>
      </section>

      <section className="settings__section" aria-labelledby="settings-phone-title">
        <h2 id="settings-phone-title" className="settings__title">
          This phone
        </h2>
        <div className="settings__plate settings__phone">
          <p className="settings__version" data-testid="settings-version">
            Sample data v{SEED_VERSION}, saved on this phone only.
          </p>
          <p className="settings__version" data-testid="settings-last-sync">
            {lastSync ? `Last change saved ${formatStamp(lastSync)}.` : 'Nothing changed yet.'}
          </p>
          {resetStep === 'idle' && (
            <button type="button" className="btn btn--desktop settings__reset" data-testid="settings-reset" onClick={() => setResetStep('confirm')}>
              Reset this phone
            </button>
          )}
          {resetStep === 'confirm' && (
            <div className="settings__confirm" data-testid="settings-reset-words">
              <p>Throws away every change on this phone, queued photos included, and puts the sample data back.</p>
              <div className="settings__confirm-actions">
                <button type="button" className="btn btn--desktop settings__danger" data-testid="settings-reset-confirm" onClick={reset}>
                  Reset this phone
                </button>
                <button type="button" className="btn btn--desktop" data-testid="settings-reset-keep" onClick={() => setResetStep('idle')}>
                  Keep everything
                </button>
              </div>
            </div>
          )}
          {resetStep === 'done' && (
            <p className="settings__done" data-testid="settings-reset-done">
              Reset done. Sample data is back.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
