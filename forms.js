'use strict';
/* Bottom-sheet forms for every record type. */
let SHEET = null, sheetReturnFocus = null;
const clean = o => { const r = {}; Object.keys(o).forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
const kindOpts = () => [['cow', t('kind_cow')], ['cf', t('kind_cf')], ['cm', t('kind_cm')]];
const animalOpts = (herd) => [...(herd ? [['*', t('whole_herd')]] : []), ...animals().sort((a, b) => (a.kind === 'cow' ? 0 : 1) - (b.kind === 'cow' ? 0 : 1) || tagSort(a, b)).map(a => [a.id, `${a.tag} (${kindLabel(a.kind)})`])];
const lblOf = (f, v) => (typeof f.label === 'function' ? f.label(v) : f.label || '');

function fieldHTML(f, val) {
  const id = 'f_' + f.k, v = val == null ? '' : val;
  let ctrl;
  if (f.type === 'select') {
    ctrl = `<select id="${id}">${f.opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    ctrl = `<textarea id="${id}">${esc(v)}</textarea>`;
  } else if (f.type === 'info') {
    ctrl = `<div class="card small" id="${id}"></div>`;
  } else {
    ctrl = `<input id="${id}" type="${f.type}" ${f.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} ${f.list ? `list="${id}_dl"` : ''} value="${esc(v)}" autocomplete="off">${f.list ? `<datalist id="${id}_dl">${f.list.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>` : ''}`;
  }
  return `<div class="field" data-fk="${f.k}"><label for="${id}"></label>${ctrl}${f.hint ? `<div class="hint">${f.hint}</div>` : ''}<div class="err hidden"></div></div>`;
}
function sheetValues() {
  const vals = {};
  SHEET.fields.forEach(f => {
    if (f.type === 'info') return;
    const el = $('#f_' + f.k);
    if (!el) return;
    vals[f.k] = f.type === 'number' ? (el.value === '' ? null : parseFloat(el.value)) : el.value.trim();
  });
  return vals;
}
function refreshSheet() {
  if (!SHEET) return;
  const vals = sheetValues();
  SHEET.fields.forEach(f => {
    const w = $(`[data-fk="${f.k}"]`, $('#sheet'));
    if (!w) return;
    w.classList.toggle('hidden', f.show ? !f.show(vals) : false);
    $('label', w).textContent = lblOf(f, vals);
    if (f.type === 'info') $('#f_' + f.k).innerHTML = f.calc(vals);
  });
}
function openSheet(spec) {
  sheetReturnFocus = document.activeElement;
  SHEET = spec;
  const host = $('#sheet');
  host.innerHTML = `<div class="scrim" data-act="sheet-scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(spec.title)}">
    <div class="sh"><h2>${esc(spec.title)}</h2><button type="button" class="xbtn" data-act="sheet-cancel" aria-label="${t('close')}">${ic('x')}</button></div>
    <form id="sheet-form" class="stack" novalidate>${spec.fields.map(f => fieldHTML(f, spec.values[f.k])).join('')}</form>
    <div class="btns" style="justify-content:space-between"><div class="btns">${btn('sheet-save', t('save'), 'primary')}${btn('sheet-cancel', t('cancel'))}</div>${spec.onDelete ? btn('sheet-delete', t('delete'), 'danger') : ''}</div></div></div>`;
  host.classList.remove('hidden');
  refreshSheet();
}
function closeSheet() {
  SHEET = null;
  const host = $('#sheet');
  host.innerHTML = ''; host.classList.add('hidden');
  if (sheetReturnFocus && document.contains(sheetReturnFocus)) { try { sheetReturnFocus.focus(); } catch (e) { /* ignore */ } }
}
function fieldError(k, msg) {
  const w = $(`[data-fk="${k}"]`, $('#sheet'));
  if (!w) return;
  w.classList.add('bad');
  const e = $('.err', w); e.textContent = msg; e.classList.remove('hidden');
}
async function sheetSave() {
  if (!SHEET) return;
  $('#sheet').querySelectorAll('.field.bad').forEach(w => { w.classList.remove('bad'); $('.err', w).classList.add('hidden'); });
  const vals = sheetValues();
  let first = null;
  SHEET.fields.forEach(f => {
    if (!f.req || (f.show && !f.show(vals))) return;
    if (vals[f.k] === '' || vals[f.k] == null) { fieldError(f.k, t('required')); first = first || f.k; }
  });
  if (first) { const el = $('#f_' + first); if (el) el.focus(); return; }
  const shown = {};
  SHEET.fields.forEach(f => { if (f.type !== 'info' && (!f.show || f.show(vals))) shown[f.k] = vals[f.k]; });
  const res = await SHEET.onSave(shown);
  if (res && res.err) { Object.keys(res.err).forEach(k => fieldError(k, res.err[k])); return; }
  if (res && res.ok) { closeSheet(); toast(t('saved_ok')); }
}
async function sheetDelete(el) {
  if (!SHEET || !SHEET.onDelete) return;
  if (!el.dataset.armed) {
    el.dataset.armed = '1'; el.textContent = t('confirm_delete');
    setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = t('delete'); } }, 4000);
    return;
  }
  const ok = await run(() => SHEET.onDelete());
  if (ok) { closeSheet(); toast(t('saved_ok')); }
}

/* ---------- animals ---------- */
function animalForm(id, preset) {
  const ex = id ? byId(id) : null;
  const v = ex ? Object.assign({}, ex) : Object.assign({ kind: 'cow', source: 'purchased', purchaseDate: todayISO() }, preset || {});
  openSheet({
    title: t(ex ? 'edit_animal' : 'add_animal'), values: v,
    fields: [
      { k: 'tag', label: t('tag'), type: 'text', req: true },
      { k: 'kind', label: t('kind'), type: 'select', opts: kindOpts() },
      { k: 'source', label: t('source'), type: 'select', opts: [['purchased', t('src_purchased')], ['home', t('src_home')]] },
      { k: 'purchaseDate', label: t('purchase_date'), type: 'date', show: x => x.source === 'purchased' },
      { k: 'price', label: t('price'), type: 'number', show: x => x.source === 'purchased' },
      { k: 'calfPrice', label: t('calf_price'), type: 'number', show: x => x.source === 'purchased' && x.kind === 'cow' },
      { k: 'dob', label: t('dob'), type: 'date' },
      { k: 'motherId', label: t('mother'), type: 'select', opts: [['', t('none')], ...cows().filter(c => c.id !== id).map(c => [c.id, c.tag])], show: x => x.kind !== 'cow' || x.source === 'home' },
      { k: 'notes', label: t('notes'), type: 'textarea' }
    ],
    async onSave(x) {
      if (animals().some(a => a.id !== id && String(a.tag).trim().toLowerCase() === x.tag.toLowerCase())) return { err: { tag: t('tag_dup') } };
      const p = x.source === 'purchased';
      const doc = clean({
        tag: x.tag, kind: x.kind, source: x.source,
        purchaseDate: p ? x.purchaseDate || null : null, price: p && x.price != null ? x.price : null,
        calfPrice: p && x.kind === 'cow' && x.calfPrice != null ? x.calfPrice : null,
        dob: x.dob || null, motherId: x.motherId || null, notes: x.notes || '',
        createdAt: ex ? ex.createdAt : Date.now(), example: ex && ex.example ? true : undefined
      });
      const ok = await run(() => store.set('animals', id || uid(), doc));
      return { ok };
    },
    onDelete: ex ? () => deleteAnimal(id) : null
  });
}
async function deleteAnimal(id) {
  for (const col of ['breeding', 'calvings', 'vaccines', 'health']) {
    for (const r of list(col).filter(r => r.animalId === id)) await store.del(col, r.id);
  }
  for (const k of calvesOf(id)) await store.merge('animals', k.id, { motherId: null });
  await store.del('animals', id);
  if (S.view === 'animal') { S.view = 'animals'; scheduleRender(); }
}

/* ---------- breeding / calving ---------- */
function expectedHTML(v) {
  if (!v.aiDate) return '';
  const c = cfg(), due = addDays(v.aiDate, num(c.gestDays));
  return line(t('heat_check'), fmtDate(addDays(v.aiDate, num(c.heatDays)))) + line(t('preg_check'), fmtDate(addDays(v.aiDate, num(c.checkDays)))) +
    line(t('due'), fmtDate(due)) + line(t('dry_on'), fmtDate(addDays(due, -num(c.dryDays))));
}
function breedForm(animalId, recId) {
  const rec = recId ? S.d.breeding[recId] : null;
  const v = rec ? Object.assign({}, rec) : { aiDate: todayISO(), result: 'pending' };
  openSheet({
    title: t('breed_title') + ' · ' + tagOf(animalId), values: v,
    fields: [
      { k: 'aiDate', label: t('ai_date'), type: 'date', req: true },
      { k: 'semen', label: t('semen'), type: 'text' },
      { k: 'result', label: t('preg_result'), type: 'select', opts: [['pending', t('res_pending')], ['pregnant', t('res_pregnant')], ['open', t('res_open')]] },
      { k: 'checkDate', label: t('check_date'), type: 'date', show: x => x.result !== 'pending' },
      { k: 'exp', label: t('expected'), type: 'info', calc: expectedHTML }
    ],
    async onSave(x) {
      const doc = clean({ animalId, aiDate: x.aiDate, semen: x.semen || '', result: x.result, checkDate: x.result !== 'pending' ? x.checkDate || null : null, calvedOn: rec ? rec.calvedOn || null : null, driedOn: rec ? rec.driedOn || null : null, createdAt: rec ? rec.createdAt : Date.now() });
      return { ok: await run(() => store.set('breeding', recId || uid(), doc)) };
    },
    onDelete: rec ? () => store.del('breeding', recId) : null
  });
}
function calvingForm(animalId, recId) {
  const rec = recId ? S.d.calvings[recId] : null;
  if (rec) {
    openSheet({
      title: t('calving_title') + ' · ' + tagOf(animalId), values: rec,
      fields: [{ k: 'date', label: t('calving_date'), type: 'date', req: true }],
      async onSave(x) { return { ok: await run(() => store.merge('calvings', recId, { date: x.date })) }; },
      onDelete: () => store.del('calvings', recId)
    });
    return;
  }
  const calfOpts = [['cf', t('kind_cf')], ['cm', t('kind_cm')]];
  openSheet({
    title: t('calving_title') + ' · ' + tagOf(animalId), values: { date: todayISO(), calf1Kind: 'cf', calf2Kind: 'cf' },
    fields: [
      { k: 'date', label: t('calving_date'), type: 'date', req: true },
      { k: 'calf1Tag', label: t('calf1_tag'), type: 'text' },
      { k: 'calf1Kind', label: t('calf1_sex'), type: 'select', opts: calfOpts, show: x => !!x.calf1Tag },
      { k: 'calf2Tag', label: t('calf2_tag'), type: 'text', show: x => !!x.calf1Tag },
      { k: 'calf2Kind', label: t('calf2_sex'), type: 'select', opts: calfOpts, show: x => !!x.calf1Tag && !!x.calf2Tag },
      { k: 'hint', label: '', type: 'info', calc: () => `<span class="muted">${t('calving_hint')}</span>` }
    ],
    async onSave(x) {
      const calves = [];
      if (x.calf1Tag) calves.push({ tag: x.calf1Tag, kind: x.calf1Kind || 'cf', f: 'calf1Tag' });
      if (x.calf2Tag) calves.push({ tag: x.calf2Tag, kind: x.calf2Kind || 'cf', f: 'calf2Tag' });
      const err = {};
      calves.forEach((c, i) => {
        const low = c.tag.toLowerCase();
        if (animals().some(a => String(a.tag).trim().toLowerCase() === low) || calves.findIndex(o => o.tag.toLowerCase() === low) !== i) err[c.f] = t('tag_dup');
      });
      if (Object.keys(err).length) return { err };
      const ok = await run(async () => {
        const ids = [];
        for (const c of calves) {
          const cid = uid(); ids.push(cid);
          await store.set('animals', cid, { tag: c.tag, kind: c.kind, source: 'home', dob: x.date, motherId: animalId, notes: '', purchaseDate: null, price: null, calfPrice: null, createdAt: Date.now() });
        }
        await store.set('calvings', uid(), { animalId, date: x.date, calfIds: ids, createdAt: Date.now() });
        const open = breedRecs(animalId).find(r => !r.calvedOn && r.result !== 'open');
        if (open) await store.merge('breeding', open.id, { calvedOn: x.date });
      });
      return { ok };
    }
  });
}

/* ---------- vaccines / health ---------- */
const VACCINES = ['FMD', 'HS', 'BQ', 'Anthrax', 'Brucellosis', 'LSD', 'Deworming'];
function vaccForm(animalId, recId) {
  const rec = recId ? S.d.vaccines[recId] : null;
  const v = rec ? Object.assign({}, rec) : { animalId: animalId || '*', date: todayISO() };
  openSheet({
    title: t('vacc_title'), values: v,
    fields: [
      { k: 'animalId', label: t('animal'), type: 'select', opts: animalOpts(true) },
      { k: 'name', label: t('vacc_name'), type: 'text', req: true, list: VACCINES },
      { k: 'date', label: t('vacc_date'), type: 'date', req: true },
      { k: 'nextDate', label: t('vacc_next'), type: 'date' },
      { k: 'cost', label: t('cost'), type: 'number' },
      { k: 'note', label: t('notes'), type: 'textarea' }
    ],
    async onSave(x) {
      const doc = clean({ animalId: x.animalId, name: x.name, date: x.date, nextDate: x.nextDate || null, cost: x.cost, note: x.note || '', createdAt: rec ? rec.createdAt : Date.now() });
      return { ok: await run(() => store.set('vaccines', recId || uid(), doc)) };
    },
    onDelete: rec ? () => store.del('vaccines', recId) : null
  });
}
function illForm(animalId, recId) {
  const rec = recId ? S.d.health[recId] : null;
  const first = cows()[0] || animals()[0];
  const v = rec ? Object.assign({}, rec) : { animalId: animalId || (first ? first.id : ''), date: todayISO(), problem: 'fever' };
  const P = ['fever', 'fmd', 'mastitis', 'bloat', 'diarrhea', 'lame', 'noeat', 'other'];
  openSheet({
    title: t('ill_title'), values: v,
    fields: [
      { k: 'animalId', label: t('animal'), type: 'select', opts: animalOpts(false), req: true },
      { k: 'date', label: t('date'), type: 'date', req: true },
      { k: 'problem', label: t('problem'), type: 'select', opts: P.map(p => [p, t('pr_' + p)]) },
      { k: 'otherText', label: t('other_text'), type: 'text', show: x => x.problem === 'other' },
      { k: 'medicine', label: t('medicine'), type: 'text' },
      { k: 'dose', label: t('dose'), type: 'text' },
      { k: 'courseDays', label: t('course'), type: 'number' },
      { k: 'nextDoseDate', label: t('next_dose'), type: 'date' },
      { k: 'withholdDays', label: t('withhold'), type: 'number', hint: t('withhold_hint') },
      { k: 'recoveredDate', label: t('recovered'), type: 'date' },
      { k: 'cost', label: t('cost'), type: 'number' },
      { k: 'vet', label: t('vet'), type: 'text' },
      { k: 'notes', label: t('notes'), type: 'textarea' }
    ],
    async onSave(x) {
      const doc = clean({
        animalId: x.animalId, date: x.date, problem: x.problem, otherText: x.problem === 'other' ? x.otherText || '' : '',
        medicine: x.medicine || '', dose: x.dose || '', courseDays: x.courseDays, nextDoseDate: x.nextDoseDate || null,
        withholdDays: x.withholdDays, recoveredDate: x.recoveredDate || null, cost: x.cost, vet: x.vet || '', notes: x.notes || '',
        createdAt: rec ? rec.createdAt : Date.now()
      });
      return { ok: await run(() => store.set('health', recId || uid(), doc)) };
    },
    onDelete: rec ? () => store.del('health', recId) : null
  });
}

/* ---------- money ---------- */
function purchaseForm(recId) {
  const rec = recId ? S.d.purchases[recId] : null, c = cfg();
  const v = rec ? Object.assign({}, rec) : { date: todayISO(), feedId: c.feeds[0].id };
  const unitFor = fid => { const f = c.feeds.find(x => x.id === fid); return f ? buyUnitOf(f) : ''; };
  openSheet({
    title: t('purchase_title'), values: v,
    fields: [
      { k: 'date', label: t('date'), type: 'date', req: true },
      { k: 'feedId', label: t('item'), type: 'select', opts: c.feeds.map(f => [f.id, feedName(f)]) },
      { k: 'qty', label: x => `${t('qty')} (${unitFor(x.feedId)})`, type: 'number', req: true },
      { k: 'amount', label: t('amount'), type: 'number', req: true },
      { k: 'supplier', label: t('supplier'), type: 'text' }
    ],
    async onSave(x) {
      const doc = clean({ date: x.date, feedId: x.feedId, qty: x.qty, amount: x.amount, supplier: x.supplier || '', createdAt: rec ? rec.createdAt : Date.now() });
      return { ok: await run(() => store.set('purchases', recId || uid(), doc)) };
    },
    onDelete: rec ? () => store.del('purchases', recId) : null
  });
}
function expenseForm(recId) {
  const rec = recId ? S.d.expenses[recId] : null;
  const v = rec ? Object.assign({}, rec) : { date: todayISO(), cat: 'labor' };
  openSheet({
    title: t('expense_title'), values: v,
    fields: [
      { k: 'date', label: t('date'), type: 'date', req: true },
      { k: 'cat', label: t('category'), type: 'select', opts: ['medicine', 'vet', 'labor', 'power', 'transport', 'other'].map(k => [k, t('cat_' + k)]) },
      { k: 'amount', label: t('amount'), type: 'number', req: true },
      { k: 'note', label: t('notes'), type: 'text' }
    ],
    async onSave(x) {
      const doc = clean({ date: x.date, cat: x.cat, amount: x.amount, note: x.note || '', createdAt: rec ? rec.createdAt : Date.now() });
      return { ok: await run(() => store.set('expenses', recId || uid(), doc)) };
    },
    onDelete: rec ? () => store.del('expenses', recId) : null
  });
}
/* Pick a cow first, then open the breeding form. */
function breedPick() {
  const cs = cows();
  if (!cs.length) { toast(t('no_cows'), 'bad'); return; }
  openSheet({
    title: t('breed_title'), values: { animalId: cs[0].id },
    fields: [{ k: 'animalId', label: t('animal'), type: 'select', opts: cs.map(c => [c.id, c.tag]) }],
    async onSave(x) { closeSheet(); breedForm(x.animalId); return {}; }
  });
}
