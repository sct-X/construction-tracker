// Builds the HyperFrames compositions from scenes.mjs and the voice manifest:
//   index.html     1920x1080, the main video
//   portrait/index.html  1080x1920, the phone version (same scenes, caption on top, visual below)
// Also makes the background bed (assets/audio/bed.wav, a soft synthesised pad, ffmpeg only) and copies GSAP
// from node_modules into assets/vendor. Run from video/:  node scripts/build.mjs
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenes } from '../scenes.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'assets/voice/manifest.json'), 'utf8'));
const boxes = JSON.parse(readFileSync(path.join(ROOT, 'assets/shots/boxes.json'), 'utf8'));

const TAIL = 1.0; // after a scene's last sentence, before the next scene starts
const XF = 0.8; // crossfade between scenes and between visuals
const END_FADE = 1.6;
const FPS = 30;

mkdirSync(path.join(ROOT, 'assets/vendor'), { recursive: true });
mkdirSync(path.join(ROOT, 'assets/audio'), { recursive: true });
copyFileSync(path.join(ROOT, 'node_modules/gsap/dist/gsap.min.js'), path.join(ROOT, 'assets/vendor/gsap.min.js'));

// ---------- timing ----------
const r3 = (n) => Math.round(n * 1000) / 1000;
function cueResolver(sc) {
  const m = manifest.scenes[sc.id];
  if (!m) throw new Error(`No voice for ${sc.id}: run scripts/voice.mjs`);
  return (cue) => {
    if (typeof cue === 'number') return cue;
    const mm = /^(n\d+|e\d+|end)\s*([+-]\s*[\d.]+)?$/.exec(cue);
    if (!mm) throw new Error(`${sc.id}: bad cue "${cue}"`);
    let base;
    if (mm[1] === 'end') base = m.voiceEnd;
    else {
      const s = m.sentences[Number(mm[1].slice(1)) - 1];
      if (!s) throw new Error(`${sc.id}: no sentence for "${cue}"`);
      base = mm[1][0] === 'n' ? s.start : s.end;
    }
    return base + (mm[2] ? Number(mm[2].replace(/\s/g, '')) : 0);
  };
}

let t = 0;
const timed = scenes.map((sc) => {
  const m = manifest.scenes[sc.id];
  const dur = r3(m.voiceEnd + TAIL + (sc.hold ?? 0));
  const out = { sc, start: r3(t), dur, cue: cueResolver(sc), voice: m };
  t += dur;
  return out;
});
const TOTAL = r3(Math.ceil((t + END_FADE) * FPS) / FPS);

// ---------- background bed ----------
// A quiet pad: an A major chord (with a soft ninth) on sine waves, each voice swelling slowly at its own rate,
// low-passed and given a little echo. Deterministic, no samples. Remade when the length changes.
const bed = path.join(ROOT, 'assets/audio/bed.wav');
const bedLen = path.join(ROOT, 'assets/audio/bed.len');
if (!existsSync(bed) || !existsSync(bedLen) || readFileSync(bedLen, 'utf8') !== String(TOTAL)) {
  const notes = [
    [110.0, 0.30, 0.031],
    [164.81, 0.22, 0.023],
    [220.0, 0.2, 0.017],
    [277.18, 0.14, 0.041],
    [329.63, 0.1, 0.029],
    [493.88, 0.05, 0.013],
  ];
  const expr = notes
    .map(([f, a, lfo], i) => `${a}*sin(2*PI*${f}*t)*(0.55+0.45*sin(2*PI*${lfo}*t+${i * 1.3}))`)
    .join('+');
  execFileSync(FFMPEG, [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=48000:d=${TOTAL}`,
    '-af', `lowpass=f=900,aecho=0.8:0.7:180|340:0.25|0.18,volume=0.16,afade=t=in:d=4,afade=t=out:st=${Math.max(0, TOTAL - 5)}:d=5`,
    '-ac', '2', bed,
  ]);
  writeFileSync(bedLen, String(TOTAL));
}

// ---------- layouts ----------
const LAYOUTS = {
  landscape: {
    file: 'index.html',
    W: 1920,
    H: 1080,
    cap: { x: 96, y: 0, w: 540, h: 1080, align: 'center' },
    box: { x: 690, y: 60, w: 1160, h: 960 },
    shotAspect: 1.6,
    shotZoom: 1,
    css: `
      .cap-sec { font-size: 26px; } .cap-title { font-size: 62px; } .cap-line { font-size: 33px; }
      .hero-title { font-size: 104px; } .hero-sub { font-size: 40px; } .hero-line { font-size: 84px; }`,
  },
  portrait: {
    file: 'portrait/index.html',
    portrait: true,
    W: 1080,
    H: 1920,
    cap: { x: 80, y: 150, w: 920, h: 540, align: 'start' },
    box: { x: 40, y: 700, w: 1000, h: 1170 },
    shotAspect: 1.16, // a taller crop of the desktop screenshots, zoomed in, so the text stays readable
    shotZoom: 1.3,
    css: `
      .cap-sec { font-size: 32px; } .cap-title { font-size: 70px; margin-bottom: 18px; } .cap-line { font-size: 38px; margin-top: 10px; }
      .hero-title { font-size: 96px; } .hero-sub { font-size: 44px; } .hero-line { font-size: 88px; }`,
  },
};

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pngSize = (file) => {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16) / 2, h: b.readUInt32BE(20) / 2 }; // shot at deviceScaleFactor 2
};
const findBox = (img, key) => {
  const b = boxes[img.replace(/-full$/, '')]?.find?.[key];
  if (!b) throw new Error(`No box "${key}" for ${img}`);
  return b;
};

const ICONS = {
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
};
const WAVE = [6, 12, 18, 10, 22, 14, 8, 20, 26, 16, 10, 18, 24, 12, 8, 16, 22, 14, 9, 18, 12, 7, 15, 20, 11, 6, 13, 9];
const wave = (cls = 'wave') => `<span class="${cls}">${WAVE.map((h) => `<i style="height:${h}px"></i>`).join('')}</span>`;

// ---------- one composition ----------
function compose(L) {
  const html = [];
  const js = []; // timeline instructions, as data
  let uid = 0;
  const id = (p) => `${p}${++uid}`;

  for (const { sc, start, dur, cue, voice } of timed) {
    const sid = `sc-${sc.id}`;
    const isLast = sc === scenes.at(-1);
    const clipDur = isLast ? r3(TOTAL - start) : r3(dur + XF);
    const at = (c) => r3(start + cue(c));
    const sceneEnd = r3(start + dur);
    js.push({ op: 'scene', el: sid, start, dur, first: start === 0, last: isLast });

    const parts = [];
    // caption
    if (sc.caption) {
      const c = sc.caption;
      const cid = id('cap');
      const capAt = c.at !== undefined ? at(c.at) : start;
      if (c.at !== undefined && cue(c.at) > 0) js.push({ op: 'in', el: cid, t: capAt, y: 0 });
      const lines = c.lines
        .map((ln) => {
          const lid = id('ln');
          js.push({ op: 'in', el: lid, t: at(ln.at), y: 14 });
          return `<div class="cap-line" id="${lid}" style="opacity:0">${ln.html}</div>`;
        })
        .join('');
      parts.push(
        `<div class="cap cap--${L.cap.align}" id="${cid}" style="left:${L.cap.x}px;top:${L.cap.y}px;width:${L.cap.w}px;height:${L.cap.h}px;${c.at !== undefined && cue(c.at) > 0 ? 'opacity:0' : ''}">` +
          `<div class="cap-sec">${esc(c.section)}</div><div class="cap-title">${esc(c.title)}</div>${lines}</div>`,
      );
    }
    // visuals
    const visuals = sc.visuals.map((v) => (L.portrait && v.p ? { ...v, ...v.p } : v)).filter((v) => !v.skip);
    visuals.forEach((v, i) => {
      const vid = id('v');
      const vStart = at(v.at);
      const next = visuals[i + 1];
      const vEnd = next ? at(next.at) : sceneEnd + XF;
      const shown = cue(v.at) <= 0;
      if (!shown) js.push({ op: 'xin', el: vid, t: vStart });
      if (next) js.push({ op: 'xout', el: vid, t: at(next.at) });
      const vt = (c) => r3(vStart + (typeof c === 'number' ? c : cue(c) - cue(v.at))); // numbers: from the visual's start
      parts.push(renderVisual(L, v, vid, { vt, at, vStart, vEnd, js, id, shown }));
    });
    html.push(
      `<section id="${sid}" class="clip scene" data-start="${start}" data-duration="${clipDur}" data-track-index="1">${parts.join('')}</section>`,
    );
    html.push(
      `<audio id="vo-${sc.id}" src="assets/voice/${voice.file}" data-start="${start}" data-duration="${voice.length}" data-volume="1" data-track-index="2"></audio>`,
    );
  }
  html.push(
    `<audio id="bed" src="assets/audio/bed.wav" data-start="0" data-duration="${TOTAL}" data-volume="1" data-track-index="3"></audio>`,
  );
  return page(L, html.join('\n'), js);
}

function renderVisual(L, v, vid, ctx) {
  const { vt, js, id, shown, vEnd } = ctx;
  const B = L.box;
  const op = shown ? '' : 'opacity:0;';
  if (v.type === 'hero') {
    const lines = (v.lines ?? [])
      .map((ln) => {
        const lid = id('hl');
        js.push({ op: 'in', el: lid, t: vt(ln.at), y: 18 });
        return `<div class="hero-line" id="${lid}" style="opacity:0">${ln.html}</div>`;
      })
      .join('');
    let sub = '';
    if (v.sub) {
      const subId = id('hs');
      if (v.subAt) js.push({ op: 'in', el: subId, t: vt(v.subAt), y: 0 });
      sub = `<div class="hero-sub" id="${subId}" style="${v.subAt ? 'opacity:0' : ''}">${esc(v.sub)}</div>`;
    }
    const title = v.title ? `<div class="hero-title">${esc(v.title)}</div><div class="hero-rule"></div>` : '';
    return `<div class="visual hero" id="${vid}" style="${op}width:${L.W}px;height:${L.H}px">${title}${lines}${sub}</div>`;
  }

  if (v.type === 'shot' || v.type === 'phone') {
    const size = pngSize(path.join(ROOT, `assets/shots/${v.img}.png`));
    const phone = v.type === 'phone';
    // frame size and placement
    let FW, FH, wrapW, wrapH, k;
    if (phone) {
      wrapW = 410;
      wrapH = 864;
      k = Math.min(B.w / wrapW, B.h / wrapH);
      FW = 390;
      FH = 844;
    } else {
      FW = Math.min(B.w, B.h * L.shotAspect);
      FH = FW / L.shotAspect;
      wrapW = FW;
      wrapH = FH;
      k = 1;
    }
    const base = FW / size.w;
    const zoom = phone ? 1 : L.shotZoom;
    const cam = (kf) => {
      const s = base * (kf.z ?? 1) * zoom;
      const iw = size.w * s;
      const ih = size.h * s;
      // the portrait crop is narrower: a centred key looks past the sidebar at the content
      const kx = zoom > 1 && kf.x === 640 ? 780 : kf.x;
      let x = FW / 2 - kx * s;
      let y = FH / 2 - kf.y * s;
      x = iw <= FW ? (FW - iw) / 2 : Math.min(0, Math.max(FW - iw, x));
      y = ih <= FH ? (FH - ih) / 2 : Math.min(0, Math.max(FH - ih, y));
      return { x: r3(x), y: r3(y), scale: r3(s) };
    };
    const keys = v.cam ?? [{ at: 0, x: size.w / 2, y: Math.min(size.h, phone ? 422 : 400), z: 1 }];
    const camId = id('cam');
    const first = cam(keys[0]);
    if (keys.length === 1) {
      // gentle drift so a still never sits dead
      const drift = cam({ ...keys[0], z: (keys[0].z ?? 1) * 1.04 });
      js.push({ op: 'cam', el: camId, t: vt(keys[0].at), d: Math.max(2, vEnd - vt(keys[0].at)), to: drift, ease: 'none' });
    }
    for (const kf of keys.slice(1)) js.push({ op: 'cam', el: camId, t: vt(kf.at), d: kf.d ?? 2.5, to: cam(kf), ease: 'sine.inOut' });
    const marks = (v.marks ?? [])
      .map((mk) => {
        const [x, y, w, h] = mk.rect ?? findBox(v.img, mk.box);
        const mid = id('mk');
        js.push({ op: 'mark', el: mid, t: vt(mk.at), until: mk.until !== undefined ? vt(mk.until) : null });
        const pad = 8;
        const bw = r3(3.2 / base);
        return `<div class="mark" id="${mid}" style="left:${x - pad}px;top:${y - pad}px;width:${w + pad * 2}px;height:${h + pad * 2}px;border-width:${bw}px;border-radius:${r3(12 / base)}px"></div>`;
      })
      .join('');
    const inner =
      `<div class="screen${phone ? ' screen--phone' : ''}" style="width:${FW}px;height:${FH}px">` +
      `<div class="cam" id="${camId}" style="width:${size.w}px;height:${size.h}px;transform:translate(${first.x}px,${first.y}px) scale(${first.scale})">` +
      `<img src="assets/shots/${v.img}.png" width="${size.w}" height="${size.h}" alt="">${marks}</div></div>`;
    const left = B.x + (B.w - wrapW * k) / 2;
    const top = B.y + (B.h - wrapH * k) / 2;
    return `<div class="visual ${phone ? 'phoneframe' : 'shotframe'}" id="${vid}" style="${op}left:${r3(left)}px;top:${r3(top)}px;width:${wrapW}px;height:${wrapH}px;transform:scale(${r3(k)});transform-origin:0 0">${inner}</div>`;
  }

  if (v.type === 'chat') return renderChat(L, v, vid, ctx);

  if (v.type === 'methods') {
    const DW = 1100;
    const DH = 800;
    const k = Math.min(B.w / DW, B.h / DH);
    const items = v.items
      .map((it) => {
        const iid = id('m');
        js.push({ op: 'in', el: iid, t: vt(it.at), y: 24 });
        let bub;
        if (it.bubble.kind === 'text') bub = `<div class="bubble me demo"><div class="txt">${it.bubble.html}</div></div>`;
        else if (it.bubble.kind === 'voice') bub = `<div class="bubble me demo voice"><span class="play">${ICONS.play}</span>${wave()}<span class="vlen">${it.bubble.len}</span></div>`;
        else bub = `<div class="bubble me demo file"><div class="doc"><span class="thumb"></span><span><span class="fname">${it.bubble.name}</span><span class="fsize">${it.bubble.size}</span></span></div><div class="txt">${esc(it.bubble.caption)}</div></div>`;
        return `<div class="m-item" id="${iid}" style="opacity:0"><span class="m-icon">${ICONS[it.icon]}</span><span class="m-words"><span class="m-title">${esc(it.title)}</span><span class="m-detail">${esc(it.detail)}</span></span><span class="m-demo">${bub}</span></div>`;
      })
      .join('');
    return `<div class="visual methods" id="${vid}" style="${op}left:${r3(B.x + (B.w - DW * k) / 2)}px;top:${r3(B.y + (B.h - DH * k) / 2)}px;width:${DW}px;height:${DH}px;transform:scale(${r3(k)});transform-origin:0 0">${items}</div>`;
  }

  if (v.type === 'tips') {
    const DW = 1080;
    const DH = 760;
    const k = Math.min(B.w / DW, B.h / DH);
    const items = v.items
      .map((it, i) => {
        const iid = id('tip');
        js.push({ op: 'in', el: iid, t: vt(it.at), y: 20 });
        return `<div class="tip" id="${iid}" style="opacity:0"><span class="tip-n">${i + 1}</span><span class="tip-t">${it.html}</span></div>`;
      })
      .join('');
    return `<div class="visual tips" id="${vid}" style="${op}left:${r3(B.x + (B.w - DW * k) / 2)}px;top:${r3(B.y + (B.h - DH * k) / 2)}px;width:${DW}px;height:${DH}px;transform:scale(${r3(k)});transform-origin:0 0">${items}</div>`;
  }
  throw new Error(`Unknown visual type ${v.type}`);
}

function renderChat(L, v, vid, ctx) {
  const { vt, js, id, shown } = ctx;
  const B = L.box;
  const DW = 560;
  const DH = 840;
  const k = Math.min(B.w / DW, B.h / DH);
  const rows = [];
  const cues = [];
  const button = (label) => {
    const bid = id('kb');
    return { bid, html: `<span class="kbtn" id="${bid}" data-label="${esc(label)}"><span class="ripple"></span><span class="bring"></span>${esc(label)}</span>` };
  };
  for (const m of v.msgs) {
    const rid = id('row');
    const layer = (html, buttons, n) => {
      const btns = {};
      let kb = '';
      if (buttons?.length) {
        kb = `<div class="kb">${buttons
          .map((row) => `<div class="kbrow">${row.map((lab) => { const b = button(lab); btns[lab] = b.bid; return b.html; }).join('')}</div>`)
          .join('')}</div>`;
      }
      let bubble;
      const meta = `<span class="meta">${m.time ?? ''}${m.from === 'dom' ? ' <span class="ticks">✓✓</span>' : ''}</span>`;
      if (m.kind === 'voice') bubble = `<div class="bubble me voice"><span class="play">${ICONS.play}</span>${wave()}<span class="vlen">${m.len}</span>${meta}</div>`;
      else if (m.kind === 'file') bubble = `<div class="bubble me file"><div class="doc"><span class="thumb"></span><span><span class="fname">${m.name}</span><span class="fsize">${m.size}</span></span></div><div class="txt">${html}${meta}</div></div>`;
      else bubble = `<div class="bubble ${m.from === 'dom' ? 'me' : 'bot'}"><div class="txt">${html}${meta}</div></div>`;
      return { html: `<div class="layer layer--${m.from === 'dom' ? 'me' : 'bot'}" data-n="${n}">${bubble}${kb}</div>`, btns };
    };
    const l0 = layer(m.html, m.buttons, 0);
    const l1 = m.edit ? layer(m.edit.html, m.edit.buttons, 1) : null;
    rows.push(`<div class="row" id="${rid}">${l0.html}${l1 ? l1.html : ''}</div>`);
    const c = { row: rid, at: m.at === 'pre' ? null : vt(m.at) };
    if (m.edit) c.edit = vt(m.edit.at);
    if (m.tap) c.tap = { t: vt(m.tap.at), btn: l0.btns[m.tap.label] };
    if (m.ring) c.ring = { t: vt(m.ring.at), btn: l0.btns[m.ring.label], until: m.edit ? vt(m.edit.at) : null };
    if (m.tap && !m.ring) c.ring = { t: vt(m.tap.at) - 0.6, btn: l0.btns[m.tap.label], until: m.edit ? vt(m.edit.at) : vt(m.tap.at) + 0.8 };
    if (m.hl) c.hl = m.hl.map((h) => ({ k: h.k, t: vt(h.at), until: vt(h.until) }));
    cues.push(c);
  }
  js.push({ op: 'chat', rows: cues });
  let menu = '';
  if (v.menu) {
    const mid = id('menu');
    const fid = id('mf');
    const clipRing = id('cr');
    js.push({ op: 'menu', el: mid, file: fid, ring: clipRing, t: vt(v.menu.at), tf: vt(v.menu.file), until: vt(v.menu.until) });
    menu = `<div class="tg-menu" id="${mid}" style="opacity:0"><div class="tg-mi">${ICONS.image}<span>Gallery</span></div><div class="tg-mi" id="${fid}">${ICONS.file}<span>File</span><span class="ripple"></span></div></div>`;
    menu += `<span class="clipring" id="${clipRing}" style="opacity:0"></span>`;
  }
  const head = `<div class="tg-head"><span class="tg-back">${ICONS.back}</span><span class="tg-ava">T</span><span class="tg-who"><span class="tg-name">Tracker</span><span class="tg-sub">bot</span></span></div>`;
  const compose = `<div class="tg-compose"><span class="tg-clip">${ICONS.clip}</span><span class="tg-input">Message</span><span class="tg-mic">${ICONS.mic}</span></div>`;
  return `<div class="visual chatframe" id="${vid}" style="${shown ? '' : 'opacity:0;'}left:${r3(B.x + (B.w - DW * k) / 2)}px;top:${r3(B.y + (B.h - DH * k) / 2)}px;width:${DW}px;height:${DH}px;transform:scale(${r3(k)});transform-origin:0 0">${head}<div class="tg-body"><div class="tg-list">${rows.join('')}</div></div>${compose}${menu}</div>`;
}

function page(L, body, js) {
  return `<!doctype html>
<!-- Generated by scripts/build.mjs from scenes.mjs. Edit those, not this file. -->
<html lang="en-AU">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${L.W}, height=${L.H}" />
<title>Construction Tracker: a guide for Dom</title>
<script src="assets/vendor/gsap.min.js"></script>
<style>
${CSS}
${L.css}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-fps="${FPS}" data-width="${L.W}" data-height="${L.H}" style="width:${L.W}px;height:${L.H}px">
${body}
</div>
<script>
${RUNTIME.replace('__CUES__', JSON.stringify(js)).replace('__XF__', XF).replace('__TOTAL__', TOTAL).replace('__ENDFADE__', END_FADE)}
</script>
</body>
</html>
`;
}

// ---------- the browser side: builds one paused GSAP timeline from the cue data ----------
const RUNTIME = String.raw`
(function () {
  window.__timelines = window.__timelines || {};
  var CUES = __CUES__;
  var XF = __XF__, TOTAL = __TOTAL__, ENDFADE = __ENDFADE__;
  var $ = function (id) { return document.getElementById(id); };
  function build() {
    var tl = gsap.timeline({ paused: true });
    // measure chat rows before anything is hidden
    var scenesEls = Array.prototype.slice.call(document.querySelectorAll('.scene'));
    var saved = scenesEls.map(function (s) { var d = s.style.display, v = s.style.visibility; s.style.display = 'block'; s.style.visibility = 'hidden'; return [d, v]; });
    var heights = {};
    document.querySelectorAll('.row').forEach(function (row) {
      heights[row.id] = Array.prototype.map.call(row.querySelectorAll(':scope > .layer'), function (l) { return l.offsetHeight; });
    });
    scenesEls.forEach(function (s, i) { s.style.display = saved[i][0]; s.style.visibility = saved[i][1]; });

    CUES.forEach(function (c) {
      if (c.op === 'scene') {
        var el = $(c.el);
        if (c.first) tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'sine.out' }, 0);
        else tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: XF, ease: 'sine.inOut' }, c.start);
        if (c.last) tl.to(el, { opacity: 0, duration: ENDFADE, ease: 'sine.inOut' }, TOTAL - ENDFADE);
        else tl.to(el, { opacity: 0, duration: XF, ease: 'sine.inOut' }, c.start + c.dur);
      } else if (c.op === 'in') {
        tl.fromTo($(c.el), { opacity: 0, y: c.y }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, c.t);
      } else if (c.op === 'xin') {
        tl.fromTo($(c.el), { opacity: 0 }, { opacity: 1, duration: XF, ease: 'sine.inOut' }, c.t);
      } else if (c.op === 'xout') {
        tl.to($(c.el), { opacity: 0, duration: XF, ease: 'sine.inOut' }, c.t);
      } else if (c.op === 'cam') {
        tl.to($(c.el), { x: c.to.x, y: c.to.y, scale: c.to.scale, duration: c.d, ease: c.ease }, c.t);
      } else if (c.op === 'mark') {
        tl.fromTo($(c.el), { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, c.t);
        if (c.until !== null) tl.to($(c.el), { opacity: 0, duration: 0.5, ease: 'sine.inOut' }, c.until);
      } else if (c.op === 'menu') {
        var menu = $(c.el), file = $(c.file), ring = $(c.ring);
        tl.fromTo(ring, { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.5 }, c.t - 0.3);
        tl.fromTo(menu, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, c.t + 0.3);
        tl.fromTo(file, { backgroundColor: 'rgba(255,154,82,0)' }, { backgroundColor: 'rgba(255,154,82,0.28)', duration: 0.3 }, c.tf);
        tl.fromTo(file.querySelector('.ripple'), { scale: 0, opacity: 0.5 }, { scale: 4, opacity: 0, duration: 0.7, ease: 'power1.out' }, c.tf);
        tl.to([menu, ring], { opacity: 0, duration: 0.4 }, c.until);
      } else if (c.op === 'chat') {
        c.rows.forEach(function (r) {
          var row = $(r.row), h = heights[r.row];
          var layers = row.querySelectorAll(':scope > .layer');
          gsap.set(layers, { opacity: 0 });
          if (r.at === null) { row.style.height = h[0] + 'px'; gsap.set(layers[0], { opacity: 1 }); }
          else {
            row.style.height = '0px';
            tl.to(row, { height: h[0], duration: 0.55, ease: 'power2.out' }, r.at);
            tl.fromTo(layers[0], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, r.at + 0.05);
          }
          if (r.ring) {
            var br = $(r.ring.btn).querySelector('.bring');
            tl.fromTo(br, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, r.ring.t);
            if (r.ring.until !== null) tl.to(br, { opacity: 0, duration: 0.3 }, r.ring.until);
          }
          if (r.tap) {
            var b = $(r.tap.btn);
            tl.to(b, { backgroundColor: 'rgba(255,255,255,0.34)', duration: 0.15 }, r.tap.t);
            tl.to(b, { backgroundColor: 'rgba(255,255,255,0.12)', duration: 0.4 }, r.tap.t + 0.3);
            tl.fromTo(b.querySelector('.ripple'), { scale: 0, opacity: 0.6 }, { scale: 4, opacity: 0, duration: 0.7, ease: 'power1.out' }, r.tap.t);
          }
          if (r.edit !== undefined) {
            tl.to(row, { height: h[1], duration: 0.5, ease: 'power2.inOut' }, r.edit);
            tl.to(layers[0], { opacity: 0, duration: 0.35 }, r.edit);
            tl.fromTo(layers[1], { opacity: 0 }, { opacity: 1, duration: 0.5 }, r.edit + 0.12);
          }
          (r.hl || []).forEach(function (hl) {
            var span = layers[0].querySelector('.hl[data-k="' + hl.k + '"]');
            tl.fromTo(span, { backgroundColor: 'rgba(255,154,82,0)' }, { backgroundColor: 'rgba(255,154,82,0.30)', duration: 0.45 }, hl.t);
            tl.to(span, { backgroundColor: 'rgba(255,154,82,0)', duration: 0.5 }, hl.until);
          });
        });
      }
    });
    tl.set({}, {}, TOTAL);
    window.__timelines.main = tl;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build); else build();
})();
`;

const CSS = String.raw`
:root {
  --ground: #f2f2f7; --plate: #ffffff; --fill: #e4e4e9; --line: #c6c6c8;
  --text: #1d1d1f; --text-2: #48484d; --muted: #636366;
  --tint: #b0501a; --tint-wash: #fbeee5; --late: #d70015; --ok: #1e7b34;
  --tg-bg: #0e1621; --tg-head: #17212b; --tg-bot: #182533; --tg-me: #2b5278; --tg-text: #f5f5f5;
  --tg-muted: #8a9bab; --tg-link: #6ab3f3;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--ground); }
body { font-family: var(--font); color: var(--text); -webkit-font-smoothing: antialiased; }
#root { position: relative; overflow: hidden; background: var(--ground); }
.scene { position: absolute; inset: 0; }
.visual { position: absolute; }

/* captions */
.cap { position: absolute; display: flex; flex-direction: column; }
.cap--center { justify-content: center; }
.cap--start { justify-content: flex-start; }
.cap-sec { font-weight: 600; color: var(--tint); margin-bottom: 14px; letter-spacing: -0.005em; }
.cap-title { font-weight: 700; letter-spacing: -0.024em; line-height: 1.06; margin-bottom: 26px; text-wrap: balance; }
.cap-line { line-height: 1.32; color: var(--text-2); margin-top: 18px; letter-spacing: -0.01em; }
.cap-line b { color: var(--text); font-weight: 600; }
.chip { display: inline-block; padding: 0.1em 0.55em; border-radius: 0.4em; background: var(--fill); color: var(--text); font-weight: 600; font-size: 0.86em; margin-right: 0.25em; }
.chip--tint { background: var(--tint); color: #fff; }

/* hero */
.hero { left: 0; top: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.hero-title { font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; padding: 0 80px; }
.hero-rule { width: 96px; height: 6px; border-radius: 3px; background: var(--tint); margin: 40px 0 34px; }
.hero-sub { color: var(--text-2); font-weight: 500; margin-top: 10px; }
.hero-line { font-weight: 700; letter-spacing: -0.028em; line-height: 1.18; }
.hero-line + .hero-sub { margin-top: 48px; }
.tint { color: var(--tint); }

/* screenshots */
.screen { position: relative; overflow: hidden; background: var(--ground); }
.shotframe .screen { border-radius: 16px; box-shadow: 0 0 0 1px rgba(0,0,0,0.10), 0 18px 50px rgba(0,0,0,0.10), 0 3px 10px rgba(0,0,0,0.05); }
.phoneframe { border-radius: 56px; background: #1d1d1f; padding: 10px; box-shadow: 0 18px 50px rgba(0,0,0,0.14); }
.screen--phone { border-radius: 46px; }
.cam { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
.cam img { display: block; }
.mark { position: absolute; border-style: solid; border-color: var(--tint); opacity: 0; box-shadow: 0 0 0 6px rgba(176,80,26,0.14); }

/* methods */
.methods { display: flex; flex-direction: column; justify-content: center; gap: 30px; }
.m-item { display: flex; align-items: center; gap: 34px; background: var(--plate); border-radius: 22px; padding: 30px 36px; min-height: 220px; box-shadow: 0 0 0 1px rgba(0,0,0,0.05); }
.m-icon { flex: none; width: 104px; height: 104px; border-radius: 52px; background: var(--tint-wash); color: var(--tint); display: grid; place-items: center; }
.m-icon svg { width: 52px; height: 52px; }
.m-words { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.m-title { font-size: 40px; font-weight: 700; letter-spacing: -0.02em; }
.m-detail { font-size: 27px; color: var(--text-2); line-height: 1.3; }
.m-demo { flex: none; width: 420px; display: flex; justify-content: flex-end; }
.bubble.demo { font-size: 23px; max-width: 420px; }

/* tips */
.tips { display: flex; flex-direction: column; justify-content: center; gap: 22px; }
.tip { display: flex; align-items: center; gap: 30px; background: var(--plate); border-radius: 20px; padding: 26px 34px; box-shadow: 0 0 0 1px rgba(0,0,0,0.05); }
.tip-n { flex: none; width: 70px; height: 70px; border-radius: 35px; background: var(--tint); color: #fff; font-size: 36px; font-weight: 700; display: grid; place-items: center; }
.tip-t { font-size: 40px; color: var(--text-2); letter-spacing: -0.015em; line-height: 1.25; }
.tip-t b { color: var(--text); font-weight: 600; }

/* the Telegram-like chat (a generic dark messenger look) */
.chatframe { background: var(--tg-bg); border-radius: 40px; overflow: hidden; box-shadow: 0 0 0 10px #1d1d1f, 0 24px 60px rgba(0,0,0,0.22); color: var(--tg-text); font-size: 21px; }
.tg-head { position: absolute; left: 0; right: 0; top: 0; height: 86px; background: var(--tg-head); display: flex; align-items: center; gap: 14px; padding: 18px 22px 0; z-index: 2; }
.tg-back { width: 30px; height: 30px; color: var(--tg-link); }
.tg-back svg { width: 30px; height: 30px; }
.tg-ava { width: 50px; height: 50px; border-radius: 25px; background: #c1652e; color: #fff; font-weight: 700; font-size: 24px; display: grid; place-items: center; }
.tg-who { display: flex; flex-direction: column; }
.tg-name { font-weight: 600; font-size: 22px; }
.tg-sub { font-size: 17px; color: var(--tg-muted); }
.tg-body { position: absolute; left: 0; right: 0; top: 86px; bottom: 76px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 14px 12px; }
.tg-list { display: flex; flex-direction: column; justify-content: flex-end; min-height: 100%; }
.row { position: relative; flex: none; overflow: visible; }
.layer { position: absolute; left: 0; right: 0; top: 0; padding-top: 12px; display: flex; flex-direction: column; }
.layer--me { align-items: flex-end; }
.layer--bot { align-items: flex-start; }
.bubble { border-radius: 18px; padding: 10px 14px 9px; line-height: 1.36; max-width: 84%; position: relative; }
.bubble.bot { background: var(--tg-bot); width: 460px; max-width: 460px; border-bottom-left-radius: 6px; }
.bubble.me { background: var(--tg-me); border-bottom-right-radius: 6px; }
.bubble.demo { border-bottom-right-radius: 18px; color: var(--tg-text); }
.txt { white-space: pre-line; overflow-wrap: break-word; }
.txt b { font-weight: 650; }
.meta { float: right; font-size: 14px; color: var(--tg-muted); margin: 10px -2px -4px 14px; line-height: 1; }
.me .meta { color: #9cc3e6; }
.ticks { letter-spacing: -0.3em; }
.hl { background-color: rgba(255,154,82,0); border-radius: 5px; padding: 1px 4px; margin: 0 -4px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.kb { width: 460px; display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.kbrow { display: flex; gap: 6px; }
.kbtn { position: relative; overflow: visible; flex: 1; text-align: center; background: rgba(255,255,255,0.12); border-radius: 12px; padding: 12px 8px; font-size: 19px; font-weight: 600; color: #fff; }
.kbtn .ripple, .tg-mi .ripple { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: #fff; opacity: 0; pointer-events: none; }
.kbtn { overflow: hidden; }
.bring { position: absolute; inset: 0; border-radius: 12px; border: 3px solid #ff9a52; opacity: 0; }
.voice { display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 10px; }
.play { width: 46px; height: 46px; border-radius: 23px; background: #fff; color: var(--tg-me); display: grid; place-items: center; flex: none; }
.play svg { width: 24px; height: 24px; margin-left: 3px; }
.wave { display: flex; align-items: center; gap: 3px; height: 30px; }
.wave i { display: block; width: 4px; border-radius: 2px; background: #a9cdef; }
.vlen { font-size: 15px; color: #9cc3e6; margin-left: 4px; }
.voice .meta { float: none; margin: 18px 0 0 8px; align-self: flex-end; }
.file { width: 380px; }
.doc { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
.thumb { width: 64px; height: 64px; border-radius: 10px; background: linear-gradient(135deg, #8d7f6e, #5d6670); flex: none; }
.fname { display: block; font-weight: 600; font-size: 19px; }
.fsize { display: block; font-size: 16px; color: #9cc3e6; margin-top: 2px; }
.tg-compose { position: absolute; left: 0; right: 0; bottom: 0; height: 76px; background: var(--tg-head); display: flex; align-items: center; gap: 14px; padding: 0 18px 6px; }
.tg-clip, .tg-mic { width: 34px; height: 34px; color: var(--tg-muted); flex: none; }
.tg-clip svg, .tg-mic svg { width: 34px; height: 34px; }
.tg-input { flex: 1; height: 44px; border-radius: 22px; background: #242f3d; color: var(--tg-muted); font-size: 19px; display: flex; align-items: center; padding: 0 18px; }
.clipring { position: absolute; left: 10px; bottom: 15px; width: 50px; height: 50px; border-radius: 25px; border: 3px solid #ff9a52; }
.tg-menu { position: absolute; left: 14px; bottom: 84px; width: 260px; background: #1f2b38; border-radius: 18px; padding: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); z-index: 3; }
.tg-mi { position: relative; overflow: hidden; display: flex; align-items: center; gap: 14px; padding: 14px 14px; border-radius: 12px; font-size: 21px; }
.tg-mi svg { width: 30px; height: 30px; color: var(--tg-link); }
`;

// The phone version is its own HyperFrames project (one root composition per project); it shares assets/.
mkdirSync(path.join(ROOT, 'portrait'), { recursive: true });
if (!existsSync(path.join(ROOT, 'portrait/assets'))) symlinkSync('../assets', path.join(ROOT, 'portrait/assets'));
for (const L of Object.values(LAYOUTS)) {
  writeFileSync(path.join(ROOT, L.file), compose(L));
  console.log(`wrote ${L.file}: ${timed.length} scenes, ${TOTAL}s (${Math.floor(TOTAL / 60)}:${String(Math.round(TOTAL % 60)).padStart(2, '0')})`);
}
writeFileSync(
  path.join(ROOT, 'assets/timing.json'),
  JSON.stringify({ total: TOTAL, scenes: timed.map(({ sc, start, dur }) => ({ id: sc.id, start, dur })) }, null, 2),
);
