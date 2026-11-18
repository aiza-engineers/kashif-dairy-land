'use strict';
/* Clicks, typing, daily saving, backup and settings. */
function toast(msg, kind) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.className = 'toast' + (kind === 'bad' ? ' bad' : '');
  el.textContent = msg;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.remove(), 2600);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function setLang(l) {
  S.lang = l;
  try { localStorage.setItem('kdl-lang', l); } catch (e) { /* convenience only */ }
  render();
}
const toTop = () => window.scrollTo(0, 0);
function show(view, extra) { S.view = view; Object.assign(S, extra || {}); render(); toTop(); }
function shiftDate(n) { S.date = addDays(S.date || todayISO(), n); render(); }
const rec = (col, el) => S.d[col][el.dataset.id];

/* ---------- daily entry ---------- */
function saveDaily(input) {
  const [aid, k] = input.dataset.dl.split('|');
  const date = S.date;
  const v = input.value === '' ? null : parseFloat(input.value);
  const base = store.exists('days', date) ? {} : { date, p: num(cfg().milkPrice) };
  run(() => store.merge('days', date, Object.assign(base, { e: { [aid]: { [k]: v } } })));
}
function saveRate(input) {
  const v = input.value === '' ? null : parseFloat(input.value);
  if (v == null) return;
  const date = S.date;
  run(() => store.merge('days', date, store.exists('days', date) ? { p: v } : { date, p: v }));
}
function liveDaily() {
  const c = cfg(), price = {};
  c.feeds.forEach(f => { price[f.id] = stockInfo(f).priceUnit; });
  let milk = 0, cost = 0;
  document.querySelectorAll('[data-dl]').forEach(i => {
    const k = i.dataset.dl.split('|')[1], v = num(i.value);
    if (k === 'am' || k === 'pm') milk += v; else if (price[k] != null) cost += v * price[k];
  });
  const rate = num($('#d-rate') && $('#d-rate').value), inc = milk * rate;
  const set = (id, val) => { const e = $(id); if (e) e.textContent = val; };
  set('#t-milk', fmtNum(milk, 1)); set('#t-inc', fmtNum(inc)); set('#t-feed', fmtNum(cost)); set('#t-net', fmtNum(inc - cost));
}
function suggestAll() {
  const c = cfg();
  cows().forEach(a => c.feeds.forEach(f => {
    const input = document.getElementById(`in-${a.id}-${f.id}`);
    const sg = suggest(a.id, f, S.date);
    if (input && input.value === '' && sg.val > 0) { input.value = sg.val; saveDaily(input); }
  }));
  liveDaily();
}

/* ---------- settings ---------- */
function collectFeeds() {
  document.querySelectorAll('[data-feed]').forEach(i => {
    feedDraft[+i.dataset.feed][i.dataset.k] = i.type === 'number' ? (i.value === '' ? '' : parseFloat(i.value)) : i.value;
  });
}
async function saveSettings() {
  collectFeeds();
  const feeds = feedDraft.filter(f => f.ur || f.en).map(f => ({
    id: f.id, ur: f.ur || f.en, en: f.en || f.ur, unit: f.unit || 'kg', buyUnit: f.buyUnit || f.unit || 'kg',
    factor: num(f.factor) > 0 ? num(f.factor) : 1, base: num(f.base), per: num(f.per)
  }));
  if (!feeds.length) { toast(t('s_need_feed'), 'bad'); return; }
  const g = (id, d) => { const v = parseFloat($(id).value); return Number.isFinite(v) && v >= 0 ? v : d; };
  const doc = { milkPrice: g('#s-price', DEFAULTS.milkPrice), gestDays: g('#s-gest', DEFAULTS.gestDays) || DEFAULTS.gestDays, dryDays: g('#s-dry', DEFAULTS.dryDays), heatDays: g('#s-heat', DEFAULTS.heatDays), checkDays: g('#s-check', DEFAULTS.checkDays), lowDays: g('#s-low', DEFAULTS.lowDays), feeds };
  if (await run(() => store.set('settings', 'main', doc))) { feedDraft = null; toast(t('saved_ok')); render(); }
}

/* ---------- backup ---------- */
function doBackup() {
  const data = {};
  COLS.forEach(c => { data[c] = S.d[c]; });
  data.personal = S.d.personal;
  const json = JSON.stringify({ app: 'kashif-dairy-land', v: 1, exportedAt: new Date().toISOString(), data }, null, 1);
  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `kashif-dairy-land-backup-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(t('b_done'));
  } catch (e) { console.error(e); toast(t('save_fail'), 'bad'); }
}
async function doRestore(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  let obj;
  try { obj = JSON.parse(await f.text()); if (!obj || obj.app !== 'kashif-dairy-land' || !obj.data) throw new Error('bad'); }
  catch (e) { toast(t('b_bad'), 'bad'); input.value = ''; return; }
  toast(t('restoring'));
  for (const col of [...COLS, 'personal']) {
    for (const [id, doc] of Object.entries(obj.data[col] || {})) {
      const body = Object.assign({}, doc); delete body.id;
      if (!(await run(() => store.set(col, id, body)))) { input.value = ''; return; }
      await sleep(40);
    }
  }
  input.value = '';
  toast(t('b_restored'));
}
async function addExamples() {
  const ok = await run(async () => {
    for (const tag of ['EX-1', 'EX-2', 'EX-3']) {
      if (animals().some(a => a.tag === tag)) continue;
      await store.set('animals', uid(), { tag, kind: 'cow', source: 'purchased', purchaseDate: todayISO(), price: null, calfPrice: null, dob: null, motherId: null, notes: '', createdAt: Date.now(), example: true });
    }
  });
  if (ok) toast(t('saved_ok'));
}
async function removeExamples() {
  const ok = await run(async () => { for (const a of animals().filter(x => x.example)) await deleteAnimal(a.id); });
  if (ok) toast(t('saved_ok'));
}

/* ---------- actions ---------- */
const ACT = {
  nav: el => show(el.dataset.v, el.dataset.v === 'daily' && !S.date ? { date: todayISO() } : {}),
  lang: () => setLang(S.lang === 'ur' ? 'en' : 'ur'),
  setlang: el => setLang(el.dataset.v),
  settings: () => { feedDraft = null; show('settings'); },
  back: () => show(S.view === 'animal' ? 'animals' : 'home'),
  animal: el => show('animal', { animalId: el.dataset.id }),
  'animal-add': () => animalForm(null, S.view === 'animals' && S.sub.animals === 'calves' ? { kind: 'cf', source: 'home' } : null),
  'animal-edit': el => animalForm(el.dataset.id),
  'breed-add': el => breedForm(el.dataset.id),
  'breed-edit': el => { const r = rec('breeding', el); if (r) breedForm(r.animalId, r.id); },
  'breed-pick': breedPick,
  'calving-add': el => calvingForm(el.dataset.id),
  'calving-edit': el => { const r = rec('calvings', el); if (r) calvingForm(r.animalId, r.id); },
  'vacc-add': el => vaccForm(el.dataset.id || null),
  'vacc-edit': el => { const r = rec('vaccines', el); if (r) vaccForm(r.animalId, r.id); },
  'ill-add': el => illForm(el.dataset.id || null),
  'ill-edit': el => { const r = rec('health', el); if (r) illForm(r.animalId, r.id); },
  'purchase-add': () => purchaseForm(),
  'purchase-edit': el => purchaseForm(el.dataset.id),
  'expense-add': () => expenseForm(),
  'expense-edit': el => expenseForm(el.dataset.id),
  'pexp-add': () => pMoneyForm('exp'), 'pexp-edit': el => pMoneyForm('exp', el.dataset.id),
  'pinc-add': () => pMoneyForm('inc'), 'pinc-edit': el => pMoneyForm('inc', el.dataset.id),
  'led-add': () => pLedgerForm(null), 'led-edit': el => pLedgerForm(el.dataset.id),
  pperson: el => { S.person = el.dataset.p; render(); toTop(); }, 'pperson-all': () => { S.person = null; render(); },
  'pmonth-prev': () => { S.pmonth = addMonths(S.pmonth, -1); render(); }, 'pmonth-next': () => { S.pmonth = addMonths(S.pmonth, 1); render(); },
  'mark-dry': async el => { if (await run(() => store.merge('breeding', el.dataset.id, { driedOn: todayISO() }))) toast(t('saved_ok')); },
  alert: el => {
    let go = {}; try { go = JSON.parse(el.dataset.go); } catch (e) { /* ignore */ }
    if (go.animal) show('animal', { animalId: go.animal });
    else if (go.view) { if (go.sub) S.sub[go.view === 'accounts' ? 'acc' : go.view] = go.sub; show(go.view); }
  },
  seg: el => { S.sub[el.dataset.key] = el.dataset.v; render(); },
  'date-prev': () => shiftDate(-1), 'date-next': () => shiftDate(1), 'date-today': () => { S.date = todayISO(); render(); },
  'month-prev': () => { S.month = addMonths(S.month, -1); render(); }, 'month-next': () => { S.month = addMonths(S.month, 1); render(); },
  sug: el => { const i = document.getElementById(el.dataset.t); if (i) { i.value = el.dataset.v; saveDaily(i); liveDaily(); } },
  'sug-all': suggestAll,
  'sheet-save': () => sheetSave(), 'sheet-cancel': () => closeSheet(), 'sheet-delete': el => sheetDelete(el),
  'sheet-scrim': (el, e) => { if (e.target === el) closeSheet(); },
  'feed-add': () => { collectFeeds(); feedDraft.push({ id: 'f' + uid(), ur: '', en: '', unit: 'kg', buyUnit: 'kg', factor: 1, base: 0, per: 0 }); render(); },
  'feed-del': el => { collectFeeds(); feedDraft.splice(+el.dataset.i, 1); render(); },
  'settings-save': saveSettings,
  backup: doBackup,
  forgot: () => doForgot(), logout: () => doLogout(),
  restore: () => $('#restore-file').click(),
  'examples-add': addExamples, 'examples-del': removeExamples
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.matches('[data-dl]')) { saveDaily(el); liveDaily(); }
  else if (el.id === 'd-date') { if (el.value) { S.date = el.value; render(); } }
  else if (el.id === 'd-rate') saveRate(el);
  else if (el.id === 'restore-file') doRestore(el);
  else if (el.closest('#sheet')) refreshSheet();
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.matches('[data-dl]') || el.id === 'd-rate') liveDaily();
  else if (el.id === 'q') { S.q = el.value; const l = $('#alist'); if (l) l.innerHTML = animalRowsHTML(); }
  else if (el.closest('#sheet')) refreshSheet();
});
document.addEventListener('submit', e => { if (e.target.id === 'login-form') { e.preventDefault(); doLogin(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && SHEET) closeSheet(); });
