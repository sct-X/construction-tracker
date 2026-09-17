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
import { useApi, useQuery, useSession } from '../data/context';
import type { NotificationPrefKey } from '../data/api';
import { NOTIFICATION_PREF_KEYS } from '../data/api';
import { ROLE_LABELS } from '../domain/types';
import { SEED_VERSION } from '../seed';
import { InstallSteps, deviceWords, isStandalone } from '../components/InstallSteps';
import { PageHeader } from '../shell/PageHeader';
import './settings.css';

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export const PREF_WORDS: Record<NotificationPrefKey, { label: string; detail: string }> = {
  reminders: { label: 'Reminders', detail: 'When one of your items reaches its act-by date, or goes past it.' },
  hold_points: { label: 'Hold points', detail: 'A week before an inspection, with which photo sets are still empty.' },
  eta_changes: { label: 'ETA changes', detail: 'When a shipment your items are waiting on moves.' },
  unconfirmed_jobs: { label: 'Unconfirmed jobs', detail: 'When a job has gone more than a week without anyone confirming it.' },
};

/** Which preferences a role can receive; the site and builder roles never get "unconfirmed jobs". */
export function prefsFor(role: string): NotificationPrefKey[] {
  return NOTIFICATION_PREF_KEYS.filter((k) => k !== 'unconfirmed_jobs' || role === 'admin' || role === 'partner');
}

export function readPermission(): PermissionState {
  if (typeof Notification === 'undefined' || typeof Notification.permission !== 'string') return 'unsupported';
  return Notification.permission;
}

export function permissionWords(state: PermissionState, platform: 'iphone' | 'android' | 'other'): string {
  switch (state) {
    case 'granted':
      return 'Allowed on this phone.';
    case 'denied':
      return platform === 'android'
        ? 'Blocked on this phone. To unblock: hold the Tracker icon, tap App info, then Notifications, and turn them on.'
        : 'Blocked on this phone. To unblock: open Settings, tap Notifications, find Tracker and turn Allow Notifications on.';
    case 'default':
      return 'Not asked yet. Tap the button and the phone will ask you.';
    case 'unsupported':
      return platform === 'iphone'
        ? 'This browser cannot ask yet. On an iPhone, notifications only work once the app is on the home screen and opened from there (iOS 16.4 or later).'
        : 'This browser cannot show notifications.';
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
  const { person, role, side, sides, personId } = useSession();
  const prefs = useQuery((api) => api.getNotificationPrefs(), [personId]);
  const subscriptions = useQuery((api) => api.listPushSubscriptions(), [personId]);
  const me = useQuery((api) => api.getPerson(personId), [personId]);
  const [permission, setPermission] = useState<PermissionState>(() => readPermission());
  const [asking, setAsking] = useState(false);
  const [buzzed, setBuzzed] = useState(false);
  const [resetStep, setResetStep] = useState<'idle' | 'confirm' | 'done'>('idle');
  const standalone = isStandalone();
  const platform = /iPhone|iPad/i.test(typeof navigator === 'undefined' ? '' : navigator.userAgent) ? 'iphone' : /Android/i.test(typeof navigator === 'undefined' ? '' : navigator.userAgent) ? 'android' : 'other';
  const device = deviceWords();
  const thisPhone = subscriptions.find((s) => s.device === device);

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
        <p className="settings__who" data-testid="settings-who">
          <span className="settings__who-name">{person.name}</span>
          <span className="settings__who-role">
            {ROLE_LABELS[role]} on {side.name}
            {otherSides.length > 0 && `. Also on ${otherSides.map((s) => s.name).join(' and ')}`}.
          </span>
          {person.phone && <span className="settings__who-phone">{person.phone}</span>}
        </p>
      </section>

      <section className="settings__section" aria-labelledby="settings-setup-title">
        <h2 id="settings-setup-title" className="settings__title">
          Phone setup
        </h2>
        <ol className="settings__steps" data-testid="settings-steps">
          <li className="settings__step" data-done={homeDone}>
            <span className="settings__step-n" aria-hidden="true">
              1
            </span>
            <div className="settings__step-body">
              <span className="settings__step-name">Added to the home screen</span>
              <span className="settings__step-state" data-testid="settings-step-home">
                {standalone ? 'Done. You are opening it from the home screen.' : homeDone ? 'Recorded as done, but this tab is in the browser. The steps are below.' : 'Not yet. The steps are below.'}
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
                {permissionWords(permission, platform)}
              </span>
              <button type="button" className="btn btn--primary settings__allow" data-testid="settings-allow-notifications" disabled={asking || permission === 'unsupported'} onClick={allow}>
                {permission === 'granted' ? 'Notifications are allowed' : asking ? 'Asking the phone' : 'Allow notifications'}
              </button>
              <span className="settings__push-note" data-testid="settings-push-note">
                {thisPhone
                  ? `This phone (${thisPhone.device}) is recorded against your name. `
                  : ''}
                There is no push server in this prototype, so nothing buzzes your phone yet. Reminders show in the app's own list for now, and the real server will use the phones recorded here.
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
                {buzzed ? 'Sent. It is in your notifications list, under the bell.' : buzzDone ? 'Received before.' : 'Not yet.'}
              </span>
              <button type="button" className="btn settings__buzz" data-testid="settings-test-buzz" onClick={testBuzz}>
                Send me a test buzz
              </button>
            </div>
          </li>
        </ol>
      </section>

      <section className="settings__section" aria-labelledby="settings-prefs-title">
        <h2 id="settings-prefs-title" className="settings__title">
          What to tell me about
        </h2>
        <ul className="settings__prefs">
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
                {prefs[key] ? 'On' : 'Off'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings__section" aria-labelledby="settings-install-title">
        <h2 id="settings-install-title" className="settings__title">
          Install to your home screen
        </h2>
        <InstallSteps />
      </section>

      <section className="settings__section" aria-labelledby="settings-phone-title">
        <h2 id="settings-phone-title" className="settings__title">
          This phone
        </h2>
        <p className="settings__version" data-testid="settings-version">
          Prototype, sample data version {SEED_VERSION}. Everything is saved on this phone only.
        </p>
        {resetStep === 'idle' && (
          <button type="button" className="btn" data-testid="settings-reset" onClick={() => setResetStep('confirm')}>
            Reset this phone
          </button>
        )}
        {resetStep === 'confirm' && (
          <div className="settings__confirm" data-testid="settings-reset-words">
            <p>This throws away every change saved on this phone, including queued photos, and puts the sample data back. Nothing on anyone else's phone changes.</p>
            <div className="settings__confirm-actions">
              <button type="button" className="btn settings__danger" data-testid="settings-reset-confirm" onClick={reset}>
                Yes, reset this phone
              </button>
              <button type="button" className="btn" data-testid="settings-reset-keep" onClick={() => setResetStep('idle')}>
                Keep everything
              </button>
            </div>
          </div>
        )}
        {resetStep === 'done' && (
          <p className="settings__done" data-testid="settings-reset-done">
            Reset done. The sample data is back and the photo queue is empty.
          </p>
        )}
      </section>
    </main>
  );
}
