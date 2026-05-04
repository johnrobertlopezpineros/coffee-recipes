const CACHE = 'cafe-k6-v2';
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Dominios que NUNCA deben pasar por caché — van directo a la red
const NETWORK_ONLY = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.gstatic.com/firebasejs',
];

function isNetworkOnly(url) {
  return NETWORK_ONLY.some(domain => url.includes(domain));
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase y Google APIs: siempre red, nunca caché
  if (isNetworkOnly(url)) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Google Fonts: red primero, caché como respaldo
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // App shell (HTML, manifest, icons): caché primero, red como respaldo
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
