/* Service worker بسيط جداً: بيحفظ ملفات الغلاف بس (الصفحة واللوجو) عشان الموبايل يعتبره تطبيق.
   مابيلمسش أي طلب رايح لجوجل، ومابيحفظش أي بيانات من البرنامج.
   لو عدّلت أي ملف هنا، زوّد رقم الإصدار ده (v1 -> v2) عشان الموبايلات تاخد النسخة الجديدة. */
var CACHE = 'wrapper-v1';
var FILES = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-48.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  // Only our own wrapper files. Everything else (Google, the app, the sheet) is not touched at all.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Network first so updates show up right away; fall back to the saved copy when offline.
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
