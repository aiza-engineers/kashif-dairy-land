'use strict';
/* Personal section: house expenses, personal income and a lend/borrow (lain dain) ledger.
   Kept apart from the farm accounts, so it never changes the farm profit. All records live in
   one Firestore collection, "personal", told apart by the field "kind": exp | inc | led. */
const P_EXP = ['rashan', 'medical', 'transport', 'bills', 'school', 'clothes', 'mobile', 'other'];
const P_INC = ['salary', 'business', 'farm', 'other'];
const pAll = kind => list('personal').filter(r => r.kind === kind);
const pKey = n => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();
/* What the other person owes me goes up when I give or when I pay back; it goes down when I take or get back. */
const pSign = d => (d === 'gave' || d === 'paid' ? 1 : -1);
const pSum = rows => rows.reduce((s, r) => s + num(r.amount), 0);
const pMonthRows = (kind, ym) => pAll(kind).filter(r => r.date && r.date.startsWith(ym));
const pSettled = b => Math.abs(b) < 0.005;

function pPeople() {
  const m = {};
  pAll('led').forEach(r => {
    const k = pKey(r.person);
    const p = m[k] || (m[k] = { key: k, name: r.person, bal: 0, last: '' });
    p.bal += pSign(r.dir) * num(r.amount);
    if ((r.date || '') >= p.last) { p.last = r.date || ''; p.name = r.person; }
  });
  return Object.values(m).sort((a, b) => Math.abs(b.bal) - Math.abs(a.bal) || String(a.name).localeCompare(String(b.name)));
}
function pTotals(ppl) {
  return {
    get: ppl.filter(p => p.bal > 0.005).reduce((s, p) => s + p.bal, 0),
    owe: ppl.filter(p => p.bal < -0.005).reduce((s, p) => s - p.bal, 0)
  };
}
const pBalChip = p => (pSettled(p.bal) ? chip(t('ps_square')) : p.bal > 0 ? chip(`${t('ps_toget')} ${money(p.bal)}`, 'ok') : chip(`${t('ps_toowe')} ${money(-p.bal)}`, 'warn'));
const pSortRows = rows => rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0));

/* ---------- views ---------- */
function pMonthBar() {
  const rtl = S.lang === 'ur';
  return `<div class="datebar">${btn('pmonth-prev', ic(rtl ? 'right' : 'left'), 'sm')}<h3 style="flex:1;text-align:center">${monthLabel(S.pmonth)}</h3>${btn('pmonth-next', ic(rtl ? 'left' : 'right'), 'sm')}</div>`;
}
function pEntries(kind) {
  const isExp = kind === 'exp', cats = isExp ? P_EXP : P_INC, pre = isExp ? 'psc_' : 'psi_';
  const rows = pSortRows(pMonthRows(kind, S.pmonth));
  const byCat = cats.map(c => ({ c, amount: pSum(rows.filter(r => r.cat === c)) })).filter(x => x.amount > 0);
  return `${pMonthBar()}
  <div style="display:flex;justify-content:flex-end">${btn(`p${kind}-add`, ic('plus') + t(isExp ? 'ps_exp_add' : 'ps_inc_add'), 'primary sm')}</div>
  <div class="card"><table class="rep">${byCat.map(x => `<tr><td>${t(pre + x.c)}</td><td>${money(x.amount)}</td></tr>`).join('')}
    <tr class="tot"><td>${t(isExp ? 'ps_total_exp' : 'ps_total_inc')}</td><td>${money(pSum(rows))}</td></tr></table></div>
  <div class="stack">${rows.map(r => histRow(`p${kind}-edit`, r.id, esc(t(pre + r.cat)), `${fmtDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''}`, chip(money(r.amount), isExp ? 'gold' : 'ok'))).join('') || `<div class="card muted">${t('no_items')}</div>`}</div>`;
}
function pLedger() {
  const ppl = pPeople(), tot = pTotals(ppl);
  let sel = S.person ? ppl.find(p => p.key === S.person) : null;
  if (S.person && !sel) S.person = null;
  const rows = pSortRows(pAll('led').filter(r => !sel || pKey(r.person) === sel.key));
  const shown = sel ? rows : rows.slice(0, 20);
  const entry = r => histRow('led-edit', r.id, esc(t('psd_' + r.dir)), `${esc(r.person)} · ${fmtDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''}`,
    chip(money(r.amount), { gave: 'gold', took: 'warn', recv: 'ok', paid: 'ok' }[r.dir] || ''));
  const people = ppl.map(p => `<button type="button" class="rowbtn" data-act="pperson" data-p="${esc(p.key)}"><div class="grow"><div><b>${esc(p.name)}</b> ${pBalChip(p)}</div></div>${ic('chev', 'chev')}</button>`).join('');
  return `<section class="tiles">${tile(t('ps_toget_t'), nz(fmtNum(tot.get)), t('rs'), 'hl')}${tile(t('ps_toowe_t'), nz(fmtNum(tot.owe)), t('rs'))}</section>
  <div style="display:flex;justify-content:flex-end">${btn('led-add', ic('plus') + t('ps_led_add'), 'primary sm')}</div>
  ${sel ? `<div class="card stack"><div class="row-head"><h3>${esc(sel.name)}</h3>${pBalChip(sel)}</div>${btn('pperson-all', t('ps_all'), 'block')}</div>`
    : `<div class="stack"><div class="group-h"><span>${t('ps_people')}</span></div>${people || `<div class="card muted">${t('no_items')}</div>`}</div>`}
  <div class="stack"><div class="group-h"><span>${sel ? t('ps_entries') : t('ps_recent')}</span></div>${shown.map(entry).join('') || `<div class="card muted">${t('no_items')}</div>`}</div>
  <p class="hint">${t('ps_note_led')}</p>`;
}
function pSummary() {
  const ym = S.pmonth, inc = pMonthRows('inc', ym), exp = pMonthRows('exp', ym);
  const ti = pSum(inc), te = pSum(exp), net = ti - te, pos = net >= 0;
  const lines = (rows, cats, pre) => cats.map(c => [t(pre + c), pSum(rows.filter(r => r.cat === c))]).filter(x => x[1] > 0)
    .map(x => `<tr><td>${x[0]}</td><td>${money(x[1])}</td></tr>`).join('');
  const tot = pTotals(pPeople());
  return `${pMonthBar()}
  <div class="card"><div class="group-h"><span>${t('ps_income')}</span></div><table class="rep">${lines(inc, P_INC, 'psi_')}<tr class="tot"><td>${t('ps_total_inc')}</td><td>${money(ti)}</td></tr></table></div>
  <div class="card"><div class="group-h"><span>${t('ps_expense')}</span></div><table class="rep">${lines(exp, P_EXP, 'psc_')}<tr class="tot"><td>${t('ps_total_exp')}</td><td>${money(te)}</td></tr></table></div>
  <div class="card"><div class="muted small">${t(pos ? 'ps_net_pos' : 'ps_net_neg')}</div><div class="profit ${pos ? 'pos' : 'neg'}">${money(Math.abs(net))}</div></div>
  <div class="card">${line(t('ps_alltime') + ' · ' + t('ps_income'), money(pSum(pAll('inc'))))}${line(t('ps_alltime') + ' · ' + t('ps_expense'), money(pSum(pAll('exp'))))}
    ${line(t('ps_toget_t'), money(tot.get))}${line(t('ps_toowe_t'), money(tot.owe))}<p class="hint">${t('ps_note_led')}</p></div>`;
}
function personalView() {
  if (!S.pmonth) S.pmonth = monthOf(todayISO());
  const f = S.sub.personal;
  const body = f === 'exp' || f === 'inc' ? pEntries(f) : f === 'led' ? pLedger() : pSummary();
  const warn = S.pErr ? `<div class="banner bad" role="alert">${t(S.pErr === 'denied' ? 'ps_denied' : 'ps_err')}</div>` : '';
  return `<h2>${t('nav_personal')}</h2>${warn}${seg('personal', [['exp', t('ps_t_exp')], ['inc', t('ps_t_inc')], ['led', t('ps_t_led')], ['sum', t('ps_t_sum')]])}<div class="stack">${body}</div>`;
}

/* ---------- forms ---------- */
function pMoneyForm(kind, recId) {
  const isExp = kind === 'exp', cats = isExp ? P_EXP : P_INC, pre = isExp ? 'psc_' : 'psi_';
  const rec = recId ? S.d.personal[recId] : null;
  const v = rec ? Object.assign({}, rec) : { date: todayISO(), cat: cats[0] };
  openSheet({
    title: t(isExp ? 'ps_exp_title' : 'ps_inc_title'), values: v,
    fields: [
      { k: 'date', label: t('date'), type: 'date', req: true },
      { k: 'cat', label: t('category'), type: 'select', opts: cats.map(c => [c, t(pre + c)]) },
      { k: 'amount', label: t('amount'), type: 'number', req: true },
      { k: 'note', label: t('notes'), type: 'text' }
    ],
    async onSave(x) {
      const doc = clean({ kind, date: x.date, cat: x.cat, amount: x.amount, note: x.note || '', createdAt: rec ? rec.createdAt : Date.now() });
      S.pmonth = monthOf(x.date);
      return { ok: await run(() => store.set('personal', recId || uid(), doc)) };
    },
    onDelete: rec ? () => store.del('personal', recId) : null
  });
}
function pLedgerForm(recId) {
  const rec = recId ? S.d.personal[recId] : null;
  const cur = S.person ? pPeople().find(p => p.key === S.person) : null;
  const v = rec ? Object.assign({}, rec) : { date: todayISO(), dir: 'gave', person: cur ? cur.name : '' };
  openSheet({
    title: t('ps_led_title'), values: v,
    fields: [
      { k: 'date', label: t('date'), type: 'date', req: true },
      { k: 'person', label: t('ps_person'), type: 'text', req: true, list: pPeople().map(p => p.name) },
      { k: 'dir', label: t('category'), type: 'select', opts: ['gave', 'took', 'recv', 'paid'].map(d => [d, t('psd_' + d)]) },
      { k: 'amount', label: t('amount'), type: 'number', req: true },
      { k: 'note', label: t('notes'), type: 'text' }
    ],
    async onSave(x) {
      const same = pPeople().find(p => p.key === pKey(x.person));
      const doc = clean({ kind: 'led', date: x.date, person: same ? same.name : x.person.replace(/\s+/g, ' '), dir: x.dir, amount: x.amount, note: x.note || '', createdAt: rec ? rec.createdAt : Date.now() });
      return { ok: await run(() => store.set('personal', recId || uid(), doc)) };
    },
    onDelete: rec ? () => store.del('personal', recId) : null
  });
}
