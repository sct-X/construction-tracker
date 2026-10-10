// Screenshots of the web app in MOCK mode (the Pages build, seed data, today Thu 17 Sep 2026).
// Needs the Pages preview running:  npm run build:pages -w @ct/web && npm run preview:pages -w @ct/web -- --host 127.0.0.1
// Run from video/:  node scripts/shoot.mjs   (uses the repo's @playwright/test chromium)
// The demo's dev bar is hidden. Each shot also records element boxes (CSS px) for highlights: assets/shots/boxes.json.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.CT_URL ?? 'http://127.0.0.1:4320/construction-tracker/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'shots');
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

// name, hash, viewport, and `find`: named boxes to record, each [text, closest-selector?]. The text is matched
// against the smallest element whose own text starts with it; the box is that element's, or its closest() match.
const SHOTS = [
  { name: 'overview', find: { parkCard: ['Park Rd', 'li'], parkOverdue: ['4 overdue'], parkStage: ['Lock-up'], newJob: ['New job', 'a'] }, hash: '#/', vp: DESKTOP },
  { name: 'job-park-rd', find: { tabs: ['Program', '[role=tablist],nav,ul'], hold: ['Next hold point', 'section,div.card,a'], overdue: ['Overdue', 'section'], trades: ['Trades on this week', 'section'], photoSet: ['0 of 1 required'] }, hash: '#/jobs/park-rd', vp: DESKTOP },
  { name: 'waiting', find: { overdueHead: ['Overdue', 'h3'], call: ['Call Solid Frame Carpentry', 'a,button'], firstRow: ['Glazing energy compliance certificate', 'li'] }, hash: '#/waiting', vp: DESKTOP },
  { name: 'shipments-park-rd', find: { eta: ['26 Oct 2026'], etaNote: ['ETA 1 week before needed'], status: ['In production'], row: ['Park Rd windows', 'tr,li'] }, hash: '#/jobs/park-rd/shipments', vp: DESKTOP },
  { name: 'program-park-rd', find: { legend: ['Forecast', 'ul,div'], today: ['Today'], windows: ['Install windows'], hold: ['Stormwater inspection'], editProgram: ['Edit program', 'a,button'] }, hash: '#/jobs/park-rd/program', vp: DESKTOP },
  { name: 'step-slab-insp', hash: '#/jobs/seaview/steps/sv-slab-insp', vp: DESKTOP },
  { name: 'step-windows', find: { dates: ['Mon 2 Nov to Fri 13 Nov'], waits: ['Order of work', 'section,div'], needs: ['Needs', 'section,div'] }, hash: '#/jobs/park-rd/steps/pr-install-windows', vp: DESKTOP },
  { name: 'photos-seaview', find: { slab: ['Slab', 'section'], missing: ['Plumbing under slab', 'li,div'] }, hash: '#/jobs/seaview/photos', vp: DESKTOP },
  { name: 'photos-park-rd', hash: '#/jobs/park-rd/photos', vp: DESKTOP },
  { name: 'notes-park-rd', find: { first: ['Thu 17 Sep', 'tr,li'] }, hash: '#/jobs/park-rd/notes', vp: DESKTOP },
  { name: 'history', find: { first: ['Park Rd windows ETA Mon 26 Oct to Mon 2 Nov', 'li'], quote: ['windows 2 Nov'] }, hash: '#/history', vp: DESKTOP },
  { name: 'setup-new-job', find: { name: ['Job name', 'label,div'], template: ['Duplex', 'button,label,div'], start: ['Start on site', 'label,div'] }, hash: '#/setup', vp: DESKTOP },
  { name: 'setup-programs', hash: '#/setup/programs', vp: DESKTOP },
  { name: 'setup-trades', hash: '#/setup/trades', vp: DESKTOP },
  { name: 'phone-overview', find: { parkCard: ['Park Rd', 'li'], parkOverdue: ['4 overdue'], parkStage: ['Lock-up'] }, hash: '#/', vp: PHONE },
  { name: 'phone-job-park-rd', find: { hold: ['Next hold point', 'section,div.card,a'], overdue: ['Overdue', 'section'], trades: ['Trades on this week', 'section'] }, hash: '#/jobs/park-rd', vp: PHONE },
  { name: 'phone-waiting', find: { call: ['Call Solid Frame Carpentry', 'a,button'], overdueHead: ['Overdue', 'h3'] }, hash: '#/waiting', vp: PHONE },
  { name: 'phone-program-park-rd', find: { strip: ['Frame', 'ol,ul,div'], week: ['This week', 'section'] }, hash: '#/jobs/park-rd/program', vp: PHONE },
  { name: 'phone-step-slab-insp', hash: '#/jobs/seaview/steps/sv-slab-insp', vp: PHONE },
  { name: 'phone-photos-seaview', find: { missing: ['Plumbing under slab', 'li,div'] }, hash: '#/jobs/seaview/photos', vp: PHONE },
  { name: 'phone-shipments-park-rd', find: { eta: ['26 Oct 2026'], etaNote: ['ETA 1 week before needed'], status: ['In production'] }, hash: '#/jobs/park-rd/shipments', vp: PHONE },
  { name: 'phone-step-windows', find: { dates: ['Mon 2 Nov to Fri 13 Nov'], needs: ['Needs', 'section,div'] }, hash: '#/jobs/park-rd/steps/pr-install-windows', vp: PHONE },
  { name: 'phone-notes-park-rd', find: { first: ['Thu 17 Sep', 'tr,li'] }, hash: '#/jobs/park-rd/notes', vp: PHONE },
  { name: 'phone-history', find: { first: ['Park Rd windows ETA Mon 26 Oct to Mon 2 Nov', 'li'] }, hash: '#/history', vp: PHONE },
];

const browser = await chromium.launch();
const boxes = {};
for (const s of SHOTS) {
  const ctx = await browser.newContext({
    viewport: s.vp,
    deviceScaleFactor: 2,
    colorScheme: 'light',
    timezoneId: 'Australia/Sydney',
    locale: 'en-AU',
    isMobile: s.vp === PHONE,
    hasTouch: s.vp === PHONE,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
  await page.goto(BASE + s.hash);
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: '.devbar{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`) });
  // full page too, for slow pans down a long screen; a fixed bar at the bottom (the phone tab bar) would land
  // mid-page in a full-page shot, so it is hidden for that one
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' && el.getBoundingClientRect().top > innerHeight / 2) el.style.visibility = 'hidden';
    }
  });
  await page.screenshot({ path: path.join(OUT, `${s.name}-full.png`), fullPage: true });
  const dims = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  const found = {};
  for (const [key, [text, closest]] of Object.entries(s.find ?? {})) {
    found[key] = await page.evaluate(([text, closest]) => {
      let best = null;
      for (const el of document.querySelectorAll('body *')) {
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
        const t = (el.getAttribute('aria-label') && el.matches('a,button') ? el.textContent : own).trim();
        if (!t.startsWith(text)) continue;
        if (!best || best.contains(el)) best = el;
      }
      if (!best) return null;
      const el = closest ? best.closest(closest) ?? best : best;
      const r = el.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)];
    }, [text, closest]);
  }
  boxes[s.name] = { viewport: s.vp, full: dims, find: found };
  console.log('shot', s.name, JSON.stringify(dims), JSON.stringify(found));
  await ctx.close();
}
writeFileSync(path.join(OUT, 'boxes.json'), JSON.stringify(boxes, null, 2));
await browser.close();
