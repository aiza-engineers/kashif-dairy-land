'use strict';
/* PDF reports. Each report is built as a clean printable page and shown full-screen; "Save PDF" opens the
   phone's print dialog, where "Save as PDF" makes the file (Urdu text stays correct because the browser draws it). */
let REPORT = null;

/* ---------- small helpers ---------- */
const rLocal = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const rName = () => rLocal('kdl-rpname');
const rAddr = () => rLocal('kdl-rpaddr');
const rNum = (n, d = 0) => nz(fmtNum(n, d));
const rSigned = n => (n < 0 ? `<span class="neg">${nz('−' + fmtNum(-n))}</span>` : `<span class="pos">${nz(fmtNum(n))}</span>`);
const rAsc = rows => rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.createdAt || 0) - (b.createdAt || 0));
const rYear = v => { const y = parseInt(v, 10); return y >= 2000 && y <= 2100 ? String(y) : todayISO().slice(0, 4); };
const rMonth = v => (/^\d{4}-\d{2}$/.test(v || '') ? v : monthOf(todayISO()));
const rMonthName = m => MONTHS[S.lang][m - 1];

function rTable(cols, rows, foot) {
  const cls = c => (c.n ? ' class="n"' : '');
  const head = cols.map(c => `<th${cls(c)}>${c.h}</th>`).join('');
  const tr = r => `<tr>${r.map((v, i) => `<td${cls(cols[i])}>${v}</td>`).join('')}</tr>`;
  const body = rows.length ? rows.map(tr).join('') : `<tr><td colspan="${cols.length}" class="rnone">${t('rp_none')}</td></tr>`;
  return `<table class="rt"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot ? `<tfoot>${tr(foot)}</tfoot>` : ''}</table>`;
}
const rKV = rows => `<table class="rt kv"><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="n">${r[1]}</td></tr>`).join('')}</tbody></table>`;
const rSec = (title, html) => `<section><h2>${title}</h2>${html}</section>`;

/* Every report sits on the Kashif Dairy Land letterhead: logo, name in Urdu and English, an optional address line. */
function rLetterhead() {
  const addr = rAddr();
  return `<div class="lh" dir="ltr"><img src="logo.svg" alt=""><div class="lht"><div class="lhur" lang="ur" dir="rtl">${I.app[0]}</div><div class="lhen">${I.app[1].toUpperCase()}</div>${addr ? `<div class="lhaddr">${esc(addr)}</div>` : ''}</div></div>
    <div class="lhrule"><i></i><i></i></div>`;
}
function rWrap(o) {
  const by = rName(), addr = rAddr();
  const head = `${rLetterhead()}<div class="rtb"><div class="rtt"><h1>${esc(o.title)}</h1>${o.sub ? `<div class="rsub">${o.sub}</div>` : ''}</div>
    <div class="rdate">${t('rp_date')}: ${nz(fmtDate(todayISO()))}${by ? `<br>${t('rp_by')}: ${esc(by)}` : ''}</div></div>`;
  const foot = `<footer class="rfoot"><div class="lhrule"><i></i><i></i></div><div class="rft"><span>${I.app[S.lang === 'ur' ? 0 : 1]}${addr ? ' · ' + esc(addr) : ''}</span><span>${t('rp_foot')}</span></div></footer>`;
  return { file: `Kashif-Dairy-Land_${o.slug}`, html: head + o.body + foot };
}

/* ---------- farm reports ---------- */
function repPregnancy() {
  const today = todayISO();
  const info = cows().map(a => ({ a, b: breedStatus(a.id) }));
  const n = s => info.filter(x => x.b && x.b.state === s).length;
  const order = x => (!x.b ? 9 : { pregnant: 0, pending: 1, open: 2, calved: 3 }[x.b.state]);
  info.sort((x, y) => order(x) - order(y) || String((x.b && x.b.due) || '9999').localeCompare(String((y.b && y.b.due) || '9999')) || tagSort(x.a, y.a));
  const rows = info.map(({ a, b }) => {
    const tag = `<b>${esc(a.tag)}</b>`;
    if (!b) return [tag, t('rp_no_record'), '', '', '', '', ''];
    const r = b.rec, st = b.state, live = st === 'pregnant' || st === 'pending';
    const stTxt = st === 'pregnant' ? t('st_preg') : st === 'pending' ? t('st_pending') : st === 'open' ? t('st_open') : `${t('calved_on')} ${fmtDate(r.calvedOn)}`;
    const due = live ? `${nz(fmtDate(b.due))}${st === 'pending' ? ' *' : ''} <small>(${relText(b.due, today)})</small>` : '';
    const dry = st === 'pregnant' ? (r.driedOn ? `${t('dried_on')} ${nz(fmtDate(r.driedOn))}` : nz(fmtDate(b.dry))) : '';
    const chk = st === 'pending' ? nz(fmtDate(b.check)) : r.checkDate ? nz(fmtDate(r.checkDate)) : '';
    return [tag, stTxt, nz(fmtDate(r.aiDate)), esc(r.semen || ''), due, dry, chk];
  });
  const body = rSec(t('rp_summary'), rKV([
    [t('rp_cows_n'), rNum(info.length)], [t('st_preg'), rNum(n('pregnant'))], [t('st_pending'), rNum(n('pending'))],
    [t('st_open'), rNum(n('open'))], [t('rp_no_record'), rNum(info.filter(x => !x.b).length)]
  ])) + rSec(t('rp_preg'), rTable([
    { h: t('tag') }, { h: t('rp_status') }, { h: t('rp_last_ai') }, { h: t('semen') }, { h: t('due') }, { h: t('dry_on') }, { h: t('preg_check') }
  ], rows)) + `<p class="rnote">${t('rp_est')}</p>`;
  return rWrap({ title: t('rp_preg'), sub: `${t('rp_as_of')} ${nz(fmtDate(today))}`, body, slug: `Pregnancy-report_${today}` });
}

function repHerd() {
  const today = todayISO();
  const all = animals().sort((a, b) => (a.kind === 'cow' ? 0 : 1) - (b.kind === 'cow' ? 0 : 1) || tagSort(a, b));
  const rows = all.map(a => {
    const b = a.kind === 'cow' ? breedStatus(a.id) : null, m = a.motherId ? byId(a.motherId) : null;
    const st = b ? (b.state === 'pregnant' ? t('st_preg') : b.state === 'pending' ? t('st_pending') : b.state === 'open' ? t('st_open') : t('calved_on')) : '';
    const price = a.source === 'purchased' ? num(a.price) + num(a.calfPrice) : 0;
    return [`<b>${esc(a.tag)}</b>`, kindLabel(a.kind), a.source === 'purchased' ? t('src_purchased') : t('born_home'),
      a.dob ? `${nz(fmtDate(a.dob))} <small>(${ageStr(a.dob, today)})</small>` : '', m ? esc(m.tag) : '', price > 0 ? nz(fmtNum(price)) : '', st];
  });
  const capital = all.reduce((s, a) => s + (a.source === 'purchased' ? num(a.price) + num(a.calfPrice) : 0), 0);
  const cs = calfStats();
  const body = rSec(t('rp_summary'), rKV([
    [t('tile_cows'), rNum(cows().length)], [t('heifers'), rNum(cs.f)], [t('bulls'), rNum(cs.m)], [t('rp_bought_cost'), money(capital)]
  ])) + rSec(t('rp_herd'), rTable([
    { h: t('tag') }, { h: t('kind') }, { h: t('source') }, { h: t('dob') }, { h: t('mother') }, { h: t('price'), n: true }, { h: t('rp_status') }
  ], rows));
  return rWrap({ title: t('rp_herd'), sub: `${t('rp_as_of')} ${nz(fmtDate(today))}`, body, slug: `Herd-list_${today}` });
}

function repFarmMonth(ym) {
  const r = monthReport(ym);
  const days = Object.keys(S.d.days).filter(d => d.startsWith(ym)).sort();
  const exp = [...r.feedLines.map(x => [esc(feedName(x.f)), rNum(x.amount)]), ...(r.medTotal ? [[t('m_med'), rNum(r.medTotal)]] : []),
    ...r.otherLines.map(x => [t('cat_' + x.k), rNum(x.amount)])];
  const pos = r.profit >= 0;
  let dl = 0, di = 0, dc = 0;
  const dayRows = days.map(d => { const x = dayTotals(d); dl += x.milk; di += x.income; dc += x.feedCost; return [nz(fmtDate(d)), rNum(x.milk, 1), rNum(x.income), rNum(x.feedCost), rSigned(x.net)]; });
  let body = rSec(t('rp_summary'), rKV([[t('m_litres') + ` (${t('unit_l')})`, rNum(r.litres, 1)], [t('m_income'), money(r.income)]]))
    + rSec(t('m_exp'), rTable([{ h: t('item') }, { h: t('amount'), n: true }], exp, [t('m_exp'), rNum(r.totalExp)]))
    + `<div class="rbig">${pos ? t('m_profit') : t('m_loss')}: ${money(Math.abs(r.profit))}</div>`;
  if (r.feedUsed > 0) body += rKV([[t('m_feed_used'), money(r.feedUsed)]]);
  if (r.boughtCount) body += rKV([[`${t('m_animals')} (${r.boughtCount})`, money(r.capital)]]) + `<p class="rnote">${t('m_animals_note')}</p>`;
  body += rSec(t('rp_daily'), rTable([{ h: t('date') }, { h: t('m_litres') + ` (${t('unit_l')})`, n: true }, { h: t('m_income'), n: true }, { h: t('d_feedcost'), n: true }, { h: t('d_net'), n: true }],
    dayRows, [t('rp_total'), rNum(dl, 1), rNum(di), rNum(dc), rSigned(di - dc)]));
  return rWrap({ title: t('rp_fmonth'), sub: monthLabel(ym), body, slug: `Farm-month_${ym}` });
}

function repFarmYear(y) {
  const T = { l: 0, i: 0, f: 0, m: 0, o: 0, e: 0 };
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    const r = monthReport(`${y}-${String(m).padStart(2, '0')}`);
    T.l += r.litres; T.i += r.income; T.f += r.feedTotal; T.m += r.medTotal; T.o += r.otherTotal; T.e += r.totalExp;
    rows.push([rMonthName(m), rNum(r.litres, 1), rNum(r.income), rNum(r.feedTotal), rNum(r.medTotal), rNum(r.otherTotal), rNum(r.totalExp), rSigned(r.profit)]);
  }
  const profit = T.i - T.e;
  const bought = animals().filter(a => a.source === 'purchased' && a.purchaseDate && a.purchaseDate.startsWith(y + '-')).sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
  const capital = bought.reduce((s, a) => s + num(a.price) + num(a.calfPrice), 0);
  const body = rSec(t('rp_summary'), rKV([
    [t('m_litres') + ` (${t('unit_l')})`, rNum(T.l, 1)], [t('m_income'), money(T.i)], [t('m_exp'), money(T.e)], [profit >= 0 ? t('m_profit') : t('m_loss'), money(Math.abs(profit))]
  ])) + rSec(t('rp_by_month'), rTable([
    { h: t('rp_month') }, { h: t('m_litres'), n: true }, { h: t('m_income'), n: true }, { h: t('rp_feedbuy'), n: true }, { h: t('m_med'), n: true }, { h: t('rp_other_exp'), n: true }, { h: t('m_exp'), n: true }, { h: t('rp_pl'), n: true }
  ], rows, [t('rp_total'), rNum(T.l, 1), rNum(T.i), rNum(T.f), rNum(T.m), rNum(T.o), rNum(T.e), rSigned(profit)]))
    + rSec(t('rp_bought_year'), rTable([{ h: t('tag') }, { h: t('kind') }, { h: t('purchase_date') }, { h: t('price'), n: true }],
      bought.map(a => [`<b>${esc(a.tag)}</b>`, kindLabel(a.kind), nz(fmtDate(a.purchaseDate)), rNum(num(a.price) + num(a.calfPrice))]), bought.length ? [t('rp_total'), '', '', rNum(capital)] : null))
    + `<p class="rnote">${t('m_animals_note')}</p>`;
  return rWrap({ title: t('rp_fyear'), sub: y, body, slug: `Farm-year_${y}` });
}

/* ---------- personal reports ---------- */
function repPersMonth(ym) {
  const inc = rAsc(pMonthRows('inc', ym)), exp = rAsc(pMonthRows('exp', ym));
  const ti = pSum(inc), te = pSum(exp), net = ti - te;
  const catRows = P_EXP.map(c => [c, pSum(exp.filter(r => r.cat === c))]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])
    .map(x => [t('psc_' + x[0]), rNum(x[1]), nz(Math.round(x[1] * 100 / te) + '%')]);
  const list_ = (rows, pre) => rows.map(r => [nz(fmtDate(r.date)), t(pre + r.cat), esc(r.note || ''), rNum(r.amount)]);
  const cols = [{ h: t('date') }, { h: t('category') }, { h: t('notes') }, { h: t('amount'), n: true }];
  const body = rSec(t('rp_summary'), rKV([[t('ps_total_inc'), money(ti)], [t('ps_total_exp'), money(te)], [t(net >= 0 ? 'ps_net_pos' : 'ps_net_neg'), money(Math.abs(net))]]))
    + rSec(t('rp_exp_by_cat'), rTable([{ h: t('category') }, { h: t('amount'), n: true }, { h: '%', n: true }], catRows, te ? [t('rp_total'), rNum(te), ''] : null))
    + rSec(t('rp_exp_list'), rTable(cols, list_(exp, 'psc_'), exp.length ? [t('rp_total'), '', '', rNum(te)] : null))
    + rSec(t('rp_inc_list'), rTable(cols, list_(inc, 'psi_'), inc.length ? [t('rp_total'), '', '', rNum(ti)] : null));
  return rWrap({ title: t('rp_pmonth'), sub: monthLabel(ym), body, slug: `Personal-month_${ym}` });
}

function repPersYear(y) {
  const inYear = kind => pAll(kind).filter(r => r.date && r.date.startsWith(y + '-'));
  const inc = inYear('inc'), exp = inYear('exp');
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    const a = pSum(pMonthRows('inc', ym)), b = pSum(pMonthRows('exp', ym));
    rows.push([rMonthName(m), rNum(a), rNum(b), rSigned(a - b)]);
  }
  const ti = pSum(inc), te = pSum(exp), net = ti - te;
  const catRows = P_EXP.map(c => [c, pSum(exp.filter(r => r.cat === c))]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])
    .map(x => [t('psc_' + x[0]), rNum(x[1]), nz(Math.round(x[1] * 100 / te) + '%')]);
  const srcRows = P_INC.map(c => [c, pSum(inc.filter(r => r.cat === c))]).filter(x => x[1] > 0).map(x => [t('psi_' + x[0]), rNum(x[1])]);
  const body = rSec(t('rp_summary'), rKV([[t('ps_income'), money(ti)], [t('ps_expense'), money(te)], [t(net >= 0 ? 'ps_net_pos' : 'ps_net_neg'), money(Math.abs(net))]]))
    + rSec(t('rp_by_month'), rTable([{ h: t('rp_month') }, { h: t('ps_income'), n: true }, { h: t('ps_expense'), n: true }, { h: t('rp_net'), n: true }], rows, [t('rp_total'), rNum(ti), rNum(te), rSigned(net)]))
    + rSec(t('rp_exp_by_cat'), rTable([{ h: t('category') }, { h: t('amount'), n: true }, { h: '%', n: true }], catRows, te ? [t('rp_total'), rNum(te), ''] : null))
    + rSec(t('rp_inc_by_src'), rTable([{ h: t('category') }, { h: t('amount'), n: true }], srcRows, ti ? [t('rp_total'), rNum(ti)] : null));
  return rWrap({ title: t('rp_pyear'), sub: y, body, slug: `Personal-year_${y}` });
}

/* A statement is written to the other person ("you"), so it can be sent to them as it is. */
const rBal = b => (pSettled(b) ? t('ps_square') : b > 0 ? `${nz(fmtNum(b))} — ${t('rp_you_owe')}` : `${nz(fmtNum(-b))} — ${t('rp_owed_you')}`);
function repStatement(key) {
  const p = pPeople().find(x => x.key === key);
  if (!p) return null;
  const rows = rAsc(pAll('led').filter(r => pKey(r.person) === key));
  let run = 0;
  const trs = rows.map(r => { run += pSign(r.dir) * num(r.amount); return [nz(fmtDate(r.date)), `${t('rp_d_' + r.dir)}${r.note ? ' — ' + esc(r.note) : ''}`, rNum(r.amount), rBal(run)]; });
  const period = rows.length ? `${nz(fmtDate(rows[0].date))} – ${nz(fmtDate(rows[rows.length - 1].date))}` : '';
  const body = `<div class="rbig">${t('rp_closing')}: ${rBal(p.bal)}</div>`
    + rSec(t('rp_stmt_title'), rTable([{ h: t('date') }, { h: t('rp_detail') }, { h: t('amount'), n: true }, { h: t('rp_balance') }], trs));
  return rWrap({ title: `${t('rp_stmt_title')}: ${p.name}`, sub: period, body, slug: `Statement_${String(p.name).replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'person'}_${todayISO()}` });
}

function repBalances() {
  const ppl = pPeople(), tot = pTotals(ppl);
  const rows = ppl.map(p => [`<b>${esc(p.name)}</b>`, p.bal > 0.005 ? rNum(p.bal) : '', p.bal < -0.005 ? rNum(-p.bal) : '', nz(fmtDate(p.last))]);
  const body = rSec(t('rp_bal'), rTable([{ h: t('rp_person') }, { h: t('ps_toget_t'), n: true }, { h: t('ps_toowe_t'), n: true }, { h: t('rp_last_entry') }], rows, [t('rp_total'), rNum(tot.get), rNum(tot.owe), '']));
  return rWrap({ title: t('rp_bal'), sub: `${t('rp_as_of')} ${nz(fmtDate(todayISO()))}`, body, slug: `Balances_${todayISO()}` });
}

/* ---------- screen: choose a report ---------- */
function reportsView() {
  const now = todayISO();
  const rp = Object.assign({ 'rp-fm': monthOf(now), 'rp-fy': now.slice(0, 4), 'rp-pm': monthOf(now), 'rp-py': now.slice(0, 4), 'rp-person': '' }, S.rp);
  const card = (title, hint, ctl, r) => `<section class="card stack"><h3>${title}</h3><p class="hint">${hint}</p>${ctl}${btn('rep-go', t('rp_go'), 'primary block', `data-r="${r}"`)}</section>`;
  const mctl = id => `<div class="field"><label for="${id}">${t('rp_month')}</label><input class="inp" id="${id}" type="month" value="${esc(rp[id])}"></div>`;
  const yctl = id => `<div class="field"><label for="${id}">${t('rp_year')}</label><input class="inp" id="${id}" type="number" inputmode="numeric" min="2000" max="2100" value="${esc(rp[id])}"></div>`;
  const ppl = pPeople();
  const pctl = `<div class="field"><label for="rp-person">${t('rp_person')}</label><select class="inp" id="rp-person">${ppl.map(p => `<option value="${esc(p.key)}" ${rp['rp-person'] === p.key ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
  const rtl = S.lang === 'ur';
  return `<div style="display:flex;gap:10px;align-items:center">${btn('back', ic(rtl ? 'right' : 'left'), 'sm')}<h2 style="flex:1">${t('rp_title')}</h2></div>
  <p class="hint">${t('rp_how')}</p>
  <div class="field"><label for="rp-name">${t('rp_name')}</label><input class="inp" id="rp-name" type="text" value="${esc(rName())}" autocomplete="off"></div>
  <div class="field"><label for="rp-addr">${t('rp_addr')}</label><input class="inp" id="rp-addr" type="text" value="${esc(rAddr())}" autocomplete="off"></div>
  <h3>${t('rp_farm')}</h3>
  ${card(t('rp_preg'), t('rp_preg_h'), '', 'preg')}
  ${card(t('rp_herd'), t('rp_herd_h'), '', 'herd')}
  ${card(t('rp_fmonth'), t('rp_fmonth_h'), mctl('rp-fm'), 'fmonth')}
  ${card(t('rp_fyear'), t('rp_fyear_h'), yctl('rp-fy'), 'fyear')}
  <h3>${t('rp_personal')}</h3>
  ${card(t('rp_pmonth'), t('rp_pmonth_h'), mctl('rp-pm'), 'pmonth')}
  ${card(t('rp_pyear'), t('rp_pyear_h'), yctl('rp-py'), 'pyear')}
  ${ppl.length ? card(t('rp_stmt'), t('rp_stmt_h'), pctl, 'stmt') + card(t('rp_bal'), t('rp_bal_h'), '', 'bal')
    : `<section class="card stack"><h3>${t('rp_stmt')}</h3><p class="hint">${t('rp_no_people')}</p></section>`}`;
}

/* ---------- screen: the report itself ---------- */
function openReport(rep) {
  let el = $('#report');
  if (!el) { el = document.createElement('div'); el.id = 'report'; document.body.appendChild(el); }
  REPORT = rep;
  el.innerHTML = `<div class="rbar">${btn('report-print', t('rp_save'), 'gold')}${btn('report-close', t('close'))}</div>
    <article class="paper" dir="${S.lang === 'ur' ? 'rtl' : 'ltr'}" lang="${S.lang}">${rep.html}</article>`;
  document.documentElement.classList.add('rp-open');
  el.scrollTop = 0;
}
function closeReport() {
  const el = $('#report');
  if (el) el.remove();
  REPORT = null;
  document.documentElement.classList.remove('rp-open');
}
function printReport() {
  if (!REPORT) return;
  const old = document.title;
  document.title = REPORT.file;
  const done = () => { document.title = old; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(done, 90000);
  window.print();
}
function repGo(el) {
  const g = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  const r = el.dataset.r;
  const rep = r === 'preg' ? repPregnancy() : r === 'herd' ? repHerd()
    : r === 'fmonth' ? repFarmMonth(rMonth(g('rp-fm'))) : r === 'fyear' ? repFarmYear(rYear(g('rp-fy')))
    : r === 'pmonth' ? repPersMonth(rMonth(g('rp-pm'))) : r === 'pyear' ? repPersYear(rYear(g('rp-py')))
    : r === 'stmt' ? repStatement(g('rp-person')) : r === 'bal' ? repBalances() : null;
  if (!rep) { toast(t('rp_pick'), 'bad'); return; }
  openReport(rep);
}
function rpChange(el) {
  if (el.id === 'rp-name' || el.id === 'rp-addr') { try { localStorage.setItem(el.id === 'rp-name' ? 'kdl-rpname' : 'kdl-rpaddr', el.value.trim()); } catch (e) { /* convenience only */ } return; }
  S.rp[el.id] = el.value;
}
