/**
 * "Install to your home screen" (UI_PLAN 3.19): a short numbered list, no pictures.
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
    steps: ['Open this address in Safari.', 'Tap Share (the square with the arrow).', 'Tap "Add to Home Screen".', 'Tap "Add".', 'Open it from the new icon from now on.'],
    note: 'Notifications need iOS 16.4 or later.',
  },
  android: {
    name: 'Android',
    steps: ['Open this address in Chrome.', 'Tap the three dots, top right.', 'Tap "Add to Home screen", then "Install".', 'Open it from the new icon from now on.'],
    note: 'An "Install" bar at the foot of the screen does the same.',
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
        <p className="install__done">Installed.</p>
      </div>
    );
  }

  const set = STEPS[shown];
  return (
    <div className="install" data-testid={testId} data-installed="false">
      <div className="seg install__switch" role="group" aria-label="Which phone">
        {(['iphone', 'android'] as const).map((p) => (
          <button key={p} type="button" className="seg__btn install__tab" aria-pressed={shown === p} data-testid={`${testId}-${p}`} onClick={() => setShown(p)}>
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
