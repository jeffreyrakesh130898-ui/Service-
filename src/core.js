'use strict';
/* HookCalc: crane and rigging calculator.
   Plain JavaScript, no libraries. Every value is stored in SI units
   (kg, m, m², m³, kPa, kg/m, kg/m³, kN, m/s) and converted only for display. */

const APP = { name: 'HookCalc', version: '1.0.0', key: 'hookcalc.v1' };
const G = 9.80665;
const NB = '\u00a0';
const TOOL_ORDER = ['cap', 'sling', 'weight', 'boom', 'ground', 'wind', 'cg', 'reev', 'conv'];
const TOOLS = {};
const ACTS = {};
const RANK = { info: 0, ok: 1, warn: 2, bad: 3, stop: 4 };
const SHORT = { ok: 'OK', warn: 'Caution', bad: 'Danger', stop: 'Stop', info: '' };
const EMOJI = { ok: '\u2705', warn: '\u26a0\ufe0f', bad: '\ud83d\udfe5', stop: '\u26d4', info: '\u2139\ufe0f' };
const DISCLAIMER = 'HookCalc is a calculation aid. Always use the manufacturer\u2019s load chart, the rigging tags and your site rules, and have a competent person plan and supervise every lift.';
const SHARE_FOOT = 'Calculated with HookCalc. Check against the load chart, rigging tags and site rules before lifting.';
const PAGE_TITLES = { plan: 'Lift plan', guide: 'Field guide', settings: 'Settings' };
const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்']];
const LANG_SHORT = { en: 'EN', hi: 'हि', ta: 'த' };

/* ---------- helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isNum = v => typeof v === 'number' && isFinite(v);
const all = (...v) => v.every(isNum);
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const clone = o => JSON.parse(JSON.stringify(o));
const worst = (...ss) => ss.reduce((a, b) => (b && RANK[b] > RANK[a] ? b : a), 'info');
const empty = msg => ({ state: 'empty', msg });
const fail = msg => ({ state: 'error', msg });
const lab = (l, st) => (typeof l === 'function' ? l(st) : l);
function mq(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
const reduceMotion = () => mq('(prefers-reduced-motion: reduce)');
const isWide = () => mq('(min-width: 980px)');

/* ---------- language ----------
   English text is the key. STRINGS (i18n.js) holds rows of [English, Hindi, Tamil].
   Keys with {0}, {1} are templates: they also translate text built at run time. */
const I18N = { hi: {}, ta: {} };
const TPL = { hi: [], ta: [] };
let tCache = {}, tCacheN = 0;
function initI18n() {
  if (typeof STRINGS === 'undefined') return;
  const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  STRINGS.forEach(row => {
    const en = row[0];
    ['hi', 'ta'].forEach((lg, i) => {
      const tr = row[i + 1];
      if (!tr) return;
      I18N[lg][en] = tr;
      if (/\{\d\}/.test(en) && /[A-Za-z]{3}/.test(en.replace(/\{\d\}/g, ' '))) {
        const idx = [];
        const src = reEsc(en).replace(/\\\{(\d)\\\}/g, (m, n) => { idx.push(+n); return '([\\s\\S]+?)'; });
        TPL[lg].push({ re: new RegExp('^' + src + '$'), idx, tr, w: en.replace(/\{\d\}/g, '').length });
      }
    });
  });
  ['hi', 'ta'].forEach(lg => TPL[lg].sort((a, b) => b.w - a.w));
}
function T(s) {
  if (typeof s !== 'string' || !S || !S.lang || S.lang === 'en' || !/[A-Za-z]/.test(s)) return s;
  const d = I18N[S.lang];
  if (!d) return s;
  if (Object.prototype.hasOwnProperty.call(d, s)) return d[s];
  const ck = S.lang + '|' + s;
  if (Object.prototype.hasOwnProperty.call(tCache, ck)) return tCache[ck];
  let out = s;
  const tp = TPL[S.lang] || [];
  for (let i = 0; i < tp.length; i++) {
    const m = tp[i].re.exec(s);
    if (m) {
      const t = tp[i];
      out = t.tr.replace(/\{(\d)\}/g, (x, n) => { const q = t.idx.indexOf(+n); return q >= 0 ? T(m[q + 1]) : ''; });
      break;
    }
  }
  if (out === s && typeof window !== 'undefined' && window.__hcMiss) window.__hcMiss.add(s);
  if (++tCacheN > 3000) { tCache = {}; tCacheN = 0; }
  tCache[ck] = out;
  return out;
}
function TF(tpl) { const a = arguments; return T(tpl).replace(/\{(\d)\}/g, (x, n) => (a[+n + 1] != null ? String(a[+n + 1]) : '')); }
function detectLang() {
  try { const l = String(navigator.language || '').toLowerCase(); if (l.indexOf('hi') === 0) return 'hi'; if (l.indexOf('ta') === 0) return 'ta'; } catch (e) { /* ignore */ }
  return 'en';
}
function applyLang() { document.documentElement.lang = S.lang || 'en'; tCache = {}; tCacheN = 0; }

/* ---------- numbers ---------- */
function parseNum(str) {
  if (str == null) return null;
  let s = String(str).trim().replace(/[\s\u00a0'\u2019_]/g, '').replace(/[\u2212\u2013]/g, '-');
  if (s === '' || /^[-+]?[.,]?$/.test(s)) return null;
  const commas = (s.match(/,/g) || []).length;
  if (commas) {
    if (s.indexOf('.') >= 0) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (commas === 1) {
      const parts = s.split(',');
      const whole = parts[0].replace(/^[-+]/, '');
      if (parts[1].length === 3 && whole !== '' && whole !== '0') s = parts[0] + parts[1];
      else s = parts[0] + '.' + parts[1];
    } else s = s.replace(/,/g, '');
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return parseFloat(s);
}
function autoDp(v) {
  const a = Math.abs(v);
  if (a === 0 || a >= 1000) return 0;
  if (a >= 10) return 1;
  if (a >= 1) return 2;
  if (a >= 0.01) return 3;
  return 4;
}
function fmtN(v, dp) {
  if (!isNum(v)) return '\u2014';
  if (dp == null) dp = autoDp(v);
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (v < 0 && /[1-9]/.test(s) ? '\u2212' : '') + s;
}
function fmtSig(v) {
  if (!isNum(v)) return '\u2014';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-4 || a >= 1e12)) return v.toExponential(4);
  return Number(v.toPrecision(6)).toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/* ---------- units ---------- */
const UNITS = {
  mass: { metric: ['t', 1000], imperial: ['lb', 0.45359237] },
  len: { metric: ['m', 1], imperial: ['ft', 0.3048] },
  dim: { metric: ['mm', 0.001], imperial: ['in', 0.0254] },
  area: { metric: ['m\u00b2', 1], imperial: ['ft\u00b2', 0.09290304] },
  vol: { metric: ['m\u00b3', 1], imperial: ['ft\u00b3', 0.028316846592] },
  press: { metric: ['t/m\u00b2', G], imperial: ['psf', 0.04788025898] },
  lin: { metric: ['kg/m', 1], imperial: ['lb/ft', 1.48816394357] },
  dens: { metric: ['kg/m\u00b3', 1], imperial: ['lb/ft\u00b3', 16.018463374] },
  force: { metric: ['kN', 1], imperial: ['lbf', 0.0044482216152605] },
  deg: { metric: ['\u00b0', 1], imperial: ['\u00b0', 1] },
  pct: { metric: ['%', 1], imperial: ['%', 1] },
  num: { metric: ['', 1], imperial: ['', 1] }
};
const WIND_UNITS = { ms: ['m/s', 1], kmh: ['km/h', 1 / 3.6], mph: ['mph', 0.44704], kn: ['knots', 0.514444] };
function uInfo(kind) {
  if (kind === 'speed') return WIND_UNITS[S.windUnit] || WIND_UNITS.ms;
  const k = UNITS[kind] || UNITS.num;
  return k[S.units] || k.metric;
}
const unitOf = kind => uInfo(kind)[0];
const toSI = (kind, v) => v * uInfo(kind)[1];
const fromSI = (kind, si) => si / uInfo(kind)[1];
const tight = u => u === '\u00b0' || u === '%';
function withUnit(n, u) { return u ? (tight(u) ? n + u : n + NB + u) : n; }
function fmtQ(kind, si, dp) { return isNum(si) ? withUnit(fmtN(fromSI(kind, si), dp), unitOf(kind)) : '\u2014'; }
function mv(label, kind, si, dp) { return { label, value: fmtN(fromSI(kind, si), dp), unit: unitOf(kind) }; }
function massAlt(si) { return S.units === 'imperial' ? withUnit(fmtN(si / 907.18474, 2), 'US tons') : withUnit(fmtN(si, 0), 'kg'); }
const fmtDeg = (d, dp) => fmtN(d, dp == null ? 1 : dp) + '\u00b0';
const fmtPct = (p, dp) => fmtN(p, dp == null ? 1 : dp) + '%';
function dispVal(kind, si) { return isNum(si) ? String(Number(fromSI(kind, si).toPrecision(6))) : ''; }
/* Example values: exact in the base unit, rounded to 3 significant figures after conversion. */
function exNum(kind, si) {
  const f = uInfo(kind)[1];
  return Number(fromSI(kind, si).toPrecision(f === 1 ? 6 : 3));
}

/* ---------- state ---------- */
let S = null;
function freshTool(id) { return clone(TOOLS[id].defaults); }
function freshPlan() { return { job: '', customer: '', site: '', date: '', crane: '', operator: '', rigger: '', notes: '', chk: {} }; }
function defaultState() {
  const tools = {};
  TOOL_ORDER.forEach(id => { tools[id] = freshTool(id); });
  return { v: 1, lang: detectLang(), units: 'metric', theme: 'auto', crit: 75, windUnit: 'ms', onboarded: false, tools, ex: {}, inc: {}, plan: freshPlan() };
}
function loadState() {
  const d = defaultState();
  let s = null;
  try { const raw = localStorage.getItem(APP.key); if (raw) s = JSON.parse(raw); } catch (e) { s = null; }
  if (!s || typeof s !== 'object') return d;
  if (LANG_SHORT[s.lang]) d.lang = s.lang;
  if (s.units === 'metric' || s.units === 'imperial') d.units = s.units;
  if (['auto', 'light', 'dark'].indexOf(s.theme) >= 0) d.theme = s.theme;
  if (isNum(s.crit)) d.crit = clamp(Math.round(s.crit / 5) * 5, 50, 90);
  if (WIND_UNITS[s.windUnit]) d.windUnit = s.windUnit;
  d.onboarded = !!s.onboarded;
  if (s.tools && typeof s.tools === 'object') {
    TOOL_ORDER.forEach(id => {
      if (s.tools[id] && typeof s.tools[id] === 'object') d.tools[id] = Object.assign(freshTool(id), s.tools[id]);
    });
  }
  if (s.ex && typeof s.ex === 'object') d.ex = Object.assign({}, s.ex);
  if (s.inc && typeof s.inc === 'object') d.inc = Object.assign({}, s.inc);
  if (s.plan && typeof s.plan === 'object') {
    d.plan = Object.assign(freshPlan(), s.plan);
    d.plan.chk = Object.assign({}, s.plan.chk);
  }
  if (!Array.isArray(d.tools.cg.items) || !d.tools.cg.items.length) d.tools.cg.items = freshTool('cg').items;
  return d;
}
let saveT = 0;
function flushSave() {
  clearTimeout(saveT);
  try { localStorage.setItem(APP.key, JSON.stringify(S)); } catch (e) { /* storage can be unavailable; the app still works */ }
}
function save() { clearTimeout(saveT); saveT = setTimeout(flushSave, 250); }
function applyTheme() {
  const r = document.documentElement;
  r.classList.toggle('hc-light', S.theme === 'light');
  r.classList.toggle('hc-dark', S.theme === 'dark');
}

/* ---------- icons ---------- */
const svgI = p => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC = {
  back: svgI('<path d="M15 5l-7 7 7 7"/>'),
  chev: svgI('<path d="m9 5 7 7-7 7"/>'),
  cap: svgI('<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4.2-5"/><circle cx="12" cy="17" r="1.4"/>'),
  sling: svgI('<path d="M12 3v3"/><path d="M12 6 4.5 14M12 6l7.5 8"/><rect x="3" y="14" width="18" height="6" rx="1.2"/>'),
  weight: svgI('<path d="M7.2 9h9.6l2.7 11H4.5z"/><path d="M9.5 9a2.5 2.5 0 1 1 5 0"/>'),
  boom: svgI('<path d="M2.5 20.5h19"/><path d="M4 20.5v-3.3h7.5v3.3"/><path d="M7 17.2 18.5 5"/><path d="M18.5 5v8"/><rect x="16.8" y="13" width="3.4" height="3" rx=".6"/>'),
  ground: svgI('<path d="M12 2.5v8"/><path d="m8.6 7.4 3.4 3.4 3.4-3.4"/><rect x="4.5" y="13" width="15" height="3.4" rx=".8"/><path d="M2.5 20h19"/>'),
  wind: svgI('<path d="M3 8.5h10.5a2.8 2.8 0 1 0-2.8-2.8"/><path d="M3 12.5h15a2.8 2.8 0 1 1-2.8 2.8"/><path d="M3 16.5h6"/>'),
  cg: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 12V4a8 8 0 0 1 8 8zM12 12v8a8 8 0 0 1-8-8z" fill="currentColor"/></svg>',
  reev: svgI('<circle cx="12" cy="5.5" r="2.8"/><path d="M9.2 5.5v10M14.8 5.5v10"/><rect x="7.5" y="15.5" width="9" height="4.5" rx="1"/>'),
  conv: svgI('<path d="M4 8h14.5L15 4.5"/><path d="M20 16H5.5L9 19.5"/>'),
  tools: svgI('<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>'),
  plan: svgI('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4"/><path d="m8.5 11 1.7 1.7 3.3-3.3"/><path d="M8.5 16.5h7"/>'),
  guide: svgI('<path d="M5 5a2 2 0 0 1 2-2h11v15H7a2 2 0 0 0-2 2z"/><path d="M5 20a2 2 0 0 0 2 2h11v-4"/><path d="M9 7.5h5"/>'),
  gear: svgI('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  share: svgI('<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>'),
  copy: svgI('<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>'),
  print: svgI('<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="1.6"/><path d="M7 14h10v6.5H7z"/>'),
  chat: svgI('<path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4a8.5 8.5 0 1 1 15.6-4.6z"/>'),
  plus: svgI('<path d="M12 5v14M5 12h14"/>'),
  x: svgI('<path d="M6 6l12 12M18 6 6 18"/>'),
  spark: svgI('<path d="M12 3.5 13.8 9l5.7 1.5-5.7 1.6L12 17.5l-1.8-5.4-5.7-1.6L10.2 9z"/>'),
  reset: svgI('<path d="M4 4.5v5h5"/><path d="M4.6 15a8 8 0 1 0 1.9-8.2L4 9.5"/>'),
  install: svgI('<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 19.5h15"/>'),
  trash: svgI('<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/>')
};
const SIC = {
  ok: svgI('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  warn: svgI('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17.2v.1"/>'),
  stop: svgI('<path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z"/><path d="M8.5 12h7"/>'),
  info: svgI('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>'),
  empty: svgI('<path d="M6 12h12"/>'),
  error: svgI('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.2v.1"/>')
};
SIC.bad = SIC.warn;
const HOOK = '<svg class="hook" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M18.5 1v3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="12.5" y="4" width="12" height="9.5" rx="2.4" fill="currentColor"/><circle cx="18.5" cy="8.75" r="2.3" fill="var(--hook-hole, #1C2126)"/><path d="M18.5 13.5v6.3a5.4 5.4 0 1 1-5.4-5.4" fill="none" stroke="currentColor" stroke-width="3.3" stroke-linecap="round"/></svg>';

/* ---------- feedback: toast, screen reader, modal ---------- */
let toastT = 0;
function toast(msg) {
  const el = $('#toast'); if (!el) return;
  el.textContent = T(msg);
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2800);
}
let srT = 0;
function announce(t) {
  clearTimeout(srT);
  srT = setTimeout(() => { const el = $('#sr'); if (el && el.textContent !== t) el.textContent = t; }, 1000);
}
let modalRet = null, modalActs = null, modalKind = '';
function openModal(o) {
  const root = $('#modal-root');
  if (root.firstChild) closeModal(true);
  modalRet = document.activeElement;
  modalActs = o.actions || [];
  modalKind = o.kind || '';
  root.innerHTML = `<div class="mback" data-dismiss="${o.dismiss === false ? 0 : 1}"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t"><h2 id="m-t">${esc(T(o.title))}</h2><div class="m-body">${o.body}</div><div class="m-acts">${modalActs.map((a, i) => `<button type="button" class="btn ${a.cls || ''}" data-mact="${i}">${esc(T(a.label))}</button>`).join('')}</div></div></div>`;
  document.body.classList.add('modal-open');
  const f = $('.m-acts .btn-primary', root) || $('.m-acts .btn', root);
  if (f) f.focus();
  if (o.onOpen) o.onOpen(root);
}
function closeModal(silent) {
  const root = $('#modal-root');
  if (!root || !root.firstChild) return;
  root.innerHTML = '';
  modalActs = null;
  modalKind = '';
  document.body.classList.remove('modal-open');
  if (!silent && modalRet && document.contains(modalRet)) { try { modalRet.focus(); } catch (e) { /* ignore */ } }
}
function modalAct(i) {
  const a = modalActs && modalActs[i];
  const keep = a && a.onClick ? a.onClick() : false;
  if (keep !== true) closeModal();
}
function confirmBox(title, text, okLabel, onOk, danger) {
  openModal({ title, body: `<p>${esc(T(text))}</p>`, actions: [{ label: 'Cancel', cls: 'btn-quiet' }, { label: okLabel, cls: danger ? 'btn-danger' : 'btn-primary', onClick: onOk }] });
}

/* ---------- copy and share ---------- */
function showCopyBox(text) {
  openModal({
    title: 'Copy this text',
    body: `<p class="hint">${esc(T('Select all of it, copy, then paste where you need it.'))}</p><label class="vh" for="copybox">${esc(T('Text to copy'))}</label><textarea id="copybox" class="copybox" readonly rows="10">${esc(text)}</textarea>`,
    actions: [{ label: 'Done', cls: 'btn-primary' }],
    onOpen: root => { const ta = $('.copybox', root); if (ta) { ta.focus(); ta.select(); } }
  });
}
function copyText(text) {
  const done = () => toast('Copied. Paste it into WhatsApp, SMS or email.');
  const fallback = () => {
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { ok = false; }
    if (ok) done(); else showCopyBox(text);
  };
  try {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fallback); return; }
  } catch (e) { /* use fallback */ }
  fallback();
}
function shareText(title, text) {
  if (!text) return;
  if (navigator.share) {
    try {
      navigator.share({ title, text }).catch(err => { if (!err || err.name !== 'AbortError') copyText(text); });
      return;
    } catch (e) { /* fall through to copy */ }
  }
  copyText(text);
}

/* ---------- form engine for calculators ---------- */
function toolCtx() { return VIEW.name === 'tool' && TOOLS[VIEW.id] ? { id: VIEW.id, t: TOOLS[VIEW.id], st: S.tools[VIEW.id] } : null; }
function exampleOf(t, st) { const ex = typeof t.example === 'function' ? t.example(st) : t.example; return ex || { opts: {}, vals: {} }; }
function findField(fields, k) {
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.k === k) return f;
    if (f.fields) { const r = findField(f.fields, k); if (r) return r; }
  }
  return null;
}
function renderFields(t, st) {
  const exv = exampleOf(t, st).vals || {};
  return t.fields.map((f, i) => fieldHTML(f, st, exv, i, false)).join('');
}
function fieldHTML(f, st, exv, i, inRow) {
  const shown = !f.show || f.show(st);
  const w = inRow ? '' : ` data-fi="${i}"${shown ? '' : ' hidden'}`;
  switch (f.t) {
    case 'num': return numHTML(f, st, exv, w);
    case 'seg': return segHTML(f, st, w, false);
    case 'tiles': return segHTML(f, st, w, true);
    case 'sel': return selHTML(f, st, w);
    case 'head': return `<div class="grp"${w}><h2>${esc(T(lab(f.label, st)))}</h2>${f.note ? `<p class="hint">${esc(T(lab(f.note, st)))}</p>` : ''}</div>`;
    case 'note': return `<p class="fnote"${w}>${esc(T(lab(f.html, st)))}</p>`;
    case 'row': return `<div class="row2"${w}>${f.fields.map(sf => fieldHTML(sf, st, exv, i, true)).join('')}</div>`;
    case 'custom': return `<div class="fcustom"${w}>${f.render(st, exv)}</div>`;
    default: return '';
  }
}
function numHTML(f, st, exv, w) {
  const id = 'f-' + f.k;
  const u = unitOf(f.kind);
  const ex = exv[f.k];
  const ph = f.ph != null ? T(lab(f.ph, st)) : (isNum(ex) ? T('e.g.') + ' ' + exNum(f.kind, ex) : '');
  const hint = T(lab(f.hint, st));
  return `<div class="fld"${w}><label for="${id}">${esc(T(lab(f.label, st)))}${u ? `<span class="vh"> (${esc(u)})</span>` : ''}${f.opt ? ` <span class="opt">${esc(T('optional'))}</span>` : ''}</label>` +
    `<div class="inp">${f.neg ? `<button type="button" class="sign" data-act="sign" data-target="${id}" aria-label="${esc(T('Change plus or minus'))}">\u00b1</button>` : ''}` +
    `<input id="${id}" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-k="${f.k}" data-kind="${f.kind}"${f.neg ? ' data-neg="1"' : ''} placeholder="${esc(ph)}" value="${esc(dispVal(f.kind, st[f.k]))}"${hint ? ` aria-describedby="h-${f.k}"` : ''}>` +
    `${u ? `<span class="u" aria-hidden="true">${esc(u)}</span>` : ''}</div>` +
    `${hint ? `<p class="hint" id="h-${f.k}">${esc(hint)}</p>` : ''}<p class="errmsg" hidden></p></div>`;
}
function segHTML(f, st, w, tiles) {
  const cur = f.global ? S[f.k] : st[f.k];
  const hint = T(lab(f.hint, st));
  const opts = lab(f.opts, st);
  const btn = (o, j) => `<button type="button" data-seg="${f.k}" data-j="${j}" aria-pressed="${o[0] === cur}">${tiles && o[2] ? o[2] : ''}<span>${esc(T(lab(o[1], st)))}</span></button>`;
  return `<div class="fld"${w}><span class="lbl" id="l-${f.k}">${esc(T(lab(f.label, st)))}</span><div class="${tiles ? 'tiles' : 'seg'}${f.cls ? ' ' + f.cls : ''}" role="group" aria-labelledby="l-${f.k}">${opts.map(btn).join('')}</div>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;
}
function selHTML(f, st, w) {
  const cur = st[f.k];
  const opts = lab(f.opts, st);
  const one = o => `<option value="${esc(o[0])}"${String(o[0]) === String(cur) ? ' selected' : ''}>${esc(T(o[1]))}</option>`;
  const body = opts.map(o => (o[0] === '__g' ? `<optgroup label="${esc(T(o[1]))}">${o[2].map(one).join('')}</optgroup>` : one(o))).join('');
  const hint = T(lab(f.hint, st));
  return `<div class="fld"${w}><label for="f-${f.k}">${esc(T(lab(f.label, st)))}${f.opt ? ` <span class="opt">${esc(T('optional'))}</span>` : ''}</label><div class="selwrap"><select id="f-${f.k}" data-sel="${f.k}">${body}</select></div>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;
}
function updateVis() {
  const c = toolCtx(); if (!c) return;
  $$('#inputs [data-fi]').forEach(el => { const f = c.t.fields[+el.getAttribute('data-fi')]; el.hidden = !!(f && f.show && !f.show(c.st)); });
}
function rerenderInputs(focusSel) {
  const c = toolCtx(); const box = $('#inputs');
  if (!c || !box) return;
  box.innerHTML = renderFields(c.t, c.st);
  if (focusSel) { const el = $(focusSel, box); if (el) el.focus(); }
}
function readNum(str, kind, neg) {
  const n = parseNum(str);
  if (n === null) return { v: null };
  if (!isNum(n)) return { v: null, err: 'Enter a number, like 12.5' };
  if (n < 0 && !neg) return { v: null, err: 'Enter a number above zero' };
  return { v: toSI(kind, n) };
}
function setErr(el, msg) {
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  const box = el.closest('.fld, .mfld'); if (!box) return;
  box.classList.toggle('has-err', !!msg);
  const em = $('.errmsg', box);
  if (em) { em.textContent = msg ? T(msg) : ''; em.hidden = !msg; }
}
function touched(id) { if (S.ex[id]) S.ex[id] = false; save(); }
function onNumInput(el) {
  const c = toolCtx(); if (!c) return;
  const k = el.getAttribute('data-k');
  const r = readNum(el.value, el.getAttribute('data-kind'), !!el.getAttribute('data-neg'));
  c.st[k] = r.v;
  setErr(el, r.err);
  const f = findField(c.t.fields, k);
  if (f && f.clears) { c.st[f.clears] = ''; const s = $(`#inputs select[data-sel="${f.clears}"]`); if (s) s.value = ''; }
  touched(c.id);
  updateVis();
  updateResults();
}
function onSelect(el) {
  const c = toolCtx(); if (!c) return;
  const k = el.getAttribute('data-sel');
  const f = findField(c.t.fields, k);
  c.st[k] = el.value;
  if (f && f.set) f.set(c.st, el.value);
  touched(c.id);
  if (f && f.rerender) rerenderInputs(`select[data-sel="${k}"]`); else updateVis();
  updateResults();
}
function onSeg(btn) {
  const c = toolCtx(); if (!c) return;
  const k = btn.getAttribute('data-seg'), j = +btn.getAttribute('data-j');
  const f = findField(c.t.fields, k); if (!f) return;
  const opts = lab(f.opts, c.st);
  if (!opts[j]) return;
  const val = opts[j][0];
  if (f.global) { S[k] = val; save(); } else { c.st[k] = val; if (f.set) f.set(c.st, val); touched(c.id); }
  rerenderInputs(`[data-seg="${k}"][data-j="${j}"]`);
  updateResults();
}
function toggleSign(btn) {
  const inp = document.getElementById(btn.getAttribute('data-target')); if (!inp) return;
  const s = inp.value.trim();
  inp.value = (s.charAt(0) === '-' || s.charAt(0) === '\u2212') ? s.slice(1) : '-' + s;
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.focus();
}
function fillExample() {
  const c = toolCtx(); if (!c) return;
  const ex = exampleOf(c.t, c.st);
  const st = freshTool(c.id);
  Object.assign(st, clone(ex.opts || {}));
  Object.keys(ex.vals || {}).forEach(k => {
    const f = findField(c.t.fields, k);
    const v = ex.vals[k];
    st[k] = f && f.kind && isNum(v) ? toSI(f.kind, exNum(f.kind, v)) : v;
  });
  if (ex.items) st.items = ex.items.map(it => ({ n: it.n, w: toSI('mass', exNum('mass', it.w)), x: toSI('len', exNum('len', it.x)), y: isNum(it.y) ? toSI('len', exNum('len', it.y)) : null }));
  S.tools[c.id] = st;
  S.ex[c.id] = true;
  save();
  rerenderInputs();
  updateResults();
  toast('Example values filled in. Change any value to use your own.');
}
function clearTool() {
  const c = toolCtx(); if (!c) return;
  const st = freshTool(c.id);
  (c.t.keepOnClear || []).forEach(k => { st[k] = c.st[k]; });
  S.tools[c.id] = st;
  S.ex[c.id] = false;
  save();
  rerenderInputs();
  updateResults();
  toast('Cleared');
}
function sendTo(el) {
  const to = el.getAttribute('data-to');
  let set = {};
  try { set = JSON.parse(el.getAttribute('data-set') || '{}'); } catch (e) { set = {}; }
  if (!TOOLS[to]) return;
  const fromEx = VIEW.name === 'tool' && !!S.ex[VIEW.id];
  if (S.ex[to]) S.tools[to] = freshTool(to);
  Object.keys(set).forEach(k => { S.tools[to][k] = set[k]; });
  S.ex[to] = fromEx;
  save();
  go('/t/' + to);
  toast(TF('Carried over to {0}', T(TOOLS[to].title)));
}

/* ---------- results ---------- */
function runCalc(id) {
  try { const r = TOOLS[id].calc(S.tools[id]); r.id = id; return r; } catch (e) {
    try { console.error(e); } catch (er) { /* ignore */ }
    return { id, state: 'error', msg: 'These values could not be calculated. Check the inputs.' };
  }
}
function readoutHTML(r, t, sub) {
  const ok = r.state === 'ok';
  const s = ok ? (r.status || 'info') : r.state;
  const m = ok ? r.main : { label: t ? t.mainLabel : '', value: '\u2014', unit: '' };
  const verdict = ok ? r.verdict : r.msg;
  const rows = ok && r.rows ? r.rows.filter(Boolean) : [];
  return `<section class="readout${sub ? ' ro-sub' : ''}" data-s="${s}">` +
    `<div class="ro-head"><span class="ro-lbl">${esc(T(m.label))}</span></div>` +
    `<div class="ro-main${m.text ? ' ro-text' : ''}"><span class="ro-num">${esc(T(m.value))}</span>${m.unit ? `<span class="ro-unit">${esc(T(m.unit))}</span>` : ''}</div>` +
    (verdict ? `<p class="ro-verdict">${SIC[s] || ''}<span>${esc(T(verdict))}</span></p>` : '') +
    (rows.length ? `<dl class="ro-rows">${rows.map(x => `<div class="ro-row"${x[2] ? ` data-s="${x[2]}"` : ''}><dt>${esc(T(x[0]))}</dt><dd>${esc(T(x[1]))}</dd></div>`).join('')}</dl>` : '') +
    '</section>';
}
function actsHTML(r) {
  if (r.state !== 'ok') return '';
  const b = (r.acts || []).map(a => `<button type="button" class="btn" data-act="send" data-to="${a.to}" data-set="${esc(JSON.stringify(a.set))}">${IC[TOOLS[a.to].icon]}<span>${esc(T(a.label))}</span></button>`);
  b.push(`<button type="button" class="btn btn-quiet" data-act="share-tool">${IC.share}<span>${esc(T('Share result'))}</span></button>`);
  return `<div class="res-acts">${b.join('')}</div>`;
}
function updateResults() {
  const c = toolCtx(); if (!c) return;
  const ro = $('#res-ro'), fig = $('#res-fig'), tail = $('#res-tail');
  if (!ro) return;
  const r = runCalc(c.id);
  const ok = r.state === 'ok';
  ro.innerHTML = readoutHTML(r, c.t) + (ok && r.more ? r.more.map(m => readoutHTML(m, c.t, true)).join('') : '');
  if (ok && r.fig) {
    if (r.figKey && fig.getAttribute('data-key') === r.figKey && r.figPatch) r.figPatch(fig);
    else { fig.innerHTML = r.fig; fig.setAttribute('data-key', r.figKey || ''); }
    fig.className = 'fig' + (r.figCls ? ' ' + r.figCls : '');
    fig.hidden = false;
  } else { fig.hidden = true; fig.innerHTML = ''; fig.setAttribute('data-key', ''); }
  const notes = ok && r.notes ? r.notes : [];
  const tips = c.t.tips || [];
  tail.innerHTML = (notes.length ? `<ul class="notes">${notes.map(n => `<li>${esc(T(n))}</li>`).join('')}</ul>` : '') +
    actsHTML(r) +
    (tips.length ? `<div class="tips"><h3>${esc(T('Good to know'))}</h3><ul>${tips.map(n => `<li>${esc(T(lab(n)))}</li>`).join('')}</ul></div>` : '');
  updateRbar(r, c.t);
  if (ok) announce(`${T(r.main.label)}: ${T(r.main.value)} ${T(r.main.unit) || ''}. ${T(r.verdict) || ''}`);
}
function updateRbar(r, t) {
  const bar = $('#rbar'); if (!bar || !bar.firstChild) return;
  const ok = r.state === 'ok';
  bar.setAttribute('data-s', ok ? (r.status || 'info') : r.state);
  const m = ok ? r.main : { label: t.mainLabel, value: '\u2014', unit: '' };
  $('.rb-l', bar).textContent = T(m.label);
  $('.rb-v', bar).textContent = withUnit(T(m.value), T(m.unit));
  $('.rb-s', bar).textContent = T(ok ? (r.short != null ? r.short : SHORT[r.status || 'info']) : (r.state === 'error' ? 'Check inputs' : 'Enter values'));
}
function toolShareText(id) {
  const t = TOOLS[id], r = runCalc(id);
  if (r.state !== 'ok') { toast('Enter the values first.'); return ''; }
  const L = [`${T(t.title)} (HookCalc)`];
  const block = x => {
    L.push(`${T(x.main.label)}: ${withUnit(T(x.main.value), T(x.main.unit))}`);
    if (x.verdict) L.push(`${EMOJI[x.status || 'info']} ${T(x.verdict)}`);
    (x.rows || []).filter(Boolean).forEach(row => L.push(`\u2022 ${T(row[0])}: ${T(row[1])}`));
  };
  block(r);
  (r.more || []).forEach(m => { L.push(''); block(m); });
  L.push('', T(SHARE_FOOT));
  return L.join('\n').replace(/\u00a0/g, ' ');
}
let roObs = null;
function watchReadout() {
  if (roObs) { roObs.disconnect(); roObs = null; }
  const bar = $('#rbar'), tgt = $('#res-ro');
  if (!bar || !tgt) return;
  bar.classList.remove('rbar-off');
  if (!('IntersectionObserver' in window)) return;
  roObs = new IntersectionObserver(ents => { ents.forEach(en => bar.classList.toggle('rbar-off', en.isIntersecting)); }, { threshold: 0.2 });
  roObs.observe(tgt);
}
function scrollToRes() { const r = $('#res'); if (r) r.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); }

/* ---------- views ---------- */
function unitsToggle(variant) {
  return `<div class="useg${variant ? ' useg-' + variant : ''}" role="group" aria-label="${esc(T('Units'))}">${[['metric', 't, m', 'Metric units'], ['imperial', 'lb, ft', 'Imperial units']].map(o => `<button type="button" data-units="${o[0]}" aria-pressed="${S.units === o[0]}" aria-label="${esc(T(o[2]))}">${o[1]}</button>`).join('')}</div>`;
}
function gseg(k, opts, label) {
  return `<div class="seg" role="group" aria-label="${esc(T(label))}">${opts.map(o => `<button type="button" data-gseg="${k}" data-v="${o[0]}" aria-pressed="${S[k] === o[0]}"${k === 'lang' ? ` lang="${o[0]}"` : ''}>${esc(T(o[1]))}</button>`).join('')}</div>`;
}
function syncGlobal() {
  $$('[data-gseg]').forEach(b => b.setAttribute('aria-pressed', String(S[b.getAttribute('data-gseg')] === b.getAttribute('data-v'))));
  $$('[data-units]').forEach(b => b.setAttribute('aria-pressed', String(S.units === b.getAttribute('data-units'))));
}
function setUnits(u) {
  if (u !== 'metric' && u !== 'imperial') return;
  if (u !== S.units) {
    S.units = u; save(); render(true);
    toast(u === 'metric' ? 'Metric units: t, m, mm' : 'Imperial units: lb, ft, in');
  }
  syncGlobal();
}
function setGlobal(k, v) {
  if (k === 'units') { setUnits(v); return; }
  if (k === 'theme' && ['auto', 'light', 'dark'].indexOf(v) >= 0) { S.theme = v; applyTheme(); save(); syncGlobal(); return; }
  if (k === 'windUnit' && WIND_UNITS[v]) { S.windUnit = v; save(); render(true); return; }
  if (k === 'lang' && LANG_SHORT[v]) {
    S.lang = v; save(); applyLang(); buildChrome(); render(true); syncGlobal();
    if (modalKind === 'onboard') showOnboarding(); else if (modalKind === 'lang') closeModal();
  }
}
function renderTool(v) {
  const c = toolCtx();
  v.innerHTML = `<div class="page tool"><div class="tool-intro"><p class="lede">${esc(T(c.t.lede))}</p>` +
    `<div class="tool-acts"><button type="button" class="btn btn-sm" data-act="example">${IC.spark}<span>${esc(T('Fill example'))}</span></button><button type="button" class="btn btn-sm btn-quiet" data-act="clear">${IC.reset}<span>${esc(T('Clear'))}</span></button>${c.t.noUnits ? '' : unitsToggle('sm')}</div></div>` +
    `<div class="tool-grid"><div class="inputs" id="inputs">${renderFields(c.t, c.st)}</div>` +
    `<section class="results" id="res" aria-label="${esc(T('Results'))}"><div id="res-ro"></div><figure class="fig" id="res-fig" hidden></figure><div id="res-tail"></div></section></div></div>`;
  updateResults();
  watchReadout();
}
function buildChrome() {
  const tabs = [['home', '#/', 'Tools', 'tools'], ['plan', '#/plan', 'Lift plan', 'plan'], ['guide', '#/guide', 'Guide', 'guide'], ['settings', '#/settings', 'Settings', 'gear']];
  $('#tabs').innerHTML = tabs.map(x => `<a href="${x[1]}" data-nav="${x[0]}">${IC[x[3]]}<span>${esc(T(x[2]))}</span></a>`).join('');
  $('#tabs').setAttribute('aria-label', T('Main'));
  const sk = $('.skip'); if (sk) sk.textContent = T('Skip to content');
  $('#side').innerHTML = `<a class="side-brand" href="#/">${HOOK}<span>HookCalc</span></a>` +
    `<nav class="side-nav" aria-label="${esc(T('Main'))}"><a href="#/" data-nav="home">${IC.tools}<span>${esc(T('All tools'))}</span></a>` +
    `<p class="side-h">${esc(T('Calculators'))}</p>${TOOL_ORDER.map(id => `<a href="#/t/${id}" data-nav="tool-${id}">${IC[TOOLS[id].icon]}<span>${esc(T(TOOLS[id].title))}</span></a>`).join('')}` +
    `<p class="side-h">${esc(T('Job'))}</p><a href="#/plan" data-nav="plan">${IC.plan}<span>${esc(T('Lift plan'))}</span></a><a href="#/guide" data-nav="guide">${IC.guide}<span>${esc(T('Field guide'))}</span></a><a href="#/settings" data-nav="settings">${IC.gear}<span>${esc(T('Settings'))}</span></a></nav>`;
  $('#rbar').innerHTML = '<button type="button" class="rbar-in" data-act="to-res" aria-label="' + esc(T('Show results')) + '"><span class="rb-dot" aria-hidden="true"></span><span class="rb-txt"><span class="rb-l"></span><span class="rb-v"></span></span><span class="rb-s"></span></button>';
}
function renderNav() {
  const key = VIEW.name === 'tool' ? 'tool-' + VIEW.id : VIEW.name;
  $$('#side [data-nav]').forEach(a => { if (a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const tkey = VIEW.name === 'tool' ? 'home' : VIEW.name;
  $$('#tabs [data-nav]').forEach(a => { if (a.getAttribute('data-nav') === tkey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
function renderBar() {
  const b = $('#bar');
  const back = `<a class="bar-back" href="#/" aria-label="${esc(T('Back to all tools'))}">${IC.back}</a>`;
  if (VIEW.name === 'home') b.innerHTML = `<a class="brand" href="#/">${HOOK}<span>HookCalc</span></a><span class="bar-sp"></span><button type="button" class="lang-btn" data-act="lang" aria-label="${esc(T('Language'))}">${LANG_SHORT[S.lang] || 'EN'}</button>${unitsToggle('bar')}`;
  else if (VIEW.name === 'tool') { const t = TOOLS[VIEW.id]; b.innerHTML = `${back}<span class="bar-ic">${IC[t.icon]}</span><h1 class="bar-t">${esc(T(t.title))}</h1>`; }
  else b.innerHTML = `${back}<h1 class="bar-t">${esc(T(PAGE_TITLES[VIEW.name] || ''))}</h1>`;
}

/* ---------- router ---------- */
let VIEW = { name: 'home' };
function parseRoute() {
  const h = location.hash || '';
  if (h.indexOf('#/') !== 0) return { name: 'home' };
  const p = h.slice(2).split('/').filter(Boolean);
  if (p[0] === 't' && TOOLS[p[1]]) return { name: 'tool', id: p[1] };
  if (p[0] === 'plan') return { name: 'plan' };
  if (p[0] === 'guide') return { name: 'guide', sec: p[1] || null };
  if (p[0] === 'settings') return { name: 'settings' };
  return { name: 'home' };
}
function go(path) { const h = '#' + path; if (location.hash === h) render(false); else location.hash = h; }
function render(keepScroll) {
  VIEW = parseRoute();
  document.body.setAttribute('data-view', VIEW.name);
  if (roObs) { roObs.disconnect(); roObs = null; }
  renderBar();
  renderNav();
  const v = $('#view');
  if (VIEW.name === 'tool') renderTool(v);
  else if (VIEW.name === 'plan') renderPlan(v);
  else if (VIEW.name === 'guide') renderGuide(v);
  else if (VIEW.name === 'settings') renderSettings(v);
  else renderHome(v);
  $('#rbar').hidden = VIEW.name !== 'tool';
  document.title = (VIEW.name === 'tool' ? T(TOOLS[VIEW.id].title) + ' \u2013 ' : (PAGE_TITLES[VIEW.name] ? T(PAGE_TITLES[VIEW.name]) + ' \u2013 ' : '')) + 'HookCalc';
  if (!keepScroll) window.scrollTo(0, 0);
  if (VIEW.name === 'guide' && VIEW.sec && !keepScroll) openGuideSec(VIEW.sec);
}

/* ---------- events ---------- */
function onClick(e) {
  const el = e.target.closest('button, a, .mback');
  if (!el) return;
  if (el.classList.contains('mback')) { if (e.target === el && el.getAttribute('data-dismiss') === '1') closeModal(); return; }
  if (el.hasAttribute('data-mact')) { modalAct(+el.getAttribute('data-mact')); return; }
  if (el.hasAttribute('data-units')) { setUnits(el.getAttribute('data-units')); return; }
  if (el.hasAttribute('data-gseg')) { setGlobal(el.getAttribute('data-gseg'), el.getAttribute('data-v')); return; }
  if (el.hasAttribute('data-seg')) { onSeg(el); return; }
  const act = el.getAttribute('data-act');
  if (!act) return;
  switch (act) {
    case 'skip': { e.preventDefault(); const v = $('#view'); if (v) v.focus(); break; }
    case 'example': fillExample(); break;
    case 'clear': clearTool(); break;
    case 'send': sendTo(el); break;
    case 'share-tool': if (VIEW.name === 'tool') shareText(TOOLS[VIEW.id].title, toolShareText(VIEW.id)); break;
    case 'to-res': scrollToRes(); break;
    case 'sign': toggleSign(el); break;
    default: if (ACTS[act]) ACTS[act](el, e);
  }
}
function onInput(e) {
  const el = e.target;
  if (el.matches('input[data-k]')) onNumInput(el);
  else if (el.matches('input[data-item]')) onItemInput(el);
  else if (el.matches('[data-plan]')) { S.plan[el.getAttribute('data-plan')] = el.value; save(); }
  else if (el.matches('input[data-qc]')) onQuickInput(el);
  else if (el.matches('input[data-crit]')) { S.crit = clamp(+el.value, 50, 90); const o = $('#crit-val'); if (o) o.textContent = S.crit + '%'; save(); }
}
function onChange(e) {
  const el = e.target;
  if (el.matches('select[data-sel]')) onSelect(el);
  else if (el.matches('input[data-chk]')) { S.plan.chk[el.getAttribute('data-chk')] = el.checked; save(); refreshPlanStatus(); }
  else if (el.matches('input[data-inc]')) {
    S.inc[el.getAttribute('data-inc')] = el.checked; save();
    const card = el.closest('.pcard'); if (card) card.classList.toggle('off', !el.checked);
    refreshPlanStatus();
  } else if (el.matches('input[data-opt]')) {
    const c = toolCtx(); if (!c) return;
    c.st[el.getAttribute('data-opt')] = el.checked; touched(c.id);
    rerenderInputs(`input[data-opt="${el.getAttribute('data-opt')}"]`); updateResults();
  }
}
function focusNext(el) {
  const scope = el.closest('#inputs, .qc') || document;
  const list = $$('input[type="text"]', scope).filter(x => x.offsetParent !== null && !x.disabled);
  const i = list.indexOf(el);
  if (i >= 0 && i < list.length - 1) { list[i + 1].focus(); try { list[i + 1].select(); } catch (er) { /* ignore */ } }
  else { el.blur(); if (VIEW.name === 'tool' && !isWide()) scrollToRes(); }
}
function onKey(e) {
  const root = $('#modal-root');
  if (root && root.firstChild) {
    if (e.key === 'Escape') { const b = $('.mback', root); if (b && b.getAttribute('data-dismiss') === '1') { e.preventDefault(); closeModal(); } return; }
    if (e.key === 'Tab') {
      const f = $$('button, [href], input, select, textarea', $('.modal', root)).filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  if (e.key === 'Enter' && e.target.matches('input[type="text"][data-k], input[data-item], input[data-qc]')) { e.preventDefault(); focusNext(e.target); }
}
