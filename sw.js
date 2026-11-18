/* Keeps the app screens on the phone so it opens with no signal. Records are kept by Firestore itself. */
const V = 'kdl-v3';
const SHELL = ['./', 'index.html', 'style.css', 'i18n.js', 'core.js', 'calc.js', 'views.js', 'forms.js', 'personal.js', 'events.js', 'main.js',
  'firebase-config.js', 'logo.svg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const SDK = ['app', 'auth', 'firestore'].map(n => `https://www.gstatic.com/firebasejs/10.14.1/firebase-${n}-compat.js`);
const RUNTIME_HOSTS = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL).then(() =>
    Promise.all(SDK.map(u => c.add(new Request(u, { mode: 'no-cors' })).catch(() => {}))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const keep = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
  return res;
};
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // Own files: try the network briefly so new versions arrive, else use the saved copy.
    e.respondWith(new Promise(resolve => {
      const timer = setTimeout(() => caches.match(req).then(m => m && resolve(m)), 4000);
      fetch(req).then(res => { clearTimeout(timer); resolve(keep(req, res)); })
        .catch(() => { clearTimeout(timer); caches.match(req).then(m => resolve(m || caches.match('index.html')).catch(() => resolve(Response.error()))); });
    }));
  } else if (RUNTIME_HOSTS.includes(url.hostname)) {
    // Firebase SDK and fonts: saved copy first.
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(res => keep(req, res))));
  }
});
