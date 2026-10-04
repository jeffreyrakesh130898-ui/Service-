/* ===================== calculators ===================== */

/* ---------- drawing helpers ---------- */
const F1 = n => n.toFixed(1);
function tx(x, y, s, cls, anchor) {
  return `<text class="d-txt${cls ? ' ' + cls : ''}" x="${F1(x)}" y="${F1(y)}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(T(s))}</text>`;
}
function cgMark(x, y, r) {
  const X = F1(x), Y = F1(y);
  return `<g class="d-cg"><circle cx="${X}" cy="${Y}" r="${r}"/><path d="M${X} ${Y}V${F1(y - r)}A${r} ${r} 0 0 1 ${F1(x + r)} ${Y}ZM${X} ${Y}V${F1(y + r)}A${r} ${r} 0 0 1 ${F1(x - r)} ${Y}Z"/></g>`;
}
function barSVG(o) {
  const x0 = 16, x1 = 304, y = 46, h = 20;
  const max = Math.max(o.val, isNum(o.lim) ? o.lim : 0) * 1.25 || 1;
  const X = v => x0 + clamp(v / max, 0, 1) * (x1 - x0);
  let g = `<rect class="d-bar-bg" x="${x0}" y="${y}" width="${x1 - x0}" height="${h}"/>`;
  if (isNum(o.lim) && o.lim > 0) {
    g += `<rect class="d-z-ok" x="${x0}" y="${y}" width="${F1(X(o.lim * 0.8) - x0)}" height="${h}"/>`;
    g += `<rect class="d-z-warn" x="${F1(X(o.lim * 0.8))}" y="${y}" width="${F1(X(o.lim) - X(o.lim * 0.8))}" height="${h}"/>`;
    g += `<rect class="d-z-stop" x="${F1(X(o.lim))}" y="${y}" width="${F1(x1 - X(o.lim))}" height="${h}"/>`;
    g += `<line class="d-limit" x1="${F1(X(o.lim))}" y1="${y - 6}" x2="${F1(X(o.lim))}" y2="${y + h + 6}"/>`;
    g += tx(clamp(X(o.lim), 44, 276), y + h + 22, o.limLabel, 'd-strong', 'middle');
  }
  (o.marks || []).forEach(m => {
    g += `<line class="d-axis" x1="${F1(X(m.v))}" y1="${y - 4}" x2="${F1(X(m.v))}" y2="${y + h + 4}"/>` + tx(clamp(X(m.v), 44, 276), y + h + 40, m.label, '', 'middle');
  });
  const vx = X(o.val);
  g += `<path class="d-marker" d="M${F1(vx)} ${y - 1}l-8 -12h16z"/>` + tx(clamp(vx, 44, 276), y - 19, o.valLabel, 'd-strong', 'middle');
  const H = o.marks && o.marks.length ? 116 : 98;
  return `<svg class="dia" viewBox="0 0 320 ${H}" role="img" aria-label="${esc(T(o.aria))}">${g}</svg>${o.cap ? `<figcaption>${esc(T(o.cap))}</figcaption>` : ''}`;
}

/* ---------- capacity gauge ---------- */
function capStatus(p) { if (p > 100) return 'stop'; if (p > 90) return 'bad'; if (p > S.crit) return 'warn'; return 'ok'; }
function CAP_VERDICT(s) {
  return { ok: `Within ${S.crit}% of the chart. Normal lift.`, warn: 'Critical lift. Needs a written lift plan and sign-off.', bad: 'Over 90% of the chart. Engineered lift with senior approval.', stop: 'Overload. Do not lift.' }[s];
}
const CAP_SHORT = { ok: 'OK', warn: 'Critical lift', bad: 'Over 90%', stop: 'Overload' };
let gaugeSeq = 0;
function gaugeSVG(p) {
  const thr = S.crit, cx = 120, cy = 116, r = 92;
  const A = v => 180 - clamp(v, 0, 120) * 1.5;
  const P = (a, rr) => [cx + rr * Math.cos(rad(a)), cy - rr * Math.sin(rad(a))];
  const arc = (v0, v1, cls, extra) => {
    const a = P(A(v0), r), b = P(A(v1), r);
    return `<path class="gz ${cls}" d="M${F1(a[0])} ${F1(a[1])}A${r} ${r} 0 0 1 ${F1(b[0])} ${F1(b[1])}"${extra || ''}/>`;
  };
  const id = 'hz' + (++gaugeSeq);
  const marks = [0, 50, thr, 100, 120].filter((v, i, arr) => arr.indexOf(v) === i);
  const ticks = marks.map(v => {
    const a = A(v), p0 = P(a, r - 11), p1 = P(a, r + 11), t = P(a, r - 25);
    return `<line class="gt" x1="${F1(p0[0])}" y1="${F1(p0[1])}" x2="${F1(p1[0])}" y2="${F1(p1[1])}"/><text class="gl" x="${F1(t[0])}" y="${F1(t[1] + 4)}" text-anchor="middle">${v}</text>`;
  }).join('');
  return `<svg class="gauge" viewBox="0 0 240 132" role="img" aria-label="Gauge: ${fmtN(p, 1)} percent of chart capacity">` +
    `<defs><pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#D7263D"/><rect width="3.5" height="7" fill="#F7B500"/></pattern></defs>` +
    arc(0, thr, 'gz-ok') + arc(thr, 90, 'gz-warn') + arc(90, 100, 'gz-bad') + arc(100, 120, 'gz-stop', ` stroke="url(#${id})"`) + ticks +
    `<g class="needle" style="transform:rotate(${F1(clamp(p, 0, 120) * 1.5)}deg)"><path d="M${cx} ${cy - 4}L${cx - r + 16} ${cy}L${cx} ${cy + 4}z"/></g>` +
    `<circle class="hub" cx="${cx}" cy="${cy}" r="8"/></svg>`;
}
function patchGauge(root, p) {
  const n = root.querySelector('.needle');
  if (n) n.style.transform = `rotate(${F1(clamp(p, 0, 120) * 1.5)}deg)`;
  const s = root.querySelector('svg.gauge');
  if (s) s.setAttribute('aria-label', `Gauge: ${fmtN(p, 1)} percent of chart capacity`);
}

/* ===================== 1. Crane capacity ===================== */
TOOLS.cap = {
  id: 'cap', icon: 'cap', title: 'Crane capacity', short: 'Load as a % of the chart, with hook and rigging',
  lede: 'Add up everything on the hook and compare it with the load chart.',
  mainLabel: 'Capacity used',
  defaults: { load: null, rig: null, block: null, other: null, cap: null, R: null, boom: null },
  example: { opts: {}, vals: { load: 8000, rig: 250, block: 450, cap: 14200, R: 14, boom: 32.1 } },
  tips: [
    'Use the chart for the exact set-up: counterweight, outrigger spread, boom length, and working over the side or the rear.',
    'If the radius is between two chart values, use the larger radius. Do not average between values unless the chart allows it.',
    'Some charts already include the hook block. Read the chart notes.'
  ],
  fields: [
    { t: 'num', k: 'load', kind: 'mass', label: 'Load weight' },
    { t: 'num', k: 'rig', kind: 'mass', label: 'Rigging weight', opt: 1, hint: 'Slings, shackles, spreader beam' },
    { t: 'num', k: 'block', kind: 'mass', label: 'Hook block weight', opt: 1, hint: 'Written on the hook block plate' },
    { t: 'num', k: 'other', kind: 'mass', label: 'Other deductions', opt: 1, hint: 'Stowed jib, extensions, or anything the chart says to deduct' },
    { t: 'num', k: 'cap', kind: 'mass', label: 'Chart capacity', hint: 'From the load chart at this radius, boom length and set-up' },
    { t: 'head', label: 'For the lift plan', note: 'Optional. These are written into the lift plan.' },
    { t: 'row', fields: [{ t: 'num', k: 'R', kind: 'len', label: 'Radius', opt: 1 }, { t: 'num', k: 'boom', kind: 'len', label: 'Boom length', opt: 1 }] }
  ],
  calc(st) {
    if (!isNum(st.load) && !isNum(st.cap)) return empty('Enter the load weight and the chart capacity.');
    if (!isNum(st.load)) return empty('Enter the load weight.');
    if (!isNum(st.cap)) return empty('Now enter the chart capacity.');
    if (st.cap <= 0) return fail('Chart capacity must be more than zero.');
    const ded = (st.rig || 0) + (st.block || 0) + (st.other || 0);
    const gross = st.load + ded;
    const p = gross / st.cap * 100;
    const s = capStatus(p);
    const spare = st.cap - gross;
    const rows = [['Gross load on the hook', fmtQ('mass', gross)]];
    if (ded > 0) rows.push(['Deductions included', fmtQ('mass', ded)]);
    rows.push(['Chart capacity', fmtQ('mass', st.cap)]);
    rows.push(spare >= 0 ? ['Spare capacity', fmtQ('mass', spare)] : ['Over the chart by', fmtQ('mass', -spare), 'stop']);
    rows.push(['Max load weight here', fmtQ('mass', Math.max(0, st.cap - ded))]);
    rows.push([`Critical lift above ${S.crit}%`, fmtQ('mass', st.cap * S.crit / 100)]);
    if (isNum(st.R)) rows.push(['Radius', fmtQ('len', st.R)]);
    if (isNum(st.boom)) rows.push(['Boom length', fmtQ('len', st.boom)]);
    const where = [isNum(st.R) ? 'at ' + fmtQ('len', st.R) + ' radius' : '', isNum(st.boom) ? 'boom ' + fmtQ('len', st.boom) : ''].filter(Boolean).join(', ');
    return {
      state: 'ok', status: s, pct: p,
      main: { label: 'Capacity used', value: fmtN(p, 1), unit: '%' },
      verdict: CAP_VERDICT(s), short: CAP_SHORT[s], rows,
      lines: [
        `Gross load ${fmtQ('mass', gross)} (load ${fmtQ('mass', st.load)}${ded > 0 ? ' + deductions ' + fmtQ('mass', ded) : ''})`,
        `Chart capacity ${fmtQ('mass', st.cap)}${where ? ' ' + where : ''}`,
        `Capacity used ${fmtPct(p)}`
      ],
      fig: gaugeSVG(p), figKey: 'g' + S.crit, figCls: 'fig-dark', figPatch: el => patchGauge(el, p),
      acts: [{ label: 'Check ground pressure', to: 'ground', set: { gload: gross } }, { label: 'Work out parts of line', to: 'reev', set: { W: gross } }]
    };
  }
};

/* ===================== 2. Sling tension ===================== */
function shareTxt(a, w) { const pa = Math.round(a / w * 100); return `${pa}% / ${100 - pa}%`; }
function angleStatus(b) {
  if (b < 30) return { s: 'stop', v: 'Sling angle under 30\u00b0. Do not lift. Use longer slings or a spreader beam.' };
  if (b < 45) return { s: 'warn', v: 'Low sling angle. Leg tension is high. Use longer slings if you can.' };
  if (b < 60) return { s: 'ok', v: 'Sling angle is acceptable.' };
  return { s: 'ok', v: 'Good sling angle.' };
}
function slingSVG(o) {
  const py = 150, top = 50;
  let hx = 160, hy = top, pts;
  if (o.kind === 'one') pts = [[160, py]];
  else if (o.kind === 'sym') {
    const s = clamp((py - top) / Math.tan(rad(o.beta)), 6, 132);
    pts = [[160 - s, py], [160 + s, py]];
  } else {
    const k = Math.min(256 / Math.max(o.D1 + o.D2, 1e-9), (py - top) / o.Ho);
    const sL = o.D1 * k, sR = o.D2 * k;
    hy = Math.min(py - o.Ho * k, py - 30);
    hx = 160 - (sL + sR) / 2 + sL;
    pts = [[hx - sL, py], [hx + sR, py]];
  }
  const xs = pts.map(p => p[0]);
  const bx0 = clamp(Math.min.apply(null, xs) - 22, 6, 130), bx1 = clamp(Math.max.apply(null, xs) + 22, 190, 314);
  let g = `<rect class="d-load" x="${F1(bx0)}" y="${py}" width="${F1(bx1 - bx0)}" height="42" rx="4"/>`;
  if (o.kind === 'offc') g += cgMark(hx, py + 21, 9);
  g += `<line class="d-rope" x1="${F1(hx)}" y1="0" x2="${F1(hx)}" y2="${F1(hy - 38)}"/>`;
  g += `<rect class="d-block" x="${F1(hx - 15)}" y="${F1(hy - 40)}" width="30" height="24" rx="5"/><circle class="d-sheave" cx="${F1(hx)}" cy="${F1(hy - 28)}" r="5"/>`;
  g += `<line class="d-rope" x1="${F1(hx)}" y1="${F1(hy - 16)}" x2="${F1(hx)}" y2="${F1(hy - 5)}"/>`;
  pts.forEach((p, i) => { g += `<line class="d-leg" data-s="${o.ss[i]}" x1="${F1(hx)}" y1="${F1(hy)}" x2="${F1(p[0])}" y2="${F1(p[1])}"/>`; });
  g += `<circle class="d-ring" cx="${F1(hx)}" cy="${F1(hy)}" r="5"/>`;
  pts.forEach(p => { g += `<circle class="d-pin" cx="${F1(p[0])}" cy="${py}" r="4.5"/>`; });
  pts.forEach((p, i) => {
    if (!o.angLabels || !o.angLabels[i]) return;
    const dx = hx - p[0], dy = p[1] - hy;
    const phi = Math.atan2(dy, Math.abs(dx));
    const dir = dx < 0 ? -1 : 1;
    const r = clamp(Math.abs(dx) * 0.7, 16, 28);
    const x0 = p[0] + dir * r, x1 = p[0] + dir * r * Math.cos(phi), y1 = p[1] - r * Math.sin(phi);
    g += `<path class="d-arc" d="M${F1(x0)} ${py}A${r} ${r} 0 0 ${dir < 0 ? 1 : 0} ${F1(x1)} ${F1(y1)}"/>`;
    g += tx(p[0] + dir * (r + 16) * Math.cos(phi / 2), p[1] - (r + 16) * Math.sin(phi / 2) + 4, o.angLabels[i], 'd-strong', 'middle');
  });
  pts.forEach((p, i) => {
    const mx = (hx + p[0]) / 2, my = (hy + p[1]) / 2, right = p[0] >= hx;
    g += tx(mx + (right ? 12 : -12), my, o.labels[i], 'd-strong', right ? 'start' : 'end');
  });
  return `<svg class="dia" viewBox="0 0 320 200" role="img" aria-label="${esc(T(o.aria))}">${g}</svg>${o.cap ? `<figcaption>${esc(T(o.cap))}</figcaption>` : ''}`;
}
const slingLH = st => st.legs >= 2 && st.mode === 'lh';
const slingAng = st => st.legs >= 2 && st.mode === 'angle';
const slingOff = st => st.legs === 2 && st.mode === 'offc';
TOOLS.sling = {
  id: 'sling', icon: 'sling', title: 'Sling tension', short: 'Load in each leg from the sling angle or length',
  lede: 'Find the load in each sling leg and the WLL you need.',
  mainLabel: 'Tension in each leg',
  defaults: { W: null, legs: 2, share: 2, mode: 'lh', L: null, H: null, ang: null, ref: 'horiz', D1: null, D2: null, Ho: null, hitch: 'straight', wll: null },
  example(st) {
    const opts = { legs: st.legs, share: st.share, mode: st.mode, ref: st.ref, hitch: st.hitch };
    if (st.legs === 1) return { opts, vals: { W: 8000 } };
    if (st.mode === 'angle') return { opts, vals: { W: 8000, ang: st.ref === 'between' ? 60 : st.ref === 'vert' ? 30 : 60 } };
    if (st.mode === 'offc') return { opts, vals: { W: 8000, D1: 1.2, D2: 2, Ho: 3 } };
    return { opts, vals: { W: 8000, L: 4, H: 3.2 } };
  },
  tips: [
    'Keep sling angles above 45\u00b0 from horizontal where you can. Never lift below 30\u00b0.',
    'Shackles, hooks and lifting points see the same leg tension. Check their WLL too.',
    'Pack sharp edges. An unprotected edge can cut a sling well below its WLL.'
  ],
  fields: [
    { t: 'num', k: 'W', kind: 'mass', label: 'Load weight', hint: 'Include anything hanging below the slings, such as a spreader beam.' },
    { t: 'seg', k: 'legs', label: 'Number of sling legs', opts: [[1, '1'], [2, '2'], [3, '3'], [4, '4']], set: st => { if (st.legs !== 2 && st.mode === 'offc') st.mode = 'lh'; } },
    { t: 'seg', k: 'share', label: 'Legs that carry the load', opts: [[2, 'Only 2 (safe)'], [3, '3 legs']], show: st => st.legs >= 3, hint: 'On a rigid load, a 3 or 4-leg sling often hangs on just 2 legs. Use 2 unless the legs are equalised.' },
    { t: 'seg', k: 'mode', label: 'Work it out from', opts: [['lh', 'Length and height'], ['angle', 'Sling angle'], ['offc', 'Off-centre load']], show: st => st.legs >= 2, set: st => { if (st.mode === 'offc') st.legs = 2; } },
    { t: 'row', show: slingLH, fields: [{ t: 'num', k: 'L', kind: 'len', label: 'Sling length' }, { t: 'num', k: 'H', kind: 'len', label: 'Height' }] },
    { t: 'note', show: slingLH, html: 'Sling length is from the hook to the pick point. Height is straight up from the pick points to the hook.' },
    { t: 'seg', k: 'ref', label: 'Angle measured', opts: [['horiz', 'From horizontal'], ['vert', 'From vertical'], ['between', 'Between legs']], show: slingAng },
    { t: 'num', k: 'ang', kind: 'deg', label: st => ({ horiz: 'Angle from horizontal', vert: 'Angle from vertical', between: 'Angle between the legs' }[st.ref] || 'Angle'), show: slingAng },
    { t: 'row', show: slingOff, fields: [{ t: 'num', k: 'D1', kind: 'len', label: 'Point A to CG' }, { t: 'num', k: 'D2', kind: 'len', label: 'Point B to CG' }] },
    { t: 'num', k: 'Ho', kind: 'len', label: 'Hook height above pick points', show: slingOff, hint: 'Distances are measured flat. The hook must sit right above the centre of gravity (CG).' },
    { t: 'seg', k: 'hitch', label: 'Hitch', opts: [['straight', 'Straight'], ['choker', 'Choker \u00d70.8']], hint: st => (st.hitch === 'choker' ? 'For a choke angle of 120\u00b0 or more. A tighter choke loses more capacity.' : '') },
    { t: 'num', k: 'wll', kind: 'mass', label: 'Sling WLL on the tag', opt: 1, hint: 'Working load limit of one leg in a straight pull' }
  ],
  calc(st) {
    const W = st.W;
    if (!isNum(W)) return empty('Enter the load weight.');
    if (W <= 0) return fail('Load weight must be more than zero.');
    const hf = st.hitch === 'choker' ? 0.8 : 1;
    const ch = hf < 1 ? ' (choker)' : '';
    const finish = (r, T) => {
      if (isNum(st.wll) && st.wll > 0) {
        const use = T / (st.wll * hf) * 100;
        const s = use > 100 ? 'stop' : use > 90 ? 'warn' : 'ok';
        r.rows.push(['Sling use' + ch, fmtPct(use, 0), s === 'ok' ? '' : s]);
        r.lines.push(`Sling WLL ${fmtQ('mass', st.wll)}${ch}: ${fmtPct(use, 0)} used`);
        if (RANK[s] > RANK[r.status]) { r.status = s; r.verdict = s === 'stop' ? 'Sling overloaded. Use a sling with a higher WLL.' : 'Sling is close to its WLL.'; }
      }
      return r;
    };
    if (st.legs === 1) {
      return finish({
        state: 'ok', status: 'ok', main: mv('Tension in the leg', 'mass', W), verdict: 'One vertical leg takes the full load.',
        rows: [['Minimum WLL needed' + ch, fmtQ('mass', W / hf)]],
        lines: [`Single vertical leg: ${fmtQ('mass', W)}`, `Minimum WLL ${fmtQ('mass', W / hf)}${ch}`],
        fig: slingSVG({ kind: 'one', ss: ['ok'], labels: [fmtQ('mass', W)], aria: 'Single vertical sling leg' })
      }, W);
    }
    if (st.mode === 'offc' && st.legs === 2) {
      if (!all(st.D1, st.D2, st.Ho)) return empty('Enter both distances to the CG and the hook height.');
      if (st.Ho <= 0 || st.D1 + st.D2 <= 0) return fail('Distances must be more than zero.');
      const L1 = Math.hypot(st.D1, st.Ho), L2 = Math.hypot(st.D2, st.Ho);
      const V1 = W * st.D2 / (st.D1 + st.D2), V2 = W * st.D1 / (st.D1 + st.D2);
      const T1 = V1 * L1 / st.Ho, T2 = V2 * L2 / st.Ho;
      const b1 = deg(Math.atan2(st.Ho, st.D1)), b2 = deg(Math.atan2(st.Ho, st.D2));
      const a1 = angleStatus(b1), a2 = angleStatus(b2);
      const lowA = b1 <= b2 ? a1 : a2;
      const Tm = Math.max(T1, T2);
      return finish({
        state: 'ok', status: lowA.s, main: mv('Highest leg tension', 'mass', Tm), verdict: lowA.v,
        rows: [
          ['Leg A tension', fmtQ('mass', T1)], ['Leg A angle from horizontal', fmtDeg(b1), a1.s === 'ok' ? '' : a1.s], ['Leg A length needed', fmtQ('len', L1)],
          ['Leg B tension', fmtQ('mass', T2)], ['Leg B angle from horizontal', fmtDeg(b2), a2.s === 'ok' ? '' : a2.s], ['Leg B length needed', fmtQ('len', L2)],
          ['Load share A / B', shareTxt(V1, W)],
          ['Minimum WLL needed' + ch, fmtQ('mass', Tm / hf)]
        ],
        notes: ['The two legs must be different lengths so the hook sits right above the CG. Equal slings will make the load tilt.'],
        lines: [`Off-centre 2-leg sling: leg A ${fmtQ('mass', T1)} at ${fmtDeg(b1)}, leg B ${fmtQ('mass', T2)} at ${fmtDeg(b2)}`, `Leg lengths A ${fmtQ('len', L1)}, B ${fmtQ('len', L2)}`, `Minimum WLL ${fmtQ('mass', Tm / hf)}${ch}`],
        fig: slingSVG({ kind: 'offc', D1: st.D1, D2: st.D2, Ho: st.Ho, ss: [a1.s, a2.s], labels: ['A ' + fmtQ('mass', T1), 'B ' + fmtQ('mass', T2)], angLabels: [fmtDeg(b1, 0), fmtDeg(b2, 0)], aria: 'Two-leg sling with the centre of gravity off centre', cap: 'Hook sits above the centre of gravity.' })
      }, Tm);
    }
    let beta;
    if (st.mode === 'angle') {
      if (!isNum(st.ang)) return empty('Enter the sling angle.');
      beta = st.ref === 'vert' ? 90 - st.ang : st.ref === 'between' ? 90 - st.ang / 2 : st.ang;
      if (!(beta > 0 && beta <= 90)) return fail(st.ref === 'between' ? 'The angle between the legs must be less than 180\u00b0.' : 'The angle must be between 0\u00b0 and 90\u00b0.');
    } else {
      if (!all(st.L, st.H)) return empty('Enter the sling length and the height.');
      if (st.H <= 0 || st.L <= 0) return fail('Length and height must be more than zero.');
      if (st.H > st.L) return fail('The height cannot be more than the sling length.');
      beta = deg(Math.asin(st.H / st.L));
    }
    const n = st.legs === 2 ? 2 : st.share;
    const k = 1 / Math.sin(rad(beta));
    const T = W / n * k;
    const as = angleStatus(beta);
    const rows = [
      ['Sling angle from horizontal', fmtDeg(beta), as.s === 'ok' ? '' : as.s],
      ['Angle from vertical', fmtDeg(90 - beta)],
      ['Angle between the legs', fmtDeg(180 - 2 * beta)],
      ['Angle factor', fmtN(k, 3)],
      ['Legs carrying the load', TF('{0} of {1}', n, st.legs)],
      ['Minimum WLL per leg' + ch, fmtQ('mass', T / hf)],
      ['Inward pull on the load per leg', fmtQ('mass', T * Math.cos(rad(beta)))]
    ];
    const notes = [];
    if (st.legs > n) notes.push(`Worked out with only ${n} legs carrying the load. This is the safe assumption for a rigid load.`);
    return finish({
      state: 'ok', status: as.s, main: mv('Tension in each leg', 'mass', T), verdict: as.v, rows, notes,
      lines: [`${st.legs}-leg sling, ${n} legs carrying the load`, `Tension ${fmtQ('mass', T)} per leg at ${fmtDeg(beta)} from horizontal`, `Minimum WLL per leg ${fmtQ('mass', T / hf)}${ch}`],
      fig: slingSVG({ kind: 'sym', beta, ss: [as.s, as.s], labels: [fmtQ('mass', T), fmtQ('mass', T)], angLabels: [null, fmtDeg(beta, 0)], aria: `Sling legs at ${fmtDeg(beta, 0)} from horizontal`, cap: st.legs > 2 ? `Side view: 2 of ${st.legs} legs shown.` : '' })
    }, T);
  }
};

/* ===================== 3. Load weight ===================== */
const MAT_LIST = [
  ['Metals', [['steel', 'Steel', 7850], ['stainless', 'Stainless steel', 8000], ['castiron', 'Cast iron', 7200], ['aluminium', 'Aluminium', 2700], ['copper', 'Copper', 8960], ['brass', 'Brass', 8500], ['lead', 'Lead', 11340]]],
  ['Concrete and stone', [['rcc', 'Reinforced concrete (RCC)', 2500], ['concrete', 'Plain concrete (PCC)', 2400], ['brick', 'Brickwork', 1900], ['granite', 'Granite', 2700], ['marble', 'Marble', 2700], ['glass', 'Glass', 2500]]],
  ['Soil and bulk', [['soil', 'Soil or earth', 1800], ['sanddry', 'Sand, dry', 1600], ['sandwet', 'Sand, wet', 1900], ['gravel', 'Gravel', 1700], ['cement', 'Cement, bulk', 1440], ['asphalt', 'Asphalt', 2300]]],
  ['Wood and plastic', [['hardwood', 'Hardwood', 750], ['softwood', 'Softwood', 500], ['hdpe', 'HDPE or plastic', 950]]],
  ['Liquids', [['water', 'Water', 1000], ['seawater', 'Sea water', 1025], ['diesel', 'Diesel', 850], ['oil', 'Oil', 900]]]
];
const MAT = {};
MAT_LIST.forEach(g => g[1].forEach(m => { MAT[m[0]] = { n: m[1], d: m[2] }; }));
const LIQ = { water: { n: 'Water', d: 1000 }, seawater: { n: 'Sea water', d: 1025 }, diesel: { n: 'Diesel', d: 850 }, petrol: { n: 'Petrol', d: 740 }, oil: { n: 'Oil', d: 900 } };
function matOpts() {
  return MAT_LIST.map(g => ['__g', g[0], g[1].map(m => [m[0], `${T(m[1])} (${fmtQ('dens', m[2], 0)})`])]).concat([['custom', 'Other: enter the density']]);
}
const LBFT = 1.48816394357;
const SECT_LIST = [
  ['ISMB (India)', [['ISMB 100', 11.5], ['ISMB 125', 13.0], ['ISMB 150', 14.9], ['ISMB 175', 19.3], ['ISMB 200', 25.4], ['ISMB 225', 31.2], ['ISMB 250', 37.3], ['ISMB 300', 44.2], ['ISMB 350', 52.4], ['ISMB 400', 61.6], ['ISMB 450', 72.4], ['ISMB 500', 86.9], ['ISMB 550', 103.7], ['ISMB 600', 122.6]]],
  ['HEB (Europe)', [['HEB 100', 20.4], ['HEB 200', 61.3], ['HEB 300', 117], ['HEB 400', 155], ['HEB 500', 187], ['HEB 600', 212]]],
  ['IPE (Europe)', [['IPE 200', 22.4], ['IPE 300', 42.2], ['IPE 400', 66.3], ['IPE 500', 90.7], ['IPE 600', 122]]],
  ['W shapes (US)', [['W8\u00d731', 31 * LBFT], ['W10\u00d733', 33 * LBFT], ['W12\u00d726', 26 * LBFT], ['W14\u00d730', 30 * LBFT], ['W16\u00d740', 40 * LBFT], ['W18\u00d750', 50 * LBFT], ['W21\u00d762', 62 * LBFT], ['W24\u00d776', 76 * LBFT]]]
];
const SECT = {};
SECT_LIST.forEach(g => g[1].forEach(s => { SECT[s[0]] = s[1]; }));
function sectOpts() {
  return [['', 'Pick a section (optional)']].concat(SECT_LIST.map(g => ['__g', g[0], g[1].map(s => [s[0], `${s[0]} (${fmtQ('lin', s[1], 1)})`])]));
}
const SH = {
  plate: svgI('<path d="M3 12.5 11 9l10 3.5-8 3.5z"/><path d="M3 12.5V15l10 4 8-3.5v-3"/><path d="M13 16v3"/>'),
  bar: svgI('<ellipse cx="6.5" cy="12" rx="2.5" ry="4.2"/><path d="M6.5 7.8h11.5M6.5 16.2h11.5"/><path d="M18 7.8a2.5 4.2 0 0 1 0 8.4"/>'),
  pipe: svgI('<ellipse cx="6.5" cy="12" rx="2.8" ry="4.8"/><ellipse cx="6.5" cy="12" rx="1.1" ry="2.2"/><path d="M6.5 7.2H18M6.5 16.8H18"/><path d="M18 7.2a2.8 4.8 0 0 1 0 9.6"/>'),
  beam: svgI('<path d="M5 4.5h14v3h-5.3v9H19v3H5v-3h5.3v-9H5z"/>'),
  sphere: svgI('<circle cx="12" cy="12" r="7.5"/><path d="M4.5 12a7.5 2.8 0 0 0 15 0"/>'),
  vol: svgI('<path d="M12 3.5 20 8v8l-8 4.5L4 16V8z"/><path d="M4 8l8 4.5L20 8M12 12.5v8"/>'),
  pieces: svgI('<rect x="3.5" y="13" width="7.5" height="6.5" rx=".8"/><rect x="13" y="13" width="7.5" height="6.5" rx=".8"/><rect x="8.2" y="5" width="7.5" height="6.5" rx=".8"/>')
};
const SHAPE_N = { plate: 'plate or block', bar: 'round bar', pipe: 'pipe', beam: 'section', sphere: 'ball', volume: 'by volume', pieces: 'pieces' };
const noMat = st => st.shape === 'beam' || st.shape === 'pieces';
const shapeIs = (...s) => st => s.indexOf(st.shape) >= 0;
TOOLS.weight = {
  id: 'weight', icon: 'weight', title: 'Load weight', short: 'Steel, concrete, pipes, tanks and more',
  lede: 'Work out what a load weighs from its size and material.',
  mainLabel: 'Total weight',
  keepOnClear: ['shape', 'mat'],
  defaults: { shape: 'plate', mat: 'steel', dens: null, L: null, W: null, T: null, D: null, OD: null, wt: null, cont: 'empty', liq: 'water', fill: null, sect: '', lin: null, Ds: null, vol: null, unit: null, qty: 1, allow: null },
  example(st) {
    switch (st.shape) {
      case 'bar': return { opts: { shape: 'bar', mat: 'steel' }, vals: { L: 3, D: 0.1 } };
      case 'pipe': return { opts: { shape: 'pipe', mat: 'steel', cont: 'empty' }, vals: { L: 6, OD: 0.508, wt: 0.0127 } };
      case 'beam': return { opts: { shape: 'beam', sect: 'HEB 300' }, vals: { L: 12, lin: 117 } };
      case 'sphere': return { opts: { shape: 'sphere', mat: 'steel' }, vals: { Ds: 0.5 } };
      case 'volume': return { opts: { shape: 'volume', mat: 'rcc' }, vals: { vol: 3.5 } };
      case 'pieces': return { opts: { shape: 'pieces' }, vals: { unit: 50, qty: 40 } };
      default: return { opts: { shape: 'plate', mat: 'steel' }, vals: { L: 6, W: 2, T: 0.025 } };
    }
  },
  tips: [
    'Use the weight on the drawing, nameplate or delivery note when you have it.',
    'Add an allowance when the weight is an estimate, or when fittings and contents are unknown.'
  ],
  fields: [
    { t: 'tiles', k: 'shape', label: 'Shape', opts: [['plate', 'Plate or block', SH.plate], ['bar', 'Round bar', SH.bar], ['pipe', 'Pipe or tank', SH.pipe], ['beam', 'Beam or section', SH.beam], ['sphere', 'Ball', SH.sphere], ['volume', 'Known volume', SH.vol], ['pieces', 'Piece weight known', SH.pieces]] },
    { t: 'sel', k: 'mat', label: 'Material', opts: matOpts, show: st => !noMat(st) },
    { t: 'num', k: 'dens', kind: 'dens', label: 'Density', show: st => !noMat(st) && st.mat === 'custom', ph: () => 'e.g. ' + exNum('dens', 7850) },
    { t: 'num', k: 'L', kind: 'len', label: 'Length', show: shapeIs('plate', 'bar', 'pipe', 'beam') },
    { t: 'num', k: 'W', kind: 'len', label: 'Width', show: shapeIs('plate') },
    { t: 'num', k: 'T', kind: 'dim', label: 'Thickness or height', show: shapeIs('plate') },
    { t: 'num', k: 'D', kind: 'dim', label: 'Diameter', show: shapeIs('bar') },
    { t: 'num', k: 'OD', kind: 'dim', label: 'Outside diameter', show: shapeIs('pipe') },
    { t: 'num', k: 'wt', kind: 'dim', label: 'Wall thickness', show: shapeIs('pipe') },
    { t: 'seg', k: 'cont', label: 'Contents', opts: [['empty', 'Empty'], ['liquid', 'Holds liquid']], show: shapeIs('pipe') },
    { t: 'sel', k: 'liq', label: 'Liquid', opts: () => Object.keys(LIQ).map(k => [k, `${T(LIQ[k].n)} (${fmtQ('dens', LIQ[k].d, 0)})`]), show: st => st.shape === 'pipe' && st.cont === 'liquid' },
    { t: 'num', k: 'fill', kind: 'pct', label: 'How full', opt: 1, ph: 'Blank = full', show: st => st.shape === 'pipe' && st.cont === 'liquid' },
    { t: 'sel', k: 'sect', label: 'Section', opt: 1, opts: sectOpts, show: shapeIs('beam'), rerender: true, set: (st, v) => { if (isNum(SECT[v])) st.lin = SECT[v]; } },
    { t: 'num', k: 'lin', kind: 'lin', label: () => (S.units === 'imperial' ? 'Weight per foot' : 'Weight per metre'), show: shapeIs('beam'), clears: 'sect', hint: 'From the steel table, or pick a section above.' },
    { t: 'num', k: 'Ds', kind: 'len', label: 'Diameter', show: shapeIs('sphere') },
    { t: 'num', k: 'vol', kind: 'vol', label: 'Volume', show: shapeIs('volume') },
    { t: 'num', k: 'unit', kind: 'mass', label: 'Weight of one piece', show: shapeIs('pieces') },
    { t: 'num', k: 'qty', kind: 'num', label: 'Number of pieces' },
    { t: 'num', k: 'allow', kind: 'pct', label: 'Extra allowance', opt: 1, ph: 'e.g. 10', hint: 'Adds a margin for estimates, fittings or contents you are unsure of.' }
  ],
  calc(st) {
    const sh = st.shape;
    let rho = null;
    if (!noMat(st)) {
      rho = st.mat === 'custom' ? st.dens : (MAT[st.mat] ? MAT[st.mat].d : null);
      if (!isNum(rho)) return empty('Enter the density of the material.');
      if (rho <= 0) return fail('Density must be more than zero.');
    }
    let V = null, m1 = null, liq = 0;
    if (sh === 'plate') { if (!all(st.L, st.W, st.T)) return empty('Enter the length, width and thickness.'); V = st.L * st.W * st.T; }
    else if (sh === 'bar') { if (!all(st.L, st.D)) return empty('Enter the length and the diameter.'); V = Math.PI / 4 * st.D * st.D * st.L; }
    else if (sh === 'pipe') {
      if (!all(st.L, st.OD, st.wt)) return empty('Enter the length, outside diameter and wall thickness.');
      if (2 * st.wt >= st.OD) return fail('The wall is too thick for this diameter.');
      const id = st.OD - 2 * st.wt;
      V = Math.PI / 4 * (st.OD * st.OD - id * id) * st.L;
      if (st.cont === 'liquid') {
        const fill = isNum(st.fill) ? clamp(st.fill, 0, 100) : 100;
        liq = Math.PI / 4 * id * id * st.L * fill / 100 * (LIQ[st.liq] || LIQ.water).d;
      }
    } else if (sh === 'beam') { if (!all(st.L, st.lin)) return empty('Enter the length and the weight per ' + (S.units === 'imperial' ? 'foot.' : 'metre.')); m1 = st.L * st.lin; }
    else if (sh === 'sphere') { if (!isNum(st.Ds)) return empty('Enter the diameter.'); V = Math.PI / 6 * Math.pow(st.Ds, 3); }
    else if (sh === 'volume') { if (!isNum(st.vol)) return empty('Enter the volume.'); V = st.vol; }
    else if (sh === 'pieces') { if (!isNum(st.unit)) return empty('Enter the weight of one piece.'); m1 = st.unit; }
    const qty = st.qty;
    if (!isNum(qty) || qty <= 0) return empty('Enter the number of pieces.');
    if (V != null) m1 = V * rho + liq;
    const allow = isNum(st.allow) ? st.allow : 0;
    const base = m1 * qty, extra = base * allow / 100, total = base + extra;
    if (!(total > 0)) return fail('The weight works out as zero. Check the sizes.');
    const many = qty !== 1;
    const rows = [];
    if (many) rows.push(['Each piece', fmtQ('mass', m1)], ['Number of pieces', fmtN(qty, Number.isInteger(qty) ? 0 : 2)]);
    if (V != null) rows.push([many ? 'Volume of each' : 'Volume', fmtQ('vol', V)]);
    if (rho != null) rows.push(['Density used', fmtQ('dens', rho, 0)]);
    if (liq > 0) rows.push([many ? 'Liquid inside each' : 'Liquid inside', fmtQ('mass', liq)]);
    if (extra > 0) rows.push([`Allowance (${fmtPct(allow, 0)})`, fmtQ('mass', extra)]);
    rows.push([S.units === 'imperial' ? 'In US tons' : 'In kilograms', massAlt(total)]);
    const what = sh === 'beam' ? (st.sect || 'Beam') : sh === 'pieces' ? 'Pieces' : (st.mat === 'custom' ? 'Custom material' : MAT[st.mat].n);
    const notes = [];
    if (sh === 'pipe') notes.push('Flanges, end caps, nozzles, lining and insulation are not included.');
    if (sh === 'beam') notes.push('Plates, cleats and bolts are not included.');
    return {
      state: 'ok', status: 'info', main: mv('Total weight', 'mass', total),
      verdict: 'Estimate. Confirm it with the drawing, nameplate or a load cell.', short: '', rows, notes,
      lines: [`${T(what)}, ${T(SHAPE_N[sh])}${many ? ' \u00d7 ' + fmtN(qty, 0) : ''}: ${fmtQ('mass', total)}${extra > 0 ? ' ' + TF('incl. {0} allowance', fmtPct(allow, 0)) : ''}`],
      acts: [{ label: 'Use in capacity check', to: 'cap', set: { load: total } }, { label: 'Use in sling tension', to: 'sling', set: { W: total } }]
    };
  }
};

/* ===================== 4. Boom and radius ===================== */
function boomSVG(o) {
  const VW = 340, top = 24;
  const xmin = Math.min(-4, o.a - 1.5);
  const xmax = Math.max(o.R + 2.5, isNum(o.od) ? o.od + 3 : 0);
  const ymax = Math.max(o.tipH, isNum(o.oh) ? o.oh : 0, 3) * 1.12;
  let k = (VW - 24) / (xmax - xmin), gy = top + ymax * k;
  if (gy > 300) { k = (300 - top) / ymax; gy = 300; }
  const x0 = Math.max(12, (VW - (xmax - xmin) * k) / 2);
  const X = x => x0 + (x - xmin) * k, Y = y => gy - y * k;
  let g = `<line class="d-ground" x1="0" y1="${gy}" x2="${VW}" y2="${gy}"/>`;
  for (let x = 6; x < VW + 8; x += 12) g += `<line class="d-hatch" x1="${x}" y1="${gy + 1.5}" x2="${x - 7}" y2="${gy + 8.5}"/>`;
  if (isNum(o.od) && isNum(o.oh) && o.oh > 0) {
    const ow = clamp((o.R - o.od) * 0.6, 1, 3);
    g += `<rect class="d-obs" data-s="${o.obs ? o.obs.s : 'info'}" x="${F1(X(o.od))}" y="${F1(Y(o.oh))}" width="${F1(ow * k)}" height="${F1(o.oh * k)}"/>`;
  }
  if (o.mode === 'inv' && o.setH > 0) g += `<rect class="d-set" x="${F1(X(o.R - 2.4))}" y="${F1(Y(o.setH))}" width="${F1(4.8 * k)}" height="${F1(o.setH * k)}"/>`;
  const cw = clamp(6.5 * k, 46, 118), ch = clamp(1.3 * k, 10, 18), cx0 = X(0) - cw * 0.62, ctop = gy - ch - 8;
  g += `<rect class="d-carrier" x="${F1(cx0)}" y="${F1(ctop)}" width="${F1(cw)}" height="${F1(ch)}" rx="2.5"/>`;
  g += `<circle class="d-wheel" cx="${F1(cx0 + 10)}" cy="${gy - 5}" r="5.5"/><circle class="d-wheel" cx="${F1(cx0 + cw - 10)}" cy="${gy - 5}" r="5.5"/>`;
  const fx = X(o.a), fy = Y(o.h0);
  if (fy < ctop - 4) g += `<path class="d-cab" d="M${F1(Math.min(X(0), fx) - 16)} ${F1(ctop)}V${F1(fy - 3)}H${F1(fx + 6)}V${F1(ctop)}Z"/>`;
  g += `<line class="d-axis" x1="${F1(X(0))}" y1="${F1(Math.min(fy, ctop) - 10)}" x2="${F1(X(0))}" y2="${gy + 26}"/>`;
  const tX = X(o.R), tY = Y(o.tipH);
  g += `<line class="d-boom-o" x1="${F1(fx)}" y1="${F1(fy)}" x2="${F1(tX)}" y2="${F1(tY)}"/><line class="d-boom" x1="${F1(fx)}" y1="${F1(fy)}" x2="${F1(tX)}" y2="${F1(tY)}"/>`;
  g += `<circle class="d-sheave" cx="${F1(tX)}" cy="${F1(tY)}" r="4"/>`;
  let hookY, loadTop, loadBot;
  if (o.mode === 'inv') {
    loadBot = Y(o.setH || 0); loadTop = Y((o.setH || 0) + (o.loadH || 0)); hookY = Y((o.setH || 0) + (o.loadH || 0) + (o.rigH || 0));
  } else {
    hookY = Y(o.tipH * 0.48); loadTop = hookY + clamp(1.6 * k, 10, 24); loadBot = loadTop + clamp(1.4 * k, 10, 24);
  }
  if (loadBot - loadTop < 6) loadBot = loadTop + 6;
  if (hookY > loadTop - 4) hookY = loadTop - 4;
  const lw = clamp(2 * k, 16, 40);
  g += `<line class="d-rope" x1="${F1(tX)}" y1="${F1(tY)}" x2="${F1(tX)}" y2="${F1(hookY - 9)}"/>`;
  g += `<rect class="d-block" x="${F1(tX - 6)}" y="${F1(hookY - 11)}" width="12" height="9" rx="2"/>`;
  g += `<path class="d-rig" d="M${F1(tX)} ${F1(hookY)}L${F1(tX - lw / 2 + 3)} ${F1(loadTop)}M${F1(tX)} ${F1(hookY)}L${F1(tX + lw / 2 - 3)} ${F1(loadTop)}"/>`;
  g += `<rect class="d-loadb" x="${F1(tX - lw / 2)}" y="${F1(loadTop)}" width="${F1(lw)}" height="${F1(loadBot - loadTop)}" rx="2"/>`;
  if (o.obs && isNum(o.obs.y)) {
    const xo = X(o.od);
    g += `<line class="d-clr" data-s="${o.obs.s}" x1="${F1(xo)}" y1="${F1(Y(o.oh))}" x2="${F1(xo)}" y2="${F1(Y(o.obs.y))}"/>`;
    g += tx(xo + 6, (Y(o.oh) + Y(o.obs.y)) / 2 + 4, fmtQ('len', o.obs.c), 'd-strong', 'start');
  }
  const r = 30, th = o.th;
  g += `<line class="d-axis" x1="${F1(fx)}" y1="${F1(fy)}" x2="${F1(fx + r + 10)}" y2="${F1(fy)}"/>`;
  g += `<path class="d-arc" d="M${F1(fx + r)} ${F1(fy)}A${r} ${r} 0 0 0 ${F1(fx + r * Math.cos(rad(th)))} ${F1(fy - r * Math.sin(rad(th)))}"/>`;
  g += tx(fx + (r + 8) * Math.cos(rad(th / 2)), fy - (r + 8) * Math.sin(rad(th / 2)) + 4, fmtDeg(th), 'd-strong', 'start');
  g += `<text class="d-txt" transform="translate(${F1((fx + tX) / 2)} ${F1((fy + tY) / 2)}) rotate(${F1(-th)})" y="-10" text-anchor="middle">${esc(T('Boom ' + fmtQ('len', o.L)))}</text>`;
  const right = tX + 80 < VW;
  g += tx(right ? tX + 8 : tX - 8, tY - 7, 'Tip ' + fmtQ('len', o.tipH), '', right ? 'start' : 'end');
  const dy = gy + 20;
  g += `<path class="d-dimline" d="M${F1(X(0))} ${dy}H${F1(tX)}M${F1(X(0))} ${dy - 5}v10M${F1(tX)} ${dy - 5}v10"/>`;
  g += tx((X(0) + tX) / 2, dy + 16, 'Radius ' + fmtQ('len', o.R), 'd-strong', 'middle');
  return `<svg class="dia" viewBox="0 0 ${VW} ${F1(gy + 42)}" role="img" aria-label="${esc(T(o.aria))}">${g}</svg><figcaption>${esc(T('Side view to scale. The crane body is only a sketch.'))}</figcaption>`;
}
const boomFwd = st => st.mode === 'fwd';
const boomInv = st => st.mode === 'inv';
TOOLS.boom = {
  id: 'boom', icon: 'boom', title: 'Boom and radius', short: 'Radius, boom length and clearance over obstacles',
  lede: 'Find the working radius, or the boom length you need to reach a spot.',
  mainLabel: 'Working radius',
  keepOnClear: ['mode'],
  defaults: { mode: 'fwd', L: null, ang: null, R: null, setH: null, loadH: null, rigH: null, clr: null, a: 0, h0: 0, od: null, oh: null, margin: null },
  example(st) {
    if (st.mode === 'inv') return { opts: { mode: 'inv' }, vals: { R: 18, setH: 12, loadH: 2, rigH: 3, clr: 2, a: 0, h0: 2.5, od: 13, oh: 12, margin: 1 } };
    return { opts: { mode: 'fwd' }, vals: { L: 32.1, ang: 64, a: 0, h0: 2.5, od: 9, oh: 8, margin: 1 } };
  },
  tips: [
    'Radius is measured from the centre of rotation to the hook, with the load hanging.',
    'The boom bends under load, so the real radius grows a little. Check the radius after taking the weight.'
  ],
  fields: [
    { t: 'seg', k: 'mode', label: 'I want to find', opts: [['fwd', 'The radius'], ['inv', 'The boom length']] },
    { t: 'num', k: 'L', kind: 'len', label: 'Boom length', show: boomFwd },
    { t: 'num', k: 'ang', kind: 'deg', label: 'Boom angle', show: boomFwd, hint: 'Read it on the boom angle indicator or the LMI.' },
    { t: 'num', k: 'R', kind: 'len', label: 'Radius needed', show: boomInv, hint: 'From the centre of rotation to where the load is set down.' },
    { t: 'head', label: 'Height needed at the boom tip', show: boomInv, note: 'These are added up to get the tip height.' },
    { t: 'row', show: boomInv, fields: [{ t: 'num', k: 'setH', kind: 'len', label: 'Set-down height' }, { t: 'num', k: 'loadH', kind: 'len', label: 'Load height' }] },
    { t: 'row', show: boomInv, fields: [{ t: 'num', k: 'rigH', kind: 'len', label: 'Rigging height' }, { t: 'num', k: 'clr', kind: 'len', label: 'Hook block and gap' }] },
    { t: 'note', show: boomInv, html: 'Set-down height is the top of the roof or platform. Rigging height is from the hook to the top of the load. Hook block and gap is the block height plus a safe gap under the boom tip.' },
    { t: 'head', label: 'Crane measurements', note: 'Optional. Leave them at 0 if you do not know them. They are in the crane manual.' },
    { t: 'row', fields: [{ t: 'num', k: 'a', kind: 'len', label: 'Boom foot offset', neg: 1 }, { t: 'num', k: 'h0', kind: 'len', label: 'Boom foot height' }] },
    { t: 'note', html: 'Offset is the flat distance from the centre of rotation to the boom foot pin. Use minus if the pin is behind it. Height is the pin height above the ground.' },
    { t: 'head', label: 'Obstacle check', note: 'Optional. Checks that the boom clears a building, pipe rack or wall.' },
    { t: 'row', fields: [{ t: 'num', k: 'od', kind: 'len', label: 'Distance to obstacle' }, { t: 'num', k: 'oh', kind: 'len', label: 'Obstacle height' }] },
    { t: 'num', k: 'margin', kind: 'len', label: 'Clearance you need', opt: 1, ph: () => (S.units === 'imperial' ? 'Blank = 3 ft' : 'Blank = 1 m'), hint: 'Distance is from the centre of rotation to the near edge of the obstacle.' }
  ],
  calc(st) {
    const a = isNum(st.a) ? st.a : 0, h0 = isNum(st.h0) ? st.h0 : 0;
    let L, th, R, tipH;
    if (st.mode === 'inv') {
      if (!isNum(st.R)) return empty('Enter the radius and the heights.');
      const Hn = (st.setH || 0) + (st.loadH || 0) + (st.rigH || 0) + (st.clr || 0);
      if (!(Hn > 0)) return empty('Enter the heights to work out the tip height.');
      const dx = st.R - a, dy = Hn - h0;
      if (dx <= 0) return fail('The radius must be more than the boom foot offset.');
      if (dy <= 0) return fail('The tip height needed is below the boom foot. Check the heights.');
      L = Math.hypot(dx, dy); th = deg(Math.atan2(dy, dx)); R = st.R; tipH = Hn;
    } else {
      if (!all(st.L, st.ang)) return empty('Enter the boom length and the boom angle.');
      if (st.L <= 0) return fail('Boom length must be more than zero.');
      if (!(st.ang > 0 && st.ang <= 90)) return fail('The boom angle must be between 0\u00b0 and 90\u00b0.');
      L = st.L; th = st.ang; R = L * Math.cos(rad(th)) + a; tipH = L * Math.sin(rad(th)) + h0;
    }
    let s = 'info', verdict = st.mode === 'inv' ? 'Use the next longer boom length your crane has, then check the chart at this radius.' : 'Check the load chart at this radius and boom length.';
    if (th > 82) { s = 'warn'; verdict = 'Very steep boom. Check the highest boom angle your crane allows.'; }
    let obs = null;
    const margin = isNum(st.margin) ? st.margin : (S.units === 'imperial' ? 0.9144 : 1);
    if (all(st.od, st.oh)) {
      if (st.od >= R) obs = { s: 'info', txt: 'The obstacle is at or past the hook radius, so the boom does not pass over it.' };
      else if (st.od <= a) obs = { s: 'info', txt: 'The obstacle is behind the boom foot.' };
      else {
        const y = h0 + (st.od - a) * Math.tan(rad(th)), c = y - st.oh;
        obs = { y, c, s: c < 0 ? 'stop' : c < margin ? 'warn' : 'ok' };
        obs.txt = obs.s === 'stop' ? 'The boom hits the obstacle. Move the crane or use a longer boom.' : obs.s === 'warn' ? 'The boom clears the obstacle by less than the gap you need.' : 'The boom clears the obstacle.';
      }
    }
    if (obs && obs.s !== 'info') {
      if (RANK[obs.s] >= RANK[s]) { verdict = obs.s === 'ok' ? obs.txt + ' ' + verdict : obs.txt; s = worst(s, obs.s); }
    }
    const rows = st.mode === 'inv'
      ? [['Boom angle', fmtDeg(th), th > 82 ? 'warn' : ''], ['Tip height needed', fmtQ('len', tipH)], ['Radius', fmtQ('len', R)]]
      : [['Boom tip height', fmtQ('len', tipH)], ['Boom angle', fmtDeg(th), th > 82 ? 'warn' : ''], ['Boom length', fmtQ('len', L)]];
    if (obs && isNum(obs.y)) rows.push(['Boom height over the obstacle', fmtQ('len', obs.y)], ['Clearance', fmtQ('len', obs.c), obs.s === 'ok' ? 'ok' : obs.s], ['Clearance you need', fmtQ('len', margin)]);
    const notes = [];
    if (obs && obs.s === 'info') notes.push(obs.txt);
    if (obs && isNum(obs.y)) notes.push('Clearance is measured to the centre line of the boom. Allow for half the boom depth and for boom bending.');
    if (!(a || h0)) notes.push('Boom foot offset and height are 0, so the tip height is measured from the boom foot.');
    return {
      state: 'ok', status: s,
      main: st.mode === 'inv' ? mv('Boom length needed', 'len', L) : mv('Working radius', 'len', R),
      verdict, rows, notes,
      lines: st.mode === 'inv'
        ? [`Boom length needed ${fmtQ('len', L)} at ${fmtDeg(th)} for ${fmtQ('len', R)} radius`, `Tip height needed ${fmtQ('len', tipH)}`].concat(obs && isNum(obs.y) ? [`Clearance over obstacle ${fmtQ('len', obs.c)}`] : [])
        : [`Radius ${fmtQ('len', R)} with ${fmtQ('len', L)} boom at ${fmtDeg(th)}`, `Boom tip height ${fmtQ('len', tipH)}`].concat(obs && isNum(obs.y) ? [`Clearance over obstacle ${fmtQ('len', obs.c)}`] : []),
      fig: boomSVG({ R, L, th, a, h0, tipH, mode: st.mode, setH: st.setH, loadH: st.loadH, rigH: st.rigH, od: st.od, oh: st.oh, obs, aria: `Boom at ${fmtDeg(th)}, radius ${fmtQ('len', R)}` })
    };
  }
};

/* ===================== 5. Ground bearing ===================== */
const SOILS = [
  ['Loose or soft ground', [['fill', 'Made ground or loose fill', 0, 'test first'], ['peat', 'Mud, peat or marsh', 0, 'not suitable'], ['clay0', 'Clay, mushy', 0, 'not suitable'], ['clay1', 'Clay, soft', 40]]],
  ['Sand and gravel, compacted', [['sand', 'Fine to medium sand', 150], ['gravel', 'Coarse sand to gravel', 200]]],
  ['Clay, firm or harder', [['clay2', 'Clay, firm', 100], ['clay3', 'Clay, semi-solid', 200], ['clay4', 'Clay, hard', 300]]],
  ['Rock and paving', [['asphalt', 'Asphalt on a firm base', 200], ['rockw', 'Rock, weathered', 100], ['rockl', 'Rock, sound, layered', 1500], ['rockm', 'Rock, sound, massive', 3000]]]
];
const SOIL = {};
SOILS.forEach(g => g[1].forEach(s => { SOIL[s[0]] = { n: s[1], kpa: s[2], note: s[3] }; }));
function soilOpts() {
  return [['', 'Choose the ground type']].concat(SOILS.map(g => ['__g', g[0], g[1].map(s => [s[0], `${T(s[1])} (${s[2] > 0 ? fmtQ('press', s[2], S.units === 'imperial' ? 0 : 1) : T(s[3])})`])])).concat([['custom', 'Known value from a ground survey']]);
}
function pressAlt(kpa) { return S.units === 'imperial' ? withUnit(fmtN(kpa / 6.894757293, 1), 'psi') : withUnit(fmtN(kpa, 0), 'kN/m\u00b2'); }
function matSVG(o) {
  const dims = [];
  if (o.shape === 'round') { if (isNum(o.aD)) dims.push(o.aD); if (isNum(o.nD)) dims.push(o.nD); }
  else { if (isNum(o.aL)) dims.push(o.aL, o.aW); if (isNum(o.nS)) dims.push(o.nS); }
  const m = Math.max.apply(null, dims.concat([0.1]));
  const k = 116 / m, cx = 160, cy = 70;
  let g = '';
  if (o.shape === 'round') {
    if (isNum(o.aD)) g += `<circle class="d-mat" cx="${cx}" cy="${cy}" r="${F1(o.aD * k / 2)}"/>`;
    if (isNum(o.nD)) g += `<circle class="d-need" data-s="${o.s}" cx="${cx}" cy="${cy}" r="${F1(o.nD * k / 2)}"/>`;
  } else {
    if (isNum(o.aL)) g += `<rect class="d-mat" x="${F1(cx - o.aL * k / 2)}" y="${F1(cy - o.aW * k / 2)}" width="${F1(o.aL * k)}" height="${F1(o.aW * k)}" rx="3"/>`;
    if (isNum(o.nS)) g += `<rect class="d-need" data-s="${o.s}" x="${F1(cx - o.nS * k / 2)}" y="${F1(cy - o.nS * k / 2)}" width="${F1(o.nS * k)}" height="${F1(o.nS * k)}"/>`;
  }
  g += `<circle class="d-float" cx="${cx}" cy="${cy}" r="${F1(clamp(0.25 * k, 5, 26))}"/>`;
  let y = 150;
  if (o.actualTxt) { g += `<rect class="d-mat" x="20" y="${y - 10}" width="18" height="12" rx="2"/>` + tx(46, y, o.actualTxt, 'd-strong', 'start'); y += 22; }
  if (o.needTxt) g += `<rect class="d-need" data-s="${o.s}" x="20" y="${y - 10}" width="18" height="12"/>` + tx(46, y, o.needTxt, 'd-strong', 'start');
  return `<svg class="dia" viewBox="0 0 320 ${o.actualTxt && o.needTxt ? 182 : 162}" role="img" aria-label="${esc(T(o.aria))}">${g}</svg><figcaption>${esc(T('Plan view of one outrigger mat, to scale. The dashed outline is the smallest mat that works.'))}</figcaption>`;
}
const gOut = st => st.type === 'out';
TOOLS.ground = {
  id: 'ground', icon: 'ground', title: 'Ground bearing', short: 'Outrigger and crawler pressure, and mat size',
  lede: 'Check the ground can take the outrigger or track load, and size the mats.',
  mainLabel: 'Ground pressure',
  keepOnClear: ['type'],
  defaults: { type: 'out', meth: 'est', crane: null, gload: null, fac: 0.75, P: null, tl: null, tw: null, pad: 'rect', pL: null, pW: null, pD: null, soil: '', allow: null },
  example(st) {
    if (st.type === 'crawler') return { opts: { type: 'crawler', soil: 'gravel' }, vals: { crane: 120000, gload: 20000, tl: 6.5, tw: 0.9 } };
    return { opts: { type: 'out', meth: 'est', fac: 0.75, pad: 'rect', soil: 'gravel' }, vals: { crane: 48000, gload: 8700, pL: 1.8, pW: 1.8 } };
  },
  tips: [
    'Ground values here are typical figures used in crane manuals (DIN 1054). Fill, trenches, pipes, voids and wet ground can be much weaker.',
    'Keep outrigger mats away from excavation edges, drains and basement walls.'
  ],
  fields: [
    { t: 'seg', k: 'type', label: 'Crane stands on', opts: [['out', 'Outriggers'], ['crawler', 'Crawler tracks']] },
    { t: 'seg', k: 'meth', label: 'Outrigger load', opts: [['est', 'Estimate it'], ['known', 'I know it']], show: gOut },
    { t: 'num', k: 'crane', kind: 'mass', label: 'Crane weight', show: st => st.type === 'crawler' || st.meth === 'est', hint: 'Total weight as rigged, with counterweight.' },
    { t: 'num', k: 'gload', kind: 'mass', label: 'Gross load', show: st => st.type === 'crawler' || st.meth === 'est', hint: 'Load + rigging + hook block.' },
    { t: 'seg', k: 'fac', label: 'Share on the most loaded outrigger', opts: [[0.75, '75% (common rule)'], [0.65, '65% (QLD code)']], show: st => gOut(st) && st.meth === 'est', hint: 'A rule of thumb only. The crane maker\u2019s outrigger load data is better.' },
    { t: 'num', k: 'P', kind: 'mass', label: 'Outrigger load', show: st => gOut(st) && st.meth === 'known', hint: 'From the crane\u2019s outrigger load chart or app.' },
    { t: 'row', show: st => st.type === 'crawler', fields: [{ t: 'num', k: 'tl', kind: 'len', label: 'Track length on ground' }, { t: 'num', k: 'tw', kind: 'len', label: 'Track shoe width' }] },
    { t: 'seg', k: 'pad', label: 'Mat shape', opts: [['rect', 'Square or rectangle'], ['round', 'Round']], show: gOut },
    { t: 'row', show: st => gOut(st) && st.pad === 'rect', fields: [{ t: 'num', k: 'pL', kind: 'len', label: 'Mat length' }, { t: 'num', k: 'pW', kind: 'len', label: 'Mat width' }] },
    { t: 'num', k: 'pD', kind: 'len', label: 'Mat diameter', show: st => gOut(st) && st.pad === 'round' },
    { t: 'note', show: gOut, html: 'Leave the mat size blank to find the size you need.' },
    { t: 'sel', k: 'soil', label: 'Ground type', opts: soilOpts },
    { t: 'num', k: 'allow', kind: 'press', label: 'Allowable ground pressure', show: st => st.soil === 'custom', hint: 'From a ground survey or an engineer.' }
  ],
  calc(st) {
    const soil = SOIL[st.soil];
    const allow = st.soil === 'custom' ? (isNum(st.allow) ? st.allow : null) : (soil ? soil.kpa : null);
    const soilName = st.soil === 'custom' ? T('from survey') : (soil ? T(soil.n) : '');
    const rows = [], lines = [];
    let F, A = null, P = null, crawler = st.type === 'crawler';
    if (crawler) {
      if (!all(st.crane, st.gload)) return empty('Enter the crane weight and the gross load.');
      if (!all(st.tl, st.tw)) return empty('Enter the track length and the shoe width.');
      if (st.tl <= 0 || st.tw <= 0) return fail('Track sizes must be more than zero.');
      const tot = st.crane + st.gload;
      F = tot * G / 1000; A = 2 * st.tl * st.tw;
      rows.push(['Total weight', fmtQ('mass', tot)], ['Track contact area', fmtQ('area', A)]);
      lines.push(`Crawler: ${fmtQ('mass', tot)} on ${fmtQ('area', A)} of track`);
    } else {
      if (st.meth === 'known') { if (!isNum(st.P)) return empty('Enter the outrigger load.'); P = st.P; }
      else { if (!all(st.crane, st.gload)) return empty('Enter the crane weight and the gross load.'); P = st.fac * (st.crane + st.gload); }
      if (!(P > 0)) return fail('The outrigger load must be more than zero.');
      F = P * G / 1000;
      if (st.pad === 'round') { if (isNum(st.pD)) A = Math.PI / 4 * st.pD * st.pD; }
      else if (all(st.pL, st.pW)) A = st.pL * st.pW;
      if (A != null && A <= 0) return fail('Mat size must be more than zero.');
      rows.push(['Outrigger load', fmtQ('mass', P) + (st.meth === 'est' ? ` (${fmtN(st.fac * 100, 0)}%)` : '')]);
      lines.push(`Outrigger load ${fmtQ('mass', P)}${st.meth === 'est' ? ` (${fmtN(st.fac * 100, 0)}% of crane + load)` : ''}`);
      if (A != null) rows.push(['Mat area', fmtQ('area', A)]);
    }
    const reqA = isNum(allow) && allow > 0 ? F / allow : null;
    const nS = reqA != null ? Math.sqrt(reqA) : null, nD = reqA != null ? Math.sqrt(4 * reqA / Math.PI) : null;
    const allowTxt = isNum(allow) ? (allow > 0 ? `${fmtQ('press', allow)} (${soilName})` : 'Not suitable') : '';
    if (A == null) {
      if (!isNum(allow)) return empty('Enter the mat size, or choose the ground type to get the size you need.');
      if (allow <= 0) return { state: 'ok', status: 'stop', main: { label: 'Mat size needed', value: 'Test first', unit: '', text: true }, verdict: 'This ground is not safe as it is. Test it or improve it, and use engineered mats.', rows: rows.concat([['Allowable pressure', allowTxt, 'stop']]), lines: lines.concat(['Ground not suitable without testing or improvement']) };
      rows.push(['Allowable pressure', allowTxt], ['Mat area needed', fmtQ('area', reqA)], ['Square mat, each side', fmtQ('len', nS)], ['Round mat diameter', fmtQ('len', nD)]);
      lines.push(`Ground ${allowTxt}`, `Mats needed: at least ${fmtQ('len', nS)} square (${fmtQ('area', reqA)}) under each outrigger`);
      return {
        state: 'ok', status: 'info', main: mv('Square mat, each side', 'len', nS), verdict: 'Use mats at least this big under every outrigger.', rows, lines,
        fig: matSVG({ shape: st.pad, nS, nD, s: 'info', needTxt: st.pad === 'round' ? 'Needed: ' + fmtQ('len', nD) + ' diameter' : 'Needed: ' + fmtQ('len', nS) + ' square', aria: 'Mat size needed' })
      };
    }
    const p = F / A;
    rows.push([S.units === 'imperial' ? 'Pressure in psi' : 'Pressure in kN/m\u00b2', pressAlt(p)]);
    let s = 'info', verdict = 'Choose the ground type to check this pressure.', u = null;
    if (isNum(allow)) {
      rows.push(['Allowable pressure', allowTxt, allow > 0 ? '' : 'stop']);
      if (allow <= 0) { s = 'stop'; verdict = 'This ground is not safe as it is. Test it or improve it, and use engineered mats.'; }
      else {
        u = p / allow * 100;
        s = u > 100 ? 'stop' : u > 80 ? 'warn' : 'ok';
        verdict = s === 'stop' ? 'Ground overloaded. Use bigger mats or improve the ground.' : s === 'warn' ? 'Close to the limit. Bigger mats are safer.' : 'The ground can take this load.';
        rows.push(['Ground used', fmtPct(u, 0), s === 'ok' ? 'ok' : s]);
        if (!crawler) rows.push(['Mat area needed', fmtQ('area', reqA)], [st.pad === 'round' ? 'Smallest round mat' : 'Smallest square mat', st.pad === 'round' ? fmtQ('len', nD) + ' diameter' : fmtQ('len', nS) + ' square']);
      }
    }
    lines.push(`Pressure ${fmtQ('press', p)} (${pressAlt(p)})${isNum(allow) && allow > 0 ? ` vs ${fmtQ('press', allow)} allowed, ${fmtPct(u, 0)} used` : ''}`);
    const notes = [];
    if (crawler) notes.push('This is the average pressure. Under the track nearest the load it can be twice as high or more. Use the crane maker\u2019s ground pressure data for the lift.');
    let fig;
    if (crawler) fig = isNum(allow) && allow > 0 ? barSVG({ val: p, lim: allow, valLabel: fmtQ('press', p), limLabel: 'Allowed ' + fmtQ('press', allow), aria: 'Track pressure compared with the allowed pressure' }) : '';
    else fig = matSVG({ shape: st.pad, aL: st.pL, aW: st.pW, aD: st.pD, nS, nD, s, actualTxt: st.pad === 'round' ? 'Your mat: ' + fmtQ('len', st.pD) + ' diameter' : 'Your mat: ' + fmtN(fromSI('len', st.pL)) + ' \u00d7 ' + fmtQ('len', st.pW), needTxt: reqA != null ? (st.pad === 'round' ? 'Needed: ' + fmtQ('len', nD) + ' diameter' : 'Needed: ' + fmtQ('len', nS) + ' square') : '', aria: 'Mat size compared with the size needed' });
    return { state: 'ok', status: s, main: mv(crawler ? 'Average track pressure' : 'Ground pressure', 'press', p), verdict, rows, notes, lines, fig: fig || null };
  }
};

/* ===================== 6. Wind ===================== */
const BF = [[0.5, 'Calm'], [1.6, 'Light air'], [3.4, 'Light breeze'], [5.5, 'Gentle breeze'], [8.0, 'Moderate breeze'], [10.8, 'Fresh breeze'], [13.9, 'Strong breeze'], [17.2, 'Near gale'], [20.8, 'Gale'], [24.5, 'Strong gale'], [28.5, 'Storm'], [32.7, 'Violent storm']];
function beaufort(v) { for (let i = 0; i < BF.length; i++) if (v < BF[i][0]) return { n: i, name: BF[i][1] }; return { n: 12, name: 'Hurricane' }; }
TOOLS.wind = {
  id: 'wind', icon: 'wind', title: 'Wind check', short: 'Wind limit for the lift, and big-area loads',
  lede: 'Compare the wind with the chart limit. Large, light loads get a lower limit.',
  mainLabel: 'Wind at the boom tip',
  keepOnClear: ['at'],
  defaults: { v: null, at: 'tip', tipH: null, lim: null, A: null, m: null, cw: 1.2 },
  example: { opts: { at: 'tip' }, vals: { v: 7.5, lim: 9, A: 12, m: 3000, cw: 1.2 } },
  tips: [
    'Use the 3-second gust speed, not the average speed.',
    'Wind is stronger higher up. An anemometer on the boom tip gives the best reading.',
    'The wind limits in the crane manual always come first. Stop if gusts rise or the load starts to swing.'
  ],
  fields: [
    { t: 'seg', k: 'windUnit', global: true, label: 'Wind speed unit', opts: [['ms', 'm/s'], ['kmh', 'km/h'], ['mph', 'mph'], ['kn', 'knots']] },
    { t: 'num', k: 'v', kind: 'speed', label: 'Wind speed (gust)' },
    { t: 'seg', k: 'at', label: 'Measured', opts: [['tip', 'At the boom tip'], ['ground', 'Forecast or at 10 m']] },
    { t: 'num', k: 'tipH', kind: 'len', label: 'Boom tip height', show: st => st.at === 'ground', hint: 'The forecast is scaled up to this height.' },
    { t: 'num', k: 'lim', kind: 'speed', label: 'Wind limit in the load chart', hint: 'From the load chart or crane manual.' },
    { t: 'head', label: 'Big or light loads', note: 'Panels, cladding, blades and similar loads catch more wind. Add the size to get the limit for this load.' },
    { t: 'row', fields: [{ t: 'num', k: 'A', kind: 'area', label: 'Area facing the wind', opt: 1 }, { t: 'num', k: 'm', kind: 'mass', label: 'Load weight', opt: 1 }] },
    { t: 'note', html: 'Area is the biggest side: length \u00d7 height. Load weight includes the hook block and rigging.' },
    { t: 'num', k: 'cw', kind: 'num', label: 'Drag factor (Cw)', hint: '1.2 for flat or box-shaped loads. Use the manual\u2019s value if it gives one.' }
  ],
  calc(st) {
    if (!isNum(st.v)) return empty('Enter the wind speed.');
    let vt = st.v, scaled = false, hAssumed = false;
    if (st.at === 'ground') {
      const h = isNum(st.tipH) ? st.tipH : 10;
      hAssumed = !isNum(st.tipH);
      vt = st.v * Math.pow(Math.max(h, 10) / 10, 0.14);
      scaled = true;
    }
    const q = vt * vt / 1.6;
    const bf = beaufort(st.v);
    const cw = isNum(st.cw) && st.cw > 0 ? st.cw : 1.2;
    let vperm = isNum(st.lim) && st.lim > 0 ? st.lim : null, ratio = null, Fw = null, swing = null;
    if (isNum(st.A) && st.A > 0) Fw = q * st.A * cw;
    if (isNum(st.A) && st.A > 0 && isNum(st.m) && st.m > 0) {
      ratio = st.A * cw / (st.m / 1000);
      if (vperm != null && ratio > 1.2) vperm = st.lim * Math.sqrt(1.2 / ratio);
      swing = deg(Math.atan(Fw / (st.m * G)));
    }
    let s = 'info', verdict = 'Enter the chart wind limit to check this lift.', u = null;
    if (vperm != null) {
      u = vt / vperm * 100;
      s = u > 100 ? 'stop' : u > 80 ? 'warn' : 'ok';
      verdict = s === 'stop' ? 'Too windy for this lift. Do not lift.' : s === 'warn' ? 'Close to the wind limit. Watch the gusts.' : 'Wind is within the limit for this lift.';
    }
    const rows = [];
    if (scaled) rows.push(['Forecast speed at 10 m', fmtQ('speed', st.v)]);
    if (vperm != null) {
      rows.push(['Wind limit for this lift', fmtQ('speed', vperm), s === 'ok' ? '' : s]);
      if (ratio != null && ratio > 1.2) rows.push(['Chart wind limit', fmtQ('speed', st.lim)]);
      rows.push(['Limit used', fmtPct(u, 0)]);
    }
    rows.push(['Beaufort force', `${bf.n}, ${T(bf.name)}`]);
    rows.push(['Wind pressure', S.units === 'imperial' ? withUnit(fmtN(q * 0.0208854, 1), 'psf') : withUnit(fmtN(q, 0), 'N/m\u00b2')]);
    if (Fw != null) rows.push(['Wind force on the load', S.units === 'imperial' ? withUnit(fmtN(Fw * 0.2248089, 0), 'lbf') : `${withUnit(fmtN(Fw / 1000, 2), 'kN')} (${withUnit(fmtN(Fw / G / 1000, 2), 't')})`]);
    if (swing != null) rows.push(['Load swing from the wind', fmtDeg(swing)]);
    if (ratio != null) rows.push(['Wind area per tonne', withUnit(fmtN(ratio, 2), 'm\u00b2/t') + ' (chart assumes 1.2)', ratio > 1.2 ? 'warn' : '']);
    const notes = [];
    if (ratio != null && ratio > 1.2) notes.push('This load catches more wind than the chart assumes (1.2 m\u00b2 per tonne), so the wind limit for it is lower.');
    if (hAssumed) notes.push('Tip height not entered, so the forecast is used as it is. Enter the tip height for a better figure.');
    return {
      state: 'ok', status: s, main: mv('Wind at the boom tip', 'speed', vt, 1), verdict, rows, notes,
      lines: [`Wind ${fmtQ('speed', vt, 1)} at the boom tip${vperm != null ? `, limit for this lift ${fmtQ('speed', vperm, 1)}` : ''}`].concat(ratio != null ? [`Load area ${fmtQ('area', st.A)}, ${withUnit(fmtN(ratio, 2), 'm\u00b2/t')}`] : []),
      fig: vperm != null ? barSVG({ val: vt, lim: vperm, valLabel: 'Now ' + fmtQ('speed', vt, 1), limLabel: 'Limit ' + fmtQ('speed', vperm, 1), marks: ratio != null && ratio > 1.2 ? [{ v: st.lim, label: 'Chart ' + fmtQ('speed', st.lim, 1) }] : [], aria: 'Wind speed compared with the limit' }) : null
    };
  }
};

/* ===================== 7. Centre of gravity and load share ===================== */
function cgAuto(st) {
  const items = (st.items || []).filter(it => isNum(it.w) && it.w > 0 && isNum(it.x));
  if (!items.length) return { W: null, items: [] };
  const W = items.reduce((s, it) => s + it.w, 0);
  const xg = items.reduce((s, it) => s + it.w * it.x, 0) / W;
  let yg = null;
  if (st.useY && items.every(it => isNum(it.y))) yg = items.reduce((s, it) => s + it.w * it.y, 0) / W;
  return { W, xg, yg, n: items.length, items };
}
function cgSVG(o) {
  const xs = o.items.map(i => i.x).concat([o.xg, 0]);
  if (isNum(o.D)) xs.push(o.D);
  let lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
  if (hi - lo < 0.5) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const k = 280 / (hi - lo), X = x => 20 + (x - lo) * k, by = 112;
  let g = '';
  const lp = [[0, 'A']];
  if (isNum(o.D)) lp.push([o.D, 'B']);
  lp.forEach(p => { g += `<line class="d-lift" x1="${F1(X(p[0]))}" y1="${by}" x2="${F1(X(p[0]))}" y2="22"/><path class="d-lift-h" d="M${F1(X(p[0]))} 12l-6 10h12z"/>` + tx(X(p[0]) + 9, 30, p[1], 'd-strong', 'start'); });
  g += `<line class="d-beam" x1="${F1(X(lo + pad * 0.5))}" y1="${by}" x2="${F1(X(hi - pad * 0.5))}" y2="${by}"/>`;
  const wmax = Math.max.apply(null, o.items.map(i => i.w).concat([1e-9]));
  o.items.forEach((it, i) => {
    const sc = Math.sqrt(it.w / wmax), h = 14 + 44 * sc, w = 16 + 14 * sc;
    g += `<rect class="d-item" x="${F1(X(it.x) - w / 2)}" y="${F1(by - 3 - h)}" width="${F1(w)}" height="${F1(h)}" rx="3"/>` + tx(X(it.x), by - 3 - h / 2 + 4, String(it.i + 1), 'd-num', 'middle');
  });
  const cx = X(o.xg), left = cx > 210;
  g += `<line class="d-axis" x1="${F1(cx)}" y1="${by + 3}" x2="${F1(cx)}" y2="${by + 22}"/>` + cgMark(cx, by + 32, 9);
  g += tx(cx + (left ? -16 : 16), by + 37, 'CG ' + fmtQ('len', o.xg), 'd-strong', left ? 'end' : 'start');
  return `<svg class="dia" viewBox="0 0 320 156" role="img" aria-label="${esc(T('Load items and centre of gravity'))}">${g}</svg><figcaption>${esc(T('Side view. Numbers match your item list. Lift point A is at zero.'))}</figcaption>`;
}
function cgItemsHTML(st) {
  const ex = exampleOf(TOOLS.cg, st).items || [];
  const mini = (id, i, k, kind, val, label, ph, neg) => `<div class="mfld"><label for="${id}">${esc(T(label))}<span class="vh"> (${esc(unitOf(kind))})</span></label><div class="inp inp-sm">${neg ? `<button type="button" class="sign" data-act="sign" data-target="${id}" aria-label="${esc(T('Change plus or minus'))}">\u00b1</button>` : ''}<input id="${id}" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" spellcheck="false" data-item="${i}" data-ik="${k}" data-kind="${kind}" placeholder="${esc(ph)}" value="${esc(dispVal(kind, val))}"><span class="u" aria-hidden="true">${esc(unitOf(kind))}</span></div><p class="errmsg" hidden></p></div>`;
  const rows = st.items.map((it, i) => {
    const e = ex[i] || {};
    return `<div class="cgi"><div class="cgi-top"><span class="cgi-n" aria-hidden="true">${i + 1}</span><label class="vh" for="ci-n-${i}">${esc(TF('Item {0} name', i + 1))}</label><input class="cgi-name" id="ci-n-${i}" type="text" enterkeyhint="next" autocomplete="off" maxlength="40" data-item="${i}" data-ik="n" placeholder="${esc(e.n ? T('e.g.') + ' ' + T(e.n) : TF('Item {0}', i + 1))}" value="${esc(it.n)}">${st.items.length > 1 ? `<button type="button" class="icon-btn" data-act="item-del" data-i="${i}" aria-label="${esc(TF('Remove item {0}', i + 1))}">${IC.x}</button>` : ''}</div>` +
      `<div class="cgi-vals">${mini('ci-w-' + i, i, 'w', 'mass', it.w, 'Weight', isNum(e.w) ? T('e.g.') + ' ' + exNum('mass', e.w) : '', false)}${mini('ci-x-' + i, i, 'x', 'len', it.x, 'Position x', isNum(e.x) ? T('e.g.') + ' ' + exNum('len', e.x) : '', true)}${st.useY ? mini('ci-y-' + i, i, 'y', 'len', it.y, 'Position y', '', true) : ''}</div></div>`;
  }).join('');
  return `<div class="grp grp-first"><h2>${esc(T('Load items'))}</h2><p class="hint">${esc(T('Measure every position from the same point. Use lift point A as zero to get the load share below.'))}</p></div>` +
    `<div class="cgl">${rows}</div><div class="cg-tools"><button type="button" class="btn btn-sm" data-act="item-add">${IC.plus}<span>${esc(T('Add item'))}</span></button>` +
    `<label class="chk"><input type="checkbox" data-opt="useY"${st.useY ? ' checked' : ''}><span>${esc(T('Also find the side-to-side position (y)'))}</span></label></div>`;
}
function onItemInput(el) {
  const st = S.tools.cg;
  const i = +el.getAttribute('data-item'), k = el.getAttribute('data-ik');
  const it = st.items[i]; if (!it) return;
  if (k === 'n') it.n = el.value.slice(0, 40);
  else { const r = readNum(el.value, el.getAttribute('data-kind'), k !== 'w'); it[k] = r.v; setErr(el, r.err); }
  touched('cg');
  updateResults();
}
ACTS['item-add'] = () => {
  const st = S.tools.cg;
  if (st.items.length >= 15) { toast('You can add up to 15 items.'); return; }
  st.items.push({ n: '', w: null, x: null, y: null });
  touched('cg');
  rerenderInputs('#ci-n-' + (st.items.length - 1));
  updateResults();
};
ACTS['item-del'] = el => {
  const st = S.tools.cg;
  st.items.splice(+el.getAttribute('data-i'), 1);
  if (!st.items.length) st.items.push({ n: '', w: null, x: null, y: null });
  touched('cg');
  rerenderInputs();
  updateResults();
};
TOOLS.cg = {
  id: 'cg', icon: 'cg', title: 'Centre of gravity', short: 'CG of a combined load, and the share at two lift points',
  lede: 'Find where the hook must go, and how much each lift point or crane takes.',
  mainLabel: 'Centre of gravity',
  defaults: { items: [{ n: '', w: null, x: null, y: null }, { n: '', w: null, x: null, y: null }], useY: false, D: null, W: null, a: null, capA: null, capB: null },
  example: {
    opts: {}, vals: { D: 3 },
    items: [{ n: 'Skid frame', w: 1200, x: 1.5 }, { n: 'Pump', w: 2500, x: 1 }, { n: 'Motor', w: 1800, x: 2.4 }]
  },
  tips: [
    'Tandem lifts with two cranes are always critical lifts. Keep each crane well inside its chart, because the share changes if the load tilts.',
    'If the CG is not between the lift points, the load will tip when lifted.'
  ],
  fields: [
    { t: 'custom', render: cgItemsHTML },
    { t: 'head', label: 'Load share between two lift points', note: 'For a two-point lift, or a tandem lift with two cranes. Lift point A is at zero.' },
    { t: 'num', k: 'D', kind: 'len', label: 'Distance from A to B' },
    { t: 'row', fields: [{ t: 'num', k: 'W', kind: 'mass', label: 'Total weight', opt: 1, ph: 'Blank = items' }, { t: 'num', k: 'a', kind: 'len', label: 'A to CG', opt: 1, neg: 1, ph: 'Blank = CG' }] },
    { t: 'note', html: 'Leave these blank to use the total weight and CG of the items above.' },
    { t: 'row', fields: [{ t: 'num', k: 'capA', kind: 'mass', label: 'Crane A capacity', opt: 1 }, { t: 'num', k: 'capB', kind: 'mass', label: 'Crane B capacity', opt: 1 }] },
    { t: 'note', html: 'For a tandem lift, enter each crane\u2019s chart capacity at its own radius.' }
  ],
  calc(st) {
    const cg = cgAuto(st);
    const W = isNum(st.W) ? st.W : cg.W;
    const a = isNum(st.a) ? st.a : (cg.W != null ? cg.xg : null);
    let r1 = null, r2 = null;
    const lines = [];
    if (cg.W != null) {
      const rows = [['Total weight', fmtQ('mass', cg.W)], ['Items counted', String(cg.n)]];
      if (cg.yg != null) rows.push(['CG side to side (y)', fmtQ('len', cg.yg)]);
      else if (st.useY) rows.push(['CG side to side (y)', 'Enter y for every item']);
      r1 = { state: 'ok', status: 'info', main: mv('Centre of gravity (x)', 'len', cg.xg), verdict: 'Put the hook right above this point.', rows };
      lines.push(`CG ${fmtQ('len', cg.xg)} from zero${cg.yg != null ? ', ' + fmtQ('len', cg.yg) + ' side to side' : ''}, total ${fmtQ('mass', cg.W)}`);
    }
    if (isNum(st.D) && isNum(W) && isNum(a)) {
      if (st.D <= 0) return fail('The distance from A to B must be more than zero.');
      if (W <= 0) return fail('The total weight must be more than zero.');
      const A = W * (st.D - a) / st.D, B = W * a / st.D;
      let s = 'info', v = 'Size the slings, shackles and lugs at each point for these loads.';
      const rows = [['Load at lift point B', fmtQ('mass', B)], ['Share A / B', shareTxt(A, W)], ['Total weight', fmtQ('mass', W)], ['A to CG', fmtQ('len', a)]];
      let ln = `Lift point A ${fmtQ('mass', A)}, B ${fmtQ('mass', B)} (A to B ${fmtQ('len', st.D)})`;
      if (a < 0 || a > st.D) { s = 'stop'; v = 'The CG is outside the lift points. The load will tip. Move the lift points.'; }
      else {
        const pA = isNum(st.capA) && st.capA > 0 ? A / st.capA * 100 : null, pB = isNum(st.capB) && st.capB > 0 ? B / st.capB * 100 : null;
        if (pA != null || pB != null) {
          const sA = pA != null ? capStatus(pA) : 'info', sB = pB != null ? capStatus(pB) : 'info';
          if (pA != null) rows.push(['Crane A uses', fmtPct(pA), sA === 'ok' ? '' : sA]);
          if (pB != null) rows.push(['Crane B uses', fmtPct(pB), sB === 'ok' ? '' : sB]);
          s = worst(sA, sB, 'warn');
          v = s === 'stop' ? 'A crane is overloaded. Do not lift.' : s === 'bad' ? 'Over 90% on a crane. Engineered lift with senior approval.' : 'Tandem lift. Treat it as a critical lift.';
          ln += `; crane A ${pA != null ? fmtPct(pA) : '\u2014'}, crane B ${pB != null ? fmtPct(pB) : '\u2014'} of chart`;
        }
      }
      r2 = { state: 'ok', status: s, main: mv('Load at lift point A', 'mass', A), verdict: v, rows };
      lines.push(ln);
    }
    if (!r1 && !r2) return empty('Enter the weight and position of each item, or fill in the load share.');
    let main = r1 || r2, other = r1 && r2 ? r2 : null;
    if (r1 && r2 && RANK[r2.status] >= RANK.warn) { main = r2; other = r1; }
    const figItems = cg.items.map(it => ({ w: it.w, x: it.x, i: st.items.indexOf(it) }));
    return Object.assign({}, main, {
      more: other ? [other] : [], lines,
      fig: cgSVG({ items: figItems, xg: cg.W != null ? cg.xg : a, D: st.D })
    });
  }
};

/* ===================== 8. Parts of line ===================== */
function reevSVG(n) {
  const m = Math.min(n, 12), gap = 12, w = Math.max(56, (m - 1) * gap + 28), x0 = 160 - w / 2;
  let g = `<rect class="d-block" x="${F1(x0)}" y="14" width="${F1(w)}" height="22" rx="4"/>`;
  const xs = [];
  for (let i = 0; i < m; i++) xs.push(160 - (m - 1) * gap / 2 + i * gap);
  xs.forEach(x => { g += `<line class="d-rope" x1="${F1(x)}" y1="36" x2="${F1(x)}" y2="112"/>`; });
  g += `<line class="d-rope" x1="${F1(xs[xs.length - 1])}" y1="14" x2="${F1(xs[xs.length - 1] + 40)}" y2="2"/>`;
  g += `<rect class="d-block" x="${F1(x0)}" y="112" width="${F1(w)}" height="22" rx="4"/>`;
  g += '<path class="d-hookp" d="M160 134v9a7 7 0 1 1-7-7"/>';
  g += tx(x0 + w + 12, 78, `${n} part${n === 1 ? '' : 's'}`, 'd-strong', 'start');
  return `<svg class="dia" viewBox="0 0 320 160" role="img" aria-label="${esc(TF('{0} parts of line', n))}">${g}</svg>`;
}
TOOLS.reev = {
  id: 'reev', icon: 'reev', title: 'Parts of line', short: 'Reeving needed for the load',
  lede: 'Find how many parts of hoist rope the load needs.',
  mainLabel: 'Parts of line needed',
  defaults: { W: null, P: null, blk: null },
  example: { opts: {}, vals: { W: 20500, P: 5400, blk: 40000 } },
  tips: [
    'Use the reeving table in the load chart when there is one. Some cranes lose capacity to sheave friction.',
    'Make sure there is enough rope on the drum for this many parts at the working height.'
  ],
  fields: [
    { t: 'num', k: 'W', kind: 'mass', label: 'Gross load', hint: 'Load + rigging + hook block' },
    { t: 'num', k: 'P', kind: 'mass', label: 'Line pull per part', hint: 'Permitted line pull from the load chart' },
    { t: 'num', k: 'blk', kind: 'mass', label: 'Hook block capacity', opt: 1 }
  ],
  calc(st) {
    if (!all(st.W, st.P)) return empty('Enter the gross load and the line pull per part.');
    if (st.W <= 0 || st.P <= 0) return fail('Values must be more than zero.');
    const n = Math.max(1, Math.ceil(st.W / st.P - 1e-9));
    const capN = n * st.P;
    let s = 'ok', verdict = `Reeve at least ${n} part${n === 1 ? '' : 's'} of line.`;
    const rows = [['Hoist capacity with ' + n + (n === 1 ? ' part' : ' parts'), fmtQ('mass', capN)], ['Spare', fmtQ('mass', capN - st.W)], ['Pull on each part', fmtQ('mass', st.W / n)]];
    if (isNum(st.blk) && st.blk > 0) {
      const ok = st.W <= st.blk;
      rows.push(['Hook block capacity', fmtQ('mass', st.blk), ok ? '' : 'stop']);
      if (!ok) { s = 'stop'; verdict = 'The hook block is too small for this load. Use a bigger block.'; }
    }
    const tr = [];
    for (let p = Math.max(1, n - 1); p <= n + 2; p++) tr.push(`<tr${p === n ? ' class="hi"' : ''}><td>${p}</td><td class="num">${fmtQ('mass', p * st.P)}</td><td class="num">${fmtQ('mass', st.W / p)}</td></tr>`);
    return {
      state: 'ok', status: s, main: { label: 'Parts of line needed', value: String(n), unit: n === 1 ? 'part' : 'parts' }, verdict, rows,
      lines: [`${n} parts of line for ${fmtQ('mass', st.W)} at ${fmtQ('mass', st.P)} line pull`, `Hoist capacity ${fmtQ('mass', capN)}`],
      fig: reevSVG(n) + `<div class="tblw"><table class="tbl"><thead><tr><th>${esc(T('Parts'))}</th><th class="num">${esc(T('Hoist capacity'))}</th><th class="num">${esc(T('Pull per part'))}</th></tr></thead><tbody>${tr.join('')}</tbody></table></div>`
    };
  }
};

/* ===================== 9. Unit converter ===================== */
const CONV = {
  mass: { n: 'Weight', def: ['t', 'lb'], u: [['kg', 'kg', 1, 'm', 'kilogram (kg)'], ['t', 't', 1000, 'm', 'tonne (t)'], ['lb', 'lb', 0.45359237, 'i', 'pound (lb)'], ['ust', 'US tons', 907.18474, 'i', 'US ton (2,000 lb)'], ['lt', 'long tons', 1016.0469088, 'i', 'long ton (2,240 lb)'], ['kip', 'kip', 453.59237, 'i', 'kip (1,000 lb)']] },
  len: { n: 'Length', def: ['m', 'ft'], u: [['mm', 'mm', 0.001, 'm', 'millimetre (mm)'], ['cm', 'cm', 0.01, 'm', 'centimetre (cm)'], ['m', 'm', 1, 'm', 'metre (m)'], ['in', 'in', 0.0254, 'i', 'inch (in)'], ['ft', 'ft', 0.3048, 'i', 'foot (ft)'], ['yd', 'yd', 0.9144, 'i', 'yard (yd)']] },
  area: { n: 'Area', def: ['m2', 'ft2'], u: [['m2', 'm\u00b2', 1, 'm', 'square metre (m\u00b2)'], ['cm2', 'cm\u00b2', 1e-4, 'm', 'square cm (cm\u00b2)'], ['ft2', 'ft\u00b2', 0.09290304, 'i', 'square foot (ft\u00b2)'], ['in2', 'in\u00b2', 0.00064516, 'i', 'square inch (in\u00b2)']] },
  press: { n: 'Pressure', def: ['tm2', 'psf'], u: [['kpa', 'kPa', 1000, 'm', 'kPa (kN/m\u00b2)'], ['mpa', 'MPa', 1e6, 'm', 'MPa (N/mm\u00b2)'], ['tm2', 't/m\u00b2', 9806.65, 'm', 'tonne per m\u00b2'], ['kgcm2', 'kg/cm\u00b2', 98066.5, 'm', 'kg per cm\u00b2'], ['bar', 'bar', 1e5, 'm', 'bar'], ['psi', 'psi', 6894.757293, 'i', 'psi (lb/in\u00b2)'], ['psf', 'psf', 47.88025898, 'i', 'psf (lb/ft\u00b2)'], ['tsf', 'US tons/ft\u00b2', 95760.51796, 'i', 'US ton per ft\u00b2']] },
  force: { n: 'Force', def: ['kN', 'lbf'], u: [['N', 'N', 1, 'm', 'newton (N)'], ['kN', 'kN', 1000, 'm', 'kilonewton (kN)'], ['kgf', 'kgf', 9.80665, 'm', 'kilogram-force (kgf)'], ['tf', 'tf', 9806.65, 'm', 'tonne-force (tf)'], ['lbf', 'lbf', 4.4482216153, 'i', 'pound-force (lbf)'], ['kipf', 'kip', 4448.2216153, 'i', 'kip-force']] },
  speed: { n: 'Speed', def: ['ms', 'mph'], u: [['ms', 'm/s', 1, 'm', 'metres per second'], ['kmh', 'km/h', 1 / 3.6, 'm', 'km per hour'], ['mph', 'mph', 0.44704, 'i', 'miles per hour'], ['kt', 'knots', 0.514444, 'i', 'knots'], ['fpm', 'ft/min', 0.00508, 'i', 'feet per minute']] },
  vol: { n: 'Volume', def: ['m3', 'ft3'], u: [['l', 'litres', 0.001, 'm', 'litre (L)'], ['m3', 'm\u00b3', 1, 'm', 'cubic metre (m\u00b3)'], ['ft3', 'ft\u00b3', 0.028316846592, 'i', 'cubic foot (ft\u00b3)'], ['usgal', 'US gal', 0.003785411784, 'i', 'US gallon'], ['ukgal', 'UK gal', 0.00454609, 'i', 'UK gallon']] }
};
TOOLS.conv = {
  id: 'conv', icon: 'conv', title: 'Unit converter', short: 't, lb, kN, kPa, psi, m/s and more',
  lede: 'Convert the units you meet on load charts, tags and drawings.',
  mainLabel: 'Converted', noPlan: true, noUnits: true,
  keepOnClear: ['cat', 'from'],
  defaults: { cat: 'mass', from: 't', val: null },
  example: st => ({ opts: { cat: st.cat, from: st.from }, vals: { val: 12.5 } }),
  fields: [
    { t: 'tiles', k: 'cat', label: 'Convert', cls: 'tiles-txt', opts: Object.keys(CONV).map(k => [k, CONV[k].n]), set: st => { st.from = CONV[st.cat].def[S.units === 'imperial' ? 1 : 0]; } },
    { t: 'num', k: 'val', kind: 'num', label: 'Value', neg: 1, ph: 'e.g. 12.5' },
    { t: 'sel', k: 'from', label: 'From', opts: st => (CONV[st.cat] || CONV.mass).u.map(u => [u[0], T(u[4])]) }
  ],
  calc(st) {
    const C = CONV[st.cat];
    if (!C) return empty('Choose what to convert.');
    if (!isNum(st.val)) return empty('Enter a value to convert.');
    const fu = C.u.filter(u => u[0] === st.from)[0] || C.u[0];
    const base = st.val * fu[2];
    const others = C.u.filter(u => u[0] !== fu[0]);
    const mainU = others.filter(u => u[3] !== fu[3])[0] || others[0];
    return {
      state: 'ok', status: 'info',
      main: { label: TF('{0} {1} is', fmtSig(st.val), T(fu[1])), value: fmtSig(base / mainU[2]), unit: mainU[1] }, verdict: '', short: '',
      rows: others.filter(u => u !== mainU).map(u => [u[4], withUnit(fmtSig(base / u[2]), T(u[1]))])
    };
  }
};
