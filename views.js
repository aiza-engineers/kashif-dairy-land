'use strict';
/* Screens. Each view returns an HTML string; events are wired in events.js. */
const $ = (s, r = document) => r.querySelector(s);
const ICON = {
  home: '<path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5"/>',
  daily: '<path d="M6 4h12v17H6zM9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  animals: '<path d="M4 4h8.2L20 11.8 11.8 20 4 12.2zM8.5 8.5h.01"/>',
  health: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
  accounts: '<path d="M3 8h15.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 8l2.5-3.5H16M16 14h2.5"/>',
  personal: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', chev: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>'
};
const ic = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const chip = (txt, cls = '') => `<span class="chip ${cls}">${txt}</span>`;
const line = (l, r) => `<div class="line"><span class="l">${l}</span><span class="r">${r}</span></div>`;
const btn = (act, label, cls = '', data = '') => `<button type="button" class="btn ${cls}" data-act="${act}" ${data}>${label}</button>`;
const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-act="seg" data-key="${key}" data-v="${v}" aria-pressed="${S.sub[key] === v}">${l}</button>`).join('')}</div>`;
const tile = (k, v, u = '', cls = '') => `<div class="tile ${cls}"><div class="k">${k}</div><div class="v">${v}${u ? `<span class="u">${u}</span>` : ''}</div></div>`;

/* ---------- sign-in / start screens ---------- */
function authView() {
  const lang = `<button type="button" class="hbtn login-lang" data-act="lang" aria-label="Language">${S.lang === 'ur' ? 'EN' : 'اردو'}</button>`;
  const head = `${lang}<img src="logo.svg" alt="" width="96" height="96" class="login-logo"><h1 class="login-title">${t('app')}</h1><p class="login-sub">${t('tagline')}</p>`;
  if (S.auth === 'init') return `<main class="login">${head}<p class="login-msg ok">${t('l_wait')}</p></main>`;
  if (S.auth === 'nocfg' || S.auth === 'nosdk') return `<main class="login">${head}<p class="login-msg">${t(S.auth === 'nocfg' ? 'l_nocfg' : 'l_nosdk')}</p></main>`;
  return `<main class="login">${head}
  <form id="login-form" class="login-form" autocomplete="on">
    <div class="field"><label for="l-email">${t('l_email')}</label><input class="inp" id="l-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" dir="ltr"></div>
    <div class="field"><label for="l-pass">${t('l_pass')}</label><input class="inp" id="l-pass" name="password" type="password" autocomplete="current-password" dir="ltr"></div>
    <p class="login-msg" id="login-msg" role="alert">${S.authErr ? esc(t(S.authErr)) : ''}</p>
    <button type="submit" class="btn primary block" id="l-go">${t('l_go')}</button>
    <button type="button" class="btn block" data-act="forgot">${t('l_forgot')}</button>
  </form></main>`;
}

/* ---------- frame ---------- */
function header() {
  const st = S.local ? ['err', t('sync_off')] : S.sync === 'ok' ? ['ok', t('sync_ok')] : S.sync === 'error' ? ['err', t('sync_err')] : S.sync === 'offline' ? ['', t('sync_offline')] : ['', t('sync_loading')];
  return `<header class="hdr">
    <img src="logo.svg" alt="" width="44" height="44">
    <div class="title">${t('app')}<span class="sub"><span class="dot ${st[0]}" style="display:inline-block;margin-inline-end:6px"></span>${st[1]}</span></div>
    <button type="button" class="hbtn" data-act="lang" aria-label="Language">${S.lang === 'ur' ? 'EN' : 'اردو'}</button>
    <button type="button" class="hbtn" data-act="settings" aria-label="${t('settings')}">${ic('gear')}</button>
  </header>`;
}
function tabsHTML() {
  const n = buildAlerts(todayISO()).length;
  const items = [['home', 'nav_home'], ['daily', 'nav_daily'], ['animals', 'nav_animals'], ['health', 'nav_health'], ['accounts', 'nav_accounts'], ['personal', 'nav_personal']];
  const cur = S.view === 'animal' ? 'animals' : S.view;
  return `<nav class="tabs" aria-label="Main">${items.map(([v, k]) => `<button type="button" class="tab" data-act="nav" data-v="${v}" ${cur === v ? 'aria-current="page"' : ''}>${ic(v)}${v === 'home' && n ? `<span class="badge">${n}</span>` : ''}<span>${t(k)}</span></button>`).join('')}</nav>`;
}
function banners() {
  let h = '';
  if (S.local) h += `<div class="banner bad" role="alert">${t('nodb_banner')}</div>`;
  if (S.slow && !S.local) h += `<div class="banner" role="status">${t('slow_banner')}</div>`;
  if (S.readOnly) h += `<div class="banner" role="status">${t('no_write')}</div>`;
  return h;
}
function render() {
  const y = window.scrollY;
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ur' ? 'rtl' : 'ltr';
  if (S.auth !== 'ok') {
    const e0 = $('#l-email'), p0 = $('#l-pass'), ev = e0 ? e0.value : '', pv = p0 ? p0.value : '';
    $('#root').innerHTML = authView();
    const e1 = $('#l-email'), p1 = $('#l-pass');
    if (e1) e1.value = ev; if (p1) p1.value = pv;
    document.getElementById('sheet').classList.add('hidden');
    return;
  }
  const views = { home: homeView, daily: dailyView, animals: animalsView, animal: animalView, health: healthView, accounts: accountsView, personal: personalView, settings: settingsView };
  $('#root').innerHTML = header() + `<main class="app" id="app">${banners()}${(views[S.view] || homeView)()}</main>` + tabsHTML();
  window.scrollTo(0, y);
}

/* ---------- home ---------- */
function homeView() {
  const today = todayISO();
  if (!animals().length) {
    return `<section class="card empty"><img src="logo.svg" alt=""><h2>${t('empty_title')}</h2><p>${t('empty_text')}</p>${btn('animal-add', ic('plus') + t('add_animal'), 'primary')}</section>`;
  }
  const al = buildAlerts(today), tt = dayTotals(today), cs = calfStats(), mr = monthReport(monthOf(today));
  const alerts = al.length
    ? al.slice(0, 14).map(a => `<button type="button" class="alert ${a.sev}" data-act="alert" data-go="${esc(JSON.stringify(a.go))}"><div class="body"><div class="ttl">${esc(t(a.key, a.params))}</div>${a.when ? `<div class="when">${a.when}</div>` : ''}</div>${ic('chev', 'chv')}</button>`).join('')
    : `<div class="card muted">${t('home_none')}</div>`;
  return `
  <section class="tiles">
    ${tile(t('tile_milk'), nz(fmtNum(tt.milk, 1)), t('unit_l'), 'hl')}
    ${tile(t('tile_income'), nz(fmtNum(tt.income)), t('rs'))}
    ${tile(t('tile_cows'), nz(cows().length))}
    ${tile(t('tile_preg'), nz(pregnantCount()))}
    ${tile(t('tile_calves'), nz(cs.total), `${cs.f} ${t('heifers')} · ${cs.m} ${t('bulls')}`)}
    ${tile(t('tile_month'), `<span style="color:var(--${mr.profit < 0 ? 'bad' : 'ok'})">${nz(fmtNum(mr.profit))}</span>`, t('rs'))}
  </section>
  <section class="stack"><h2>${t('home_attention')}</h2>${alerts}</section>
  <section class="stack"><h2>${t('home_quick')}</h2>
    <div class="quick">
      ${btn('nav', t('q_daily'), 'primary', 'data-v="daily"')}
      ${btn('animal-add', ic('plus') + t('q_add_animal'))}
      ${btn('breed-pick', t('q_breed'))}
      ${btn('purchase-add', ic('plus') + t('q_purchase'))}
    </div>
  </section>`;
}

/* ---------- animals ---------- */
function animalChips(a, today) {
  const out = [];
  if (a.kind === 'cow') {
    const b = breedStatus(a.id);
    if (b && b.state === 'pregnant') out.push(chip(t('st_preg'), 'ok'));
    else if (b && b.state === 'pending') out.push(chip(t('st_pending'), 'gold'));
  }
  if (activeWithhold(a.id, today)) out.push(chip(t('withheld_chip'), 'warn'));
  return out.join(' ');
}
function animalRowsHTML() {
  const today = todayISO(), f = S.sub.animals, q = S.q.trim().toLowerCase();
  let rows = animals().filter(a => (f === 'all' || (f === 'cows' ? a.kind === 'cow' : a.kind !== 'cow')) && (!q || String(a.tag).toLowerCase().includes(q)));
  rows = rows.sort((a, b) => (a.kind === 'cow' ? 0 : 1) - (b.kind === 'cow' ? 0 : 1) || tagSort(a, b));
  const items = rows.map(a => {
    const sub = [kindLabel(a.kind), a.dob ? ageStr(a.dob, today) : '', a.source === 'purchased' ? t('src_purchased') : t('src_home')].filter(Boolean).join(' · ');
    return `<button type="button" class="rowbtn" data-act="animal" data-id="${a.id}"><div class="grow"><div class="top"><span class="tagno">${esc(a.tag)}</span> ${animalChips(a, today)}</div><div class="small muted">${esc(sub)}</div></div>${ic('chev', 'chev')}</button>`;
  }).join('');
  return items || `<div class="card muted">${t('no_items')}</div>`;
}
function animalsView() {
  return `
  <div class="card-row" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2>${t('nav_animals')} <span class="muted num">${animals().length}</span></h2>${btn('animal-add', ic('plus') + t('add'), 'primary sm')}</div>
  <div class="field"><label for="q" class="hidden">${t('search')}</label><input id="q" class="inp" type="search" placeholder="${t('search')}" value="${esc(S.q)}" autocomplete="off"></div>
  ${seg('animals', [['all', t('f_all')], ['cows', t('f_cows')], ['calves', t('f_calves')]])}
  <div class="stack" id="alist">${animalRowsHTML()}</div>`;
}

function histRow(act, id, main, subtxt, chips = '') {
  return `<button type="button" class="rowbtn" data-act="${act}" data-id="${id}"><div class="grow"><div><b>${main}</b> ${chips}</div>${subtxt ? `<div class="small muted">${subtxt}</div>` : ''}</div>${ic('chev', 'chev')}</button>`;
}
function animalView() {
  const a = byId(S.animalId);
  if (!a) { S.view = 'animals'; return animalsView(); }
  const today = todayISO(), isCow = a.kind === 'cow';
  const b = isCow ? breedStatus(a.id) : null, lc = isCow ? lastCalving(a.id) : null;
  const mother = a.motherId ? byId(a.motherId) : null, kids = calvesOf(a.id);
  let info = line(t('kind'), kindLabel(a.kind));
  info += line(t('source'), a.source === 'purchased' ? t('src_purchased') : t('born_home'));
  if (a.source === 'purchased') {
    if (a.purchaseDate) info += line(t('purchase_date'), fmtDate(a.purchaseDate));
    if (has(a.price)) info += line(t('price'), money(a.price));
    if (has(a.calfPrice) && num(a.calfPrice) > 0) info += line(t('calf_price'), money(a.calfPrice));
  }
  if (a.dob) info += line(t('dob'), `${fmtDate(a.dob)} <span class="muted small">(${ageStr(a.dob, today)})</span>`);
  if (mother) info += line(t('mother'), `<button type="button" class="chip gold" data-act="animal" data-id="${mother.id}">${esc(mother.tag)}</button>`);
  if (a.notes) info += line(t('notes'), esc(a.notes));

  let status = '';
  if (isCow) {
    if (b && b.state === 'pregnant') {
      status += line(t('st_preg'), chip(t('st_preg'), 'ok')) + line(t('due'), `${fmtDate(b.due)} <span class="muted small">(${relText(b.due, today)})</span>`);
      status += b.rec.driedOn ? line(t('dried_on'), fmtDate(b.rec.driedOn)) : line(t('dry_on'), `${fmtDate(b.dry)} <span class="muted small">(${relText(b.dry, today)})</span>`);
    } else if (b && b.state === 'pending') {
      status += line(t('st_pending'), chip(t('st_pending'), 'gold')) + line(t('heat_check'), fmtDate(b.heat)) + line(t('preg_check'), fmtDate(b.check)) + line(t('due') + ' *', fmtDate(b.due));
    } else if (b && b.state === 'open') status += line(t('st_open'), chip(t('st_open')));
    if (lc) status += line(t('last_calving'), fmtDate(lc.date)) + line(t('dim'), nz(Math.max(diffDays(today, lc.date), 0)));
    if (kids.length) {
      const kf = kids.filter(k => k.kind === 'cf').length, km = kids.length - kf;
      status += line(t('calves_total'), `${nz(kids.length)} <span class="muted small">(${kf} ${t('heifers')}, ${km} ${t('bulls')})</span>`);
    }
  }
  const wh = activeWithhold(a.id, today);
  if (wh) status += line(t('milk_out_until'), `<span style="color:var(--warn)">${fmtDate(wh)}</span>`);

  const actions = [
    isCow ? btn('breed-add', t('a_breed'), 'primary', `data-id="${a.id}"`) : '',
    isCow ? btn('calving-add', t('a_calving'), '', `data-id="${a.id}"`) : '',
    isCow && b && b.state === 'pregnant' && !b.rec.driedOn ? btn('mark-dry', t('mark_dry'), '', `data-id="${b.rec.id}"`) : '',
    btn('vacc-add', t('a_vacc'), '', `data-id="${a.id}"`),
    btn('ill-add', t('a_ill'), '', `data-id="${a.id}"`)
  ].join('');

  const hist = (title, rows) => `<section class="stack"><h3>${title}</h3>${rows || `<div class="card muted small">${t('no_items')}</div>`}</section>`;
  const resChip = r => (r === 'pregnant' ? chip(t('res_pregnant'), 'ok') : r === 'open' ? chip(t('res_open')) : chip(t('res_pending'), 'gold'));
  const breedRows = breedRecs(a.id).map(r => histRow('breed-edit', r.id, fmtDate(r.aiDate), esc(r.semen || ''), (r.calvedOn ? chip(t('calved_on') + ' ' + fmtDate(r.calvedOn), 'ok') : resChip(r.result)))).join('');
  const calvRows = list('calvings').filter(c => c.animalId === a.id).sort((x, y) => y.date.localeCompare(x.date)).map(c => histRow('calving-edit', c.id, fmtDate(c.date), (c.calfIds || []).map(id => byId(id) ? `${esc(byId(id).tag)} (${kindLabel(byId(id).kind)})` : '').filter(Boolean).join(', '))).join('');
  const vaccRows = list('vaccines').filter(v => v.animalId === a.id).sort((x, y) => y.date.localeCompare(x.date)).map(v => histRow('vacc-edit', v.id, esc(v.name), fmtDate(v.date), v.nextDate ? chip(t('next_label') + ' ' + fmtDate(v.nextDate), 'gold') : '')).join('');
  const hRows = list('health').filter(h => h.animalId === a.id).sort((x, y) => y.date.localeCompare(x.date)).map(h => histRow('ill-edit', h.id, esc(problemLabel(h)), `${fmtDate(h.date)}${h.medicine ? ' · ' + esc(h.medicine) : ''}`, h.recoveredDate ? chip(t('recovered_chip'), 'ok') : chip(t('ongoing'), 'warn'))).join('');
  const kidRows = kids.map(k => `<button type="button" class="rowbtn" data-act="animal" data-id="${k.id}"><div class="grow"><b class="tagno">${esc(k.tag)}</b> ${chip(kindLabel(k.kind), 'gold')}<div class="small muted">${k.dob ? fmtDate(k.dob) + ' · ' + ageStr(k.dob, today) : ''}</div></div>${ic('chev', 'chev')}</button>`).join('');

  return `
  <div style="display:flex;gap:10px;align-items:center">${btn('back', ic(S.lang === 'ur' ? 'right' : 'left'), 'sm', `aria-label="${t('close')}"`)}<h2 style="flex:1"><span class="tagno" style="font-size:1.7rem">${esc(a.tag)}</span> ${animalChips(a, today)}</h2>${btn('animal-edit', t('edit'), 'sm', `data-id="${a.id}"`)}</div>
  <section class="card">${info}</section>
  ${status ? `<section class="card">${status}</section>` : ''}
  <section class="btns">${actions}</section>
  ${isCow ? hist(t('sec_breeding'), breedRows) + hist(t('sec_calving'), calvRows) : ''}
  ${isCow && kids.length ? hist(t('sec_calves'), kidRows) : ''}
  ${hist(t('sec_vacc'), vaccRows)}${hist(t('sec_health'), hRows)}`;
}
function problemLabel(h) {
  return h.problem === 'other' ? h.otherText || t('pr_other') : t('pr_' + h.problem);
}

/* ---------- daily ---------- */
function dailyView() {
  if (!S.date) S.date = todayISO();
  const date = S.date, c = cfg(), cs = cows(), tt = dayTotals(date);
  const head = `
  <h2>${t('d_title')}</h2>
  <div class="datebar">${btn('date-prev', ic(S.lang === 'ur' ? 'right' : 'left'), 'sm', 'aria-label="-1"')}
    <input id="d-date" class="inp" type="date" value="${date}" aria-label="${t('date')}">
    ${btn('date-next', ic(S.lang === 'ur' ? 'left' : 'right'), 'sm', 'aria-label="+1"')}
    ${date !== todayISO() ? btn('date-today', t('today'), 'sm') : ''}</div>`;
  if (!cs.length) return head + `<div class="card muted">${t('no_cows')}</div>`;
  const tiles = `<div class="tiles">
    ${tile(t('d_milk'), `<span id="t-milk" class="num">${fmtNum(tt.milk, 1)}</span>`, t('unit_l'), 'hl')}
    ${tile(t('d_income'), `<span id="t-inc" class="num">${fmtNum(tt.income)}</span>`, t('rs'))}
    ${tile(t('d_feedcost'), `<span id="t-feed" class="num">${fmtNum(tt.feedCost)}</span>`, t('rs'))}
    ${tile(t('d_net'), `<span id="t-net" class="num">${fmtNum(tt.net)}</span>`, t('rs'))}
  </div>
  <div class="field"><label for="d-rate">${t('d_rate')}</label><input id="d-rate" class="inp" type="number" inputmode="decimal" step="any" min="0" value="${tt.rate}"></div>`;
  const rows = cs.map(a => {
    const b = breedStatus(a.id), lc = lastCalving(a.id), wh = activeWithhold(a.id, date);
    const chips = [
      b && b.state === 'pregnant' ? chip(t('preg_chip'), 'ok') : '',
      lc && diffDays(date, lc.date) >= 0 ? chip(`<span class="num">${diffDays(date, lc.date)}</span> ${t('dim_chip')}`) : '',
      wh ? chip(t('withheld_chip') + ' → ' + fmtDate(wh), 'warn') : ''
    ].join(' ');
    const cell = (k, label, sg) => `<div class="cell"><label for="in-${a.id}-${k}">${label}</label><input id="in-${a.id}-${k}" type="number" inputmode="decimal" step="any" min="0" data-dl="${a.id}|${k}" value="${esc(cellVal(date, a.id, k))}">${sg && sg.val > 0 ? `<button type="button" class="sg" data-act="sug" data-t="in-${a.id}-${k}" data-v="${sg.val}">${t('sug')} <span class="num">${sg.val}</span></button>` : ''}</div>`;
    const lm = lastMilk(a.id, date);
    return `<div class="cow"><div class="top"><span class="tagno">${esc(a.tag)}</span>${chips}<span class="sp"></span>${lm ? `<span class="small muted">${t('last_milk')}: <span class="num">${fmtNum(lm.milk, 1)}</span> ${t('unit_l')}</span>` : ''}</div>
      <div class="grid2">${cell('am', t('d_am'))}${cell('pm', t('d_pm'))}</div>
      <div class="cells">${c.feeds.map(f => cell(f.id, `${esc(feedName(f))} (${esc(unitOf(f))})`, suggest(a.id, f, date))).join('')}</div></div>`;
  }).join('');
  return head + tiles + btn('sug-all', t('use_suggest'), 'gold block') + `<p class="hint">${t('suggest_note')}</p>` + `<div class="stack">${rows}</div>`;
}

/* ---------- health ---------- */
function healthView() {
  const today = todayISO(), f = S.sub.health;
  let body = '';
  if (f === 'vacc') {
    const groups = {};
    list('vaccines').forEach(v => {
      if (v.animalId !== '*' && !byId(v.animalId)) return;
      const k = v.animalId + '|' + String(v.name).trim().toLowerCase();
      if (!groups[k] || v.date > groups[k].date) groups[k] = v;
    });
    const rows = Object.values(groups).sort((x, y) => (x.nextDate || '9999').localeCompare(y.nextDate || '9999')).map(v => {
      let ch = '';
      if (v.nextDate) {
        const dd = diffDays(v.nextDate, today);
        ch = chip(`${t('next_label')} ${fmtDate(v.nextDate)}`, dd < 0 ? 'bad' : dd <= 7 ? 'warn' : 'ok');
      }
      return histRow('vacc-edit', v.id, `${esc(tagOf(v.animalId))} · ${esc(v.name)}`, fmtDate(v.date), ch);
    }).join('');
    body = `<div class="stack">${rows || `<div class="card muted">${t('no_items')}</div>`}</div>`;
  } else {
    const rows = list('health').filter(h => byId(h.animalId)).sort((x, y) => y.date.localeCompare(x.date)).map(h => {
      const u = withholdUntil(h);
      const ch = (h.recoveredDate ? chip(t('recovered_chip'), 'ok') : chip(t('ongoing'), 'warn')) + (u && u >= today ? ' ' + chip(t('milk_out_until') + ' ' + fmtDate(u), 'warn') : '');
      return histRow('ill-edit', h.id, `${esc(tagOf(h.animalId))} · ${esc(problemLabel(h))}`, `${fmtDate(h.date)}${h.medicine ? ' · ' + esc(h.medicine) : ''}`, ch);
    }).join('');
    body = `<div class="stack">${rows || `<div class="card muted">${t('no_items')}</div>`}</div>`;
  }
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2>${t('nav_health')}</h2>${btn(f === 'vacc' ? 'vacc-add' : 'ill-add', ic('plus') + t('add'), 'primary sm', 'data-id=""')}</div>
  ${seg('health', [['vacc', t('h_vacc')], ['treat', t('h_treat')]])}${body}`;
}

/* ---------- accounts ---------- */
function groupByMonth(items) {
  const g = {};
  items.sort((a, b) => b.date.localeCompare(a.date)).forEach(i => { (g[monthOf(i.date)] = g[monthOf(i.date)] || []).push(i); });
  return g;
}
function accountsView() {
  const f = S.sub.acc, c = cfg();
  let body = '';
  if (f === 'stock') {
    body = c.feeds.map(fd => {
      const s = stockInfo(fd), bu = buyUnitOf(fd);
      const low = s.daysLeft != null && s.daysLeft < num(c.lowDays);
      return `<div class="card"><div class="row-head"><h3>${esc(feedName(fd))}</h3>${low ? chip(t('low'), s.daysLeft < 1 ? 'bad' : 'warn') : ''}</div>
        <div class="tile" style="border:0;padding:0"><div class="k">${t('remaining')}</div><div class="v">${nz(fmtNum(s.remainingBuy, 1))}<span class="u">${esc(bu)}</span></div></div>
        ${s.remaining < -1e-9 ? `<p class="hint" style="color:var(--bad)">${t('over_used')}</p>` : ''}
        ${line(t('days_left'), s.daysLeft != null ? nz(fmtNum(Math.max(s.daysLeft, 0), 1)) : `<span class="muted">${t('no_use_yet')}</span>`)}
        ${s.priceBuy > 0 ? line(t('avg_price'), `${money(s.priceBuy)} / ${esc(bu)}`) : ''}</div>`;
    }).join('');
  } else if (f === 'purch') {
    const g = groupByMonth(list('purchases'));
    body = Object.keys(g).sort().reverse().map(m => {
      const tot = g[m].reduce((s, p) => s + num(p.amount), 0);
      return `<div class="stack"><div class="group-h"><span>${monthLabel(m)}</span><span>${money(tot)}</span></div>${g[m].map(p => {
        const fd = c.feeds.find(x => x.id === p.feedId) || { id: p.feedId, ur: p.feedId, en: p.feedId, unit: '' };
        return histRow('purchase-edit', p.id, `${esc(feedName(fd))} · <span class="num">${fmtNum(p.qty, 1)}</span> ${esc(buyUnitOf(fd))}`, `${fmtDate(p.date)}${p.supplier ? ' · ' + esc(p.supplier) : ''}`, chip(money(p.amount), 'gold'));
      }).join('')}</div>`;
    }).join('') || `<div class="card muted">${t('no_items')}</div>`;
    body = `<div style="display:flex;justify-content:flex-end">${btn('purchase-add', ic('plus') + t('p_add'), 'primary sm')}</div>` + body;
  } else if (f === 'exp') {
    const g = groupByMonth(list('expenses'));
    body = Object.keys(g).sort().reverse().map(m => {
      const tot = g[m].reduce((s, p) => s + num(p.amount), 0);
      return `<div class="stack"><div class="group-h"><span>${monthLabel(m)}</span><span>${money(tot)}</span></div>${g[m].map(e => histRow('expense-edit', e.id, esc(t('cat_' + e.cat)), `${fmtDate(e.date)}${e.note ? ' · ' + esc(e.note) : ''}`, chip(money(e.amount), 'gold'))).join('')}</div>`;
    }).join('') || `<div class="card muted">${t('no_items')}</div>`;
    body = `<div style="display:flex;justify-content:flex-end">${btn('expense-add', ic('plus') + t('e_add'), 'primary sm')}</div>` + body;
  } else {
    if (!S.month) S.month = monthOf(todayISO());
    const r = monthReport(S.month);
    const rows = [
      [t('m_litres'), `${nz(fmtNum(r.litres, 1))} ${t('unit_l')}`],
      [t('m_income'), money(r.income)]
    ];
    const exp = [
      ...r.feedLines.map(x => [esc(feedName(x.f)), money(x.amount)]),
      ...(r.medTotal ? [[t('m_med'), money(r.medTotal)]] : []),
      ...r.otherLines.map(x => [t('cat_' + x.k), money(x.amount)])
    ];
    const pos = r.profit >= 0;
    body = `<div class="datebar">${btn('month-prev', ic(S.lang === 'ur' ? 'right' : 'left'), 'sm')}<h3 style="flex:1;text-align:center">${monthLabel(S.month)}</h3>${btn('month-next', ic(S.lang === 'ur' ? 'left' : 'right'), 'sm')}</div>
    <div class="card"><table class="rep">${rows.map(x => `<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join('')}</table></div>
    <div class="card"><div class="group-h"><span>${t('m_exp')}</span></div><table class="rep">${exp.map(x => `<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join('') || `<tr><td class="muted">${t('no_items')}</td><td></td></tr>`}<tr class="tot"><td>${t('m_exp')}</td><td>${money(r.totalExp)}</td></tr></table></div>
    <div class="card"><div class="muted small">${pos ? t('m_profit') : t('m_loss')}</div><div class="profit ${pos ? 'pos' : 'neg'}">${money(Math.abs(r.profit))}</div>
      ${r.feedUsed > 0 ? line(t('m_feed_used'), money(r.feedUsed)) : ''}
      ${r.boughtCount ? line(`${t('m_animals')} (${r.boughtCount})`, money(r.capital)) + `<p class="hint">${t('m_animals_note')}</p>` : ''}</div>`;
  }
  return `<h2>${t('nav_accounts')}</h2>${seg('acc', [['stock', t('ac_stock')], ['purch', t('ac_purch')], ['exp', t('ac_exp')], ['month', t('ac_month')]])}<div class="stack">${body}</div>`;
}

/* ---------- settings ---------- */
let feedDraft = null;
function feedEditor(f, i) {
  const inp = (k, label, type = 'text', extra = '') => `<div class="field"><label>${label}</label><input class="inp" data-feed="${i}" data-k="${k}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(f[k] == null ? '' : f[k])}" ${extra}></div>`;
  return `<div class="card stack"><div class="row-head"><h3>${esc(feedName(f) || '—')}</h3>${btn('feed-del', t('remove'), 'danger sm', `data-i="${i}"`)}</div>
    <div class="grid2">${inp('ur', t('f_name_ur'))}${inp('en', t('f_name_en'))}</div>
    <div class="grid2">${inp('unit', t('f_unit'))}${inp('buyUnit', t('f_buyunit'))}</div>
    <div class="grid2">${inp('factor', t('f_factor'), 'number')}<span></span></div>
    <div class="grid2">${inp('base', t('f_base') + ' (' + esc(f.unit || '') + ')', 'number')}${inp('per', t('f_per') + ' (' + esc(f.unit || '') + ')', 'number')}</div></div>`;
}
function settingsView() {
  const c = cfg();
  if (!feedDraft) feedDraft = c.feeds.map(f => Object.assign({ buyUnit: '', factor: 1 }, f));
  const n = (id, label, v) => `<div class="field"><label for="${id}">${label}</label><input class="inp" id="${id}" type="number" inputmode="decimal" step="any" min="0" value="${v}"></div>`;
  return `<div style="display:flex;gap:10px;align-items:center">${btn('back', ic(S.lang === 'ur' ? 'right' : 'left'), 'sm')}<h2 style="flex:1">${t('settings')}</h2></div>
  <section class="card stack"><div class="lbl">${t('s_lang')}</div><div class="seg"><button type="button" data-act="setlang" data-v="ur" aria-pressed="${S.lang === 'ur'}">اردو</button><button type="button" data-act="setlang" data-v="en" aria-pressed="${S.lang === 'en'}">English</button></div></section>
  <section class="card stack">${n('s-price', t('s_rate'), c.milkPrice)}
    <div class="grid2">${n('s-gest', t('s_gest'), c.gestDays)}${n('s-dry', t('s_dry'), c.dryDays)}</div>
    <div class="grid2">${n('s-heat', t('s_heat'), c.heatDays)}${n('s-check', t('s_check'), c.checkDays)}</div>
    ${n('s-low', t('s_low'), c.lowDays)}</section>
  <section class="stack"><h3>${t('s_feeds')}</h3><p class="hint">${t('s_feed_rule')}<br>${t('s_ration_note')}</p>${feedDraft.map(feedEditor).join('')}${btn('feed-add', ic('plus') + t('add_feed'), 'block')}</section>
  ${btn('settings-save', t('save'), 'primary block')}
  <section class="card stack"><h3>${t('backup')}</h3><p class="hint">${t('b_note')}</p>
    ${btn('backup', t('b_download'), 'block')}${btn('restore', t('b_restore'), 'block')}<input type="file" id="restore-file" accept=".json,application/json" class="hidden"></section>
  <section class="card stack"><h3>${t('acct')}</h3><p class="hint" dir="ltr" style="text-align:start">${t('signed_as')} ${esc(S.user)}</p>${btn('logout', t('l_out'), 'block')}</section>
  <section class="card stack"><h3>${t('examples')}</h3>${btn('examples-add', t('add_examples'), 'block')}${list('animals').some(a => a.example) ? btn('examples-del', t('remove_examples'), 'danger block') : ''}</section>`;
}
