'use strict';
/* State, helpers and the storage layer. */
const COLS = ['animals', 'days', 'purchases', 'expenses', 'vaccines', 'health', 'breeding', 'calvings', 'settings'];
const S = {
  lang: 'ur', view: 'home', animalId: null, date: null, month: null,
  sub: { animals: 'all', health: 'vacc', acc: 'stock', personal: 'exp' }, q: '', pmonth: null, person: null, pErr: '',
  d: { animals: {}, days: {}, purchases: {}, expenses: {}, vaccines: {}, health: {}, breeding: {}, calvings: {}, settings: {}, personal: {} },
  loaded: {}, fresh: {}, sync: 'loading', local: false, slow: false, readOnly: false,
  auth: 'init', user: '', authErr: ''
};

const DEFAULTS = {
  milkPrice: 200, gestDays: 280, heatDays: 21, checkDays: 60, dryDays: 60, lowDays: 5,
  feeds: [
    { id: 'wanda', ur: 'ونڈا', en: 'Wanda (concentrate)', unit: 'kg', buyUnit: 'kg', factor: 1, base: 0, per: 0.4 },
    { id: 'silage', ur: 'سائیلج', en: 'Silage', unit: 'kg', buyUnit: 'kg', factor: 1, base: 25, per: 0 },
    { id: 'soda', ur: 'میٹھا سوڈا', en: 'Sweet soda', unit: 'g', buyUnit: 'kg', factor: 1000, base: 0, per: 4 }
  ]
};
function cfg() {
  const s = S.d.settings.main || {};
  return Object.assign({}, DEFAULTS, s, { feeds: s.feeds && s.feeds.length ? s.feeds : DEFAULTS.feeds });
}

/* ---------- small helpers ---------- */
const LI = () => (S.lang === 'ur' ? 0 : 1);
function t(k, p) {
  const e = I[k];
  if (!e) { console.warn('missing text', k); return k; }
  let s = e[LI()];
  if (p) s = s.replace(/\{(\w+)\}/g, (_, x) => (p[x] == null ? '' : p[x]));
  return s;
}
const feedName = f => (S.lang === 'ur' ? f.ur || f.en : f.en || f.ur) || f.id;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const has = v => v !== '' && v != null && Number.isFinite(parseFloat(v));
const list = col => Object.values(S.d[col] || {});

const DAY = 864e5;
const pd = iso => { const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const addDays = (iso, n) => new Date(pd(iso) + n * DAY).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((pd(a) - pd(b)) / DAY);
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const fmtDate = iso => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const monthOf = iso => iso.slice(0, 7);
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const MONTHS = {
  ur: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};
const monthLabel = ym => MONTHS[S.lang][Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
function fmtNum(n, dec = 0) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: 0 }); }
const nz = s => `<span class="num">${s}</span>`;
function money(n) { return S.lang === 'ur' ? `${nz(fmtNum(n))} ${t('rs')}` : `${t('rs')} ${nz(fmtNum(n))}`; }
function relText(iso, today) {
  const n = diffDays(iso, today);
  if (n === 0) return t('today_w');
  return n > 0 ? t('in_days', { n }) : t('overdue_days', { n: -n });
}

/* ---------- storage ---------- */
let DB = null;
const wq = {};
function enqueue(path, fn) {
  const run = (wq[path] || Promise.resolve()).then(fn);
  wq[path] = run.catch(() => {});
  return run;
}
function deepMerge(a, b) {
  const out = Object.assign({}, a);
  for (const k of Object.keys(b)) {
    out[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? deepMerge(a[k], b[k]) : b[k];
  }
  return out;
}
const created = new Set();
/* Firestore keeps writes in its local cache and syncs later, so a write must not wait for the server
   (that would hang while the farm has no signal). Server-side refusals are reported by a toast. */
const plain = d => JSON.parse(JSON.stringify(d));
function fire(p) { Promise.resolve(p).catch(e => { console.error(e); toast(t('save_fail'), 'bad'); }); }
const store = {
  exists(col, id) { return !!S.d[col][id] || created.has(col + '/' + id); },
  async set(col, id, data) {
    created.add(col + '/' + id);
    if (!DB) { S.d[col] = Object.assign({}, S.d[col], { [id]: Object.assign({ id }, data) }); scheduleRender(); return; }
    fire(DB.doc(col + '/' + id).set(plain(data)));
  },
  async merge(col, id, data) {
    created.add(col + '/' + id);
    if (!DB) { S.d[col] = Object.assign({}, S.d[col], { [id]: deepMerge(Object.assign({ id }, S.d[col][id] || {}), data) }); scheduleRender(); return; }
    fire(DB.doc(col + '/' + id).set(plain(data), { merge: true }));
  },
  async del(col, id) {
    if (!DB) { const m = Object.assign({}, S.d[col]); delete m[id]; S.d[col] = m; scheduleRender(); return; }
    fire(DB.doc(col + '/' + id).delete());
  }
};
async function run(fn) {
  try { await fn(); return true; } catch (e) { console.error(e); toast(t('save_fail'), 'bad'); return false; }
}

/* ---------- render scheduling (never redraw under a typing finger) ---------- */
let dirty = false, raf = 0;
function typingNow() {
  const a = document.activeElement;
  return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !!a.closest('#app');
}
function scheduleRender() {
  if (typingNow()) { dirty = true; return; }
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; dirty = false; render(); });
}
document.addEventListener('focusout', () => {
  setTimeout(() => { if (dirty && !typingNow()) scheduleRender(); }, 250);
});
