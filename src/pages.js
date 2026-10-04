/* ===================== pages ===================== */

/* ---------- home ---------- */
function qcField(k, label) {
  const st = S.tools.cap, u = unitOf('mass');
  return `<div class="fld qf"><label for="qc-${k}">${esc(T(label))}<span class="vh"> (${esc(u)})</span></label><div class="inp inp-dark"><input id="qc-${k}" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" spellcheck="false" data-qc="${k}" placeholder="${esc(T('e.g.'))} ${exNum('mass', k === 'load' ? 8000 : 14200)}" value="${esc(dispVal('mass', st[k]))}"><span class="u" aria-hidden="true">${esc(u)}</span></div><p class="errmsg" hidden></p></div>`;
}
function toolRow(id) {
  const t = TOOLS[id];
  let chip = '';
  if (!t.noPlan && !S.ex[id]) {
    const r = runCalc(id);
    if (r.state === 'ok') chip = `<span class="chip" data-s="${r.status || 'info'}">${esc(withUnit(T(r.main.value), T(r.main.unit)))}</span>`;
  }
  return `<a class="trow" data-id="${id}" href="#/t/${id}"><span class="ticon">${IC[t.icon]}</span><span class="tbody"><span class="tname">${esc(T(t.title))}</span><span class="tdesc">${esc(T(t.short))}</span></span>${chip}</a>`;
}
function renderHome(v) {
  v.innerHTML = '<section class="hero"><div class="hero-in">' +
    `<div class="hero-copy"><h1>${esc(T('Check the lift before you lift.'))}</h1><p>${esc(T('Crane capacity, sling loads, ground pressure and wind, with a lift plan you can share. Works without signal once it is open.'))}</p>` +
    `<a class="btn btn-primary btn-lg" href="#/plan">${IC.plan}<span>${esc(T('Make a lift plan'))}</span></a></div>` +
    `<div class="qc" role="group" aria-labelledby="qc-h"><div class="qc-top"><h2 id="qc-h">${esc(T('Quick capacity check'))}</h2><a class="qc-link" href="#/t/cap">${esc(T('Full check'))}</a></div>` +
    `<div class="qc-in">${qcField('load', 'Load weight')}${qcField('cap', 'Chart capacity')}</div><div class="qc-out" id="qc-out"></div></div>` +
    '</div></section>' +
    `<div class="page home"><section class="hsec"><h2 class="hsec-h">${esc(T('Calculators'))}</h2><div class="tlist">${TOOL_ORDER.map(toolRow).join('')}</div></section>` +
    `<section class="hsec"><h2 class="hsec-h">${esc(T('Field guide'))}</h2><div class="glinks">${GUIDE.map(g => `<a class="glink" href="#/guide/${g.id}">${esc(T(g.short))}</a>`).join('')}</div></section>` +
    `<p class="foot">${esc(T(DISCLAIMER))}</p></div>`;
  updateQC(true);
}
function updateQC(first) {
  const box = $('#qc-out'); if (!box) return;
  const st = S.tools.cap, r = runCalc('cap'), ok = r.state === 'ok';
  const s = ok ? r.status : r.state;
  const p = ok ? r.pct : 0;
  const ded = (st.rig || 0) + (st.block || 0) + (st.other || 0);
  if (first || !$('.qc-g', box)) {
    box.innerHTML = `<div class="qc-g">${gaugeSVG(p)}</div><div class="qc-num"><span class="ro-num" id="qc-num"></span><span class="ro-unit">%</span></div><p class="ro-verdict" id="qc-v"></p><p class="qc-note" id="qc-note"></p>`;
  } else patchGauge(box, p);
  box.setAttribute('data-s', s);
  $('#qc-num').textContent = ok ? r.main.value : '\u2014';
  $('#qc-v').innerHTML = `${SIC[s] || ''}<span>${esc(T(ok ? r.verdict : 'Enter both weights to see the capacity used.'))}</span>`;
  $('#qc-note').textContent = ok ? (ded > 0 ? TF('Includes {0} for hook block, rigging and other deductions.', fmtQ('mass', ded)) : T('Hook block and rigging are not added yet. Add them in the full check.')) : '';
}
function onQuickInput(el) {
  const k = el.getAttribute('data-qc');
  const r = readNum(el.value, 'mass', false);
  S.tools.cap[k] = r.v;
  setErr(el, r.err);
  touched('cap');
  updateQC(false);
  const row = $('.trow[data-id="cap"]');
  if (row) row.outerHTML = toolRow('cap');
}

/* ---------- lift plan ---------- */
const CHECKS = [
  { g: 'Crane set-up', items: [['c1', 'Daily crane checks done; LMI or safe load indicator working'], ['c2', 'Load chart matches the set-up: counterweight, outriggers, boom'], ['c3', 'Outriggers fully set on mats; crane level'], ['c4', 'Ground checked: no trenches, pipes or soft spots under the mats'], ['c5', 'Power lines and obstructions checked'], ['c6', 'Wind and weather within limits']] },
  { g: 'Load and rigging', items: [['r1', 'Load weight confirmed'], ['r2', 'Slings, shackles and hooks inspected; tags readable'], ['r3', 'Sling angles and WLL checked'], ['r4', 'Hook latch closed; load secure and balanced'], ['r5', 'Tag lines fitted where needed']] },
  { g: 'Site and people', items: [['s1', 'Lift area barricaded; nobody under the load'], ['s2', 'One signaller appointed; signals or radio agreed'], ['s3', 'Toolbox talk done with the crew'], ['s4', 'Set-down area ready and clear'], ['s5', 'Permits in place where needed']] }
];
const CHECK_COUNT = CHECKS.reduce((n, g) => n + g.items.length, 0);
const PLAN_CAT = { info: 'Not rated yet', ok: 'Normal lift', warn: 'Critical lift', bad: 'Engineered lift', stop: 'Do not lift' };
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  try { return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return iso; }
}
function planItems() { return TOOL_ORDER.filter(id => !TOOLS[id].noPlan).map(id => ({ id, r: runCalc(id) })).filter(x => x.r.state === 'ok'); }
function planStatus() {
  const inc = planItems().filter(x => !S.ex[x.id] && S.inc[x.id] !== false);
  const s = worst.apply(null, inc.map(x => x.r.status || 'info'));
  const done = CHECKS.reduce((n, g) => n + g.items.filter(i => S.plan.chk[i[0]]).length, 0);
  return { s, inc, done };
}
function planReadout() {
  const ps = planStatus();
  const verdict = {
    info: ps.inc.length ? 'Add a capacity, sling or ground check to rate this lift.' : 'Use the calculators. Their results appear here.',
    ok: 'All checks are within limits.',
    warn: 'Needs a written lift plan, sign-off and a crew briefing.',
    bad: 'Needs an engineered lift plan and senior approval.',
    stop: 'One or more checks failed. Fix them before lifting.'
  }[ps.s];
  return readoutHTML({ state: 'ok', status: ps.s, main: { label: 'Lift category', value: PLAN_CAT[ps.s], unit: '', text: true }, verdict, rows: [['Calculations in the plan', String(ps.inc.length)], ['Checklist', TF('{0} of {1} done', ps.done, CHECK_COUNT), ps.done === CHECK_COUNT ? 'ok' : '']] });
}
function refreshPlanStatus() {
  const ro = $('#plan-ro'); if (ro) ro.innerHTML = planReadout();
  const n = $('#chk-n'); if (n) { const ps = planStatus(); n.textContent = TF('{0} of {1} checked', ps.done, CHECK_COUNT); }
}
function pf(k, label, ph, type) {
  return `<div class="fld"><label for="p-${k}">${esc(T(label))}</label><div class="inp inp-text"><input id="p-${k}" type="${type || 'text'}" data-plan="${k}" value="${esc(S.plan[k])}" placeholder="${esc(T(ph || ''))}" autocomplete="off"${type === 'date' ? '' : ' maxlength="120"'}></div></div>`;
}
function planCard(x) {
  const t = TOOLS[x.id], r = x.r, ex = !!S.ex[x.id], inc = S.inc[x.id] !== false;
  const s = r.status || 'info';
  return `<article class="pcard${ex || !inc ? ' off' : ''}" data-s="${s}"><header><span class="pc-ic">${IC[t.icon]}</span><h3>${esc(T(t.title))}</h3><span class="chip" data-s="${s}">${esc(withUnit(T(r.main.value), T(r.main.unit)))}</span></header>` +
    (r.verdict ? `<p class="pc-v">${SIC[s] || ''}<span>${esc(T(r.verdict))}</span></p>` : '') +
    `<ul>${(r.lines || []).map(l => `<li>${esc(T(l))}</li>`).join('')}</ul>` +
    `<footer>${ex ? `<span class="pc-ex">${esc(T('Example values. Change a value in the calculator to use it here.'))}</span>` : `<label class="chk"><input type="checkbox" data-inc="${x.id}"${inc ? ' checked' : ''}><span>${esc(T('Include in the plan'))}</span></label>`}<a class="pc-edit" href="#/t/${x.id}">${esc(T('Edit'))}</a></footer></article>`;
}
function renderPlan(v) {
  if (!S.plan.date) { S.plan.date = todayISO(); save(); }
  const items = planItems();
  v.innerHTML = `<div class="page plan"><h1 class="print-only ptitle">${esc(T('Lift plan'))}</h1>` +
    `<div class="plan-top" id="plan-ro">${planReadout()}</div>` +
    `<section class="psec"><h2>${esc(T('Job details'))}</h2><div class="pgrid">${pf('job', 'Job or lift', 'e.g. Pump skid to roof')}${pf('customer', 'Customer')}${pf('site', 'Site')}${pf('date', 'Date', '', 'date')}${pf('crane', 'Crane and set-up', 'e.g. 60 t mobile, full outriggers')}${pf('operator', 'Crane operator')}${pf('rigger', 'Rigger or signaller')}</div></section>` +
    `<section class="psec"><h2>${esc(T('Calculations'))}</h2>${items.length ? `<div class="pcards">${items.map(planCard).join('')}</div>` : `<div class="pempty"><p>${esc(T('No calculations yet. Results from the calculators show up here.'))}</p><a class="btn btn-primary" href="#/t/cap">${IC.cap}<span>${esc(T('Start with crane capacity'))}</span></a></div>`}</section>` +
    `<section class="psec"><h2>${esc(T('Pre-lift checklist'))}</h2><p class="hint" id="chk-n"></p>${CHECKS.map(g => `<fieldset class="chkg"><legend>${esc(T(g.g))}</legend>${g.items.map(i => `<label class="chk chk-lg"><input type="checkbox" data-chk="${i[0]}"${S.plan.chk[i[0]] ? ' checked' : ''}><span>${esc(T(i[1]))}</span></label>`).join('')}</fieldset>`).join('')}</section>` +
    `<section class="psec"><h2><label for="p-notes">${esc(T('Notes'))}</label></h2><textarea id="p-notes" data-plan="notes" rows="4" placeholder="${esc(T('Lift sequence, exclusion zone, special instructions'))}">${esc(S.plan.notes)}</textarea></section>` +
    `<section class="psec pacts no-print"><h2>${esc(T('Share or save'))}</h2><div class="pbtns">` +
    `<button type="button" class="btn btn-primary" data-act="plan-share">${IC.share}<span>${esc(T('Share lift plan'))}</span></button>` +
    `<a class="btn btn-wa" data-act="plan-wa" href="https://wa.me/" target="_blank" rel="noopener">${IC.chat}<span>${esc(T('Send on WhatsApp'))}</span></a>` +
    `<button type="button" class="btn" data-act="plan-copy">${IC.copy}<span>${esc(T('Copy as text'))}</span></button>` +
    `<button type="button" class="btn" data-act="plan-print">${IC.print}<span>${esc(T('Print or save as PDF'))}</span></button></div>` +
    `<button type="button" class="btn btn-quiet btn-danger-t pnew" data-act="plan-new">${IC.reset}<span>${esc(T('Start a new lift'))}</span></button></section>` +
    `<section class="print-only psign"><div>${esc(T('Prepared by'))}</div><div>${esc(T('Approved by'))}</div><div>${esc(T('Crane operator'))}</div></section>` +
    `<p class="foot">${esc(T(DISCLAIMER))}</p></div>`;
  refreshPlanStatus();
}
function planText() {
  const p = S.plan, ps = planStatus();
  const L = ['\ud83c\udfd7\ufe0f ' + T('Lift plan')];
  [['Job', p.job], ['Customer', p.customer], ['Site', p.site], ['Date', fmtDate(p.date)], ['Crane', p.crane], ['Operator', p.operator], ['Rigger or signaller', p.rigger]]
    .forEach(kv => { if (kv[1] && String(kv[1]).trim()) L.push(`${T(kv[0])}: ${String(kv[1]).trim()}`); });
  L.push('', `${EMOJI[ps.s]} ${T('Lift category')}: ${T(PLAN_CAT[ps.s])}`);
  ps.inc.forEach(x => {
    const r = x.r;
    L.push('', `${EMOJI[r.status || 'info']} ${T(TOOLS[x.id].title)}: ${withUnit(T(r.main.value), T(r.main.unit))}`);
    if (r.verdict) L.push(T(r.verdict));
    (r.lines || []).forEach(l => L.push('\u2022 ' + T(l)));
  });
  L.push('', TF('Checklist: {0} of {1} done', ps.done, CHECK_COUNT));
  CHECKS.forEach(g => g.items.forEach(i => L.push(`${S.plan.chk[i[0]] ? '\u2611' : '\u2610'} ${T(i[1])}`)));
  if (p.notes && p.notes.trim()) L.push('', T('Notes') + ':', p.notes.trim());
  L.push('', T(SHARE_FOOT));
  return L.join('\n').replace(/\u00a0/g, ' ');
}
ACTS['plan-share'] = () => shareText(T('Lift plan'), planText());
ACTS['plan-wa'] = el => { el.setAttribute('href', 'https://wa.me/?text=' + encodeURIComponent(planText())); };
ACTS['plan-copy'] = () => copyText(planText());
ACTS['plan-print'] = () => {
  try { window.print(); } catch (e) { toast('Printing is not available here. Use Share or Copy instead.'); }
};
ACTS['plan-new'] = () => confirmBox('Start a new lift?', 'This clears every calculator, the job details, notes and the checklist. Crane and crew names are kept. Settings stay as they are.', 'Clear and start new', () => {
  const keep = { crane: S.plan.crane, operator: S.plan.operator, rigger: S.plan.rigger };
  TOOL_ORDER.forEach(id => { S.tools[id] = freshTool(id); });
  S.ex = {}; S.inc = {};
  S.plan = Object.assign(freshPlan(), keep);
  save(); render(false); toast('New lift started');
}, true);

/* ---------- field guide ---------- */
function tblHTML(head, rows, num, wrap) {
  const cls = i => {
    const c = [];
    if (num && num.indexOf(i) >= 0) c.push('num');
    if (wrap && wrap.indexOf(i) >= 0) c.push('wrap');
    return c.length ? ` class="${c.join(' ')}"` : '';
  };
  return `<div class="tblw"><table class="tbl"><thead><tr>${head.map((h, i) => `<th${cls(i)}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr${r.s ? ` data-s="${r.s}"` : ''}>${r.c.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const SIGNALS = [
  ['Hoist', 'Forearm vertical, forefinger pointing up. Move the hand in small horizontal circles.'],
  ['Lower', 'Arm extended down, forefinger pointing down. Move the hand in small horizontal circles.'],
  ['Use main hoist', 'Tap your fist on your head, then use the regular signals.'],
  ['Use whipline (auxiliary hoist)', 'Tap your elbow with one hand, then use the regular signals.'],
  ['Raise boom', 'Arm extended, fingers closed, thumb pointing up.'],
  ['Lower boom', 'Arm extended, fingers closed, thumb pointing down.'],
  ['Move slowly', 'Give the motion signal with one hand. Hold the other hand still in front of it.'],
  ['Raise boom and lower load', 'Arm extended, thumb pointing up. Open and close the fingers for as long as the load should move.'],
  ['Lower boom and raise load', 'Arm extended, thumb pointing down. Open and close the fingers for as long as the load should move.'],
  ['Swing', 'Arm extended. Point with a finger in the direction the boom should swing.'],
  ['Stop', 'Arm extended, palm down. Move the arm back and forth horizontally.'],
  ['Emergency stop', 'Both arms extended, palms down. Move both arms back and forth horizontally.'],
  ['Dog everything', 'Clasp your hands in front of your body.'],
  ['Travel', 'Arm extended forward, hand open and slightly raised. Make a pushing motion in the direction of travel.'],
  ['Travel, both tracks (crawler)', 'Both fists in front of the body, circling each other. Forward or backward shows the direction.'],
  ['Travel, one track (crawler)', 'Raise one fist to lock that track. Circle the other fist vertically in front of the body to travel the other track.'],
  ['Extend boom (telescopic)', 'Both fists in front of the body, thumbs pointing outward.'],
  ['Retract boom (telescopic)', 'Both fists in front of the body, thumbs pointing toward each other.'],
  ['Extend boom, one hand', 'One fist in front of the chest, thumb tapping the chest.'],
  ['Retract boom, one hand', 'One fist in front of the chest, thumb pointing outward, heel of the fist tapping the chest.']
];
const COLOURS = [['Violet', '#7B3FA0', 1], ['Green', '#2E8B3A', 2], ['Yellow', '#F2C200', 3], ['Grey', '#8C8C8C', 4], ['Red', '#D22B2B', 5], ['Brown', '#7A4B2A', 6], ['Blue', '#1F5FBF', 8], ['Orange', '#F07A1A', 10]];
const CHAIN = [[6, 1.12, 1.6, 1.12, 2.36, 1.7], [7, 1.5, 2.1, 1.5, 3.15, 2.25], [8, 2, 2.8, 2, 4.25, 3], [10, 3.15, 4.25, 3.15, 6.7, 4.75], [13, 5.3, 7.5, 5.3, 11.2, 8], [16, 8, 11.2, 8, 17, 11.8], [18, 10, 14, 10, 21.2, 15], [20, 12.5, 17, 12.5, 26.5, 18], [22, 15, 21.2, 15, 31.5, 22.4], [26, 21.2, 30, 21.2, 45, 31.5], [32, 31.5, 45, 31.5, 67, 47.5]];
const SHACKLES = [['3/8"', 1], ['1/2"', 2], ['5/8"', 3.25], ['3/4"', 4.75], ['7/8"', 6.5], ['1"', 8.5], ['1-1/8"', 9.5], ['1-1/4"', 12], ['1-3/8"', 13.5], ['1-1/2"', 17], ['1-3/4"', 25], ['2"', 35], ['2-1/2"', 55], ['3"', 85]];
const BEAU = [
  [0, 'Calm', '0\u20130.4', '0\u20131', 'Smoke rises straight up', 'Normal work'],
  [1, 'Light air', '0.5\u20131.5', '2\u20135', 'Smoke drifts', 'Normal work'],
  [2, 'Light breeze', '1.6\u20133.3', '6\u201311', 'Wind felt on the face; leaves rustle', 'Normal work'],
  [3, 'Gentle breeze', '3.4\u20135.4', '12\u201319', 'Leaves and twigs keep moving; flags fly', 'Watch big panels'],
  [4, 'Moderate breeze', '5.5\u20137.9', '20\u201328', 'Dust and loose paper lift; small branches move', 'Check large-area loads'],
  [5, 'Fresh breeze', '8.0\u201310.7', '29\u201338', 'Small trees sway', 'Check the chart limit; big loads may stop'],
  [6, 'Strong breeze', '10.8\u201313.8', '39\u201349', 'Large branches move; wires whistle', 'Most lifts stop unless the chart allows'],
  [7, 'Near gale', '13.9\u201317.1', '50\u201361', 'Whole trees move; hard to walk', 'Stop lifting; secure the crane'],
  [8, 'Gale', '17.2\u201320.7', '62\u201374', 'Twigs break off trees', 'Stop lifting; secure the crane']
];
const POWER = [['Up to 50 kV', 10, 3.05], ['Over 50 to 200 kV', 15, 4.6], ['Over 200 to 350 kV', 20, 6.1], ['Over 350 to 500 kV', 25, 7.62], ['Over 500 to 750 kV', 35, 10.67], ['Over 750 to 1,000 kV', 45, 13.72]];
const t2 = v => fmtN(v, Number.isInteger(Math.round(v * 1000) / 100) ? 1 : 2);
const gP = t => `<p>${esc(T(t))}</p>`;
const gHint = t => `<p class="hint">${esc(T(t))}</p>`;
const gList = arr => `<ul class="glist">${arr.map(t => `<li>${esc(T(t))}</li>`).join('')}</ul>`;
const GUIDE = [
  { id: 'signals', short: 'Hand signals', title: 'Crane hand signals', body: () => gP('Standard hand signals for mobile cranes (ASME B30.5). Agree the signals with the operator before the lift. Only the appointed signaller gives signals, but anyone can give the emergency stop.') + `<dl class="sig">${SIGNALS.map(x => `<div><dt>${esc(T(x[0]))}</dt><dd>${esc(T(x[1]))}</dd></div>`).join('')}</dl>` },
  {
    id: 'angles', short: 'Sling angles', title: 'Sling angle factors', body: () => {
      const base = S.units === 'imperial' ? 4535.9237 : 10000;
      const rows = [90, 75, 60, 50, 45, 40, 35, 30].map(a => { const f = 1 / Math.sin(rad(a)); return { s: a <= 30 ? 'stop' : a < 45 ? 'warn' : '', c: [a + '\u00b0', fmtN(f, 3), esc(fmtQ('mass', base / 2 * f, S.units === 'imperial' ? 0 : 2))] }; });
      return `<p>${esc(TF('The lower the sling angle, the higher the tension in each leg. Leg tension = load \u00f7 number of legs \u00d7 factor. The last column is for a 2-leg sling lifting {0}.', fmtQ('mass', base, 0)))}</p>` +
        tblHTML([T('Angle from horizontal'), T('Factor'), T('Each leg')], rows, [1, 2]) + gHint('Keep sling angles above 45\u00b0 where you can. Below 30\u00b0, do not lift.');
    }
  },
  { id: 'hitches', short: 'Hitches', title: 'Hitch types and capacity', body: () => tblHTML([T('Hitch'), T('Capacity')], [['Straight (vertical)', '1.0 \u00d7 WLL'], ['Choker, choke angle 120\u00b0 or more', '0.8 \u00d7 WLL'], ['Basket, legs vertical', '2.0 \u00d7 WLL'], ['Basket, legs at 60\u00b0', '1.73 \u00d7 WLL'], ['Basket, legs at 45\u00b0', '1.41 \u00d7 WLL'], ['Basket, legs at 30\u00b0', '1.0 \u00d7 WLL']].map(r => ({ c: [esc(T(r[0])), esc(r[1])] })), [1], [0]) + gHint('Angles are from horizontal. Bending wire rope around a small diameter lowers its capacity further. The sling tag and the maker\u2019s table come first.') },
  { id: 'colours', short: 'Sling colours', title: 'Sling colour code', body: () => gP('Colour code for flat webbing slings and roundslings to EN 1492. WLL for a straight lift.') + tblHTML([T('Colour'), T('WLL straight')], COLOURS.map(c => ({ c: [`<span class="sw" style="background:${c[1]}"></span>${esc(T(c[0]))}`, c[2] === 10 ? esc(T('10 t and over')) : c[2] + ' t'] }))) + gHint('Always read the label. Other standards, such as US WSTDA, use different colours. Never use a sling with a missing or unreadable label.') },
  { id: 'chain', short: 'Chain WLL', title: 'Grade 80 chain slings', body: () => gP('WLL in tonnes for grade 80 chain slings to EN 818-4. Angles here are measured from the vertical.') + tblHTML([T('Chain'), T('1 leg'), T('2 legs 0\u201345\u00b0'), T('2 legs 45\u201360\u00b0'), T('3\u20134 legs 0\u201345\u00b0'), T('3\u20134 legs 45\u201360\u00b0')], CHAIN.map(r => ({ c: [r[0] + ' mm'].concat(r.slice(1).map(t2)) })), [1, 2, 3, 4, 5]) + gHint('Over 60\u00b0 from vertical, do not use. Choke hitch: \u00d70.8. Grade 100 chain is stronger: use its own tag.') },
  { id: 'shackles', short: 'Shackles', title: 'Shackle WLL', body: () => gP('Typical WLL of grade S bow shackles with screw or bolt pins.') + tblHTML([T('Nominal size'), T('WLL')], SHACKLES.map(r => ({ c: [esc(r[0]), t2(r[1]) + ' t'] })), [1]) + gHint('Always use the WLL marked on the shackle. Side loading lowers the WLL.') },
  {
    id: 'chart', short: 'Load charts', title: 'Reading a load chart', body: () => `<ul class="glist">${[
      'Pick the chart for the exact set-up: counterweight, outrigger spread, on outriggers or on tyres, and working area (360\u00b0, over the side or over the rear).',
      'Radius is from the centre of rotation to the hook, with the load hanging. Measure it; do not guess.',
      'If the radius falls between two columns, use the larger radius. If the boom length falls between two rows, use the lower capacity.',
      'Deduct the hook block, slings, shackles and spreader, and any jib or extension the chart says to deduct.',
      'Capacities in bold or shaded parts of the chart are often limited by strength, not tipping. The crane can fail before it tips.',
      'Check the parts of line and the line pull for the load.'
    ].map(t => `<li>${esc(T(t))}</li>`).join('')}<li>${esc(TF('Lifts over {0}% of the chart are flagged as critical. Set your company limit in Settings.', S.crit))}</li><li>${esc(T('The LMI is a safety backup. Never use it to find the limit.'))}</li></ul>`
  },
  { id: 'wind', short: 'Wind scale', title: 'Wind scale and crane work', body: () => gP('Beaufort wind scale with typical guidance. The load chart and the crane manual limits come first. Use the wind check for big-area loads.') + tblHTML([T('Force'), 'm/s', 'km/h', T('What you see'), T('Crane work')], BEAU.map(b => ({ s: b[0] >= 7 ? 'stop' : b[0] >= 5 ? 'warn' : '', c: [`${b[0]} ${esc(T(b[1]))}`, b[2], b[3], esc(T(b[4])), esc(T(b[5]))] })), [1, 2], [3, 4]) },
  { id: 'power', short: 'Power lines', title: 'Power line distances', body: () => gP('Minimum distance from any part of the crane, load line or load to a power line, from US OSHA 1926.1408 (Table A).') + tblHTML([T('Voltage'), T('Distance')], POWER.map(r => ({ c: [esc(T(r[0])), `${r[1]} ft (${fmtN(r[2], 2)} m)`] })), [1]) + gHint('If the voltage is not known, keep at least 20 ft (6.1 m) for lines up to 350 kV and 50 ft (15.2 m) above that until the power company confirms. Your country\u2019s rules come first: in India, follow the CEA safety regulations and your site permit. Treat every line as live and use a spotter.') },
  {
    id: 'rules', short: 'Golden rules', title: 'Golden rules of lifting', body: () => gList([
      'Know the weight. Never guess.',
      'Use the right load chart for the set-up.',
      'Inspect slings, shackles and hooks before every lift.',
      'Never go over the WLL of any part of the rigging.',
      'Keep sling angles above 45\u00b0 where you can, and never below 30\u00b0.',
      'Set outriggers fully, on mats, on firm and level ground.',
      'Look for power lines and keep the safe distance.',
      'Keep everyone clear of the load and the swing area.',
      'Use tag lines to control the load.',
      'One signaller. Everyone knows the stop signal.',
      'Lift a little first. Stop, check the balance and the brakes, then carry on.',
      'Never leave a load hanging. Stop when wind, light or visibility is poor.',
      'If you are unsure, stop and ask.'
    ])
  }
];
function renderGuide(v) {
  v.innerHTML = `<div class="page guide"><p class="lede">${esc(T('Quick reference for the crew. The manufacturer\u2019s data and your site rules always come first.'))}</p>` +
    GUIDE.map(g => `<details class="gsec" id="g-${g.id}"${VIEW.sec === g.id ? ' open' : ''}><summary><span>${esc(T(g.title))}</span>${IC.chev}</summary><div class="gbody">${g.body()}</div></details>`).join('') +
    `<p class="foot">${esc(T(DISCLAIMER))}</p></div>`;
}
function openGuideSec(id) {
  const d = $('#g-' + id);
  if (d) { d.open = true; try { d.scrollIntoView({ block: 'start' }); } catch (e) { /* ignore */ } }
}

/* ---------- settings ---------- */
let installEvt = null;
function sset(title, inner) { return `<section class="sset"><h2>${esc(T(title))}</h2>${inner}</section>`; }
function renderSettings(v) {
  v.innerHTML = '<div class="page settings">' +
    sset('Language', `${gseg('lang', LANGS, 'Language')}<p class="hint">${esc(T('Changes the whole app, including the lift plan you share.'))}</p>`) +
    sset('Units', `${gseg('units', [['metric', 'Metric (t, m)'], ['imperial', 'Imperial (lb, ft)']], 'Units')}<p class="hint">${esc(T('You can also switch units on any calculator.'))}</p>`) +
    sset('Wind speed unit', gseg('windUnit', [['ms', 'm/s'], ['kmh', 'km/h'], ['mph', 'mph'], ['kn', 'knots']], 'Wind speed unit')) +
    sset('Theme', gseg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], 'Theme')) +
    `<section class="sset"><h2><label for="crit">${esc(T('Critical lift limit'))}</label></h2><p class="hint">${esc(T('Lifts above this share of the chart are flagged as critical. Use your company rule. The default is 75%.'))}</p><div class="range"><input id="crit" type="range" min="50" max="90" step="5" value="${S.crit}" data-crit><output id="crit-val" for="crit">${S.crit}%</output></div></section>` +
    (installEvt ? sset('Install', `<p class="hint">${esc(T('Put HookCalc on your home screen. It works without signal.'))}</p><button type="button" class="btn btn-primary" data-act="install">${IC.install}<span>${esc(T('Install app'))}</span></button>`) : '') +
    sset('Your data', `<p class="hint">${esc(T('Everything you enter stays on this device. Nothing you type is sent anywhere.'))}</p><button type="button" class="btn btn-danger-t" data-act="reset-all">${IC.trash}<span>${esc(T('Delete all data'))}</span></button>`) +
    sset('About', `<p>HookCalc ${esc(APP.version)}. ${esc(T(DISCLAIMER))}</p><p class="hint">${esc(T('References: ASME B30.5 hand signals, EN 818-4 chain slings, EN 1492 sling colours, DIN 1054 ground values, FEM 5.016 wind method, OSHA 1926.1408 power line distances.'))}</p>`) +
    '</div>';
}
ACTS.install = () => {
  if (!installEvt) return;
  const ev = installEvt;
  installEvt = null;
  try { ev.prompt(); if (ev.userChoice && ev.userChoice.then) ev.userChoice.then(() => { if (VIEW.name === 'settings') render(true); }); } catch (e) { /* ignore */ }
};
ACTS['reset-all'] = () => confirmBox('Delete all data?', 'This deletes every value, the lift plan and your settings from this device.', 'Delete everything', () => {
  try { localStorage.removeItem(APP.key); } catch (e) { /* ignore */ }
  const lang = S.lang;
  S = defaultState(); S.onboarded = true; S.lang = lang;
  applyTheme(); applyLang(); buildChrome(); flushSave(); render(false); toast('All data deleted');
}, true);
ACTS.lang = () => openModal({ kind: 'lang', title: 'Language', body: `<p class="lbl">Language \u00b7 \u092d\u093e\u0937\u093e \u00b7 \u0bae\u0bca\u0bb4\u0bbf</p>${gseg('lang', LANGS, 'Language')}`, actions: [{ label: 'Close', cls: 'btn-quiet' }] });

/* ---------- first launch ---------- */
function showOnboarding() {
  openModal({
    kind: 'onboard',
    title: 'Welcome to HookCalc',
    body: `<p class="lbl">Language \u00b7 \u092d\u093e\u0937\u093e \u00b7 \u0bae\u0bca\u0bb4\u0bbf</p>${gseg('lang', LANGS, 'Language')}` +
      `<p style="margin-top:16px">${esc(T('Crane and rigging numbers in one place: capacity, slings, ground pressure, wind, and a lift plan you can share.'))}</p>` +
      `<p class="lbl">${esc(T('Your units'))}</p>${gseg('units', [['metric', 'Metric (t, m)'], ['imperial', 'Imperial (lb, ft)']], 'Units')}` +
      `<p class="m-warn">${SIC.warn}<span>${esc(T(DISCLAIMER))}</span></p>`,
    actions: [{ label: 'I understand, start', cls: 'btn-primary', onClick: () => { S.onboarded = true; save(); } }],
    dismiss: false
  });
}

/* ---------- start ---------- */
function init() {
  S = loadState();
  initI18n();
  applyTheme();
  applyLang();
  buildChrome();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => render(false));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
  window.addEventListener('pagehide', flushSave);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (VIEW.name === 'settings') render(true); });
  render(false);
  if (!S.onboarded) showOnboarding();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
