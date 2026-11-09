/* Vault – Service Worker (offline + installabilità PWA) */
const VERSION = 'vault-v4-8-0';
const SHELL = [
  './', './index.html', './privacy.html', './manifest.webmanifest',
  './icons/icon-192x192.png', './icons/icon-512x512.png',
  './icons/maskable-192x192.png', './icons/maskable-512x512.png',
  './icons/apple-touch-icon.png', './icons/favicon.png'
];
// Loghi dei servizi: messi in cache per vederli anche offline
const LOGO_HOSTS = ['www.google.com', 'icons.duckduckgo.com', 'icon.horse'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Loghi: dalla cache se presenti, aggiornati in background
  if (LOGO_HOSTS.includes(url.hostname) && (req.destination === 'image' || url.pathname.includes('favicon') || url.pathname.includes('/ip3/') || url.pathname.includes('/icon/'))) {
    e.respondWith(
      caches.open(VERSION).then(cache =>
        cache.match(req).then(hit => {
          const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  // Tutto il resto fuori dall'origine (Google Drive, API, ricerche) passa direttamente dalla rete
  if (url.origin !== location.origin) return;

  // Pagina: prima la rete (per ricevere gli aggiornamenti), se offline la copia salvata
  if (req.mode === 'navigate') {
    // Informativa privacy: pagina separata, non va salvata al posto di index.html
    if (url.pathname.endsWith('/privacy.html')) {
      e.respondWith(
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('./privacy.html', copy));
          return res;
        }).catch(() => caches.match('./privacy.html'))
      );
      return;
    }
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // File dell'app: dalla cache, altrimenti rete e poi salvati
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
