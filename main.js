'use strict';
/* Start-up: language, Firebase sign-in, live subscriptions. */
const cfgOk = () => {
  const c = window.FIREBASE_CONFIG;
  return !!(c && c.apiKey && c.projectId && !/PASTE/i.test(String(c.apiKey) + String(c.projectId)));
};
let unsubs = [], slowTimer = 0;

function updateSync() {
  const all = COLS.every(c => S.loaded[c]), fresh = COLS.every(c => S.fresh[c]);
  if (fresh) { S.sync = 'ok'; S.slow = false; clearTimeout(slowTimer); }
  else if (all && navigator.onLine === false) { S.sync = 'offline'; S.slow = false; }
  else S.sync = 'loading';
}

function stopData() {
  unsubs.forEach(u => { try { u(); } catch (e) { /* ignore */ } });
  unsubs = []; clearTimeout(slowTimer);
  DB = null;
  COLS.forEach(c => { S.d[c] = {}; });
  S.d.personal = {}; S.pErr = ''; S.person = null; S.uid = '';
  S.loaded = {}; S.fresh = {}; S.sync = 'loading'; S.slow = false; S.user = '';
  created.clear();
  if (typeof SHEET !== 'undefined' && SHEET) closeSheet();
}

function startData(user) {
  stopData();
  S.user = user.email || ''; S.uid = user.uid || ''; S.auth = 'ok'; S.authErr = '';
  DB = firebase.firestore();
  slowTimer = setTimeout(() => { if (!COLS.every(c => S.fresh[c]) && navigator.onLine !== false) { S.slow = true; scheduleRender(); } }, 10000);
  COLS.forEach(col => {
    unsubs.push(DB.collection(col).onSnapshot(snap => {
      const m = {};
      snap.docs.forEach(d => { m[d.id] = Object.assign({ id: d.id }, d.data()); });
      S.d[col] = m;
      S.loaded[col] = true;
      S.fresh[col] = !snap.metadata.fromCache;
      updateSync();
      scheduleRender();
    }, err => {
      console.error(err);
      if (err && err.code === 'permission-denied') {
        S.authErr = 'l_denied';
        firebase.auth().signOut().catch(() => {});
      } else { S.sync = 'error'; scheduleRender(); }
    }));
  });
  // Personal records (this login only): own listener. If it fails (e.g. Firestore rules), only the Personal screen says so.
  unsubs.push(DB.collection('users').doc(S.uid).collection('personal').onSnapshot(snap => {
    const m = {};
    snap.docs.forEach(d => { m[d.id] = Object.assign({ id: d.id }, d.data()); });
    S.d.personal = m; S.pErr = '';
    scheduleRender();
  }, err => {
    console.error(err);
    S.pErr = err && err.code === 'permission-denied' ? 'denied' : 'other';
    scheduleRender();
  }));
  render();
}

function connect() {
  if (!cfgOk()) { S.auth = 'nocfg'; render(); return; }
  if (!window.firebase || !firebase.auth || !firebase.firestore) { S.auth = 'nosdk'; render(); return; }
  try {
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    const fs = firebase.firestore();
    // Some mobile networks stall Firestore's default streaming connection ("Connecting..." forever).
    // Auto-detect switches to plain long-polling in that case. Must be set before any other Firestore call.
    try { fs.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) { console.warn('firestore settings', e); }
    // Keep a copy of the records on the phone so the app also works with no signal.
    fs.enablePersistence({ synchronizeTabs: true }).catch(e => console.warn('offline cache not enabled', e && e.code));
    firebase.auth().onAuthStateChanged(user => {
      if (user) startData(user);
      else { stopData(); S.auth = 'login'; render(); }
    });
  } catch (e) {
    console.error(e); S.auth = 'nosdk'; render();
  }
}

const AUTH_ERR = {
  'auth/invalid-credential': 'l_bad', 'auth/wrong-password': 'l_bad', 'auth/user-not-found': 'l_bad', 'auth/invalid-email': 'l_bad',
  'auth/invalid-login-credentials': 'l_bad', 'auth/network-request-failed': 'l_net', 'auth/too-many-requests': 'l_many', 'auth/user-disabled': 'l_disabled'
};
function loginMsg(key, ok) {
  const el = document.getElementById('login-msg');
  if (!el) return;
  el.textContent = key ? t(key) : '';
  el.className = 'login-msg' + (ok ? ' ok' : '');
}
async function doLogin() {
  const email = ($('#l-email').value || '').trim(), pass = $('#l-pass').value || '';
  if (!email || !pass) { loginMsg('l_need'); return; }
  const b = $('#l-go'); if (b) b.disabled = true;
  loginMsg('l_wait', true);
  try { await firebase.auth().signInWithEmailAndPassword(email, pass); }
  catch (e) { console.warn(e && e.code); loginMsg(AUTH_ERR[e && e.code] || 'l_other'); if (b) b.disabled = false; }
}
async function doForgot() {
  const email = ($('#l-email').value || '').trim();
  if (!email) { loginMsg('l_need_email'); return; }
  try { await firebase.auth().sendPasswordResetEmail(email); loginMsg('l_reset_sent', true); }
  catch (e) { loginMsg(AUTH_ERR[e && e.code] || 'l_other'); }
}
function doLogout() { firebase.auth().signOut().catch(e => console.error(e)); }

window.addEventListener('online', () => { updateSync(); scheduleRender(); });
window.addEventListener('offline', () => { updateSync(); scheduleRender(); });

function start() {
  try { S.lang = localStorage.getItem('kdl-lang') || 'ur'; } catch (e) { S.lang = 'ur'; }
  S.date = todayISO(); S.month = monthOf(S.date);
  render();
  connect();
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e)); });
}
start();
