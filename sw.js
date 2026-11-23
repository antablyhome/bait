/* Service worker بسيط: بيحفظ ملفات الواجهة بس (الصفحة والتصميم واللوجو) عشان البرنامج يفتح بسرعة ويتثبّت كتطبيق.
   مابيلمسش أي طلب رايح لجوجل، ومابيحفظش أي أرقام ولا بيانات.
   لو عدّلت أي ملف هنا، زوّد رقم الإصدار ده (v2 -> v3) عشان الموبايلات تاخد النسخة الجديدة. */
var CACHE = 'bait-v2';
var FILES = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'favicon-48.png'
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
  // ملفاتنا بس. أي حاجة رايحة لجوجل (السيرفر، الشيت، الخطوط) مش بنلمسها خالص.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // من النت الأول عشان التحديثات توصل على طول، ولو مفيش نت ناخد النسخة المحفوظة.
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
