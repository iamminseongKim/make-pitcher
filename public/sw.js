// ACE PROJECT offline support: play on the subway even when the connection drops.
// Pages: network first (updates arrive), cache fallback. Hashed assets & fonts: cache first.
const CACHE = 'ace-project-v3'
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon.svg']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const put = res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) } return res }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then(r => r || caches.match('/'))))
    return
  }
  const cacheFirst = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/audio/') || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com') || SHELL.includes(url.pathname)
  if (cacheFirst) e.respondWith(caches.match(req).then(r => r || fetch(req).then(put)))
})
