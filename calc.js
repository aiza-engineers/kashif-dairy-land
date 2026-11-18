'use strict';
/* Herd logic: dates, stock, feed suggestions, money, alerts. No DOM here. */
const animals = () => list('animals');
const byId = id => S.d.animals[id];
const tagSort = (a, b) => String(a.tag).localeCompare(String(b.tag), undefined, { numeric: true });
const tagOf = id => (id === '*' ? t('whole_herd') : byId(id) ? byId(id).tag : '?');
const cows = () => animals().filter(a => a.kind === 'cow').sort(tagSort);
const calvesOf = id => animals().filter(a => a.motherId === id).sort(tagSort);
const kindLabel = k => t(k === 'cow' ? 'kind_cow' : k === 'cf' ? 'kind_cf' : 'kind_cm');
const unitOf = f => f.unit || 'kg';
const buyUnitOf = f => f.buyUnit || unitOf(f);
const factorOf = f => (num(f.factor) > 0 ? num(f.factor) : 1);

function ageStr(dob, today) {
  if (!dob) return '';
  const days = diffDays(today, dob);
  if (days < 0) return '';
  const y = Math.floor(days / 365.25), m = Math.floor((days % 365.25) / 30.44);
  if (y > 0) return `${y} ${t('yr')}` + (m ? ` ${m} ${t('mo')}` : '');
  if (m > 0) return `${m} ${t('mo')}`;
  return `${days} ${t('dy')}`;
}

/* ---------- breeding ---------- */
const breedRecs = id => list('breeding').filter(b => b.animalId === id).sort((a, b) => b.aiDate.localeCompare(a.aiDate));
function breedStatus(id) {
  const r = breedRecs(id)[0];
  if (!r) return null;
  if (r.calvedOn) return { rec: r, state: 'calved' };
  if (r.result === 'open') return { rec: r, state: 'open' };
  const c = cfg();
  const due = addDays(r.aiDate, num(c.gestDays));
  return {
    rec: r, state: r.result === 'pregnant' ? 'pregnant' : 'pending',
    heat: addDays(r.aiDate, num(c.heatDays)), check: addDays(r.aiDate, num(c.checkDays)),
    due, dry: addDays(due, -num(c.dryDays))
  };
}
const lastCalving = id => list('calvings').filter(c => c.animalId === id).sort((a, b) => b.date.localeCompare(a.date))[0] || null;

/* ---------- daily records ---------- */
const dayDoc = date => S.d.days[date] || null;
function cellVal(date, aid, k) {
  const d = dayDoc(date);
  return d && d.e && d.e[aid] && d.e[aid][k] != null ? d.e[aid][k] : '';
}
const milkOf = (d, aid) => (d && d.e && d.e[aid] ? num(d.e[aid].am) + num(d.e[aid].pm) : 0);
function lastMilk(aid, date) {
  const ds = Object.keys(S.d.days).filter(k => k < date).sort().reverse();
  for (const k of ds) { const m = milkOf(S.d.days[k], aid); if (m > 0) return { milk: m, date: k }; }
  return null;
}
function suggest(aid, f, date) {
  const lm = lastMilk(aid, date);
  const raw = num(f.base) + num(f.per) * (lm ? lm.milk : 0);
  const step = unitOf(f) === 'g' ? 10 : 0.5;
  return { val: Math.round(raw / step) * step, from: lm };
}

/* ---------- stock ---------- */
function usageByDay(fid) {
  const out = {};
  for (const [date, d] of Object.entries(S.d.days)) {
    let s = 0;
    for (const aid of Object.keys(d.e || {})) s += num(d.e[aid][fid]);
    if (s > 0) out[date] = s;
  }
  return out;
}
/* All quantities are kept in the daily unit; display converts to the bought-in unit. */
function stockInfo(f) {
  const fa = factorOf(f);
  const ps = list('purchases').filter(p => p.feedId === f.id);
  const boughtBuy = ps.reduce((s, p) => s + num(p.qty), 0);
  const paid = ps.reduce((s, p) => s + num(p.amount), 0);
  const ud = usageByDay(f.id);
  const used = Object.values(ud).reduce((s, v) => s + v, 0);
  const recent = Object.keys(ud).sort().reverse().slice(0, 7);
  const avg = recent.length ? recent.reduce((s, k) => s + ud[k], 0) / recent.length : 0;
  const remaining = boughtBuy * fa - used;
  const priceBuy = boughtBuy > 0 ? paid / boughtBuy : 0;
  return {
    boughtBuy, paid, used, remaining, remainingBuy: remaining / fa, priceBuy, priceUnit: priceBuy / fa,
    avg, daysLeft: avg > 0 ? remaining / avg : null
  };
}

function dayTotals(date, rateOverride) {
  const d = dayDoc(date) || { e: {} };
  const c = cfg();
  const rate = rateOverride != null ? rateOverride : has(d.p) ? num(d.p) : num(c.milkPrice);
  let milk = 0, feedCost = 0;
  const price = {};
  c.feeds.forEach(f => { price[f.id] = stockInfo(f).priceUnit; });
  for (const aid of Object.keys(d.e || {})) {
    const e = d.e[aid];
    milk += num(e.am) + num(e.pm);
    c.feeds.forEach(f => { feedCost += num(e[f.id]) * price[f.id]; });
  }
  return { milk, rate, income: milk * rate, feedCost, net: milk * rate - feedCost };
}

/* ---------- health ---------- */
const withholdUntil = h => (num(h.withholdDays) > 0 ? addDays(h.date, Math.max(num(h.courseDays) - 1, 0) + num(h.withholdDays)) : null);
function activeWithhold(aid, today) {
  let best = null;
  list('health').forEach(h => {
    if (h.animalId !== aid) return;
    const u = withholdUntil(h);
    if (u && h.date <= today && u >= today && (!best || u > best)) best = u;
  });
  return best;
}

/* ---------- monthly report ---------- */
function monthReport(ym) {
  let litres = 0, income = 0, feedUsed = 0;
  for (const date of Object.keys(S.d.days)) {
    if (!date.startsWith(ym)) continue;
    const t2 = dayTotals(date);
    litres += t2.milk; income += t2.income; feedUsed += t2.feedCost;
  }
  const c = cfg();
  const feedLines = c.feeds.map(f => ({ f, amount: list('purchases').filter(p => p.feedId === f.id && p.date.startsWith(ym)).reduce((s, p) => s + num(p.amount), 0) })).filter(x => x.amount > 0);
  const feedTotal = feedLines.reduce((s, x) => s + x.amount, 0);
  const exp = list('expenses').filter(e => e.date.startsWith(ym));
  const sumCat = cats => exp.filter(e => cats.includes(e.cat)).reduce((s, e) => s + num(e.amount), 0);
  const medTotal = list('health').filter(h => h.date.startsWith(ym)).reduce((s, h) => s + num(h.cost), 0)
    + list('vaccines').filter(v => v.date.startsWith(ym)).reduce((s, v) => s + num(v.cost), 0) + sumCat(['medicine', 'vet']);
  const otherLines = ['labor', 'power', 'transport', 'other'].map(k => ({ k, amount: sumCat([k]) })).filter(x => x.amount > 0);
  const otherTotal = otherLines.reduce((s, x) => s + x.amount, 0);
  const bought = animals().filter(a => a.source === 'purchased' && a.purchaseDate && a.purchaseDate.startsWith(ym));
  const capital = bought.reduce((s, a) => s + num(a.price) + num(a.calfPrice), 0);
  const totalExp = feedTotal + medTotal + otherTotal;
  return { litres, income, feedUsed, feedLines, feedTotal, medTotal, otherLines, otherTotal, totalExp, profit: income - totalExp, boughtCount: bought.length, capital };
}

/* ---------- herd numbers ---------- */
function calfStats() {
  const f = animals().filter(a => a.kind === 'cf').length, m = animals().filter(a => a.kind === 'cm').length;
  return { f, m, total: f + m };
}
const pregnantCount = () => cows().filter(a => { const b = breedStatus(a.id); return b && b.state === 'pregnant'; }).length;

/* ---------- alerts ---------- */
function buildAlerts(today) {
  const out = [], c = cfg();
  const push = (sev, key, params, whenISO, go, order) => out.push({ sev, key, params, when: whenISO ? relText(whenISO, today) : '', go, order });
  for (const a of cows()) {
    const b = breedStatus(a.id);
    if (!b) continue;
    if (b.state === 'pregnant') {
      const dd = diffDays(b.due, today);
      if (dd <= 21) push(dd < 0 ? 'bad' : 'warn', 'al_calving', { tag: a.tag }, b.due, { animal: a.id }, dd);
      const dr = diffDays(b.dry, today);
      if (dr <= 7 && dd > 0 && !b.rec.driedOn) push(dr < 0 ? 'bad' : 'warn', 'al_dry', { tag: a.tag }, b.dry, { animal: a.id }, dr);
    } else if (b.state === 'pending') {
      const dh = diffDays(b.heat, today), dc = diffDays(b.check, today);
      if (dc <= 3) push(dc < 0 ? 'bad' : 'warn', 'al_check', { tag: a.tag }, b.check, { animal: a.id }, dc);
      else if (dh <= 1 && dh >= -5) push('warn', 'al_heat', { tag: a.tag }, b.heat, { animal: a.id }, dh);
    }
  }
  const groups = {};
  list('vaccines').forEach(v => {
    if (v.animalId !== '*' && !byId(v.animalId)) return;
    const k = v.animalId + '|' + String(v.name).trim().toLowerCase();
    if (!groups[k] || v.date > groups[k].date) groups[k] = v;
  });
  Object.values(groups).forEach(v => {
    if (!v.nextDate) return;
    const dd = diffDays(v.nextDate, today);
    if (dd <= 7) push(dd < 0 ? 'bad' : 'warn', 'al_vacc', { tag: tagOf(v.animalId), name: v.name }, v.nextDate, v.animalId === '*' ? { view: 'health' } : { animal: v.animalId }, dd);
  });
  list('health').forEach(h => {
    const a = byId(h.animalId);
    if (!a || !h.nextDoseDate || h.recoveredDate) return;
    const dd = diffDays(h.nextDoseDate, today);
    if (dd <= 1) push(dd < 0 ? 'bad' : 'warn', 'al_dose', { tag: a.tag, med: h.medicine || '' }, h.nextDoseDate, { animal: a.id }, dd);
  });
  for (const a of animals()) {
    const w = activeWithhold(a.id, today);
    if (w) push('warn', 'al_withhold', { tag: a.tag, date: fmtDate(w) }, null, { animal: a.id }, diffDays(w, today));
  }
  c.feeds.forEach(f => {
    const s = stockInfo(f);
    if (s.daysLeft != null && s.daysLeft < num(c.lowDays)) push(s.daysLeft < 1 ? 'bad' : 'warn', 'al_stock', { item: feedName(f) }, null, { view: 'accounts', sub: 'stock' }, s.daysLeft - 100);
  });
  const rank = { bad: 0, warn: 1, ok: 2 };
  return out.sort((x, y) => rank[x.sev] - rank[y.sev] || x.order - y.order);
}
