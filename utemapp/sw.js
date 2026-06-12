// UTEMAPP Service Worker v1.0 – Offline support
var CACHE = 'utemapp-v1';
var ASSETS = [
  '.', 'index.html', 'style.css', 'app.js', 'manifest.json',
  '../js/edificios.js', '../js/data.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }));
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(r) {
      return r || fetch(e.request).then(function(res) {
        if (res.ok) { var clone = res.clone(); caches.open(CACHE).then(function(c) { c.put(e.request, clone); }); }
        return res;
      }).catch(function() {
        if (e.request.url.indexOf('.png') !== -1 || e.request.url.indexOf('.jpg') !== -1) return new Response('', { status: 200 });
        return new Response('<h1>Sin conexión</h1><p>Conectate a internet para cargar el mapa.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      });
    })
  );
});
