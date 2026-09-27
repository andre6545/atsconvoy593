// Service Worker sin cacheo agresivo para datos de estado
const CACHE_NAME = 'ats-monitor-static-v1';
const STATIC_ASSETS = [
    '/',
    '/js/monitor-config.js',
    '/js/alert-manager.js',
    '/js/history-manager.js',
    '/js/chart-manager.js',
    '/js/diagnostics.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    // NUNCA cachear llamadas a la API de estado o health
    if (e.request.url.includes('/api/')) {
        return e.respondWith(fetch(e.request, { cache: 'no-store' }));
    }

    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});
