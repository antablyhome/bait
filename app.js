/* ميزانية البيت — غلاف التطبيق
   الملف ده مافيهوش أي بيانات. كل اللي بيعمله إنه يفتح برنامج Apps Script جوه الشاشة كلها.
   لو غيّرت لينك الـ deployment في يوم، غيّر السطر اللي تحت بس. */
var APP_URL = 'https://script.google.com/macros/s/AKfycby8MzgISakcr5mzk34YtS02Is2JMEGN6sDlsJe1sxjMd4Dv45xungnmlr5A3xTKSBVh/exec';

(function () {
  var frame = document.getElementById('app');
  var splash = document.getElementById('splash');
  var offline = document.getElementById('offline');
  var started = false, hideTimer = null;

  function hideSplash() { splash.classList.add('done'); }

  function start() {
    if (navigator.onLine === false) { offline.hidden = false; return; }
    offline.hidden = true;
    splash.classList.remove('done');
    started = true;
    frame.src = APP_URL;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideSplash, 15000); // safety net if the load event never fires
  }

  frame.addEventListener('load', function () { if (started) hideSplash(); });
  document.getElementById('retry').addEventListener('click', start);
  window.addEventListener('online', function () { if (!offline.hidden) start(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { });
  }
  start();
})();
