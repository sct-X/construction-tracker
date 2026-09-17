/**
 * "Install to your home screen" (UI_PLAN 3.19), in plain words, no pictures.
 * Detects the phone from the user agent and opens on that set of steps; the
 * other set is one tap away. When the page is already running from the home
 * screen (`display-mode: standalone`, or Safari's `navigator.standalone`) it
 * says "Installed" instead of the steps.
 *
 *   <InstallSteps />                       // detects everything
 *   <InstallSteps installed platform="iphone" />   // for tests and stories
 */
import { useState } from 'react';
import './installSteps.css';

export type Platform = 'iphone' | 'android' | 'other';

/** True when the app was opened from a home-screen icon rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    /* no matchMedia */
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function detectPlatform(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** "iPhone, Safari": the device words stored against a push subscription. */
export function deviceWords(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const device = /iPhone/i.test(ua) ? 'iPhone' : /iPad/i.test(ua) ? 'iPad' : /Android/i.test(ua) ? 'Android phone' : /Macintosh/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows PC' : 'this device';
  const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox\//i.test(ua) ? 'Firefox' : /Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'browser';
  return `${device}, ${browser}`;
}

const STEPS: Record<Exclude<Platform, 'other'>, { name: string; steps: string[]; note: string }> = {
  iphone: {
    name: 'iPhone',
    steps: [
      'Open this address in Safari. Other browsers on an iPhone cannot install it.',
      'Tap Share: the square with an arrow pointing up, at the bottom of the screen.',
      'Scroll the list and tap "Add to Home Screen".',
      'Tap "Add" in the top right. The Tracker icon lands on your home screen.',
      'Open it from that icon from now on. Notifications only work when it is opened this way.',
    ],
    note: 'Needs iOS 16.4 or later for notifications.',
  },
  android: {
    name: 'Android',
    steps: [
      'Open this address in Chrome.',
      'Tap the three dots in the top right.',
      'Tap "Add to Home screen" or "Install app", then "Install".',
      'Open it from the new icon on your home screen from now on.',
    ],
    note: 'Some phones show an "Install" bar at the bottom of the screen instead. Tapping that does the same thing.',
  },
};

interface Props {
  /** Overrides detection (tests). */
  installed?: boolean;
  platform?: Platform;
  testId?: string;
}

export function InstallSteps({ installed, platform, testId = 'settings-install' }: Props) {
  const standalone = installed ?? isStandalone();
  const detected = platform ?? detectPlatform();
  const [shown, setShown] = useState<Exclude<Platform, 'other'>>(detected === 'android' ? 'android' : 'iphone');

  if (standalone) {
    return (
      <div className="install install--done" data-testid={testId} data-installed="true">
        <p className="install__done">Installed. You are opening this from your home screen, so this step is done.</p>
      </div>
    );
  }

  const set = STEPS[shown];
  return (
    <div className="install" data-testid={testId} data-installed="false">
      <p className="install__lede">
        {detected === 'other'
          ? 'You are in a desktop browser. On a phone, this page gives the steps to put the app on the home screen.'
          : 'You are in the browser. Put the app on your home screen so it opens like an app and can buzz you.'}
      </p>
      <div className="install__switch" role="group" aria-label="Which phone">
        {(['iphone', 'android'] as const).map((p) => (
          <button key={p} type="button" className="install__tab" aria-pressed={shown === p} data-testid={`${testId}-${p}`} onClick={() => setShown(p)}>
            {STEPS[p].name}
          </button>
        ))}
      </div>
      <ol className="install__steps" data-testid={`${testId}-steps`}>
        {set.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p className="install__note">{set.note}</p>
    </div>
  );
}
