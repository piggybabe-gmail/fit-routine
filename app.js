// Fit Routine by Beer — v2 (GitHub Pages + Firebase)
import { firebaseConfig } from './firebase-config.js';
import { MEALS, TH_DOW, TH_M, FOODS, FOOD, EX, GOALS, PRESETS, LIB_RECIPES, SYN, CIRC, WORKOUT_TYPES, defaultProfileDoc, defaultPlan } from './data.js';

const FBV = 'https://www.gstatic.com/firebasejs/10.12.2/';
let fb = null, db = null, auth = null;

/* ============ helpers ============ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r0 = n => Math.round(+n || 0);
const r1 = n => Math.round((+n || 0) * 10) / 10;
const fmt = n => r0(n).toLocaleString('en-US');
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(v); return isFinite(n) ? n : null; };
const pad = n => String(n).padStart(2, '0');
const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayStr = () => dstr(new Date());
const parseD = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (ds, n) => { const d = parseD(ds); d.setDate(d.getDate() + n); return dstr(d); };
const dowOf = ds => parseD(ds).getDay();
const thDate = ds => { const d = parseD(ds); return `${TH_DOW[d.getDay()]} ${d.getDate()} ${TH_M[d.getMonth()]}`; };
const thShort = ds => { const d = parseD(ds); return `${d.getDate()} ${TH_M[d.getMonth()]} ${String(d.getFullYear() + 543).slice(2)}`; };
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const r10 = x => Math.round(x / 10) * 10;
const normName = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const nowHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
const L_ = ml => (Math.round(ml / 100) / 10).toFixed(1);
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2600); }
function timeAgo(ms) { const s = (Date.now() - ms) / 1000; if (s < 60) return 'เมื่อสักครู่'; if (s < 3600) return r0(s / 60) + ' นาทีที่แล้ว'; if (s < 86400) return r0(s / 3600) + ' ชม.ที่แล้ว'; const d = new Date(ms); return `${d.getDate()} ${TH_M[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }

/* ============ state ============ */
const S = { me: null, profileDoc: null, plan: null, days: {}, recipes: {}, pantry: {}, workouts: {}, activity: [], config: {}, members: {}, devices: {}, photoCache: {}, ready: {} };
const ui = { tab: 'today', date: todayStr(), fsMeal: 'เช้า', menuSeed: 0, menuType: 'train', bookMeal: 'all', pantry: '', measUnit: 'cm', setTab: 'targets', wo: null, progEx: '', protPlans: [], pasted: null };
try { const h = location.hash.replace('#', ''); if (['today', 'train', 'kitchen', 'body', 'overview', 'settings'].includes(h)) ui.tab = h; } catch (e) { }

const isOwner = () => S.me?.role === 'owner';
const isTrainer = () => S.me?.role === 'owner' || S.me?.role === 'trainer';
const ROLE_TH = { owner: 'เจ้าของ', trainer: 'เทรนเนอร์', viewer: 'ผู้ติดตาม' };
const P = () => S.profileDoc?.profile || defaultProfileDoc().profile;
const T = () => S.profileDoc?.targets || defaultProfileDoc().targets;
const MS = () => S.profileDoc?.measurements || [];
const PLAN = () => S.plan || defaultPlan();

/* ============ firestore write helpers ============ */
const pending = new Set(), timers = {};
const ref = path => fb.doc(db, ...path.split('/'));
function writeErr(e) { console.error(e); toast(e && e.code === 'permission-denied' ? 'คุณไม่มีสิทธิ์แก้ข้อมูลส่วนนี้' : 'บันทึกไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'); }
async function put(path, data) { try { await fb.setDoc(ref(path), clone(data)); } catch (e) { writeErr(e); throw e; } }
async function del(path) { try { await fb.deleteDoc(ref(path)); } catch (e) { writeErr(e); } }
function later(key, path, getData, delay = 600) {
  pending.add(key); clearTimeout(timers[key]);
  timers[key] = setTimeout(async () => { try { await put(path, getData()); } catch (e) { } finally { pending.delete(key); } }, delay);
}
function saveProfile() { if (!S.profileDoc) S.profileDoc = defaultProfileDoc(); later('profile', 'profile/main', () => S.profileDoc); }
function savePlan() { if (!S.plan) S.plan = defaultPlan(); later('plan', 'plan/main', () => S.plan); }
function saveDay(ds) { later('day:' + ds, 'days/' + ds, () => ({ ...emptyDay(), ...(S.days[ds] || {}), date: ds })); }
function mut(fn, { day, prof, plan } = {}) { fn(); if (day) saveDay(day); if (prof) saveProfile(); if (plan) savePlan(); render(); }

/* ============ activity + LINE ============ */
const lineQ = [];
function queueLine(text) {
  const c = S.config || {};
  if (!c.lineOn || !c.lineUrl || !c.lineSecret) return;
  lineQ.push(text); clearTimeout(queueLine._t);
  queueLine._t = setTimeout(flushLine, 45000);
}
function flushLine(beacon) {
  if (!lineQ.length) return;
  const c = S.config || {};
  const text = `Fit Routine · อัปเดต\n` + lineQ.splice(0).join('\n') + `\n${location.origin}${location.pathname}`;
  const body = JSON.stringify({ secret: c.lineSecret, text });
  try {
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(c.lineUrl, new Blob([body], { type: 'text/plain' }));
    else fetch(c.lineUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body });
  } catch (e) { }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(queueLine._t); flushLine(true); } });
async function logAct(type, text, { line = true } = {}) {
  if (!S.me) return;
  const id = 'a-' + Date.now().toString(36) + newId();
  const icon = { food: '🍽', train: '🏋️', body: '📏', msg: '💬', water: '💧', ex: '🏊', recipe: '📖', pantry: '🧺' }[type] || '•';
  try { await fb.setDoc(ref('activity/' + id), { at: Date.now(), type, text, byName: S.me.name, byRole: S.me.role, byUid: S.me.uid }); } catch (e) { console.warn(e); }
  if (line) queueLine(`${icon} ${S.me.name}: ${text}`);
}
function sendLineNow(text) {
  const c = S.config || {};
  if (!c.lineUrl || !c.lineSecret) { toast('ยังไม่ได้ตั้งค่า LINE ในหน้าตั้งค่า'); return false; }
  fetch(c.lineUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ secret: c.lineSecret, text }) }).catch(() => { });
  return true;
}

/* ============ photos ============ */
function loadImage(file) { return new Promise((res, rej) => { const url = URL.createObjectURL(file); const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; }); }
async function compress(file) {
  const im = await loadImage(file);
  let max = 900, q = 0.62, out = '';
  for (let i = 0; i < 4; i++) {
    const sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    out = c.toDataURL('image/jpeg', q);
    if (out.length < 450000) break;
    max = Math.round(max * 0.8); q = Math.max(0.4, q - 0.08);
  }
  return out;
}
async function addPhoto(file, meta) {
  const data = await compress(file);
  const id = 'ph-' + Date.now().toString(36) + newId();
  await put('photos/' + id, { data, at: Date.now(), byUid: S.me.uid, byName: S.me.name, ...meta });
  S.photoCache[id] = data; return id;
}
const thumb = (id, big) => `<button class="thumb${big ? ' big' : ''}" data-act="photoView" data-id="${id}" aria-label="ดูรูป"><img data-pid="${id}" alt=""></button>`;
async function hydratePhotos() {
  document.querySelectorAll('img[data-pid]').forEach(async img => {
    if (img.getAttribute('src')) return;
    const id = img.dataset.pid;
    if (S.photoCache[id] == null) { try { const s = await fb.getDoc(ref('photos/' + id)); S.photoCache[id] = s.exists() ? s.data().data : ''; } catch (e) { S.photoCache[id] = ''; } }
    if (S.photoCache[id]) img.src = S.photoCache[id]; else img.closest('.thumb')?.classList.add('gone');
  });
}
const photoInput = (attrs, label) => `<label class="btn sm"><input type="file" accept="image/*" hidden ${attrs}>${label}</label>`;

/* ============ calculations ============ */
const emptyDay = () => ({ meals: [], exercises: [], planDone: {}, note: '', water: 0, photos: {} });
function getDay(ds) { return { ...emptyDay(), ...(S.days[ds] || {}) }; }
function ensureDay(ds) { if (!S.days[ds]) S.days[ds] = { ...emptyDay(), date: ds }; const d = S.days[ds]; for (const [k, v] of Object.entries(emptyDay())) if (d[k] == null) d[k] = clone(v); return d; }
function measSorted() { return [...MS()].sort((a, b) => a.date < b.date ? -1 : 1); }
function latestVal(k) { const m = measSorted(); for (let i = m.length - 1; i >= 0; i--) { if (m[i][k] != null && m[i][k] !== '') return +m[i][k]; } return null; }
function firstVal(k) { for (const x of measSorted()) { if (x[k] != null && x[k] !== '') return { v: +x[k], d: x.date }; } return null; }
function lastRec(k) { const m = measSorted(); for (let i = m.length - 1; i >= 0; i--) { if (m[i][k] != null && m[i][k] !== '') return { v: +m[i][k], d: m[i].date }; } return null; }
function fatPctOf(m) { if (m.fatPct != null) return +m.fatPct; if (m.fatKg != null && m.weight) return m.fatKg / m.weight * 100; return null; }
function bodyNow() { const w = latestVal('weight') ?? +P().weight; const ms = measSorted(); let fp = null; for (let i = ms.length - 1; i >= 0; i--) { const v = fatPctOf(ms[i]); if (v != null) { fp = v; break; } } return { weight: w || 60, smm: latestVal('smm'), fatPct: fp, bmrM: latestVal('bmr') }; }
function bmrInfo() { const b = bodyNow(), p = P(); if (p.bmrSource !== 'formula' && b.bmrM) return { v: b.bmrM, src: 'จากผลวัดร่างกายล่าสุด' }; if (b.fatPct != null) { const lbm = b.weight * (1 - b.fatPct / 100); return { v: 370 + 21.6 * lbm, src: 'สูตร Katch-McArdle' }; } const s = p.sex === 'm' ? 5 : -161; return { v: 10 * b.weight + 6.25 * (+p.height || 160) - 5 * (+p.age || 30) + s, src: 'สูตร Mifflin-St Jeor' }; }
function baseline() { return bmrInfo().v * (+P().activity || 1.2); }
function exKcal(e) { if (e.kcal != null && e.kcal !== '') return +e.kcal; const t = EX[e.type] || EX.other; return Math.max(0, t.met - 1) * bodyNow().weight * (+e.min || 0) / 60; }
function workoutsOn(ds) { return Object.entries(S.workouts).filter(([, w]) => w.date === ds).map(([id, w]) => ({ id, ...w })); }
function burn(ds) {
  const d = getDay(ds); let k = d.exercises.reduce((a, e) => a + exKcal(e), 0);
  if (!d.exercises.some(e => String(e.type).startsWith('weights'))) k += workoutsOn(ds).reduce((a, w) => a + exKcal({ type: 'weights', min: +w.min || 60 }), 0);
  return k;
}
function planOf(dow) { return PLAN().days?.[dow] || { title: '', rest: true, cardio: { type: 'swim_easy', min: 0 }, wMin: 0, weights: [] }; }
function planBurn(dow) { const d = planOf(dow); if (d.rest) return 0; let k = 0; if (d.cardio && +d.cardio.min) k += exKcal({ type: d.cardio.type, min: d.cardio.min }); if (d.weights && d.weights.length && +d.wMin) k += exKcal({ type: 'weights', min: d.wMin }); return k; }
function trainAvg() { const b = [0, 1, 2, 3, 4, 5, 6].map(planBurn).filter(x => x > 0); return b.length ? b.reduce((a, x) => a + x, 0) / b.length : 0; }
function kcalFloor() { return Math.max(bmrInfo().v, 1200); }
function kcalTarget(b) { const t = T(); if (t.kcalMode === 'manual') return +t.kcalManual || 0; return Math.max(kcalFloor(), (baseline() + b) * (1 + (+t.adj || 0) / 100)); }
function pctSet() { const t = T(); return t.preset === 'custom' ? t.custom : PRESETS[t.preset] || PRESETS.moderate; }
function macros(kcal) { const t = T(), p0 = pctSet(), w = bodyNow().weight; let p, c, f; if (t.proteinMode === 'gkg') { p = (+t.proteinGkg || 1.6) * w; const rem = Math.max(0, kcal - p * 4); const cf = (+p0.c + +p0.f) || 1; c = rem * (p0.c / cf) / 4; f = rem * (p0.f / cf) / 9; } else { p = kcal * p0.p / 100 / 4; c = kcal * p0.c / 100 / 4; f = kcal * p0.f / 100 / 9; } return { kcal, p, c, f }; }
function totals(ds) { return getDay(ds).meals.reduce((a, m) => ({ kcal: a.kcal + (+m.kcal || 0), p: a.p + (+m.p || 0), c: a.c + (+m.c || 0), f: a.f + (+m.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 }); }
function foodVal(f, q) { const m = f.u === 'g' ? q / 100 : q; return { kcal: f.k * m, p: f.p * m, c: f.c * m, f: f.f * m }; }
function qtyText(f, q) { return f.u === 'g' ? `${r0(q)} g` : `${q} ${f.un}`; }
function waterTarget(ds) { const t = T(); const base = +t.waterMl > 0 ? +t.waterMl : Math.round(bodyNow().weight * 30 / 100) * 100; return base + (burn(ds) > 0 ? 500 : 0); }
function lateNow(ds) { return ds === todayStr() && nowHour() >= (+P().cutoff || 20); }
function proteinIdeas(g) { if (g <= 3) return ''; return [`กุ้ง ${r10(g / 24 * 100)} g`, `ปลา ${r10(g / 18.4 * 100)} g`, `กรีกโยเกิร์ต ${r10(g / 10 * 100)} g`, `เวย์ ${Math.max(1, Math.round(g / 30))} สกู๊ป`].join(' · '); }
function weightSessions() {
  const t = T(), dates = new Set();
  Object.values(S.workouts).forEach(w => dates.add(w.date));
  Object.entries(S.days).forEach(([ds, d]) => { if ((d.exercises || []).some(e => String(e.type).startsWith('weights'))) dates.add(ds); });
  let n = +t.sessionsBefore || 0; dates.forEach(ds => { if (!t.sessionsBeforeDate || ds > t.sessionsBeforeDate) n++; }); return n;
}
function analyze(ds) {
  const d = getDay(ds), bK = burn(ds), tdee = baseline() + bK, tgt = kcalTarget(bK), m = macros(tgt), tot = totals(ds), bmr = bmrInfo().v, isToday = ds === todayStr();
  const goalNet = tgt - tdee;
  if (!d.meals.length) return { status: 'none', lines: ['ยังไม่มีรายการอาหารของวันนี้'], net: null, goalNet, tdee, tgt, m, tot, bK };
  const L = []; let miss = 0; const diff = tot.kcal - tgt, dr = diff / tgt, net = tot.kcal - tdee;
  if (Math.abs(dr) <= 0.08) L.push(`แคลอรี่ใกล้เป้า (${diff >= 0 ? '+' : ''}${fmt(diff)} kcal)`);
  else if (diff < 0) { if (isToday) L.push(`ยังกินได้อีก ${fmt(-diff)} kcal`); else { L.push(`กินต่ำกว่าเป้า ${fmt(-diff)} kcal`); miss++; } }
  else { L.push(`กินเกินเป้า ${fmt(diff)} kcal`); miss++; }
  L.push(net < 0 ? `พลังงานติดลบ ${fmt(-net)} kcal ≈ ไขมันลดราว ${r0(-net / 7.7)} g` : `พลังงานเป็นบวก ${fmt(net)} kcal`);
  const pr = tot.p / m.p;
  if (pr >= 0.9) L.push(`โปรตีนถึงเป้า ${r0(tot.p)}/${r0(m.p)} g`);
  else { const need = m.p - tot.p; L.push(lateNow(ds) ? `โปรตีนขาดอีก ${r0(need)} g · หลัง ${P().cutoff || 20}:00 เติมได้แค่กรีกโยเกิร์ต + มิกซ์เบอร์รี` : `โปรตีนขาดอีก ${r0(need)} g · เติมได้จาก ${proteinIdeas(need)}`); if (!isToday || pr < 0.7) miss++; }
  if (tot.kcal < bmr && !isToday) { L.push(`กินต่ำกว่า BMR (${fmt(bmr)} kcal) เสี่ยงเสียกล้ามเนื้อ`); miss++; }
  if (bK === 0) L.push('วันพัก: ลดแป้งลงได้เล็กน้อย เน้นโปรตีนกับผัก');
  if (tot.f > m.f * 1.3) L.push(`ไขมันสูงกว่าเป้า (${r0(tot.f)}/${r0(m.f)} g)`);
  const status = miss === 0 ? 'good' : miss === 1 ? 'ok' : 'adjust';
  return { status, label: { good: 'ดีมาก', ok: 'พอใช้', adjust: 'ควรปรับ' }[status], lines: L, net, goalNet, tdee, tgt, m, tot, bK };
}
function proteinPlans(gap, late) {
  const mk = (label, parts) => { const items = parts.filter(([, q]) => q > 0).map(([id, q]) => { const f = FOOD[id], v = foodVal(f, q); return { name: f.n, qty: qtyText(f, q), g: f.u === 'g' ? r0(q) : null, kcal: r0(v.kcal), p: r1(v.p), c: r1(v.c), f: r1(v.f) }; }); return { label, items, p: items.reduce((a, x) => a + x.p, 0), kcal: items.reduce((a, x) => a + x.kcal, 0) }; };
  const gy = Math.max(100, Math.min(late ? 250 : 300, r10(gap / 10 * 100)));
  const out = [mk('กรีกโยเกิร์ต + มิกซ์เบอร์รี', [['greek', gy], ['berries', 60]])];
  if (late) return out;
  const sc = Math.min(2, Math.floor((gap + 5) / 30)); const rem = gap - sc * 30; const g2 = rem >= 6 ? Math.max(100, Math.min(300, r10(rem / 10 * 100))) : 0;
  if (sc > 0) out.unshift(mk('ใกล้เป้าที่สุด · เวย์' + (g2 ? ' + กรีกโยเกิร์ต' : ''), [['whey', sc], ['greek', g2]]));
  const eggs = Math.max(1, Math.min(3, Math.round(gap * 0.55 / 6.3))); const rest = gap - eggs * 6.3;
  out.push(mk('ไข่ต้ม + นม', [['egg', eggs], ['skim', rest > 6 ? 1 : 0]]));
  out.push(mk('กุ้งลวก + ผัก', [['shrimp', Math.max(80, Math.min(250, r10(gap / 24 * 100)))], ['veg', 100]]));
  out.push(mk('ปลานึ่ง + ผัก', [['seabass', Math.max(100, Math.min(300, r10(gap / 18.4 * 100)))], ['veg', 100]]));
  return out;
}
const defaultMeal = () => { const h = new Date().getHours(); return h < 10 ? 'เช้า' : h < 14 ? 'กลางวัน' : h < 17 ? 'ว่าง' : 'เย็น'; };

/* ============ workouts: progress ============ */
const e1rm = (kg, reps) => (kg > 0 && reps > 0) ? kg * (1 + Math.min(reps, 15) / 30) : 0;
const exKey = n => normName(n);
function exHistory() {
  const map = {};
  Object.entries(S.workouts).sort((a, b) => a[1].date < b[1].date ? -1 : 1).forEach(([id, w]) => {
    (w.exercises || []).forEach(ex => {
      const k = exKey(ex.name); if (!k) return;
      const sets = (ex.sets || []).map(s => ({ kg: +s.kg || 0, reps: +s.reps || 0 })).filter(s => s.reps > 0 || s.kg > 0);
      if (!sets.length) return;
      let top = sets[0]; sets.forEach(s => { if (e1rm(s.kg, s.reps) > e1rm(top.kg, top.reps) || (top.kg === 0 && s.reps > top.reps && s.kg === 0)) top = s; });
      const vol = sets.reduce((a, s) => a + s.kg * s.reps, 0);
      (map[k] = map[k] || { name: ex.name, rows: [] }).rows.push({ date: w.date, id, top, e1: e1rm(top.kg, top.reps), vol, sets, maxReps: Math.max(...sets.map(s => s.reps)) });
    });
  });
  return map;
}
function woSummary(w) { return (w.exercises || []).filter(e => e.name).map(e => `${e.name} ${(e.sets || []).filter(s => +s.reps || +s.kg).map(s => (+s.kg ? `${s.kg}kg×` : '×') + (s.reps || '')).join(', ')}`).join(' · '); }
function woVolume(w) { return (w.exercises || []).reduce((a, e) => a + (e.sets || []).reduce((b, s) => b + (+s.kg || 0) * (+s.reps || 0), 0), 0); }

/* ============ pantry ============ */
const PUNITS = ['g', 'ฟอง', 'ชิ้น', 'กล่อง', 'ขวด', 'ถุง', 'สกู๊ป', 'ml'];
function fmtQty(q, u) { q = +q || 0; if (u === 'g' && q >= 1000) return (Math.round(q / 100) / 10) + ' kg'; if (u === 'ml' && q >= 1000) return (Math.round(q / 100) / 10) + ' ลิตร'; return (Math.round(q * 10) / 10) + ' ' + u; }
function pantryAvg(it) { if (+it.perDay > 0) return +it.perDay; const T0 = todayStr(), since = addDays(T0, -13); const us = (it.uses || []).filter(u => u.d >= since); if (!us.length) return 0; const first = us.reduce((a, u) => u.d < a ? u.d : a, T0); const span = Math.max(3, Math.round((parseD(T0) - parseD(first)) / 864e5) + 1); return us.reduce((a, u) => a + (+u.a || 0), 0) / span; }
function pantryStatus(it) { const avg = pantryAvg(it), q = +it.qty || 0; if (q <= 0) return { days: 0, low: true, out: true, avg }; if (!avg) return { days: null, low: false, avg }; const days = q / avg; return { days, low: days <= (+it.lowDays || 2), avg, runOut: addDays(todayStr(), Math.floor(days)) }; }
function pantryText() { return Object.values(S.pantry).filter(it => +it.qty > 0).map(it => `${it.name} ${fmtQty(it.qty, it.unit)}`).join(', '); }
function savePantry(id, it) { it.updatedAt = todayStr(); it.uses = (it.uses || []).slice(-60); S.pantry[id] = clone(it); put('pantry/' + id, it).catch(() => { }); }
function pantryUse(id, amt, ds) { const it = S.pantry[id]; if (!it || !(amt > 0)) return; it.qty = Math.max(0, r1((+it.qty || 0) - amt)); it.uses = [...(it.uses || []), { d: ds || todayStr(), a: amt }]; savePantry(id, it); }
function pantryFind(k, u) { const key = String(k).toLowerCase(); return Object.entries(S.pantry).find(([, it]) => String(it.name).toLowerCase().includes(key) && (!u || it.unit === u)); }

/* ============ render ============ */
let rq = 0;
function render() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; renderNow(); }); }
function renderNow() {
  if (!S.me) return;
  document.querySelectorAll('.tabbtn').forEach(b => { b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'); });
  $('#whoChip').textContent = `${S.me.name} · ${ROLE_TH[S.me.role] || ''}`;
  if (!S.ready.profile) { $('#main').innerHTML = '<p class="empty">กำลังโหลดข้อมูล...</p>'; return; }
  const R = { today: renderToday, train: renderTrain, kitchen: renderKitchen, body: renderBody, overview: renderOverview, settings: renderSettings }[ui.tab] || renderToday;
  $('#main').innerHTML = onboarding() + R() + `<p class="foot">ตัวเลขทั้งหมดเป็นค่าประมาณเพื่อช่วยวางแผน ปรับตามคำแนะนำของเทรนเนอร์ได้เสมอ</p>`;
  hydratePhotos();
}
function onboarding() {
  if (S.profileDoc || !isOwner()) return (!S.profileDoc && !isOwner()) ? `<div class="banner" style="margin-bottom:14px">เจ้าของยังไม่ได้ตั้งค่าข้อมูลเริ่มต้น</div>` : '';
  return `<section class="card" style="margin-bottom:14px"><h2>เริ่มต้นใช้งาน</h2><p class="small muted">นำเข้าไฟล์ข้อมูลจากแอปเดิม (fit-routine-data-….json) หรือเริ่มจากค่าตั้งต้น (ผล InBody 10 ก.ย. เป้า 2,080 kcal และแผน Push/Pull/Legs)</p>
  <div class="row">${`<label class="btn pri"><input type="file" accept="application/json,.json" hidden id="importFile">นำเข้าไฟล์ข้อมูลเดิม</label>`}<button class="btn" data-act="startDefault">เริ่มจากค่าตั้งต้น</button></div></section>`;
}
function bar(v, max, color) { const w = max > 0 ? Math.min(100, v / max * 100) : 0; return `<div class="bar ${v > max * 1.05 ? 'over' : ''}" style="--c:${color}"><i style="width:${w}%"></i></div>`; }
function macroRow(lbl, v, t, color) { return `<div class="macro"><span><span class="dot" style="background:${color}"></span> <b>${lbl}</b></span>${bar(v, t, color)}<span class="num small">${r0(v)}/${r0(t)} g</span></div>`; }
const RO = () => isOwner() ? '' : 'disabled';

/* ---------- today ---------- */
function renderToday() {
  const own = isOwner();
  const ds = ui.date, d = getDay(ds), A = analyze(ds), tot = A.tot, m = A.m, remain = A.tgt - tot.kcal;
  const dow = dowOf(ds), pl = planOf(dow), isToday = ds === todayStr(), wos = workoutsOn(ds);
  const exHtml = (d.exercises.length || wos.length) ? d.exercises.map(e => `<button class="item" ${own ? `data-act="editEx" data-id="${e.id}"` : 'disabled'}><span class="nm">${esc((EX[e.type] || EX.other).n)}${e.fromPlan ? ' <span class="tag">ตามแผน</span>' : ''}</span><span class="k">${fmt(exKcal(e))} kcal</span><span class="sub"><span>${r0(e.min)} นาที</span>${e.kcal != null && e.kcal !== '' ? '<span>kcal จากนาฬิกา</span>' : ''}${e.note ? `<span>${esc(e.note)}</span>` : ''}</span></button>`).join('') + wos.map(w => `<button class="item" data-act="tab" data-v="train"><span class="nm">🏋️ ${esc(w.title || 'เวทเทรนนิ่ง')} <span class="tag">บันทึกโดย ${esc(w.byName || '')}</span></span><span class="k">${fmt(exKcal({ type: 'weights', min: +w.min || 60 }))} kcal</span><span class="sub"><span>${esc(woSummary(w)).slice(0, 160)}</span></span></button>`).join('') : `<div class="empty">${pl.rest ? 'วันพักตามแผน' : 'ยังไม่ได้บันทึกการออกกำลังกาย'}</div>`;
  const mealsHtml = MEALS.map(ml => {
    const items = d.meals.filter(x => x.meal === ml); const sub = items.reduce((a, x) => a + (+x.kcal || 0), 0); const ph = (d.photos || {})[ml] || [];
    return `<div class="meal-group"><div class="meal-h"><h4>${ml} <span class="muted num small">${items.length ? fmt(sub) + ' kcal' : ''}</span></h4>${own ? `<div class="row" style="gap:4px">${photoInput(`data-photo-meal="${ml}"`, 'แนบรูป')}<button class="btn sm link" data-act="addFood" data-meal="${ml}">+ เพิ่ม</button></div>` : ''}</div>
    ${ph.length ? `<div class="thumbs">${ph.map(id => thumb(id)).join('')}</div>` : ''}
    ${items.map(x => `<button class="item" ${own ? `data-act="editMeal" data-id="${x.id}"` : 'disabled'}><span class="nm">${esc(x.name)}</span><span class="k">${fmt(x.kcal)}</span><span class="sub">${x.qty ? `<span>${esc(x.qty)}</span>` : ''}<span style="color:var(--pro)">P ${r1(x.p)}</span><span style="color:var(--carb)">C ${r1(x.c)}</span><span style="color:var(--fat)">F ${r1(x.f)}</span></span></button>`).join('')}</div>`;
  }).join('');
  let planHtml;
  if (pl.rest) planHtml = `<p class="small">วันพักฟื้นตามแผน · ${esc(pl.title || '')}</p>`;
  else {
    const cardioDone = d.exercises.some(e => e.fromPlan === 'cardio');
    const cK = +pl.cardio?.min ? exKcal({ type: pl.cardio.type, min: pl.cardio.min }) : 0;
    planHtml = `<p style="font-weight:600">${esc(pl.title || '')}</p>
    ${+pl.cardio?.min ? `<div class="row between"><span class="small">${esc(EX[pl.cardio.type]?.n || '')} · ${r0(pl.cardio.min)} นาที <span class="muted num">≈ ${fmt(cK)} kcal</span></span>${cardioDone ? '<span class="pill good">บันทึกแล้ว</span>' : own ? `<button class="btn sm" data-act="planCardio">ทำแล้ว บันทึกเลย</button>` : ''}</div>` : ''}
    ${(pl.weights || []).length ? `<p class="small muted">เวท: ${pl.weights.map(w => esc(w.n)).join(' · ')}</p><div class="row">${wos.length ? '<span class="pill good">เทรนเนอร์บันทึกแล้ว</span>' : ''}${isTrainer() ? `<button class="btn sm" data-act="woNew" data-date="${ds}">${wos.length ? 'แก้/เพิ่มบันทึกการเทรน' : 'บันทึกการเทรนวันนี้'}</button>` : ''}</div>` : ''}`;
  }
  const statusPill = A.status === 'none' ? '<span class="pill plain">ยังไม่ได้บันทึก</span>' : `<span class="pill ${A.status}"><span class="dot" style="background:currentColor"></span>${A.label}</span>`;
  return `<div class="stack">
  <div class="row between">
   <div class="row" style="gap:6px"><button class="btn sm" data-act="dPrev" aria-label="วันก่อนหน้า">‹</button><input type="date" id="dateInput" value="${ds}" style="width:auto"><button class="btn sm" data-act="dNext" aria-label="วันถัดไป">›</button>${isToday ? '' : '<button class="btn sm link" data-act="dToday">กลับวันนี้</button>'}</div>
   <div class="row" style="gap:8px"><h2>${thDate(ds)}</h2>${own ? '<button class="btn sm pri" data-act="pasteOpen">วางจากอินัง</button>' : ''}</div>
  </div>
  <div class="grid2">
   <div class="stack">
    <section class="card">
     <div class="card-h"><span class="eyebrow">พลังงานวันนี้</span>${statusPill}</div>
     <div class="row between" style="align-items:flex-end">
      <div><div class="hero-num num">${fmt(Math.abs(remain))}<small>kcal</small></div><div class="small muted">${remain >= 0 ? 'เหลือกินได้อีก' : 'กินเกินเป้าแล้ว'}</div></div>
      <div class="kv" style="min-width:190px"><span class="muted">กินแล้ว</span><span class="num">${fmt(tot.kcal)}</span><span class="muted">เป้าวันนี้</span><span class="num">${fmt(A.tgt)}</span><span class="muted">เผาผลาญรวม (TDEE)</span><span class="num">${fmt(A.tdee)}</span></div>
     </div>
     ${bar(tot.kcal, A.tgt, 'var(--accent)')}
     <div class="stack" style="gap:8px">${macroRow('โปรตีน', tot.p, m.p, 'var(--pro)')}${macroRow('คาร์บ', tot.c, m.c, 'var(--carb)')}${macroRow('ไขมัน', tot.f, m.f, 'var(--fat)')}</div>
    </section>
    ${proteinCard(ds, A)}
    <section class="card">
     <div class="card-h"><h3>สมดุลแคลอรี่</h3><span class="num small">${A.net == null ? '' : `สุทธิ ${A.net > 0 ? '+' : ''}${fmt(A.net)} kcal`}</span></div>
     <div class="kv small"><span class="muted">BMR × กิจกรรมประจำวัน (${P().activity})</span><span class="num">${fmt(baseline())}</span><span class="muted">ออกกำลังกาย</span><span class="num">+${fmt(A.bK)}</span><span class="tot">เผาผลาญทั้งวัน</span><span class="num tot">${fmt(A.tdee)}</span></div>
     <ul class="notes">${A.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    </section>
    ${feedCard()}
    <section class="card">
     <div class="card-h"><h3>ส่งสรุป</h3></div>
     <div class="row"><button class="btn" data-act="copyDay">คัดลอกสรุปวันนี้</button><button class="btn" data-act="copyWeek">คัดลอกสรุป 7 วัน</button>${own ? '<button class="btn pri" data-act="lineDay">ส่งสรุปวันนี้เข้ากลุ่ม LINE</button>' : ''}</div>
     <textarea id="shareOut" rows="8" readonly hidden></textarea>
    </section>
   </div>
   <div class="stack">
    <section class="card">
     <div class="card-h"><h3>น้ำดื่ม</h3><span class="num small muted">เป้า ${L_(waterTarget(ds))} ลิตร</span></div>
     <div class="row between" style="align-items:flex-end"><div class="hero-num num" style="font-size:32px">${L_(+d.water || 0)}<small>/ ${L_(waterTarget(ds))} ลิตร</small></div></div>
     ${bar(+d.water || 0, waterTarget(ds), 'var(--fat)')}
     ${own ? `<div class="row"><button class="btn sm" data-act="water" data-v="250">+ 250 มล.</button><button class="btn sm" data-act="water" data-v="500">+ 500 มล.</button><button class="btn sm" data-act="water" data-v="1000">+ 1 ลิตร</button><button class="btn sm link" data-act="water" data-v="-250">− 250</button></div>` : ''}
    </section>
    <section class="card"><div class="card-h"><h3>แผนวัน${TH_DOW[dow]}</h3><button class="btn sm link" data-act="tab" data-v="settings" data-set="plan">ดูแผน</button></div>${planHtml}</section>
    <section class="card"><div class="card-h"><h3>ออกกำลังกาย</h3>${own ? '<button class="btn sm" data-act="addEx">+ เพิ่ม</button>' : ''}</div>${exHtml}</section>
    <section class="card"><div class="card-h"><h3>อาหาร</h3><span class="num small muted">${fmt(tot.kcal)} kcal</span></div>${mealsHtml}
     <label class="f"><span>บันทึกสั้น ๆ (นอนกี่ชม. รู้สึกยังไง)</span><textarea id="dayNote" rows="2" ${RO()}>${esc(d.note || '')}</textarea></label>
    </section>
   </div>
  </div></div>`;
}
function proteinCard(ds, A) {
  if (ds !== todayStr() || !A.m || !isOwner()) return '';
  const gap = A.m.p - A.tot.p, late = lateNow(ds), cut = +P().cutoff || 20;
  if (gap <= 3) return `<section class="card"><div class="card-h"><h3>โปรตีนวันนี้</h3><span class="pill good">ถึงเป้าแล้ว</span></div></section>`;
  const plans = proteinPlans(gap, late); ui.protPlans = plans;
  return `<section class="card"><div class="card-h"><h3>โปรตีนยังขาด ${r0(gap)} g</h3><span class="small muted num">${r0(A.tot.p)}/${r0(A.m.p)} g</span></div>
  <p class="small muted">${late ? `หลัง ${cut}:00 แล้ว เลือกได้แค่กรีกโยเกิร์ตกับมิกซ์เบอร์รี ถ้าจะนอนภายใน 2 ชม. เติมพรุ่งนี้เช้าดีกว่า` : `เลือก 1 อย่าง กินให้เสร็จก่อน ${cut}:00`}</p>
  ${plans.map((pl, i) => `<div class="row between choice"><div><div style="font-weight:600">${esc(pl.label)}</div><div class="small muted">${pl.items.map(x => esc(x.qty + ' ' + x.name)).join(' + ')} · <span class="num">+${r0(pl.p)} g โปรตีน · ${fmt(pl.kcal)} kcal</span></div></div><button class="btn sm" data-act="protAdd" data-i="${i}">กินแล้ว บันทึก</button></div>`).join('')}</section>`;
}
function feedCard() {
  const list = S.activity.slice(0, 12);
  return `<section class="card"><div class="card-h"><h3>ความเคลื่อนไหวในทีม</h3>${S.config.lineOn ? '<span class="pill plain">แจ้ง LINE อยู่</span>' : ''}</div>
  <div class="row" style="flex-wrap:nowrap"><input id="msgText" placeholder="ส่งข้อความถึงทีม เช่น วันนี้ปวดเข่า ขอเบาขา"><button class="btn pri" data-act="sendMsg">ส่ง</button></div>
  ${list.length ? `<ul class="feed">${list.map(a => `<li><span class="who">${esc(a.byName || '')}<span class="muted"> · ${ROLE_TH[a.byRole] || ''}</span></span><span class="txt">${esc(a.text)}</span><span class="when">${timeAgo(a.at)}</span></li>`).join('')}</ul>` : '<p class="empty">ยังไม่มีความเคลื่อนไหว</p>'}</section>`;
}

/* ---------- train ---------- */
function renderTrain() {
  const list = Object.entries(S.workouts).map(([id, w]) => ({ id, ...w })).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.updatedAt || 0) - (a.updatedAt || 0));
  const H = exHistory(); const names = Object.keys(H).sort((a, b) => H[b].rows.length - H[a].rows.length);
  if (!ui.progEx || !H[ui.progEx]) ui.progEx = names[0] || '';
  const wkStart = addDays(todayStr(), -((dowOf(todayStr()) + 6) % 7));
  const thisWeek = list.filter(w => w.date >= wkStart).length;
  const prog = names.map(k => { const r = H[k].rows, a = r[0], b = r[r.length - 1]; const ch = a.e1 ? (b.e1 - a.e1) / a.e1 * 100 : (a.maxReps ? (b.maxReps - a.maxReps) / a.maxReps * 100 : 0); return { k, name: H[k].name, n: r.length, a, b, ch }; });
  return `<div class="stack">
  <section class="card band" style="--img:url(img/pool-violet.jpg)"><div class="card-h"><h2>การเทรนกับเทรนเนอร์</h2>${isTrainer() ? `<button class="btn pri" data-act="woNew" data-date="${todayStr()}">+ บันทึกการเทรน</button>` : ''}</div>
   <div class="stats"><div class="stat"><div class="v num">${weightSessions()}</div><div class="l">session เวทสะสม</div></div><div class="stat"><div class="v num">${list.length}</div><div class="l">บันทึกในแอป</div></div><div class="stat"><div class="v num">${thisWeek}</div><div class="l">สัปดาห์นี้</div></div><div class="stat"><div class="v num">${list[0] ? thShort(list[0].date) : '–'}</div><div class="l">ครั้งล่าสุด</div></div></div>
   <p class="small muted">เทรนเนอร์บันทึกท่า น้ำหนัก และจำนวนครั้งของแต่ละเซ็ต แอปจะคำนวณพัฒนาการจาก 1RM โดยประมาณ (สูตร Epley) ให้เอง</p>
  </section>
  ${prog.length ? `<section class="card"><div class="card-h"><h2>พัฒนาการรายท่า</h2><span class="small muted">ครั้งแรก → ล่าสุด</span></div>
   <div class="tbl-wrap"><table class="t"><thead><tr><th>ท่า</th><th class="n">ครั้ง</th><th class="n">ครั้งแรก</th><th class="n">ล่าสุด</th><th class="n">เปลี่ยน</th></tr></thead><tbody>
   ${prog.map(x => `<tr><td><button class="btn sm link" data-act="progEx" data-k="${esc(x.k)}">${esc(x.name)}</button></td><td class="n">${x.n}</td><td class="n">${x.a.top.kg ? x.a.top.kg + '×' + x.a.top.reps : '×' + x.a.maxReps}</td><td class="n">${x.b.top.kg ? x.b.top.kg + '×' + x.b.top.reps : '×' + x.b.maxReps}</td><td class="n" style="color:${x.ch > 0.5 ? 'var(--good)' : x.ch < -0.5 ? 'var(--bad)' : 'var(--muted)'}">${x.n > 1 ? (x.ch > 0 ? '+' : '') + r0(x.ch) + '%' : '–'}</td></tr>`).join('')}
   </tbody></table></div>
   ${ui.progEx && H[ui.progEx] ? progChart(H[ui.progEx]) : ''}
  </section>` : ''}
  <section class="card"><h2>ประวัติการเทรน</h2>
   ${list.length ? list.map(w => `<div class="recipe">
    <div class="row between"><div><b>${thShort(w.date)}</b> · ${esc(w.title || '')}</div><span class="small muted">โดย ${esc(w.byName || '')}${w.min ? ` · ${w.min} นาที` : ''}</span></div>
    <div class="tbl-wrap"><table class="t"><tbody>${(w.exercises || []).filter(e => e.name).map(e => `<tr><td>${esc(e.name)}${e.note ? `<div class="xs muted">${esc(e.note)}</div>` : ''}</td><td class="n">${(e.sets || []).filter(s => +s.reps || +s.kg).map(s => (+s.kg ? `${s.kg}×` : '×') + (s.reps || '')).join(' · ')}</td></tr>`).join('')}</tbody></table></div>
    <div class="row small muted" style="gap:12px"><span>ปริมาณรวม ${fmt(woVolume(w))} kg</span>${w.note ? `<span>${esc(w.note)}</span>` : ''}</div>
    ${(w.photoIds || []).length ? `<div class="thumbs">${w.photoIds.map(id => thumb(id)).join('')}</div>` : ''}
    ${isTrainer() ? `<div class="row"><button class="btn sm" data-act="woEdit" data-id="${w.id}">แก้ไข</button><button class="btn sm link" data-act="woCopy" data-id="${w.id}">ใช้เป็นแม่แบบวันนี้</button></div>` : ''}
   </div>`).join('') : '<p class="empty">ยังไม่มีบันทึกการเทรน</p>'}
  </section></div>`;
}
function progChart(h) {
  const rows = h.rows; if (rows.length < 1) return '';
  const useE = rows.some(r => r.e1 > 0); const vals = rows.map(r => useE ? r.e1 : r.maxReps);
  const W = 520, H = 170, L = 40, R = 14, Tp = 16, B = 26;
  let lo = Math.min(...vals), hi = Math.max(...vals); const pd = Math.max((hi - lo) * 0.2, 1); lo = Math.max(0, lo - pd); hi += pd;
  const x = i => rows.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (rows.length - 1), y = v => Tp + (hi - v) / (hi - lo) * (H - Tp - B);
  const line = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<h3 style="margin-top:6px">${esc(h.name)} · ${useE ? '1RM โดยประมาณ (kg)' : 'จำนวนครั้งสูงสุด'}</h3>
  <div class="tbl-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟพัฒนาการ">
   ${[lo, (lo + hi) / 2, hi].map(v => `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ch-lbl" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${r1(v)}</text>`).join('')}
   ${rows.length > 1 ? `<polyline class="ch-line" points="${line}"/>` : ''}
   ${vals.map((v, i) => `<circle class="${i === vals.length - 1 ? 'ch-end' : 'ch-pt'}" cx="${x(i)}" cy="${y(v)}" r="4"/>`).join('')}
   <text class="ch-lbl" x="${L}" y="${H - 6}">${thShort(rows[0].date)}</text>${rows.length > 1 ? `<text class="ch-lbl" x="${W - R}" y="${H - 6}" text-anchor="end">${thShort(rows[rows.length - 1].date)}</text>` : ''}
  </svg></div>`;
}
function woBlank(date) {
  const dow = dowOf(date), pl = planOf(dow);
  const type = pl.type || (['push', 'pull', 'legs'].find(t => String(pl.title).toLowerCase().includes(t)) || 'other');
  return { date, type, title: (WORKOUT_TYPES.find(x => x[0] === type) || ['', 'เวทเทรนนิ่ง'])[1], min: +pl.wMin || 60, note: '', photoIds: [], exercises: (pl.weights || []).map(w => ({ name: w.n, note: '', sets: Array.from({ length: +w.s || 3 }, () => ({ kg: +w.kg || '', reps: parseInt(w.r) || '' })) })) };
}
function lastSessionOf(type, excludeId) { return Object.entries(S.workouts).filter(([id, w]) => w.type === type && id !== excludeId).sort((a, b) => a[1].date < b[1].date ? 1 : -1)[0]; }
function woSheet() {
  const w = ui.wo; if (!w) return;
  const known = [...new Set([...Object.values(exHistory()).map(h => h.name), ...Object.values(PLAN().days || {}).flatMap(d => (d.weights || []).map(x => x.n))])];
  openSheet(`<div class="sheet-h"><h3>${w.id ? 'แก้ไข' : 'บันทึก'}การเทรน</h3><button class="btn sm" data-act="close">ปิด</button></div>
  <div class="fields">
   <label class="f"><span>วันที่</span><input type="date" data-wo="date" value="${esc(w.date)}"></label>
   <label class="f"><span>ประเภท</span><select data-wo="type">${WORKOUT_TYPES.map(([k, l]) => `<option value="${k}" ${w.type === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
   <label class="f"><span>เวลา (นาที)</span><input type="number" inputmode="numeric" data-wo="min" value="${esc(w.min)}"></label>
  </div>
  <div class="row"><button class="btn sm" data-act="woFromPlan">ดึงท่าจากแผน</button><button class="btn sm" data-act="woFromLast">ใช้ครั้งก่อน (ท่า + น้ำหนักเดิม)</button></div>
  <datalist id="exNames">${known.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
  ${(w.exercises || []).map((e, i) => `<div class="wo-ex">
   <div class="row" style="flex-wrap:nowrap"><input list="exNames" data-wo="ex.${i}.name" value="${esc(e.name)}" placeholder="ชื่อท่า"><button class="btn sm link danger" data-act="woDelEx" data-i="${i}" aria-label="ลบท่า">✕</button></div>
   <div class="sets">${(e.sets || []).map((s, j) => `<div class="setrow"><span class="xs muted">เซ็ต ${j + 1}</span><input type="number" inputmode="decimal" step="0.5" data-wo="ex.${i}.sets.${j}.kg" value="${esc(s.kg)}" placeholder="kg"><span class="xs muted">kg ×</span><input type="number" inputmode="numeric" data-wo="ex.${i}.sets.${j}.reps" value="${esc(s.reps)}" placeholder="ครั้ง"><button class="btn sm link" data-act="woDelSet" data-i="${i}" data-j="${j}" aria-label="ลบเซ็ต">−</button></div>`).join('')}</div>
   <div class="row"><button class="btn sm" data-act="woAddSet" data-i="${i}">+ เซ็ต</button><input data-wo="ex.${i}.note" value="${esc(e.note || '')}" placeholder="หมายเหตุท่านี้ เช่น ฟอร์มดีขึ้น" style="flex:1"></div>
  </div>`).join('')}
  <button class="btn" data-act="woAddEx">+ เพิ่มท่า</button>
  <label class="f"><span>หมายเหตุจากเทรนเนอร์</span><textarea data-wo="note" rows="2">${esc(w.note || '')}</textarea></label>
  <div class="row">${photoInput('data-photo-wo="1"', 'แนบรูป')}${(w.photoIds || []).length ? `<div class="thumbs">${w.photoIds.map(id => thumb(id)).join('')}</div>` : ''}</div>
  <div class="row between">${w.id ? `<button class="btn danger" data-act="woDel">ลบบันทึกนี้</button>` : '<span></span>'}<button class="btn pri" data-act="woSave">บันทึก</button></div>`);
}
function setPath(obj, path, val) { const ks = path.split('.'); let o = obj; for (let i = 0; i < ks.length - 1; i++) { const k = /^\d+$/.test(ks[i]) ? +ks[i] : ks[i]; o[k] = o[k] ?? (/^\d+$/.test(ks[i + 1]) ? [] : {}); o = o[k]; } o[/^\d+$/.test(ks[ks.length - 1]) ? +ks[ks.length - 1] : ks[ks.length - 1]] = val; }

/* ---------- kitchen ---------- */
function hasIng(ing) { const txt = (ui.pantry || pantryText()).toLowerCase(); const syn = SYN[ing] || [ing]; return syn.some(s => txt.includes(s.toLowerCase())); }
function matchRecipes() { if (!(ui.pantry || pantryText()).trim()) return []; return LIB_RECIPES.map(r => { const have = r.need.filter(hasIng), miss = r.need.filter(x => !hasIng(x)), optHave = r.opt.filter(hasIng); return { ...r, have, miss, score: have.length / r.need.length + optHave.length * 0.05 }; }).filter(r => r.have.length > 0).sort((a, b) => b.score - a.score || b.p - a.p).slice(0, 6); }
function recipeBookHtml() {
  const f = ui.bookMeal || 'all', own = isOwner();
  const list = Object.entries(S.recipes).filter(([, r]) => f === 'all' || (r.meals || []).includes(f)).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'th'));
  const count = m => Object.values(S.recipes).filter(r => m === 'all' || (r.meals || []).includes(m)).length;
  return `<section class="card"><div class="card-h"><h2>สมุดเมนูของฉัน</h2><span class="small muted">${count('all')} เมนู</span></div>
  <div class="seg">${[['all', 'ทั้งหมด'], ...MEALS.map(m => [m, m])].map(([k, l]) => `<button aria-pressed="${f === k}" data-act="bookMeal" data-v="${k}">${l} ${count(k)}</button>`).join('')}</div>
  ${list.length ? `<div class="grid-days">${list.map(([id, r]) => `<div class="recipe">
   ${(r.photoIds || []).length ? `<div class="cover">${thumb(r.photoIds[r.photoIds.length - 1], true)}</div>` : ''}
   <div class="row between"><h3>${esc(r.name)}</h3><span class="pill plain">${esc((r.meals || []).join(' / '))}${r.time ? ' · ' + esc(r.time) : ''}</span></div>
   <div class="row small" style="gap:12px"><span class="num">${fmt(r.kcal)} kcal</span><span class="num" style="color:var(--pro)">P ${r0(r.p)}</span><span class="num" style="color:var(--carb)">C ${r0(r.c)}</span><span class="num" style="color:var(--fat)">F ${r0(r.f)}</span></div>
   ${(r.tags || []).length ? `<div class="ing">${r.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
   <details><summary>วัตถุดิบและวิธีทำ${(r.photoIds || []).length > 1 ? ` · รูป ${r.photoIds.length}` : ''}</summary>
    ${(r.ingredients || []).length ? `<ul class="notes" style="margin-bottom:8px">${r.ingredients.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <ol>${(r.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${r.note ? `<p class="small muted" style="margin-top:6px">${esc(r.note)}</p>` : ''}
    ${(r.photoIds || []).length > 1 ? `<div class="thumbs">${r.photoIds.map(pid => thumb(pid)).join('')}</div>` : ''}
   </details>
   ${own ? `<div class="row between"><div class="row" style="gap:6px"><select id="bkMeal_${id}" style="width:auto">${MEALS.map(x => `<option ${x === ((r.meals || []).includes(defaultMeal()) ? defaultMeal() : (r.meals || [defaultMeal()])[0]) ? 'selected' : ''}>${x}</option>`).join('')}</select><button class="btn sm pri" data-act="bookEat" data-id="${id}">กินเมนูนี้ · บันทึก</button></div><div class="row" style="gap:4px">${photoInput(`data-photo-recipe="${id}"`, 'เพิ่มรูปผลงาน')}<button class="btn sm link danger" data-act="bookDel" data-id="${id}">ลบ</button></div></div>` : ''}
  </div>`).join('')}</div>` : `<p class="empty">${count('all') ? 'ไม่มีเมนูของมื้อนี้' : 'ยังไม่มีเมนูในสมุด'}</p>`}</section>`;
}
function pantryHtml() {
  const own = isOwner();
  const list = Object.entries(S.pantry).map(([id, it]) => ({ id, it, st: pantryStatus(it) })).sort((a, b) => (a.st.low === b.st.low ? 0 : a.st.low ? -1 : 1) || ((a.st.days ?? 999) - (b.st.days ?? 999)));
  const buy = list.filter(x => x.st.low); const soon = list.filter(x => x.st.runOut).sort((a, b) => a.st.runOut < b.st.runOut ? -1 : 1)[0];
  return `<section class="card"><div class="card-h"><h2>ของในครัว</h2><span class="small muted">${list.length} รายการ</span></div>
  ${buy.length ? `<div class="banner"><span><b>ควรซื้อเพิ่ม:</b> ${buy.map(x => esc(x.it.name) + (x.st.out ? ' (หมดแล้ว)' : x.st.days != null ? ` (เหลือ ~${Math.max(0, Math.floor(x.st.days))} วัน)` : '')).join(' · ')}</span></div>` : ''}
  ${soon && !buy.length ? `<p class="small muted">ของที่จะหมดก่อน: ${esc(soon.it.name)} ราว ${thShort(soon.st.runOut)} · ควรไปตลาดก่อนวันนั้น</p>` : ''}
  ${list.length ? list.map(({ id, it, st }) => `<div class="choice" style="flex-direction:column;align-items:stretch">
   <div class="row between"><div><b>${esc(it.name)}</b> <span class="num">${fmtQty(it.qty, it.unit)}</span></div>${st.out ? '<span class="pill adjust">หมด</span>' : st.low ? '<span class="pill ok">ใกล้หมด</span>' : st.days != null ? `<span class="pill plain">อีก ~${Math.floor(st.days)} วัน</span>` : '<span class="pill plain">ยังไม่มีสถิติ</span>'}</div>
   <div class="small muted">${st.avg ? `ใช้เฉลี่ย ${fmtQty(r1(st.avg), it.unit)}/วัน${+it.perDay > 0 ? ' (ตั้งเอง)' : ''}` : 'ใช้ไปแล้วแอปจะคำนวณวันหมดให้'}${st.runOut ? ` · หมดราว ${thShort(st.runOut)}` : ''}</div>
   ${own ? `<div class="row" style="gap:6px"><input type="number" inputmode="decimal" id="pq_${id}" placeholder="จำนวน" style="width:90px"><span class="small muted">${esc(it.unit)}</span><button class="btn sm" data-act="pUse" data-id="${id}">ใช้ไป</button><button class="btn sm" data-act="pAdd" data-id="${id}">เติม</button><button class="btn sm link" data-act="pEdit" data-id="${id}">แก้ไข</button></div>` : ''}
  </div>`).join('') : '<p class="empty">ยังไม่มีของในคลัง</p>'}
  ${own ? `<details><summary>เพิ่มวัตถุดิบ</summary><div class="fields">
   <label class="f" style="grid-column:1/-1"><span>ชื่อ</span><input id="pn_name" placeholder="เช่น ไข่ไก่, ปลาช่อนแช่แข็ง"></label>
   <label class="f"><span>จำนวนที่มี</span><input type="number" inputmode="decimal" id="pn_qty"></label>
   <label class="f"><span>หน่วย</span><select id="pn_unit">${PUNITS.map(u => `<option>${u}</option>`).join('')}</select></label>
   <label class="f"><span>ใช้ต่อวัน (ถ้ารู้)</span><input type="number" inputmode="decimal" id="pn_per"></label>
   <label class="f"><span>เตือนเมื่อเหลือไม่ถึง (วัน)</span><input type="number" id="pn_low" value="2"></label>
  </div><div class="row" style="margin-top:10px"><button class="btn pri" data-act="pNew">เพิ่มเข้าคลัง</button></div></details>` : ''}</section>`;
}
function genMenu(tgt, seed) {
  const pick = (arr, k) => arr[(seed + k) % arr.length];
  const fish = pick(['seabass', 'salmon', 'tilapia', 'dory', 'snakehead', 'tuna'], 0), dinP = pick(['shrimp', 'squid', 'seabass', 'tofu', 'shrimp'], 1), carb1 = pick(['brown', 'riceberry', 'rice'], 2), carb2 = pick(['swpot', 'brown', 'riceberry'], 3), brk = pick(['bread', 'swpot'], 1), fruit = pick(['banana', 'apple', 'papaya', 'orange'], 2), drink = pick(['skim', 'soymilk'], 0);
  let it = [{ meal: 'เช้า', id: 'egg', q: 2 }, { meal: 'เช้า', id: brk, q: brk === 'swpot' ? 120 : 2, role: 'c', min: brk === 'swpot' ? 80 : 1, max: brk === 'swpot' ? 250 : 3 }, { meal: 'เช้า', id: drink, q: 1 }, { meal: 'กลางวัน', id: fish, q: 150, role: 'p' }, { meal: 'กลางวัน', id: carb1, q: 150, role: 'c' }, { meal: 'กลางวัน', id: 'veg', q: 150 }, { meal: 'ว่าง', id: 'greek', q: 150 }, { meal: 'ว่าง', id: fruit, q: 1 }, { meal: 'เย็น', id: dinP, q: 150, role: 'p' }, { meal: 'เย็น', id: carb2, q: 120, role: 'c' }, { meal: 'เย็น', id: 'broccoli', q: 150 }, { meal: 'เย็น', id: 'oiltsp', q: 2, role: 'f' }];
  const sum = f => it.reduce((a, x) => a + f(x, foodVal(FOOD[x.id], x.q)), 0);
  for (let k = 0; k < 5; k++) {
    const Pp = it.filter(x => x.role === 'p'); const pP = sum((x, v) => x.role === 'p' ? v.p : 0), pAll = sum((x, v) => v.p); const needP = tgt.p - (pAll - pP);
    if (pP > 0) { const s = Math.max(0.4, Math.min(2.2, needP / pP)); Pp.forEach(x => x.q = Math.max(60, Math.min(320, x.q * s))); }
    const C = it.filter(x => x.role === 'c'); const cC = sum((x, v) => x.role === 'c' ? v.c : 0), cAll = sum((x, v) => v.c); const needC = tgt.c - (cAll - cC);
    if (cC > 0) { const s = Math.max(0.3, Math.min(2.5, needC / cC)); C.forEach(x => { const f = FOOD[x.id]; x.q = f.u === 'g' ? Math.max(x.min || 50, Math.min(x.max || 300, x.q * s)) : Math.max(x.min || 1, Math.min(x.max || 3, x.q * s)); }); }
    const fAll = sum((x, v) => x.role === 'f' ? 0 : v.f); const oil = it.find(x => x.role === 'f'); oil.q = Math.max(0, Math.min(6, (tgt.f - fAll) / 4.5));
  }
  it.forEach(x => { const f = FOOD[x.id]; x.q = f.u === 'g' ? Math.round(x.q / 10) * 10 : Math.round(x.q * 2) / 2; });
  return it.filter(x => x.q > 0).map(x => { const f = FOOD[x.id], v = foodVal(f, x.q); return { meal: x.meal, name: f.n, qty: qtyText(f, x.q), g: f.u === 'g' ? r0(x.q) : null, kcal: r0(v.kcal), p: r1(v.p), c: r1(v.c), f: r1(v.f) }; });
}
function renderKitchen() {
  const matches = matchRecipes(), own = isOwner();
  const b = ui.menuType === 'train' ? trainAvg() : 0, tgt = macros(kcalTarget(b)); ui.menu = genMenu(tgt, ui.menuSeed);
  const M = ui.menu, Tt = M.reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  return `<div class="stack">${recipeBookHtml()}${pantryHtml()}
  <section class="card"><div class="card-h"><h2>วันนี้ทำอะไรกินดี</h2></div>
   <textarea id="pantry" rows="2" placeholder="${esc(pantryText() || 'ไข่ กุ้ง ปลา โยเกิร์ต นม บรอกโคลี')}">${esc(ui.pantry)}</textarea>
   <div class="row"><button class="btn" data-act="pantryGo">หาเมนูจากของที่มี</button></div>
   ${matches.length ? `<div class="grid-days">${matches.map((r, i) => `<div class="recipe"><div class="row between"><h3>${esc(r.n)}</h3><span class="pill plain">${r.t} นาที</span></div>
    <div class="row small" style="gap:12px"><span class="num">${fmt(r.k)} kcal</span><span class="num" style="color:var(--pro)">P ${r0(r.p)}</span></div>
    <div class="ing">${r.have.map(x => `<span class="have">✓ ${esc(x)}</span>`).join('')}${r.miss.map(x => `<span class="need">+ ${esc(x)}</span>`).join('')}</div>
    <ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${own ? `<div class="row"><button class="btn sm" data-act="libSave" data-i="${i}">เก็บลงสมุดเมนู</button></div>` : ''}</div>`).join('')}</div>` : ''}
  </section>
  <section class="card"><div class="card-h"><h2>เมนูทั้งวันตามเป้า</h2><div class="seg"><button aria-pressed="${ui.menuType === 'train'}" data-act="menuType" data-v="train">วันซ้อม</button><button aria-pressed="${ui.menuType === 'rest'}" data-act="menuType" data-v="rest">วันพัก</button></div></div>
   <div class="grid-days" style="gap:12px">${MEALS.map(ml => { const its = M.filter(x => x.meal === ml); return its.length ? `<div class="meal-group"><h4 style="font-size:14px">${ml}</h4>${its.map(x => `<div class="item" style="cursor:default"><span class="nm">${esc(x.name)}</span><span class="k">${fmt(x.kcal)}</span><span class="sub"><span>${esc(x.qty)}</span><span style="color:var(--pro)">P ${r1(x.p)}</span></span></div>`).join('')}</div>` : ''; }).join('')}</div>
   <p class="small muted num">รวม ${fmt(Tt.kcal)} kcal · P ${r0(Tt.p)} C ${r0(Tt.c)} F ${r0(Tt.f)} · เป้า ${fmt(tgt.kcal)} · P ${r0(tgt.p)}</p>
   <div class="row"><button class="btn" data-act="menuNew">สุ่มเมนูใหม่</button>${own ? `<button class="btn pri" data-act="menuAdd">เพิ่มทั้งหมดลงบันทึก ${thShort(ui.date)}</button>` : ''}</div>
  </section></div>`;
}

/* ---------- body ---------- */
function trendSvg(key, target) {
  const pts = measSorted().map(m => ({ d: m.date, v: key === 'fatPct' ? fatPctOf(m) : (m[key] != null && m[key] !== '' ? +m[key] : null) })).filter(x => x.v != null);
  if (!pts.length) return '<p class="small muted">ยังไม่มีข้อมูล</p>';
  const W = 300, H = 120, L = 8, R = 46, Tp = 14, B = 18; let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v)); if (target != null) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
  const pv = Math.max((hi - lo) * 0.15, 0.5); lo -= pv; hi += pv; const t0 = parseD(pts[0].d).getTime(), t1 = parseD(pts[pts.length - 1].d).getTime();
  const x = d => pts.length === 1 ? (L + W - R) / 2 : L + (parseD(d).getTime() - t0) / (t1 - t0 || 1) * (W - L - R), y = v => Tp + (hi - v) / (hi - lo) * (H - Tp - B);
  const line = pts.map(p => `${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' '); const last = pts[pts.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="แนวโน้ม">${target != null ? `<line class="ch-tgt" x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/><text class="ch-tgtl" x="${W - R + 4}" y="${y(target) + 4}">เป้า ${target}</text>` : ''}${pts.length > 1 ? `<polyline class="ch-line" points="${line}"/>` : ''}${pts.map((p, i) => `<circle class="${i === pts.length - 1 ? 'ch-end' : 'ch-pt'}" cx="${x(p.d)}" cy="${y(p.v)}" r="${i === pts.length - 1 ? 4 : 3}"/>`).join('')}<text class="ch-val" x="${Math.min(x(last.d) + 6, W - R + 4)}" y="${Math.max(12, y(last.v) - 8)}">${r1(last.v)}</text><text class="ch-lbl" x="${L}" y="${H - 3}">${thShort(pts[0].d)}</text></svg>`;
}
function renderBody() {
  const p = P(), t = T(), b = bodyNow(), ms = measSorted(), own = isOwner(), dis = RO();
  const bmi = b.weight / Math.pow((+p.height || 160) / 100, 2);
  let goal = '';
  if (b.smm != null) { const gain = (+t.smmTarget || b.smm) - b.smm, months = gain > 0 ? gain / (+t.gainRate || 0.3) : 0; const end = new Date(); end.setDate(end.getDate() + Math.round(months * 30.4)); goal = `<div class="stats"><div class="stat"><div class="v num">${r1(b.smm)} → ${r1(t.smmTarget)}</div><div class="l">มวลกล้ามเนื้อ kg</div></div><div class="stat"><div class="v num">${gain > 0 ? r1(months) : 0} เดือน</div><div class="l">${gain > 0 ? 'ถึงเป้าราว ' + thShort(dstr(end)) : 'ถึงเป้าแล้ว'}</div></div><div class="stat"><div class="v num">${weightSessions()}</div><div class="l">session เวทสะสม</div></div></div>`; }
  return `<div class="stack"><div class="grid2">
  <section class="card band" style="--img:url(img/pool-blue.jpg)"><div class="card-h"><h2>ร่างกายตอนนี้</h2><span class="small muted">${ms.length ? 'วัดล่าสุด ' + thShort(ms[ms.length - 1].date) : ''}</span></div>
   <div class="stats"><div class="stat"><div class="v num">${r1(b.weight)}</div><div class="l">น้ำหนัก kg</div></div><div class="stat"><div class="v num">${b.smm != null ? r1(b.smm) : '–'}</div><div class="l">มวลกล้ามเนื้อ kg</div></div><div class="stat"><div class="v num">${b.fatPct != null ? r1(b.fatPct) : '–'}</div><div class="l">ไขมัน %</div></div><div class="stat"><div class="v num">${r1(bmi)}</div><div class="l">BMI</div></div><div class="stat"><div class="v num">${fmt(bmrInfo().v)}</div><div class="l">BMR kcal</div></div><div class="stat"><div class="v num">${fmt(baseline() + trainAvg())}</div><div class="l">TDEE วันซ้อม</div></div></div>
   ${goal}
  </section>
  <section class="card"><h2>ข้อมูลพื้นฐาน</h2><div class="fields">
   <label class="f"><span>ชื่อที่แสดงในทีม</span><input data-bind="profile.nick" value="${esc(p.nick)}" ${dis}></label>
   <label class="f"><span>อายุ</span><input type="number" data-bind="profile.age" data-type="num" value="${esc(p.age)}" ${dis}></label>
   <label class="f"><span>ส่วนสูง cm</span><input type="number" data-bind="profile.height" data-type="num" value="${esc(p.height)}" ${dis}></label>
   <label class="f"><span>กินมื้อสุดท้ายก่อน (โมง)</span><input type="number" data-bind="profile.cutoff" data-type="num" value="${esc(p.cutoff ?? 20)}" ${dis}></label></div>
   <label class="f"><span>อาหารที่แพ้ / เลี่ยง</span><textarea data-bind="profile.avoid" rows="2" ${dis}>${esc(p.avoid)}</textarea></label>
   <label class="f"><span>ข้อจำกัดร่างกาย</span><textarea data-bind="profile.limits" rows="2" ${dis}>${esc(p.limits || '')}</textarea></label>
  </section></div>
  ${own ? `<section class="card"><div class="card-h"><h2>เพิ่มผลวัดร่างกาย</h2><span class="small muted">InBody · ชั่ง · สายวัด</span></div>
   <div class="fields"><label class="f"><span>วันที่วัด</span><input type="date" id="m_date" value="${todayStr()}"></label>
    <label class="f"><span>น้ำหนัก kg</span><input type="number" step="0.1" id="m_weight"></label><label class="f"><span>มวลกล้ามเนื้อ SMM kg</span><input type="number" step="0.1" id="m_smm"></label>
    <label class="f"><span>ไขมัน kg</span><input type="number" step="0.1" id="m_fatKg"></label><label class="f"><span>ไขมัน %</span><input type="number" step="0.1" id="m_fatPct"></label>
    <label class="f"><span>BMR kcal</span><input type="number" id="m_bmr"></label><label class="f"><span>ไขมันช่องท้อง</span><input type="number" id="m_visc"></label><label class="f"><span>น้ำในร่างกาย kg</span><input type="number" step="0.1" id="m_water"></label></div>
   <details><summary>สัดส่วนร่างกาย (สายวัด)</summary><div class="seg" style="margin-bottom:10px"><button aria-pressed="${ui.measUnit !== 'in'}" data-act="measUnit" data-v="cm">cm</button><button aria-pressed="${ui.measUnit === 'in'}" data-act="measUnit" data-v="in">นิ้ว (แปลงให้)</button></div>
    <div class="fields">${CIRC.map(([k, l]) => `<label class="f"><span>${l} ${ui.measUnit === 'in' ? 'นิ้ว' : 'cm'}</span><input type="number" step="0.1" inputmode="decimal" id="m_${k}"></label>`).join('')}</div></details>
   <label class="f"><span>หมายเหตุ</span><input id="m_note"></label>
   <div class="row">${photoInput('id="m_photo"', 'แนบรูปใบผลวัด')}<button class="btn pri" data-act="measSave">บันทึกผลวัด</button></div>
  </section>` : ''}
  <section class="card"><div class="card-h"><h2>สัดส่วนร่างกาย</h2><span class="small muted">cm · (นิ้ว)</span></div>
   ${CIRC.some(([k]) => lastRec(k)) ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>จุดวัด</th><th class="n">ล่าสุด</th><th class="n">ครั้งแรก</th><th class="n">เปลี่ยน</th></tr></thead><tbody>${CIRC.map(([k, l]) => { const a = lastRec(k), f0 = firstVal(k); if (!a) return ''; const dv = f0 && f0.d !== a.d ? r1(a.v - f0.v) : null; return `<tr><td>${l}</td><td class="n">${r1(a.v)} <span class="muted">(${r1(a.v / 2.54)}")</span></td><td class="n">${f0 ? r1(f0.v) : '–'}</td><td class="n" style="color:${dv == null ? 'var(--muted)' : dv < 0 ? 'var(--good)' : dv > 0 ? 'var(--warn)' : 'var(--muted)'}">${dv == null ? '–' : (dv > 0 ? '+' : '') + dv}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="empty">ยังไม่มีข้อมูลสัดส่วน</p>'}
  </section>
  <section class="card"><h2>แนวโน้ม</h2><div class="trends">
   <div class="trend"><span class="eyebrow">น้ำหนัก kg</span>${trendSvg('weight', null)}</div><div class="trend"><span class="eyebrow">มวลกล้ามเนื้อ kg</span>${trendSvg('smm', +t.smmTarget || null)}</div>
   <div class="trend"><span class="eyebrow">ไขมัน %</span>${trendSvg('fatPct', +t.fatTarget || null)}</div><div class="trend"><span class="eyebrow">รอบเอว cm</span>${trendSvg('waist', null)}</div></div></section>
  <section class="card"><h2>ประวัติผลวัด</h2>${ms.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>วันที่</th><th class="n">น้ำหนัก</th><th class="n">SMM</th><th class="n">ไขมัน %</th><th class="n">BMR</th><th class="n">เอว</th><th class="n">สะโพก</th><th></th></tr></thead><tbody>
   ${[...ms].reverse().map(m => `<tr><td>${thShort(m.date)}${m.photoId ? ' ' + thumb(m.photoId) : ''}</td><td class="n">${m.weight ?? '–'}</td><td class="n">${m.smm ?? '–'}</td><td class="n">${fatPctOf(m) != null ? r1(fatPctOf(m)) : '–'}</td><td class="n">${m.bmr ?? '–'}</td><td class="n">${m.waist ?? '–'}</td><td class="n">${m.hip ?? '–'}</td><td>${own ? `<button class="btn sm link danger" data-act="measDel" data-date="${m.date}">ลบ</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">ยังไม่มีผลวัด</p>'}</section></div>`;
}

/* ---------- overview ---------- */
function renderOverview() {
  const N = 14, T0 = todayStr();
  const rows = [...Array(N)].map((_, i) => { const ds = addDays(T0, i - (N - 1)); const d = getDay(ds); const logged = d.meals.length > 0; const bK = burn(ds); const tdee = baseline() + bK; const tot = totals(ds); const m = macros(kcalTarget(bK)); return { ds, logged, net: logged ? tot.kcal - tdee : null, pHit: logged ? tot.p / m.p : null, tot, bK, tdee, tgtP: m.p, water: +d.water || 0, wo: workoutsOn(ds).length }; });
  const Lg = rows.filter(r => r.logged), avg = f => Lg.length ? Lg.reduce((a, r) => a + f(r), 0) / Lg.length : 0, sumNet = Lg.reduce((a, r) => a + r.net, 0);
  const W = 640, H = 230, Lp = 48, Rp = 10, Tp = 14, Bp = 44; let mx = Math.max(500, ...Lg.map(r => Math.abs(r.net))); mx = Math.ceil(mx / 250) * 250;
  const ph = H - Tp - Bp, y = v => Tp + ph / 2 - v / mx * ph / 2, bw = (W - Lp - Rp) / N;
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="สมดุลแคลอรี่ 14 วัน">${[-mx, -mx / 2, 0, mx / 2, mx].map(v => `<line class="${v === 0 ? 'ch-zero' : 'ch-grid'}" x1="${Lp}" x2="${W - Rp}" y1="${y(v)}" y2="${y(v)}"/><text class="ch-lbl" x="${Lp - 6}" y="${y(v) + 4}" text-anchor="end">${v > 0 ? '+' : ''}${fmt(v)}</text>`).join('')}
  ${rows.map((r, i) => { const x = Lp + i * bw, cx = x + bw / 2; let o = ''; if (r.net != null) { const y0 = y(0), y1 = y(r.net); o += `<rect class="${r.net < 0 ? 'ch-def' : 'ch-sur'}" x="${x + bw * 0.2}" y="${Math.min(y0, y1)}" width="${bw * 0.6}" height="${Math.max(1, Math.abs(y1 - y0))}" rx="2"/>`; } o += `<text class="ch-lbl" x="${cx}" y="${H - Bp + 16}" text-anchor="middle">${parseD(r.ds).getDate()}</text><circle class="${r.pHit != null && r.pHit >= 0.9 ? 'ch-on' : 'ch-off'}" cx="${cx}" cy="${H - 12}" r="4.5"/>`; return o; }).join('')}</svg>`;
  return `<div class="stack"><section class="card"><div class="card-h"><h2>สมดุลแคลอรี่ 14 วัน</h2></div>
  <div class="row small muted" style="gap:14px"><span><span class="dot" style="background:var(--accent)"></span> ขาดดุล</span><span><span class="dot" style="background:var(--pro)"></span> เกินดุล</span><span><span class="dot" style="background:var(--good)"></span> โปรตีนถึงเป้า</span></div>
  <div class="tbl-wrap">${svg}</div>
  <div class="stats"><div class="stat"><div class="v num">${Lg.length}/${N}</div><div class="l">วันที่บันทึก</div></div><div class="stat"><div class="v num">${fmt(avg(r => r.tot.kcal))}</div><div class="l">กินเฉลี่ย kcal</div></div><div class="stat"><div class="v num">${fmt(avg(r => r.tot.p))}</div><div class="l">โปรตีนเฉลี่ย g</div></div><div class="stat"><div class="v num">${r0(avg(r => r.tgtP - r.tot.p))}</div><div class="l">โปรตีนขาดเฉลี่ย g/วัน</div></div><div class="stat"><div class="v num">${rows.reduce((a, r) => a + r.wo, 0)}</div><div class="l">ครั้งที่เทรน</div></div><div class="stat"><div class="v num">${sumNet < 0 ? '−' : '+'}${r1(Math.abs(sumNet) / 7700)}</div><div class="l">ไขมันเปลี่ยนโดยประมาณ kg</div></div></div></section>
  <section class="card"><h2>รายวัน</h2><div class="tbl-wrap"><table class="t"><thead><tr><th>วัน</th><th class="n">กิน</th><th class="n">ออกกำลัง</th><th class="n">สุทธิ</th><th class="n">โปรตีน</th><th class="n">น้ำ ล.</th><th class="n">เทรน</th><th></th></tr></thead><tbody>
  ${[...rows].reverse().map(r => `<tr><td>${thShort(r.ds)}</td><td class="n">${r.logged ? fmt(r.tot.kcal) : '–'}</td><td class="n">${r.bK ? fmt(r.bK) : '–'}</td><td class="n" style="color:${r.net == null ? 'var(--muted)' : r.net < 0 ? 'var(--accent)' : 'var(--pro)'}">${r.net == null ? '–' : (r.net > 0 ? '+' : '') + fmt(r.net)}</td><td class="n">${r.logged ? r0(r.tot.p) + '/' + r0(r.tgtP) : '–'}</td><td class="n">${r.water ? L_(r.water) : '–'}</td><td class="n">${r.wo || '–'}</td><td><button class="btn sm link" data-act="gotoDay" data-date="${r.ds}">เปิด</button></td></tr>`).join('')}</tbody></table></div></section></div>`;
}

/* ---------- settings ---------- */
function renderSettings() {
  const tabs = [['targets', 'เป้าหมาย'], ['plan', 'แผนซ้อม'], ...(isOwner() ? [['members', 'สมาชิก'], ['line', 'LINE'], ['data', 'ข้อมูล']] : []), ['account', 'บัญชี']];
  if (!tabs.some(t => t[0] === ui.setTab)) ui.setTab = 'targets';
  const R = { targets: setTargets, plan: setPlan, members: setMembers, line: setLine, data: setData, account: setAccount }[ui.setTab];
  return `<div class="stack"><div class="seg">${tabs.map(([k, l]) => `<button aria-pressed="${ui.setTab === k}" data-act="setTab" data-v="${k}">${l}</button>`).join('')}</div>${R()}</div>`;
}
function setTargets() {
  const t = T(), p = P(), bi = bmrInfo(), base = baseline(), trainB = trainAvg(), dis = RO();
  const tR = kcalTarget(0), tT = kcalTarget(trainB), mR = macros(tR), mT = macros(tT);
  const row = (lbl, m) => `<tr><td>${lbl}</td><td class="n">${fmt(m.kcal)}</td><td class="n">${r0(m.p)}</td><td class="n">${r0(m.c)}</td><td class="n">${r0(m.f)}</td></tr>`;
  return `<section class="card"><h2>พลังงานพื้นฐาน</h2><div class="stats"><div class="stat"><div class="v num">${fmt(bi.v)}</div><div class="l">BMR · ${esc(bi.src)}</div></div><div class="stat"><div class="v num">${fmt(base)}</div><div class="l">ต่อวันไม่รวมออกกำลังกาย</div></div><div class="stat"><div class="v num">${fmt(base + trainB)}</div><div class="l">TDEE วันซ้อมเฉลี่ย</div></div></div>
   <label class="f"><span>กิจกรรมประจำวัน</span><select data-bind="profile.activity" data-type="num" ${dis}>${[[1.2, 'นั่งทำงานเป็นหลัก'], [1.3, 'เดินบ้าง'], [1.4, 'ยืน/เดินทั้งวัน'], [1.5, 'งานใช้แรง']].map(([v, l]) => `<option value="${v}" ${+p.activity === v ? 'selected' : ''}>${l} (×${v})</option>`).join('')}</select></label></section>
  <section class="card"><h2>เป้าหมายแคลอรี่</h2>
   <div class="seg">${Object.entries(GOALS).map(([k, v]) => `<button aria-pressed="${t.goal === k && t.kcalMode !== 'manual'}" data-act="goal" data-v="${k}" ${dis}>${v.n}</button>`).join('')}<button aria-pressed="${t.kcalMode === 'manual'}" data-act="kcalMode" data-v="manual" ${dis}>กำหนด kcal เอง</button></div>
   ${t.kcalMode === 'manual' ? `<label class="f"><span>กินวันละ (kcal)</span><input type="number" data-bind="targets.kcalManual" data-type="num" value="${esc(t.kcalManual)}" ${dis}></label>` : `<label class="f"><span>ปรับจาก TDEE (%)</span><input type="number" data-bind="targets.adj" data-type="num" value="${esc(t.adj)}" ${dis}></label>`}
   <label class="f"><span>TDEE จากเทรนเนอร์ (kcal/วัน)</span><input type="number" data-bind="targets.trainerTdee" data-type="num" value="${esc(t.trainerTdee ?? '')}" ${dis}></label>
   <label class="f"><span>เป้าดื่มน้ำ (มล./วัน) · เว้นว่าง = 30 มล./kg</span><input type="number" step="100" data-bind="targets.waterMl" data-type="num" value="${esc(t.waterMl ?? '')}" ${dis}></label></section>
  <section class="card"><h2>สัดส่วนสารอาหาร</h2>
   <div class="seg">${Object.entries(PRESETS).map(([k, v]) => `<button aria-pressed="${t.preset === k}" data-act="preset" data-v="${k}" ${dis}>${v.n}${v.p ? ` ${v.p}/${v.c}/${v.f}` : ''}</button>`).join('')}</div>
   ${t.preset === 'custom' ? `<div class="fields">${['p', 'c', 'f'].map(k => `<label class="f"><span>${{ p: 'โปรตีน', c: 'คาร์บ', f: 'ไขมัน' }[k]} %</span><input type="number" data-bind="targets.custom.${k}" data-type="num" value="${esc(t.custom[k])}" ${dis}></label>`).join('')}</div>` : ''}
   <div class="tbl-wrap"><table class="t"><thead><tr><th>วัน</th><th class="n">kcal</th><th class="n">P g</th><th class="n">C g</th><th class="n">F g</th></tr></thead><tbody>${row('วันพัก', mR)}${row('วันซ้อม', mT)}</tbody></table></div></section>
  <section class="card"><h2>เป้ากล้ามเนื้อ</h2><div class="fields"><label class="f"><span>เป้า SMM kg</span><input type="number" step="0.1" data-bind="targets.smmTarget" data-type="num" value="${esc(t.smmTarget)}" ${dis}></label><label class="f"><span>เป้าไขมัน %</span><input type="number" step="0.5" data-bind="targets.fatTarget" data-type="num" value="${esc(t.fatTarget)}" ${dis}></label><label class="f"><span>เวทก่อนเริ่มใช้แอป (session)</span><input type="number" data-bind="targets.sessionsBefore" data-type="num" value="${esc(t.sessionsBefore || 0)}" ${dis}></label></div></section>`;
}
function setPlan() {
  const order = [1, 2, 3, 4, 5, 6, 0], ed = isTrainer(), dis = ed ? '' : 'disabled', pl = PLAN();
  return `<section class="card"><div class="card-h"><h2>แผนซ้อมรายสัปดาห์</h2><span class="small muted">${ed ? 'เจ้าของและเทรนเนอร์แก้ได้' : 'ดูอย่างเดียว'}</span></div>${pl.note ? `<p class="small hint">${esc(pl.note)}</p>` : ''}</section>
  <div class="grid-days">${order.map(dw => { const p = planOf(dw); return `<section class="card">
   <div class="card-h"><h3>${TH_DOW[dw]}</h3><span class="num small muted">${p.rest ? 'พัก' : '≈ ' + fmt(planBurn(dw)) + ' kcal'}</span></div>
   <label class="f"><span>ชื่อวัน</span><input data-pd="${dw}|title" value="${esc(p.title || '')}" ${dis}></label>
   <div class="fields"><label class="f"><span>ประเภทเวท</span><select data-pd="${dw}|type" ${dis}><option value="">ไม่มีเวท</option>${WORKOUT_TYPES.map(([k, l]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label><label class="row small"><input type="checkbox" data-pd="${dw}|rest" ${p.rest ? 'checked' : ''} ${dis}> วันพัก</label></div>
   ${p.rest ? '' : `<div class="fields" style="grid-template-columns:minmax(0,1fr) 90px"><label class="f"><span>คาร์ดิโอ</span><select data-pd="${dw}|cardioType" ${dis}>${Object.entries(EX).filter(([k]) => !k.startsWith('weights') && k !== 'other').map(([k, v]) => `<option value="${k}" ${p.cardio?.type === k ? 'selected' : ''}>${v.n}</option>`).join('')}</select></label><label class="f"><span>นาที</span><input type="number" data-pd="${dw}|cardioMin" value="${esc(p.cardio?.min ?? 0)}" ${dis}></label></div>
   <div class="tbl-wrap"><table class="t w"><thead><tr><th>ท่าเวท</th><th>เซ็ต</th><th>ครั้ง</th><th>kg</th><th></th></tr></thead><tbody>${(p.weights || []).map((w, i) => `<tr><td><input data-pw="${dw}|${i}|n" value="${esc(w.n)}" style="min-width:120px" ${dis}></td><td><input type="number" data-pw="${dw}|${i}|s" value="${esc(w.s)}" style="width:52px" ${dis}></td><td><input data-pw="${dw}|${i}|r" value="${esc(w.r)}" style="width:64px" ${dis}></td><td><input type="number" step="0.5" data-pw="${dw}|${i}|kg" value="${esc(w.kg)}" style="width:60px" ${dis}></td><td>${ed ? `<button class="btn sm link danger" data-act="planDelW" data-dow="${dw}" data-i="${i}" aria-label="ลบท่า">✕</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
   ${ed ? `<div class="row between"><button class="btn sm" data-act="planAddW" data-dow="${dw}">+ เพิ่มท่า</button><label class="f" style="flex-direction:row;align-items:center;gap:6px"><span>เวลาเวท</span><input type="number" data-pd="${dw}|wMin" value="${esc(p.wMin ?? 0)}" style="width:64px"><span>นาที</span></label></div>` : ''}`}
  </section>`; }).join('')}</div>`;
}
function inviteLink(id, m) { return `${location.origin}${location.pathname}?join=${id}.${m.inviteCode}`; }
function setMembers() {
  const list = Object.entries(S.members);
  const devs = id => Object.values(S.devices).filter(d => d.memberId === id).length;
  return `<section class="card"><h2>สมาชิกในทีม</h2>
   <p class="small muted">เพิ่มชื่อเทรนเนอร์ แล้วส่ง "ลิงก์เชิญ" ให้ทาง LINE เทรนเนอร์เปิดลิงก์แล้วพิมพ์ชื่อให้ตรงกับที่ตั้งไว้ ไม่ต้องใช้รหัสผ่าน</p>
   ${list.length ? list.map(([id, m]) => `<div class="choice" style="flex-direction:column;align-items:stretch">
    <div class="row between"><div><b>${esc(m.name)}</b> <span class="pill plain">${ROLE_TH[m.role]}</span> ${m.active ? '' : '<span class="pill adjust">ปิดสิทธิ์</span>'}</div><span class="small muted">${devs(id)} อุปกรณ์</span></div>
    <div class="row" style="flex-wrap:nowrap"><input readonly value="${esc(inviteLink(id, m))}" id="inv_${id}"><button class="btn sm pri" data-act="copyInv" data-id="${id}">คัดลอกลิงก์</button></div>
    <div class="row"><button class="btn sm" data-act="memToggle" data-id="${id}">${m.active ? 'ปิดสิทธิ์' : 'เปิดสิทธิ์'}</button><button class="btn sm" data-act="memNewCode" data-id="${id}">สร้างลิงก์ใหม่</button><button class="btn sm link danger" data-act="memKick" data-id="${id}">ออกจากทุกอุปกรณ์</button></div>
   </div>`).join('') : '<p class="empty">ยังไม่มีสมาชิก</p>'}
   <div class="fields"><label class="f"><span>ชื่อ (ต้องพิมพ์ตรงกันตอนเข้าใช้)</span><input id="mem_name" placeholder="เช่น โค้ชบอม"></label><label class="f"><span>สิทธิ์</span><select id="mem_role"><option value="trainer">เทรนเนอร์ · บันทึกการเทรน แก้แผนได้</option><option value="viewer">ผู้ติดตาม · ดูอย่างเดียว</option><option value="owner">อุปกรณ์อื่นของฉัน · สิทธิ์เจ้าของ</option></select></label></div>
   <div class="row"><button class="btn pri" data-act="memAdd">เพิ่มสมาชิก</button></div></section>`;
}
function setLine() {
  const c = S.config || {};
  return `<section class="card"><h2>แจ้งเตือนกลุ่ม LINE</h2>
   <p class="small muted">ใส่ URL ของ Apps Script (ขั้นตอนที่ 4 ในคู่มือ) และรหัสลับที่ตั้งไว้ในสคริปต์ ทุกคนในทีมจะส่งแจ้งเตือนเข้ากลุ่มได้ การอัปเดตในช่วง 45 วินาทีจะรวมเป็นข้อความเดียว</p>
   <label class="f"><span>Apps Script Web App URL</span><input id="ln_url" value="${esc(c.lineUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec"></label>
   <label class="f"><span>รหัสลับ (APP_SECRET)</span><input id="ln_secret" value="${esc(c.lineSecret || '')}"></label>
   <label class="row small"><input type="checkbox" id="ln_on" ${c.lineOn ? 'checked' : ''}> เปิดแจ้งเตือน</label>
   <div class="row"><button class="btn pri" data-act="lineSave">บันทึก</button><button class="btn" data-act="lineTest">ส่งข้อความทดสอบ</button></div>
   <p class="small muted">แผนฟรีของ LINE OA ส่งได้ราว 300 ข้อความ/เดือน และข้อความเข้ากลุ่มนับตามจำนวนคนในกลุ่ม</p></section>`;
}
function setData() {
  return `<section class="card"><h2>นำเข้า / สำรองข้อมูล</h2>
   <div class="row"><label class="btn"><input type="file" accept="application/json,.json" hidden id="importFile">นำเข้าไฟล์ .json</label><button class="btn" data-act="exportJson">ดาวน์โหลดสำรองข้อมูล</button></div>
   <p class="small muted">ไฟล์นำเข้าจะเขียนทับข้อมูลที่มีวันที่หรือรหัสเดียวกัน ข้อมูลอื่นไม่หาย</p></section>
  <section class="card"><h2>วางจากอินัง</h2><p class="small muted">ข้อความที่ขึ้นต้นด้วย FIT1 จากแชตกับอินัง กดปุ่ม "วางจากอินัง" ในหน้าวันนี้ได้เลย</p><button class="btn pri" data-act="pasteOpen">เปิดช่องวาง</button></section>`;
}
function setAccount() {
  return `<section class="card"><h2>บัญชี</h2><p>${esc(S.me.name)} · ${ROLE_TH[S.me.role]}${S.me.email ? ` · ${esc(S.me.email)}` : ''}</p><button class="btn danger" data-act="signOut">ออกจากระบบ</button></section>`;
}

/* ============ sheets ============ */
function openSheet(html) { $('#sheetRoot').innerHTML = `<div class="sheet-bg" data-act="bgClose"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; hydratePhotos(); }
function closeSheet() { $('#sheetRoot').innerHTML = ''; ui.wo = null; }
function foodSheet() {
  const rows = FOODS.map(f => { const v = foodVal(f, f.d); return `<div class="food-row" data-name="${esc((f.n + ' ' + f.cat).toLowerCase())}"><div><div class="nm">${esc(f.n)}</div><div class="meta"><span class="fk" data-id="${f.id}">${fmt(v.kcal)} kcal · P ${r1(v.p)}</span> · ${f.u === 'g' ? 'กรัม' : esc(f.un)}</div></div><input type="number" class="fq" data-id="${f.id}" step="${f.u === 'g' ? 10 : 0.5}" value="${f.d}"><button class="btn sm" data-act="addFoodLib" data-id="${f.id}">เพิ่ม</button></div>`; }).join('');
  openSheet(`<div class="sheet-h"><h3>เพิ่มอาหาร · ${thShort(ui.date)}</h3><button class="btn sm" data-act="close">ปิด</button></div>
  <div class="seg" id="fsMeal">${MEALS.map(m => `<button aria-pressed="${ui.fsMeal === m}" data-act="fsMeal" data-v="${m}">${m}</button>`).join('')}</div>
  <input id="fsSearch" placeholder="ค้นหา เช่น ไข่ ปลา กุ้ง โยเกิร์ต ข้าว"><div class="flist">${rows}</div>
  <details open><summary>กรอกเอง</summary><div class="fields">
   <label class="f" style="grid-column:1/-1"><span>ชื่ออาหาร</span><input id="mf_name"></label><label class="f"><span>ปริมาณ</span><input id="mf_qty" placeholder="1 จาน"></label>
   <label class="f"><span>kcal</span><input type="number" id="mf_kcal"></label><label class="f"><span>โปรตีน g</span><input type="number" step="0.1" id="mf_p"></label><label class="f"><span>คาร์บ g</span><input type="number" step="0.1" id="mf_c"></label><label class="f"><span>ไขมัน g</span><input type="number" step="0.1" id="mf_f"></label></div>
   <div class="row" style="margin-top:10px"><button class="btn" data-act="mfCalc">คำนวณ kcal จาก P/C/F</button><button class="btn pri" data-act="mfAdd">เพิ่ม</button></div></details>`);
}
function editMealSheet(id) {
  const x = getDay(ui.date).meals.find(m => m.id === id); if (!x) return;
  openSheet(`<div class="sheet-h"><h3>แก้ไขรายการอาหาร</h3><button class="btn sm" data-act="close">ปิด</button></div><div class="fields">
   <label class="f" style="grid-column:1/-1"><span>ชื่ออาหาร</span><input id="e_name" value="${esc(x.name)}"></label>
   <label class="f"><span>มื้อ</span><select id="e_meal">${MEALS.map(m => `<option ${m === x.meal ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label class="f"><span>ปริมาณ</span><input id="e_qty" value="${esc(x.qty)}"></label>
   <label class="f" style="grid-column:1/-1"><span>${+x.g > 0 ? 'น้ำหนัก (กรัม) · แก้แล้วคำนวณใหม่ให้' : 'ปริมาณเทียบของเดิม (เท่า)'}</span><input type="number" id="e_amt" inputmode="decimal" step="${+x.g > 0 ? 10 : 0.25}" value="${+x.g > 0 ? x.g : 1}" data-hasg="${+x.g > 0 ? 1 : 0}" data-base="${+x.g > 0 ? x.g : 1}" data-k="${esc(x.kcal)}" data-p="${esc(x.p)}" data-c="${esc(x.c)}" data-f="${esc(x.f)}" data-qty="${esc(x.qty)}"></label>
   <label class="f"><span>kcal</span><input type="number" id="e_kcal" value="${esc(x.kcal)}"></label><label class="f"><span>โปรตีน g</span><input type="number" step="0.1" id="e_p" value="${esc(x.p)}"></label><label class="f"><span>คาร์บ g</span><input type="number" step="0.1" id="e_c" value="${esc(x.c)}"></label><label class="f"><span>ไขมัน g</span><input type="number" step="0.1" id="e_f" value="${esc(x.f)}"></label></div>
  <div class="row between"><button class="btn danger" data-act="delMeal" data-id="${id}">ลบรายการ</button><button class="btn pri" data-act="saveMeal" data-id="${id}">บันทึก</button></div>`);
}
function exSheet(id) {
  const x = id ? getDay(ui.date).exercises.find(e => e.id === id) : { type: 'swim_free_mod', min: 40, kcal: null, note: '' }; if (!x) return;
  openSheet(`<div class="sheet-h"><h3>${id ? 'แก้ไข' : 'เพิ่ม'}การออกกำลังกาย</h3><button class="btn sm" data-act="close">ปิด</button></div><div class="fields">
   <label class="f" style="grid-column:1/-1"><span>ประเภท</span><select id="x_type">${Object.entries(EX).map(([k, v]) => `<option value="${k}" ${k === x.type ? 'selected' : ''}>${v.n}</option>`).join('')}</select></label>
   <label class="f"><span>นาที</span><input type="number" id="x_min" value="${esc(x.min)}"></label><label class="f"><span>kcal จากนาฬิกา (ถ้ามี)</span><input type="number" id="x_kcal" value="${esc(x.kcal ?? '')}"></label>
   <label class="f" style="grid-column:1/-1"><span>หมายเหตุ</span><input id="x_note" value="${esc(x.note || '')}"></label></div>
  <div class="row between">${id ? `<button class="btn danger" data-act="delEx" data-id="${id}">ลบ</button>` : '<span></span>'}<button class="btn pri" data-act="saveEx" data-id="${id || ''}">บันทึก</button></div>`);
}
function pasteSheet() {
  openSheet(`<div class="sheet-h"><h3>วางจากอินัง</h3><button class="btn sm" data-act="close">ปิด</button></div>
  <p class="small muted">ก๊อปข้อความที่ขึ้นต้นด้วย <b>FIT1</b> จากแชตกับอินัง แล้ววางด้านล่าง</p>
  <textarea id="pasteText" rows="6" placeholder="FIT1 {…}"></textarea>
  <div class="row"><button class="btn" data-act="pastePreview">ตรวจสอบ</button><button class="btn pri" data-act="pasteApply" ${ui.pasted ? '' : 'disabled'}>นำเข้า</button></div><div id="pasteOut">${ui.pasted ? pastePreviewHtml(ui.pasted) : ''}</div>`);
}
function parsePaste(txt) { const i = txt.indexOf('FIT1'); if (i < 0) throw new Error('ไม่พบคำว่า FIT1'); const a = txt.indexOf('{', i), b = txt.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('รูปแบบข้อมูลไม่ครบ'); return JSON.parse(txt.slice(a, b + 1)); }
function pastePreviewHtml(o) {
  const L = [];
  if (o.meals?.length) L.push(`อาหาร ${o.meals.length} รายการ (${fmt(o.meals.reduce((a, m) => a + (+m.kcal || 0), 0))} kcal · P ${r0(o.meals.reduce((a, m) => a + (+m.p || 0), 0))})`);
  if (o.exercises?.length) L.push(`ออกกำลังกาย ${o.exercises.length} รายการ`);
  if (o.water) L.push(`น้ำดื่ม +${o.water} มล.`);
  if (o.pantryAdd?.length) L.push(`เพิ่มของเข้าคลัง ${o.pantryAdd.length} รายการ`);
  if (o.pantryUse?.length) L.push(`ตัดคลัง ${o.pantryUse.length} รายการ`);
  if (o.measurement) L.push(`ผลวัดร่างกาย ${o.measurement.date || ''}`);
  if (o.recipes?.length) L.push(`เมนูใหม่ในสมุด ${o.recipes.length} เมนู`);
  return `<div class="banner"><span>วันที่ <b>${esc(o.date || ui.date)}</b> · ${L.map(esc).join(' · ') || 'ไม่มีข้อมูล'}</span></div>`;
}
async function applyPaste(o) {
  const ds = o.date || ui.date; const d = ensureDay(ds); const parts = [];
  (o.meals || []).forEach(m => d.meals.push({ id: newId(), meal: MEALS.includes(m.meal) ? m.meal : defaultMeal(), name: String(m.name || 'อาหาร'), qty: String(m.qty || ''), g: +m.g > 0 ? +m.g : null, kcal: r0(m.kcal), p: r1(m.p), c: r1(m.c), f: r1(m.f) }));
  (o.exercises || []).forEach(e => d.exercises.push({ id: newId(), type: EX[e.type] ? e.type : 'other', min: +e.min || 0, kcal: e.kcal ?? null, note: String(e.note || '') }));
  if (o.water) d.water = Math.max(0, (+d.water || 0) + (+o.water || 0));
  saveDay(ds);
  if (o.meals?.length) parts.push(`บันทึกอาหาร ${[...new Set(o.meals.map(m => m.meal))].join('/')}: ${o.meals.map(m => m.name).join(', ')} (${fmt(o.meals.reduce((a, m) => a + (+m.kcal || 0), 0))} kcal · P${r0(o.meals.reduce((a, m) => a + (+m.p || 0), 0))})`);
  if (o.exercises?.length) parts.push(`ออกกำลังกาย: ${o.exercises.map(e => `${(EX[e.type] || EX.other).n} ${e.min || ''} นาที`).join(', ')}`);
  (o.pantryAdd || []).forEach(p => { const m = pantryFind(p.name); if (m) { const it = S.pantry[m[0]]; it.qty = r1((+it.qty || 0) + (+p.qty || 0)); if (p.perDay) it.perDay = +p.perDay; savePantry(m[0], it); } else savePantry('p-' + newId(), { name: p.name, qty: +p.qty || 0, unit: p.unit || 'g', perDay: +p.perDay || 0, lowDays: +p.lowDays || 2, uses: [] }); });
  (o.pantryUse || []).forEach(u => { const m = pantryFind(u.name); if (m) pantryUse(m[0], +u.amt, ds); });
  if (o.measurement) { saveMeasurement(o.measurement); parts.push('เพิ่มผลวัดร่างกาย'); }
  (o.recipes || []).forEach(r => { const id = 'r-' + newId(); S.recipes[id] = r; put('recipes/' + id, r).catch(() => { }); });
  if (parts.length) logAct('food', parts.join(' · '));
  render();
}
function saveMeasurement(m) {
  if (!S.profileDoc) S.profileDoc = defaultProfileDoc();
  const list = S.profileDoc.measurements || []; const prev = list.find(x => x.date === m.date); if (prev) Object.keys(prev).forEach(k => { if (m[k] == null) m[k] = prev[k]; });
  S.profileDoc.measurements = [...list.filter(x => x.date !== m.date), m]; if (m.weight) S.profileDoc.profile.weight = m.weight; saveProfile();
}

/* ============ trainer text ============ */
function trainerDayText(ds) {
  const d = getDay(ds), A = analyze(ds), L = [`สรุป ${thDate(ds)} ${parseD(ds).getFullYear() + 543}`];
  L.push(`เป้า ${fmt(A.tgt)} kcal · P${r0(A.m.p)} C${r0(A.m.c)} F${r0(A.m.f)}`); L.push(`กินรวม ${fmt(A.tot.kcal)} kcal · P${r0(A.tot.p)} C${r0(A.tot.c)} F${r0(A.tot.f)}`);
  L.push(`เผาผลาญประมาณ ${fmt(A.tdee)} · สุทธิ ${A.tot.kcal - A.tdee > 0 ? '+' : ''}${fmt(A.tot.kcal - A.tdee)} kcal`); L.push('');
  MEALS.forEach(ml => { const it = d.meals.filter(x => x.meal === ml); L.push(`${ml}: ${it.length ? it.map(x => `${x.name}${x.qty ? ' ' + x.qty : ''} (${fmt(x.kcal)})`).join(' · ') : '-'}`); });
  L.push(''); L.push(`ออกกำลังกาย: ${d.exercises.length ? d.exercises.map(e => `${(EX[e.type] || EX.other).n} ${r0(e.min)} นาที`).join(' · ') : 'ไม่มี'}`);
  workoutsOn(ds).forEach(w => L.push(`เทรน ${w.title}: ${woSummary(w)}`));
  L.push(`น้ำดื่ม: ${L_(+d.water || 0)} / ${L_(waterTarget(ds))} ลิตร`); if (d.note) L.push(`หมายเหตุ: ${d.note}`);
  return L.join('\n');
}
function trainerWeekText() {
  const T0 = ui.date, L = [`สรุป 7 วัน ถึง ${thShort(T0)}`, 'วันที่ | kcal | โปรตีน | น้ำ | เทรน']; let sk = 0, sp = 0, n = 0;
  for (let i = 6; i >= 0; i--) { const ds = addDays(T0, -i), d = getDay(ds), tot = totals(ds); if (d.meals.length) { sk += tot.kcal; sp += tot.p; n++; } L.push(`${thShort(ds)} | ${d.meals.length ? fmt(tot.kcal) : '-'} | ${d.meals.length ? r0(tot.p) : '-'} | ${+d.water ? L_(d.water) : '-'} | ${workoutsOn(ds).map(w => w.title).join(', ') || '-'}`); }
  L.push(''); L.push(n ? `เฉลี่ย ${fmt(sk / n)} kcal · โปรตีน ${r0(sp / n)} g/วัน (บันทึก ${n}/7 วัน)` : 'ยังไม่มีบันทึกอาหาร'); L.push(`เวทสะสม ${weightSessions()} session`);
  const w = latestVal('weight'), wa = lastRec('waist'); if (w) L.push(`น้ำหนักล่าสุด ${w} kg${wa ? ` · รอบเอว ${wa.v} cm` : ''}`);
  return L.join('\n');
}
async function copyText(txt) { const box = $('#shareOut'); try { await navigator.clipboard.writeText(txt); toast('คัดลอกแล้ว'); } catch (e) { toast('กดค้างที่ข้อความแล้วเลือกคัดลอก'); } if (box) { box.value = txt; box.hidden = false; } }

/* ============ actions ============ */
function addMealItems(ds, items, meal) {
  const d = ensureDay(ds); items.forEach(x => d.meals.push({ id: newId(), meal: meal || x.meal, ...x, meal: meal || x.meal })); saveDay(ds);
  const k = items.reduce((a, x) => a + (+x.kcal || 0), 0), p = items.reduce((a, x) => a + (+x.p || 0), 0);
  logAct('food', `บันทึกมื้อ${meal || items[0].meal}${ds !== todayStr() ? ` (${thShort(ds)})` : ''}: ${items.map(x => `${x.name}${x.qty ? ' ' + x.qty : ''}`).join(', ')} · ${fmt(k)} kcal · P${r0(p)}`);
  render();
}
const readNum = id => num($(id)?.value);
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return; if (a.disabled) return;
  const act = a.dataset.act;
  if (act === 'bgClose') { if (e.target === a) closeSheet(); return; }
  switch (act) {
    case 'tab': ui.tab = a.dataset.v; if (a.dataset.set) ui.setTab = a.dataset.set; try { history.replaceState(null, '', '#' + ui.tab); } catch (_) { } render(); window.scrollTo(0, 0); break;
    case 'close': closeSheet(); break;
    case 'ownerLogin': ownerLogin(); break;
    case 'joinGo': joinGo(); break;
    case 'joinPaste': { const m = ($('#invPaste').value || '').match(/join=([\w-]+\.[\w-]+)/); if (!m) { toast('ลิงก์ไม่ถูกต้อง'); break; } history.replaceState(null, '', location.pathname + '?join=' + m[1]); renderJoin(); break; }
    case 'signOut': doSignOut(); break;
    case 'dPrev': ui.date = addDays(ui.date, -1); render(); break;
    case 'dNext': ui.date = addDays(ui.date, 1); render(); break;
    case 'dToday': ui.date = todayStr(); render(); break;
    case 'gotoDay': ui.date = a.dataset.date; ui.tab = 'today'; render(); window.scrollTo(0, 0); break;
    case 'startDefault': S.profileDoc = defaultProfileDoc(); S.plan = defaultPlan(); saveProfile(); savePlan(); render(); break;
    case 'addFood': ui.fsMeal = a.dataset.meal || defaultMeal(); foodSheet(); break;
    case 'fsMeal': ui.fsMeal = a.dataset.v; document.querySelectorAll('#fsMeal button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === ui.fsMeal)); break;
    case 'addFoodLib': { const f = FOOD[a.dataset.id]; const q = num(document.querySelector(`.fq[data-id="${f.id}"]`).value) || f.d; const v = foodVal(f, q); addMealItems(ui.date, [{ name: f.n, qty: qtyText(f, q), g: f.u === 'g' ? r0(q) : null, kcal: r0(v.kcal), p: r1(v.p), c: r1(v.c), f: r1(v.f) }], ui.fsMeal); toast(`เพิ่ม ${f.n} แล้ว`); break; }
    case 'mfCalc': $('#mf_kcal').value = r0((readNum('#mf_p') || 0) * 4 + (readNum('#mf_c') || 0) * 4 + (readNum('#mf_f') || 0) * 9); break;
    case 'mfAdd': { const name = $('#mf_name').value.trim(); if (!name) { toast('ใส่ชื่ออาหารก่อน'); break; } const p = readNum('#mf_p') || 0, c = readNum('#mf_c') || 0, f = readNum('#mf_f') || 0; let k = readNum('#mf_kcal'); if (k == null) k = p * 4 + c * 4 + f * 9; addMealItems(ui.date, [{ name, qty: $('#mf_qty').value.trim(), kcal: r0(k), p: r1(p), c: r1(c), f: r1(f) }], ui.fsMeal); ['#mf_name', '#mf_qty', '#mf_kcal', '#mf_p', '#mf_c', '#mf_f'].forEach(s => $(s).value = ''); toast(`เพิ่ม ${name} แล้ว`); break; }
    case 'editMeal': editMealSheet(a.dataset.id); break;
    case 'saveMeal': { const id = a.dataset.id, ds = ui.date, am = $('#e_amt'); const v = { name: $('#e_name').value.trim() || 'อาหาร', meal: $('#e_meal').value, qty: $('#e_qty').value.trim(), kcal: r0(readNum('#e_kcal') || 0), p: r1(readNum('#e_p') || 0), c: r1(readNum('#e_c') || 0), f: r1(readNum('#e_f') || 0) }; if (am && am.dataset.hasg === '1' && num(am.value) > 0) v.g = r0(num(am.value)); mut(() => { const x = ensureDay(ds).meals.find(m => m.id === id); if (x) Object.assign(x, v); }, { day: ds }); closeSheet(); break; }
    case 'delMeal': { const id = a.dataset.id, ds = ui.date; mut(() => { const d = ensureDay(ds); d.meals = d.meals.filter(m => m.id !== id); }, { day: ds }); closeSheet(); break; }
    case 'addEx': exSheet(null); break;
    case 'editEx': exSheet(a.dataset.id); break;
    case 'saveEx': { const id = a.dataset.id, ds = ui.date; const v = { type: $('#x_type').value, min: readNum('#x_min') || 0, kcal: readNum('#x_kcal'), note: $('#x_note').value.trim() }; mut(() => { const d = ensureDay(ds); if (id) Object.assign(d.exercises.find(e => e.id === id) || {}, v); else d.exercises.push({ id: newId(), ...v }); }, { day: ds }); if (!id) logAct('ex', `ออกกำลังกาย: ${(EX[v.type] || EX.other).n} ${v.min} นาที ~${fmt(exKcal(v))} kcal`); closeSheet(); break; }
    case 'delEx': { const id = a.dataset.id, ds = ui.date; mut(() => { const d = ensureDay(ds); d.exercises = d.exercises.filter(x => x.id !== id); }, { day: ds }); closeSheet(); break; }
    case 'planCardio': { const ds = ui.date, pl = planOf(dowOf(ds)); mut(() => ensureDay(ds).exercises.push({ id: newId(), type: pl.cardio.type, min: +pl.cardio.min, kcal: null, note: '', fromPlan: 'cardio' }), { day: ds }); logAct('ex', `ทำคาร์ดิโอตามแผน: ${EX[pl.cardio.type]?.n} ${pl.cardio.min} นาที`); break; }
    case 'water': { const ds = ui.date, v = +a.dataset.v; mut(() => { const d = ensureDay(ds); d.water = Math.max(0, (+d.water || 0) + v); }, { day: ds }); break; }
    case 'protAdd': { const pl = ui.protPlans[+a.dataset.i]; if (pl) addMealItems(ui.date, pl.items, lateNow(ui.date) || nowHour() >= 14 ? (nowHour() >= 17 && !lateNow(ui.date) ? 'เย็น' : 'ว่าง') : nowHour() < 10 ? 'เช้า' : 'กลางวัน'); break; }
    case 'sendMsg': { const t = $('#msgText').value.trim(); if (!t) break; $('#msgText').value = ''; await logAct('msg', t); toast('ส่งแล้ว'); break; }
    case 'copyDay': copyText(trainerDayText(ui.date)); break;
    case 'copyWeek': copyText(trainerWeekText()); break;
    case 'lineDay': if (sendLineNow(trainerDayText(ui.date))) toast('ส่งสรุปเข้ากลุ่ม LINE แล้ว'); break;
    case 'pasteOpen': ui.pasted = null; pasteSheet(); break;
    case 'pastePreview': try { ui.pasted = parsePaste($('#pasteText').value); $('#pasteOut').innerHTML = pastePreviewHtml(ui.pasted); document.querySelector('[data-act="pasteApply"]').disabled = false; } catch (err) { $('#pasteOut').innerHTML = `<p class="small" style="color:var(--bad)">${esc(err.message)} · ก๊อปข้อความจากอินังให้ครบทั้งก้อน</p>`; } break;
    case 'pasteApply': if (ui.pasted) { await applyPaste(ui.pasted); ui.pasted = null; closeSheet(); toast('นำเข้าแล้ว'); } break;
    // train
    case 'woNew': ui.wo = woBlank(a.dataset.date || todayStr()); woSheet(); break;
    case 'woEdit': { const w = S.workouts[a.dataset.id]; if (w) { ui.wo = { id: a.dataset.id, ...clone(w) }; woSheet(); } break; }
    case 'woCopy': { const w = S.workouts[a.dataset.id]; if (w) { const c = clone(w); ui.wo = { ...c, id: undefined, date: todayStr(), note: '', photoIds: [], byName: undefined, byUid: undefined }; woSheet(); } break; }
    case 'woFromPlan': { const b = woBlank(ui.wo.date); ui.wo.exercises = b.exercises; woSheet(); break; }
    case 'woFromLast': { const l = lastSessionOf(ui.wo.type, ui.wo.id); if (!l) { toast('ยังไม่มีบันทึกครั้งก่อนของประเภทนี้'); break; } ui.wo.exercises = clone(l[1].exercises).map(e => ({ ...e, note: '' })); woSheet(); toast(`ดึงจาก ${thShort(l[1].date)}`); break; }
    case 'woAddEx': ui.wo.exercises.push({ name: '', note: '', sets: [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }] }); woSheet(); break;
    case 'woDelEx': ui.wo.exercises.splice(+a.dataset.i, 1); woSheet(); break;
    case 'woAddSet': { const ex = ui.wo.exercises[+a.dataset.i]; const last = ex.sets[ex.sets.length - 1] || { kg: '', reps: '' }; ex.sets.push({ ...last }); woSheet(); break; }
    case 'woDelSet': ui.wo.exercises[+a.dataset.i].sets.splice(+a.dataset.j, 1); woSheet(); break;
    case 'woSave': {
      const w = ui.wo; const id = w.id || ('w-' + w.date + '-' + newId()); const isNew = !w.id;
      const body = { date: w.date, type: w.type, title: (WORKOUT_TYPES.find(x => x[0] === w.type) || ['', w.title])[1], min: +w.min || 60, note: w.note || '', photoIds: w.photoIds || [], exercises: (w.exercises || []).filter(e => String(e.name || '').trim()).map(e => ({ name: String(e.name).trim(), note: e.note || '', sets: (e.sets || []).map(s => ({ kg: num(s.kg) ?? 0, reps: num(s.reps) ?? 0 })).filter(s => s.kg || s.reps) })), byName: w.byName || S.me.name, byUid: w.byUid || S.me.uid, updatedAt: Date.now(), updatedBy: S.me.name };
      try { await put('workouts/' + id, body); S.workouts[id] = body; closeSheet(); render(); logAct('train', `${isNew ? 'บันทึก' : 'แก้ไข'}การเทรน ${thShort(body.date)} · ${body.title}: ${woSummary(body)}`); toast('บันทึกการเทรนแล้ว'); } catch (err) { }
      break;
    }
    case 'woDel': { const id = ui.wo.id; if (a.dataset.confirm !== '1') { a.dataset.confirm = '1'; a.textContent = 'กดอีกครั้งเพื่อยืนยันการลบ'; break; } await del('workouts/' + id); delete S.workouts[id]; closeSheet(); render(); break; }
    case 'progEx': ui.progEx = a.dataset.k; render(); break;
    case 'photoView': { const id = a.dataset.id; openSheet(`<div class="sheet-h"><h3>รูปภาพ</h3><button class="btn sm" data-act="close">ปิด</button></div><img data-pid="${id}" alt="" style="width:100%;border-radius:12px">`); break; }
    // kitchen
    case 'bookMeal': ui.bookMeal = a.dataset.v; render(); break;
    case 'bookEat': { const r = S.recipes[a.dataset.id]; if (!r) break; const meal = $('#bkMeal_' + a.dataset.id)?.value || defaultMeal(); const used = []; (r.uses || []).forEach(u => { const m = pantryFind(u.k, u.u); if (m) { pantryUse(m[0], +u.amt, ui.date); used.push(`${m[1].name} −${u.amt}${u.u === 'g' ? 'g' : ' ' + (u.u || '')}`); } }); addMealItems(ui.date, [{ name: r.name, qty: '1 ที่', kcal: r0(r.kcal), p: r1(r.p), c: r1(r.c), f: r1(r.f) }], meal); toast(`บันทึก ${r.name} แล้ว${used.length ? ' · ตัดคลัง: ' + used.join(', ') : ''}`); break; }
    case 'bookDel': { const id = a.dataset.id; if (a.dataset.confirm !== '1') { a.dataset.confirm = '1'; a.textContent = 'กดอีกครั้งเพื่อลบ'; break; } delete S.recipes[id]; await del('recipes/' + id); render(); break; }
    case 'libSave': { const r = matchRecipes()[+a.dataset.i]; if (!r) break; const id = 'r-' + newId(); const body = { name: r.n, meals: [defaultMeal()], time: r.t + ' นาที', ingredients: [...r.need, ...r.opt], steps: r.steps, kcal: r.k, p: r.p, c: r.c, f: r.f, tags: [], note: '', createdAt: todayStr() }; S.recipes[id] = body; put('recipes/' + id, body).catch(() => { }); toast('เก็บลงสมุดเมนูแล้ว'); render(); break; }
    case 'pantryGo': ui.pantry = $('#pantry').value; render(); break;
    case 'menuType': ui.menuType = a.dataset.v; render(); break;
    case 'menuNew': ui.menuSeed++; render(); break;
    case 'menuAdd': MEALS.forEach(ml => { const its = (ui.menu || []).filter(x => x.meal === ml); if (its.length) { const d = ensureDay(ui.date); its.forEach(x => d.meals.push({ id: newId(), ...x })); } }); saveDay(ui.date); logAct('food', `เพิ่มเมนูทั้งวันลงบันทึก ${thShort(ui.date)}`); render(); toast('เพิ่มแล้ว'); break;
    case 'pUse': case 'pAdd': { const id = a.dataset.id, v = num($('#pq_' + id)?.value); if (!(v > 0)) { toast('ใส่จำนวนก่อน'); break; } if (act === 'pUse') pantryUse(id, v, ui.date); else { const it = S.pantry[id]; it.qty = r1((+it.qty || 0) + v); savePantry(id, it); } render(); break; }
    case 'pNew': { const name = $('#pn_name').value.trim(), q = num($('#pn_qty').value); if (!name || q == null) { toast('ใส่ชื่อและจำนวน'); break; } savePantry('p-' + newId(), { name, qty: q, unit: $('#pn_unit').value, perDay: num($('#pn_per').value) || 0, lowDays: num($('#pn_low').value) || 2, uses: [] }); logAct('pantry', `เพิ่ม ${name} ${q} ${$('#pn_unit').value} เข้าคลัง`, { line: false }); render(); break; }
    case 'pEdit': { const id = a.dataset.id, it = S.pantry[id]; openSheet(`<div class="sheet-h"><h3>แก้ไข ${esc(it.name)}</h3><button class="btn sm" data-act="close">ปิด</button></div><div class="fields"><label class="f" style="grid-column:1/-1"><span>ชื่อ</span><input id="pe_name" value="${esc(it.name)}"></label><label class="f"><span>คงเหลือ</span><input type="number" id="pe_qty" value="${esc(it.qty)}"></label><label class="f"><span>หน่วย</span><select id="pe_unit">${PUNITS.map(u => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label><label class="f"><span>ใช้ต่อวัน</span><input type="number" id="pe_per" value="${esc(it.perDay || '')}"></label><label class="f"><span>เตือนเมื่อเหลือ (วัน)</span><input type="number" id="pe_low" value="${esc(it.lowDays || 2)}"></label></div><div class="row between"><button class="btn danger" data-act="pDel" data-id="${id}">ลบ</button><button class="btn pri" data-act="pSave" data-id="${id}">บันทึก</button></div>`); break; }
    case 'pSave': { const id = a.dataset.id, it = S.pantry[id]; Object.assign(it, { name: $('#pe_name').value.trim() || it.name, qty: num($('#pe_qty').value) ?? it.qty, unit: $('#pe_unit').value, perDay: num($('#pe_per').value) || 0, lowDays: num($('#pe_low').value) || 2 }); savePantry(id, it); closeSheet(); render(); break; }
    case 'pDel': { const id = a.dataset.id; delete S.pantry[id]; await del('pantry/' + id); closeSheet(); render(); break; }
    // body
    case 'measUnit': ui.measUnit = a.dataset.v; render(); break;
    case 'measSave': {
      const m = { date: $('#m_date').value || todayStr(), weight: readNum('#m_weight'), smm: readNum('#m_smm'), fatKg: readNum('#m_fatKg'), fatPct: readNum('#m_fatPct'), bmr: readNum('#m_bmr'), visc: readNum('#m_visc'), water: readNum('#m_water'), note: $('#m_note').value.trim() };
      CIRC.forEach(([k]) => { const v = readNum('#m_' + k); if (v != null) m[k] = r1(ui.measUnit === 'in' ? v * 2.54 : v); });
      if (m.fatPct == null && m.fatKg != null && m.weight) m.fatPct = r1(m.fatKg / m.weight * 100);
      Object.keys(m).forEach(k => { if (m[k] == null || m[k] === '') delete m[k]; });
      if (Object.keys(m).length <= 1) { toast('ใส่อย่างน้อย 1 ค่า'); break; }
      const f = $('#m_photo')?.files?.[0]; if (f) { try { m.photoId = await addPhoto(f, { kind: 'body', date: m.date }); } catch (err) { } }
      saveMeasurement(m); render(); logAct('body', `ผลวัดร่างกาย ${thShort(m.date)}${m.weight ? ` · น้ำหนัก ${m.weight} kg` : ''}${m.smm ? ` · SMM ${m.smm} kg` : ''}${m.waist ? ` · เอว ${m.waist} cm` : ''}`); toast('บันทึกผลวัดแล้ว'); break;
    }
    case 'measDel': { const dt = a.dataset.date; S.profileDoc.measurements = S.profileDoc.measurements.filter(x => x.date !== dt); saveProfile(); render(); break; }
    // settings
    case 'setTab': ui.setTab = a.dataset.v; render(); break;
    case 'goal': mut(() => { const t = S.profileDoc.targets; t.goal = a.dataset.v; t.adj = GOALS[a.dataset.v].adj; t.kcalMode = 'auto'; }, { prof: true }); break;
    case 'kcalMode': mut(() => { S.profileDoc.targets.kcalMode = a.dataset.v; }, { prof: true }); break;
    case 'preset': mut(() => { S.profileDoc.targets.preset = a.dataset.v; }, { prof: true }); break;
    case 'planAddW': { const dw = a.dataset.dow; mut(() => { const p = S.plan.days[dw]; p.weights = p.weights || []; p.weights.push({ n: '', s: 3, r: '12', kg: 0 }); if (!+p.wMin) p.wMin = 60; }, { plan: true }); break; }
    case 'planDelW': mut(() => { S.plan.days[a.dataset.dow].weights.splice(+a.dataset.i, 1); }, { plan: true }); break;
    case 'memAdd': { const name = $('#mem_name').value.trim(); if (!name) { toast('ใส่ชื่อก่อน'); break; } const id = 'm-' + newId(); const body = { name, nameKey: normName(name), role: $('#mem_role').value, inviteCode: newId() + newId(), active: true, createdAt: Date.now() }; await put('members/' + id, body); S.members[id] = body; render(); toast('เพิ่มแล้ว คัดลอกลิงก์ส่งให้ได้เลย'); break; }
    case 'copyInv': { const inp = $('#inv_' + a.dataset.id); try { await navigator.clipboard.writeText(inp.value); toast('คัดลอกลิงก์แล้ว'); } catch (err) { inp.select(); toast('กดค้างเพื่อคัดลอก'); } break; }
    case 'memToggle': { const id = a.dataset.id, m = S.members[id]; m.active = !m.active; await put('members/' + id, m); render(); break; }
    case 'memNewCode': { const id = a.dataset.id, m = S.members[id]; m.inviteCode = newId() + newId(); await put('members/' + id, m); render(); toast('ลิงก์เดิมใช้ไม่ได้แล้ว ส่งลิงก์ใหม่แทน'); break; }
    case 'memKick': { const id = a.dataset.id; const ds = Object.entries(S.devices).filter(([, d]) => d.memberId === id); for (const [uid] of ds) await del('memberDevices/' + uid); toast(`ออกจากระบบ ${ds.length} อุปกรณ์แล้ว`); break; }
    case 'lineSave': { const c = { ...S.config, lineUrl: $('#ln_url').value.trim(), lineSecret: $('#ln_secret').value.trim(), lineOn: $('#ln_on').checked }; await put('config/app', c); S.config = c; toast('บันทึกแล้ว'); break; }
    case 'lineTest': { S.config = { ...S.config, lineUrl: $('#ln_url').value.trim(), lineSecret: $('#ln_secret').value.trim() }; if (sendLineNow(`Fit Routine: ทดสอบการแจ้งเตือนจาก ${S.me.name} ✅`)) toast('ส่งแล้ว ดูในกลุ่ม LINE'); break; }
    case 'exportJson': exportJson(); break;
  }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.bind) { if (!isOwner()) return; const v = el.dataset.type === 'num' ? num(el.value) : el.value; if (el.dataset.type === 'num' && v == null) return; mut(() => setPath(S.profileDoc, el.dataset.bind, v), { prof: true }); return; }
  if (el.dataset.pd) { const [dw, f] = el.dataset.pd.split('|'); mut(() => { const p = S.plan.days[dw] = S.plan.days[dw] || { title: '', rest: false, cardio: { type: 'swim_easy', min: 0 }, wMin: 0, weights: [] }; p.cardio = p.cardio || { type: 'swim_easy', min: 0 }; if (f === 'title') p.title = el.value; else if (f === 'rest') p.rest = el.checked; else if (f === 'type') p.type = el.value; else if (f === 'cardioType') p.cardio.type = el.value; else if (f === 'cardioMin') p.cardio.min = num(el.value) || 0; else if (f === 'wMin') p.wMin = num(el.value) || 0; }, { plan: true }); return; }
  if (el.dataset.pw) { const [dw, i, f] = el.dataset.pw.split('|'); mut(() => { const w = S.plan.days[dw].weights[+i]; if (w) w[f] = (f === 's' || f === 'kg') ? (num(el.value) || 0) : el.value; }, { plan: true }); return; }
  if (el.dataset.wo && ui.wo) { const path = el.dataset.wo; setPath(ui.wo, path, el.value); if (path === 'type') { ui.wo.title = (WORKOUT_TYPES.find(x => x[0] === el.value) || ['', ''])[1]; } return; }
  if (el.id === 'dayNote') { const ds = ui.date; mut(() => { ensureDay(ds).note = el.value; }, { day: ds }); return; }
  if (el.id === 'dateInput' && el.value) { ui.date = el.value; render(); return; }
  if (el.id === 'pantry') { ui.pantry = el.value; return; }
  if (el.id === 'importFile' && el.files[0]) { importJson(el.files[0]); return; }
  if (el.type === 'file' && el.files?.[0]) {
    const f = el.files[0];
    try {
      if (el.dataset.photoMeal) { toast('กำลังย่อรูป...'); const ml = el.dataset.photoMeal, ds = ui.date; const id = await addPhoto(f, { kind: 'meal', date: ds, meal: ml }); const d = ensureDay(ds); d.photos = d.photos || {}; (d.photos[ml] = d.photos[ml] || []).push(id); saveDay(ds); render(); logAct('food', `แนบรูปมื้อ${ml} ${thShort(ds)}`); toast('แนบรูปแล้ว'); }
      else if (el.dataset.photoRecipe) { toast('กำลังย่อรูป...'); const rid = el.dataset.photoRecipe, r = S.recipes[rid]; const id = await addPhoto(f, { kind: 'recipe', recipeId: rid }); r.photoIds = [...(r.photoIds || []), id]; await put('recipes/' + rid, r); render(); logAct('recipe', `เพิ่มรูปผลงานเมนู ${r.name}`, { line: false }); toast('เพิ่มรูปแล้ว'); }
      else if (el.dataset.photoWo && ui.wo) { toast('กำลังย่อรูป...'); const id = await addPhoto(f, { kind: 'workout', date: ui.wo.date }); ui.wo.photoIds = [...(ui.wo.photoIds || []), id]; woSheet(); }
    } catch (err) { toast('แนบรูปไม่สำเร็จ ลองรูปอื่น'); }
  }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'fsSearch') { const q = el.value.trim().toLowerCase(); document.querySelectorAll('.food-row[data-name]').forEach(r => r.hidden = !!q && !r.dataset.name.includes(q)); return; }
  if (el.classList.contains('fq')) { const f = FOOD[el.dataset.id]; const v = foodVal(f, num(el.value) || 0); const k = document.querySelector(`.fk[data-id="${f.id}"]`); if (k) k.textContent = `${fmt(v.kcal)} kcal · P ${r1(v.p)}`; return; }
  if (el.id === 'e_amt') { const d = el.dataset, v = num(el.value); if (!(v > 0)) return; const f = v / (+d.base || 1); $('#e_kcal').value = r0(+d.k * f); $('#e_p').value = r1(+d.p * f); $('#e_c').value = r1(+d.c * f); $('#e_f').value = r1(+d.f * f); $('#e_qty').value = d.hasg === '1' ? `${r0(v)} g` : (f === 1 ? d.qty : `${d.qty} ×${v}`); return; }
  if (el.dataset.wo && ui.wo) setPath(ui.wo, el.dataset.wo, el.value);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#sheetRoot').innerHTML) closeSheet(); });

/* ============ import / export ============ */
async function importJson(file) {
  try {
    const o = JSON.parse(await file.text());
    const prof = o.profile || {}; const batch = fb.writeBatch(db); let n = 0;
    const pdoc = { profile: prof.profile || defaultProfileDoc().profile, targets: prof.targets || defaultProfileDoc().targets, measurements: prof.measurements || [] };
    if (!/โอ๊ต/.test(pdoc.profile.avoid || '')) pdoc.profile.avoid = 'แพ้ข้าวโอ๊ต (ห้ามโอ๊ตทุกชนิด) · ' + (pdoc.profile.avoid || '');
    if (pdoc.profile.nick === 'นกยูงคนสวย') pdoc.profile.nick = 'Beer';
    batch.set(ref('profile/main'), pdoc); n++;
    batch.set(ref('plan/main'), prof.plan ? { note: prof.plan.note || '', days: prof.plan.days } : defaultPlan()); n++;
    Object.entries(o.days || {}).forEach(([ds, d]) => { batch.set(ref('days/' + ds), { ...emptyDay(), ...d, date: ds }); n++; });
    Object.entries(o.recipes || {}).forEach(([id, r]) => { batch.set(ref('recipes/' + id), r); n++; });
    Object.entries(o.pantry || {}).forEach(([id, r]) => { batch.set(ref('pantry/' + id), r); n++; });
    Object.entries(o.workouts || {}).forEach(([id, r]) => { batch.set(ref('workouts/' + id), r); n++; });
    await batch.commit(); toast(`นำเข้าแล้ว ${n} รายการ`);
  } catch (e) { console.error(e); toast('นำเข้าไม่สำเร็จ: ไฟล์ไม่ถูกต้องหรือไม่มีสิทธิ์'); }
}
function exportJson() {
  const o = { format: 'fit-routine-export', version: 2, exportedAt: todayStr(), profile: { ...S.profileDoc, plan: S.plan }, days: S.days, recipes: S.recipes, pantry: S.pantry, workouts: S.workouts };
  const url = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `fit-routine-backup-${todayStr()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ============ auth + boot ============ */
function gate(html) { document.body.classList.add('gated'); $('#tabs').hidden = true; $('#whoChip').textContent = ''; $('#main').innerHTML = `<section class="card gate">${html}</section>`; }
function renderSetupNeeded() { gate(`<h2>ยังไม่ได้เชื่อม Firebase</h2><p class="small">แก้ไฟล์ <b>firebase-config.js</b> ตามขั้นตอนที่ 2 ในคู่มือ (README) แล้วรีเฟรชหน้านี้</p>`); }
function renderLogin(msg) { gate(`<h2>Fit Routine by Beer</h2>${msg ? `<p class="small" style="color:var(--bad)">${esc(msg)}</p>` : ''}<p class="small muted">เจ้าของเข้าด้วยบัญชี Google · เทรนเนอร์และผู้ติดตามเปิดจากลิงก์เชิญที่ได้รับ</p><button class="btn pri" data-act="ownerLogin">เข้าสู่ระบบด้วย Google (เจ้าของ)</button><hr class="sep"><label class="f"><span>มีลิงก์เชิญ? วางที่นี่ (ใช้ในแอปบนหน้าจอโฮม)</span><input id="invPaste" placeholder="https://…?join=…"></label><button class="btn" data-act="joinPaste">ใช้ลิงก์เชิญ</button>`); }
function renderJoin(msg) { gate(`<h2>เข้าร่วม Fit Routine</h2><p class="small muted">พิมพ์ชื่อของคุณให้ตรงกับที่เจ้าของตั้งไว้ ไม่ต้องใช้รหัสผ่าน</p>${msg ? `<p class="small" style="color:var(--bad)">${esc(msg)}</p>` : ''}<label class="f"><span>ชื่อ</span><input id="joinName" autocomplete="name"></label><button class="btn pri" data-act="joinGo">เข้าใช้งาน</button>`); }
async function ownerLogin() { try { await fb.signInWithPopup(auth, new fb.GoogleAuthProvider()); } catch (e) { renderLogin(e.code === 'auth/popup-blocked' ? 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาตป๊อปอัปแล้วลองใหม่' : 'ล็อกอินไม่สำเร็จ ลองใหม่อีกครั้ง'); } }
async function joinGo() {
  const join = new URLSearchParams(location.search).get('join') || ''; const [memberId, code] = join.split('.'); const name = $('#joinName').value;
  if (!memberId || !code) return renderJoin('ลิงก์เชิญไม่ครบ ขอลิงก์ใหม่จากเจ้าของ');
  if (!normName(name)) return renderJoin('พิมพ์ชื่อก่อน');
  try {
    if (!auth.currentUser) await fb.signInAnonymously(auth);
    await fb.setDoc(ref('memberDevices/' + auth.currentUser.uid), { memberId, code, nameKey: normName(name), joinedAt: Date.now(), device: navigator.userAgent.slice(0, 120) });
    history.replaceState(null, '', location.pathname); await handleUser(auth.currentUser);
  } catch (e) { console.warn(e); renderJoin('ชื่อไม่ตรงกับที่เจ้าของตั้งไว้ หรือ ลิงก์นี้ถูกยกเลิกแล้ว'); }
}
async function doSignOut() { try { if (S.me && S.me.role !== 'owner') await fb.deleteDoc(ref('memberDevices/' + S.me.uid)); } catch (e) { } unsubAll(); await fb.signOut(auth); location.reload(); }
const unsubs = []; function unsubAll() { unsubs.splice(0).forEach(u => { try { u(); } catch (e) { } }); }
function subscribe() {
  const on = (q, fn) => unsubs.push(fb.onSnapshot(q, fn, err => console.warn('listen', err)));
  on(ref('profile/main'), s => { if (pending.has('profile')) return; S.profileDoc = s.exists() ? s.data() : null; S.ready.profile = true; if (isOwner() && S.me) S.me.name = S.profileDoc?.profile?.nick || S.me.name; render(); });
  on(ref('plan/main'), s => { if (pending.has('plan')) return; S.plan = s.exists() ? s.data() : null; render(); });
  on(ref('config/app'), s => { S.config = s.exists() ? s.data() : {}; render(); });
  on(fb.query(fb.collection(db, 'days'), fb.orderBy('date', 'desc'), fb.limit(400)), qs => { qs.docChanges().forEach(ch => { const id = ch.doc.id; if (pending.has('day:' + id)) return; if (ch.type === 'removed') delete S.days[id]; else S.days[id] = ch.doc.data(); }); render(); });
  const whole = (name, key) => on(fb.collection(db, name), qs => { const next = {}; qs.forEach(d => next[d.id] = d.data()); S[key] = next; render(); });
  whole('recipes', 'recipes'); whole('pantry', 'pantry'); whole('workouts', 'workouts');
  on(fb.query(fb.collection(db, 'activity'), fb.orderBy('at', 'desc'), fb.limit(40)), qs => { S.activity = qs.docs.map(d => d.data()); render(); });
  if (isOwner()) { whole('members', 'members'); whole('memberDevices', 'devices'); }
}
async function handleUser(user) {
  unsubAll();
  const join = new URLSearchParams(location.search).get('join');
  if (!user) return join ? renderJoin() : renderLogin();
  if (user.email) {
    // เจ้าของตรวจจากสิทธิ์ใน firestore.rules (อ่านเอกสารที่เจ้าของเท่านั้นอ่านได้)
    try { await fb.getDoc(ref('members/_ownerProbe')); S.me = { uid: user.uid, role: 'owner', name: 'Beer', email: user.email }; return startApp(); }
    catch (e) { if (e && e.code !== 'permission-denied') { S.me = { uid: user.uid, role: 'owner', name: 'Beer', email: user.email }; return startApp(); } await fb.signOut(auth); return renderLogin(`บัญชี ${user.email} ไม่ใช่เจ้าของแอปนี้`); }
  }
  try {
    const d = await fb.getDoc(ref('memberDevices/' + user.uid));
    if (d.exists()) { const m = await fb.getDoc(ref('members/' + d.data().memberId)); if (m.exists() && m.data().active) { S.me = { uid: user.uid, role: m.data().role, name: m.data().name, memberId: d.data().memberId }; return startApp(); } }
  } catch (e) { console.warn(e); }
  return join ? renderJoin() : renderLogin('อุปกรณ์นี้ยังไม่ได้รับสิทธิ์ เปิดจากลิงก์เชิญที่เจ้าของส่งให้');
}
function startApp() {
  document.body.classList.remove('gated'); $('#tabs').hidden = false;
  document.querySelectorAll('[data-owner-only]').forEach(el => el.hidden = !isOwner());
  if (!isOwner() && ui.tab === 'today' && S.me.role === 'trainer') ui.tab = 'train';
  subscribe(); render();
}
async function boot() {
  if (String(firebaseConfig.apiKey).startsWith('PASTE')) return renderSetupNeeded();
  try {
    const [appM, authM, fsM] = await Promise.all([import(FBV + 'firebase-app.js'), import(FBV + 'firebase-auth.js'), import(FBV + 'firebase-firestore.js')]);
    fb = { ...appM, ...authM, ...fsM };
    const app = fb.initializeApp(firebaseConfig);
    auth = fb.getAuth(app);
    try { db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) }); } catch (e) { db = fb.getFirestore(app); }
    fb.onAuthStateChanged(auth, u => handleUser(u));
  } catch (e) { console.error(e); gate('<h2>โหลดไม่สำเร็จ</h2><p class="small">ตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้านี้</p>'); }
}
export const __test = { S, ui, analyze, proteinPlans, exHistory, woSummary, parsePaste, trainerDayText, renderToday, renderTrain, renderKitchen, renderBody, renderOverview, renderSettings, genMenu, macros, kcalTarget, weightSessions, setPath };
if (typeof window !== 'undefined' && !window.__NO_BOOT__) boot();
