/* ميزانية البيت — الواجهة (نسخة 2.0)
   الملف ده بيتحط على GitHub Pages. مافيهوش أي بيانات ولا أسرار.
   البيانات كلها في الشيت، والسيرفر (Apps Script) هو اللي بيتأكد من الـ PIN.
   لو غيّرت لينك الـ deployment في يوم، غيّر السطر اللي تحت بس. */
var APP_URL = 'https://script.google.com/macros/s/AKfycby8MzgISakcr5mzk34YtS02Is2JMEGN6sDlsJe1sxjMd4Dv45xungnmlr5A3xTKSBVh/exec';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { }); });
}

/* ============ أدوات عامة ============ */
var LS = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) { } }
};
var App = { token: LS.get('hb_token'), st: null, boot: null, view: 'home', month: null, sheet: null, draft: null,
  pendingRender: false, loginId: LS.get('hb_last'), selShop: {}, pollT: null, busy: 0, setup: null };
var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
var ROLE = { owner: 'المالك', admin: 'أدمن', member: 'عضو' };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
function fmt(v) { return Math.round(n(v)).toLocaleString('en-US'); }
function money(v) { return fmt(v) + ' ج.م'; }
function pct(a, b) { return b > 0 ? Math.max(0, Math.min(100, Math.round(a / b * 100))) : 0; }
function monthName(m) { if (!m) return ''; var p = m.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
function monthOnly(m) { return m ? MONTHS[+m.split('-')[1] - 1] : ''; }
function dayNum(d) { var p = String(d).slice(0, 10).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
function dateLabel(d) {
  if (!d) return '';
  var t = App.st ? App.st.today : new Date().toISOString().slice(0, 10);
  var diff = Math.round(dayNum(t) - dayNum(d));
  if (diff === 0) return 'النهارده';
  if (diff === 1) return 'امبارح';
  var p = d.split('-');
  return (+p[2]) + ' ' + MONTHS[+p[1] - 1];
}
function timeAgo(iso) {
  if (!iso) return '';
  var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'دلوقتي';
  if (m < 60) return 'من ' + m + ' دقيقة';
  var h = Math.round(m / 60);
  if (h < 24) return 'من ' + h + ' ساعة';
  return dateLabel(new Date(iso).toISOString().slice(0, 10));
}
function catName(id) { var c = (App.st.categories || []).filter(function (x) { return x.id === id; })[0]; return c ? c.name : 'متفرقات'; }
function memberName(id) { var m = (App.st.members || []).filter(function (x) { return x.id === id; })[0]; return m ? m.name : ''; }
function greet() { var h = new Date().getHours(); return h < 12 ? 'صباح الخير' : 'مساء الخير'; }
function todayStr() { return App.st ? App.st.today : new Date().toISOString().slice(0, 10); }
function setPath(obj, path, val) {
  var p = path.split('.'); var o = obj;
  for (var i = 0; i < p.length - 1; i++) { o = o[p[i]]; if (o == null) return; }
  o[p[p.length - 1]] = val;
}
function $(id) { return document.getElementById(id); }
function val(id) { var e = $(id); return e ? e.value : ''; }

var IC = {
  check: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  list: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  plus: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h18M6 16v-4M11 16V7M16 16v-6M21 16v-9"/></svg>',
  layers: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
  receipt: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/></svg>',
  paste: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  warn: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  wallet: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/></svg>',
  lock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  piggy: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 9c1 .5 2 1.5 2 3h-2c0 1.5-1 3-2.5 3.7V19h-3v-2h-3v2h-3v-3.2C5.3 14.8 4 13 4 11c0-3.3 3.6-6 8-6 2 0 3.8.5 5.2 1.4L19 5z"/><path d="M15 10h.01"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>'
};

/* ============ الاتصال بالسيرفر ============ */
function call(action, data, opts) {
  data = data || {}; opts = opts || {};
  if (App.month && data.viewMonth === undefined) data.viewMonth = App.month;
  if (!opts.silent) showBusy(opts.label);
  // v2: بنكلّم السيرفر مباشرة من غير كوكيز جوجل خالص (credentials: 'omit').
  // ده اللي بيخلّي البرنامج يفتح عادي حتى لو فيه كذا حساب جوجل على الموبايل.
  // text/plain عشان المتصفح مايبعتش طلب "استئذان" (preflight) جوجل مابيردش عليه.
  var ctl = ('AbortController' in window) ? new AbortController() : null;
  var tmr = ctl ? setTimeout(function () { ctl.abort(); }, 60000) : null;
  return fetch(APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: App.token, action: action, data: data }),
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    signal: ctl ? ctl.signal : undefined
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }).then(function (txt) {
    if (tmr) clearTimeout(tmr);
    if (!opts.silent) hideBusy();
    var r; try { r = JSON.parse(txt); } catch (e) { throw new Error('رد غريب من السيرفر'); }
    if (!r.ok) {
      if (r.code === 'AUTH') { logout(true); }
      throw new Error(r.error);
    }
    if (r.data && r.data.state) { App.st = r.data.state; }
    return r.data;
  }, function () {
    if (tmr) clearTimeout(tmr);
    if (!opts.silent) hideBusy();
    throw new Error(navigator.onLine === false ? 'مفيش إنترنت دلوقتي' : 'مش قادر أوصل للسيرفر، جرّب تاني');
  });
}
function showBusy(label) { App.busy++; $('busy').innerHTML = '<div class="busy"><div class="spin"></div><div>' + esc(label || 'لحظة...') + '</div></div>'; }
function hideBusy() { App.busy = Math.max(0, App.busy - 1); if (!App.busy) $('busy').innerHTML = ''; }
var toastT;
function toast(msg, err) {
  clearTimeout(toastT);
  $('toast').innerHTML = '<div class="toast' + (err ? ' err' : '') + '" role="status">' + esc(msg) + '</div>';
  toastT = setTimeout(function () { $('toast').innerHTML = ''; }, err ? 4500 : 2600);
}
function fail(e) { toast(e && e.message ? e.message : String(e), true); }

function act(action, data, okMsg, label) {
  return call(action, data, { label: label }).then(function (r) { if (okMsg) toast(okMsg); render(true); return r; }).catch(function (e) { fail(e); throw e; });
}

/* ============ التشغيل والتحديث التلقائي ============ */
function start() {
  if (App.token) {
    call('sync', {}, { silent: true }).then(function (r) { App.st = r.state; render(true); startPoll(); })
      .catch(function () { loadBoot(); });
  } else loadBoot();
}
function loadBoot() {
  call('boot', {}, { silent: true }).then(function (b) { App.boot = b; App.st = null; render(true); })
    .catch(function (e) { $('app').innerHTML = '<div class="center"><div class="b">مش قادر أفتح التطبيق</div><div class="muted sm">' + esc(e.message) + '</div><button class="btn" data-a="reload">جرّب تاني</button></div>'; });
}
function startPoll() {
  clearTimeout(App.pollT);
  var sec = (App.st && App.st.settings && App.st.settings.pollSeconds) || 6;
  App.pollT = setTimeout(function () {
    if (!App.token) return;
    if (document.visibilityState === 'hidden') { startPoll(); return; }
    call('sync', { v: App.st ? App.st.v : '' }, { silent: true }).then(function (r) {
      if (r && r.state) { App.st = r.state; render(); }
      startPoll();
    }).catch(function () { startPoll(); });
  }, sec * 1000);
}
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && App.token && App.st) {
    call('sync', { v: App.st.v }, { silent: true }).then(function (r) { if (r && r.state) { App.st = r.state; render(); } }).catch(function () { });
  }
});
function logout(silent) {
  App.token = null; App.st = null; LS.del('hb_token'); clearTimeout(App.pollT); App.sheet = null; App.view = 'home';
  if (!silent) loadBoot(); else setTimeout(loadBoot, 50);
}

/* ============ الرسم ============ */
function isEditing() {
  var a = document.activeElement;
  return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'file';
}
function render(force) {
  if (!force && (isEditing() || App.busy)) { App.pendingRender = true; return; }
  App.pendingRender = false;
  var y = window.scrollY;
  var html;
  if (!App.st) {
    if (!App.boot) html = '<div class="center"><div class="spin"></div></div>';
    else if (App.boot.setupNeeded) html = viewSetup();
    else html = viewLogin();
  } else {
    var v = App.view;
    var isA = App.st.isAdmin;
    if ((v === 'insights' && !App.st.canInsights) || ((v === 'phases' || v === 'purchases') && !isA)) v = App.view = 'home';
    html = ({ home: isA ? viewAdminHome : viewMemberHome, add: viewAdd, list: viewShopping, insights: viewInsights,
      phases: viewPhases, settings: viewSettings, purchases: viewPurchases }[v] || viewMemberHome)();
  }
  $('app').innerHTML = html;
  renderSheet();
  if (!force) window.scrollTo(0, y);
}
document.addEventListener('focusout', function () { setTimeout(function () { if (App.pendingRender && !isEditing()) render(); }, 60); });

function header(title, sub, extra) {
  return '<header class="top"><div class="t"><small>' + esc(sub || '') + '</small><h1>' + esc(title) + '</h1></div><div class="hbtns">' + (extra || '') +
    '<button class="ibtn" data-a="go" data-v="settings" aria-label="الإعدادات">' + IC.gear + '</button></div></header>';
}
function subHeader(title, back) {
  return '<header class="top" style="justify-content:flex-start;gap:8px"><button class="ibtn plain" data-a="go" data-v="' + (back || 'home') + '" aria-label="رجوع">' + IC.back + '</button><h1 style="font-size:20px">' + esc(title) + '</h1></header>';
}
function nav() {
  var st = App.st, v = App.view, open = st.shopping.open.length;
  var b = function (id, label, icon) { return '<button class="' + (v === id ? 'on' : '') + '" data-a="go" data-v="' + id + '">' + icon + label + (id === 'list' && open ? '<span class="dot">' + open + '</span>' : '') + '</button>'; };
  var plus = '<button class="plus" data-a="newPurchase" aria-label="إضافة مشتريات">' + IC.plus + '</button>';
  var items = st.isAdmin
    ? [b('home', 'الرئيسية', IC.home), b('list', 'القايمة', IC.list), plus, st.canInsights ? b('insights', 'التحليلات', IC.chart) : b('purchases', 'المشتريات', IC.receipt), b('phases', 'المراحل', IC.layers)]
    : [b('home', 'الرئيسية', IC.home), plus, b('list', 'القايمة', IC.list)];
  return '<nav class="tabs" aria-label="القايمة الرئيسية"><div class="in">' + items.join('') + '</div></nav>';
}
function catBars(byCat, showBudget) {
  var max = Math.max.apply(null, byCat.map(function (c) { return Math.max(c.amount, showBudget ? c.budget : 0); }).concat([1]));
  var rows = byCat.filter(function (c) { return c.amount > 0 || (showBudget && c.budget > 0); }).sort(function (a, b) { return b.amount - a.amount; });
  if (!rows.length) return '<div class="empty">لسه مفيش مشتريات الشهر ده</div>';
  return rows.map(function (c) {
    var over = showBudget && c.budget > 0 && c.amount > c.budget;
    var w = showBudget && c.budget > 0 ? pct(c.amount, c.budget) : pct(c.amount, max);
    return '<div style="display:flex;flex-direction:column;gap:6px"><div class="row" style="font-size:14px"><span>' + esc(c.name) + '</span><span class="sb">' + fmt(c.amount) +
      (showBudget && c.budget > 0 ? '<span class="muted xs"> / ' + fmt(c.budget) + '</span>' : '') + '</span></div><div class="bar thin' + (over ? ' over' : '') + '"><i style="width:' + w + '%;background:' + (over ? '' : esc(c.color || '#1E5B43')) + '"></i></div></div>';
  }).join('');
}

/* ---------- الدخول والتسجيل الأول ---------- */
function viewLogin() {
  var b = App.boot;
  var sel = App.loginId && b.members.some(function (m) { return m.id === App.loginId; }) ? App.loginId : null;
  return '<main class="nonav" style="padding-top:40px"><div style="text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center"><div class="icon-box" style="width:64px;height:64px;border-radius:20px">' + IC.home + '</div><h1 style="margin:8px 0 0;font-size:24px">' + esc(b.household || 'ميزانية البيت') + '</h1><div class="muted">مين بيدخل؟</div></div>' +
    '<div class="chips" style="justify-content:center">' + b.members.map(function (m) { return '<button class="chip' + (sel === m.id ? ' on' : '') + '" data-a="pickLogin" data-id="' + m.id + '">' + esc(m.name) + '</button>'; }).join('') + '</div>' +
    (sel ? '<label class="f">الرقم السري<input id="pin" class="inp pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" placeholder="••••"></label><button class="btn full" data-a="login">دخول</button>' : '') +
    '<p class="muted sm" style="text-align:center">نسيت الرقم السري؟ اطلب من صاحب الحساب يغيّره من الإعدادات.</p></main>';
}
function viewSetup() {
  var s = App.setup || (App.setup = { household: 'بيتنا', ownerName: '', pin: '', share: 2000, members: [{ name: '', pin: rndPin() }, { name: '', pin: rndPin() }, { name: '', pin: rndPin() }] });
  return '<main class="nonav" style="padding-top:28px"><div><h1 style="margin:0;font-size:24px">أهلاً بيك 👋</h1><div class="muted">نجهّز البيت مرة واحدة بس.</div></div>' +
    '<div class="card"><label class="f">اسم البيت<input class="inp" data-bind="setup.household" value="' + esc(s.household) + '"></label>' +
    '<label class="f">اسمك (انت صاحب الحساب)<input class="inp" data-bind="setup.ownerName" value="' + esc(s.ownerName) + '" placeholder="مثلاً: محمد"></label>' +
    '<label class="f">الرقم السري بتاعك (4 أرقام)<input class="inp pin" type="password" inputmode="numeric" maxlength="6" data-bind="setup.pin" value="' + esc(s.pin) + '"></label>' +
    '<label class="f">مساهمة كل فرد في الشهر (ج.م)<input class="inp" type="number" inputmode="numeric" data-bind="setup.share" value="' + esc(s.share) + '"></label></div>' +
    '<div class="card"><h2>باقي أفراد البيت</h2><span class="muted sm">كل واحد ليه رقم سري يدخل بيه. ادّيلهم الأرقام دي، ويقدروا يغيّروها بعدين.</span>' +
    s.members.map(function (m, i) {
      return '<div style="display:grid;grid-template-columns:1fr 96px 36px;gap:6px;align-items:center"><input class="inp" placeholder="الاسم" data-bind="setup.members.' + i + '.name" value="' + esc(m.name) + '"><input class="inp" inputmode="numeric" maxlength="6" data-bind="setup.members.' + i + '.pin" value="' + esc(m.pin) + '" aria-label="الرقم السري"><button class="x" data-a="setupDel" data-i="' + i + '" aria-label="شيل">' + IC.x + '</button></div>';
    }).join('') +
    '<button class="btn soft sm" data-a="setupAdd">+ ضيف فرد</button></div>' +
    '<button class="btn full" data-a="setupSave">يلا نبدأ</button></main>';
}
function rndPin() { return String(Math.floor(1000 + Math.random() * 9000)); }

/* ---------- الرئيسية: العضو ---------- */
function heroCard() {
  var s = App.st.summary;
  var spentPct = pct(s.spent + s.setAside, s.base);
  return '<section class="hero"><div class="row"><span style="font-size:14px;opacity:.9">ميزانية ' + monthOnly(App.st.month) + '</span>' +
    (s.daysLeft ? '<span class="pill w">فاضل ' + s.daysLeft + ' ' + (s.daysLeft > 10 ? 'يوم' : 'أيام') + '</span>' : '') + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;opacity:.9">الباقي في البيت</span><span class="big">' + fmt(s.remaining) + ' <span>ج.م</span></span></div>' +
    '<div class="bar"><i style="width:' + spentPct + '%"></i></div>' +
    '<div class="row" style="font-size:13px"><span>اتصرف ' + fmt(s.spent) + (s.setAside ? ' · متحوّش ' + fmt(s.setAside) : '') + '</span><span>من ' + money(s.base) + '</span></div></section>';
}
function viewMemberHome() {
  var st = App.st, my = st.mine.status;
  var contrib = '';
  if (my) {
    var done = my.received >= my.expected && my.expected > 0;
    var inst = my.installments.filter(function (c) { return c.status !== 'planned'; }).map(function (c) { return fmt(c.amount) + ' يوم ' + dateLabel(c.date); }).join('، ');
    var plannedTxt = my.installments.filter(function (c) { return c.status === 'planned'; }).map(function (c) { return fmt(c.amount) + ' يوم ' + dateLabel(c.date); }).join('، ');
    contrib = '<section class="card" style="flex-direction:row;align-items:center"><div class="icon-box' + (done ? '' : ' o') + '">' + (done ? IC.check : IC.wallet) + '</div><div class="grow" style="flex:1;display:flex;flex-direction:column;gap:2px"><span class="sb">مساهمتك الشهر ده</span>' +
      '<span class="sm muted">دفعت ' + fmt(my.received) + ' من ' + money(my.expected) + (inst ? ' (' + inst + ')' : '') + '</span>' +
      (plannedTxt ? '<span class="xs muted">جاي: ' + plannedTxt + '</span>' : '') + '</div></section>';
  }
  var owed = st.mine.owed > 0.5 ? '<div class="alert bl">' + IC.wallet + '<span style="flex:1" class="sm sb">البيت عليه ليك ' + money(st.mine.owed) + ' من حاجات دفعتها من جيبك</span></div>' : '';
  var open = st.shopping.open;
  var shop = open.length ? '<button class="alert" data-a="go" data-v="list">' + IC.list + '<span style="flex:1" class="sm sb">قايمة الشراء: ' + open.slice(0, 4).map(function (x) { return esc(x.name); }).join('، ') + (open.length > 4 ? ' و' + (open.length - 4) + ' كمان' : '') + '</span>' + IC.chev + '</button>' : '';
  var mine = st.myPurchases.slice(0, 3);
  var recent = mine.length ? '<section class="card"><h2>آخر حاجات سجلتها</h2><div class="list">' + mine.map(purchaseRow).join('') + '</div></section>' : '';
  return header('أهلاً يا ' + st.me.name, greet()) + '<main>' + heroCard() + contrib + owed + shop +
    '<section class="card"><h2>البيت صرف في إيه؟</h2>' + catBars(st.summary.byCategory) + '</section>' + recent + '</main>' +
    '<div class="bottom"><div class="in"><button class="btn warm" style="flex:1.3" data-a="ranOut">في حاجة خلصت؟</button><button class="btn ghost" style="flex:1" data-a="newPurchase">سجّل مشتريات</button></div></div>' + nav();
}
function purchaseRow(p) {
  var names = p.items.map(function (i) { return i.name + (i.qty !== 1 || (i.unit && i.unit !== 'عدد') ? ' ' + qtyLabel(i.qty, i.unit) : ''); }).join('، ');
  var cat = p.items[0] ? catName(p.items[0].category) : '';
  return '<button class="li" data-a="openPurchase" data-id="' + p.id + '"><div class="grow"><span style="font-size:14px">' + esc(names) + '</span><span class="xs muted">' + esc(cat) + ' · ' + dateLabel(p.date) +
    (p.paidByName ? ' · من جيب ' + esc(p.paidByName) : '') + (App.st.isAdmin && p.createdByName ? ' · ' + esc(p.createdByName) : '') + '</span></div><span class="sb" style="font-size:14px">' + fmt(p.total) + '</span></button>';
}

/* ---------- الرئيسية: الأدمن ---------- */
function monthSelect() {
  var st = App.st;
  return '<select class="inp msel" id="monthSel" data-a-change="pickMonth" aria-label="الشهر">' + st.months.map(function (m) { return '<option value="' + m + '"' + (m === st.month ? ' selected' : '') + '>' + monthName(m) + '</option>'; }).join('') + '</select>';
}
function viewAdminHome() {
  var st = App.st, s = st.summary, a = st.admin;
  var tiles = '<section class="tiles"><div class="tile"><span>اتجمع' + (s.carry ? ' + مرحّل' : '') + '</span><b>' + fmt(s.base) + '</b></div><div class="tile"><span>اتصرف</span><b>' + fmt(s.spent) + '</b></div><div class="tile dark"><span>الباقي</span><b>' + fmt(s.remaining) + '</b></div></section>';
  var cashLine = '<div class="row xs muted" style="flex-wrap:wrap;gap:6px"><span>كاش في الإيد: <b style="color:var(--ink)">' + fmt(a.cashInHand) + '</b></span>' + (a.owedTotal ? '<span>على البيت للأعضاء: <b style="color:var(--ink)">' + fmt(a.owedTotal) + '</b></span>' : '') + (s.carry ? '<span>مرحّل من قبل: <b style="color:var(--ink)">' + fmt(s.carry) + '</b></span>' : '') + (s.setAside ? '<span>اتحوّش: <b style="color:var(--ink)">' + fmt(s.setAside) + '</b></span>' : '') + '</div>';
  var open = st.shopping.open;
  var shop = open.length ? '<button class="alert" data-a="go" data-v="list">' + IC.warn + '<span style="flex:1" class="sm sb">' + open.length + ' ' + (open.length > 10 ? 'حاجة' : 'حاجات') + ' في القايمة (' + open.slice(0, 3).map(function (x) { return esc(x.name); }).join('، ') + (open.length > 3 ? '...' : '') + ')' + (st.shopping.estTotal ? ' · حوالي ' + fmt(st.shopping.estTotal) + ' ج' : '') + '</span>' + IC.chev + '</button>' : '';
  var mode = st.settings.contribMode === 'equal' ? 'متساوية · ' + fmt(st.settings.defaultShare) + ' للفرد' : 'حسب كل فرد';
  var avs = a.membersStatus.map(function (m) {
    var cls = '', txt = 'لسه';
    if (m.expected > 0 && m.received >= m.expected) { txt = 'دفع ✓'; }
    else if (m.received > 0) { cls = ' o'; txt = 'فاضل ' + fmt(m.left); }
    else if (m.planned > 0) { cls = ' n'; txt = 'جاي ' + fmt(m.planned); }
    else { cls = ' n'; }
    return '<button class="av" data-a="contribSheet" data-id="' + m.id + '"><span class="c' + cls + '">' + esc(m.name.charAt(0)) + '</span><span class="xs">' + esc(m.name) + '</span><span class="xs sb" style="color:' + (cls ? 'var(--muted)' : 'var(--pri)') + '">' + txt + '</span></button>';
  }).join('');
  var contrib = '<section class="card"><div class="row"><h2>المساهمات</h2><span class="xs muted">' + mode + '</span></div><div class="avatars" style="grid-template-columns:repeat(' + Math.min(4, Math.max(a.membersStatus.length, 1)) + ',minmax(0,1fr))">' + avs + '</div>' +
    '<div class="row xs muted"><span>اتجمع ' + fmt(s.received) + ' من ' + fmt(a.expected) + '</span><span>دوس على أي حد تسجّل دفعة</span></div></section>';
  var owed = a.owed.length ? '<section class="card"><h2>البيت عليه فلوس لـ</h2><div class="list">' + a.owed.map(function (o) {
    return '<div class="li"><div class="grow"><span class="sb">' + esc(o.name) + '</span><span class="xs muted">دفع من جيبه</span></div><span class="sb">' + fmt(o.amount) + '</span><button class="btn soft sm" data-a="settleSheet" data-id="' + o.id + '">سدّد</button></div>';
  }).join('') + '</div></section>' : '';
  var plan = a.plan;
  var phaseNames = ['', 'نعرف أقل احتياج', 'ميزانية لكل بند', 'فلوس الطوارئ', 'نستثمر'];
  var phasePct = plan.phase === 1 ? pct(plan.monthsLogged, plan.baselineMonths) : plan.phase === 3 ? plan.emergency.pct : 100;
  var phase = '<button class="card" style="text-align:right;gap:8px" data-a="go" data-v="phases"><div class="row"><span class="sb" style="font-size:14px">المرحلة ' + plan.phase + ': ' + phaseNames[plan.phase] + '</span><span class="xs muted">' +
    (plan.phase === 1 ? 'شهر ' + Math.min(plan.monthsLogged + 1, plan.baselineMonths) + ' من ' + plan.baselineMonths : plan.phase === 3 ? plan.emergency.pct + '%' : '') + '</span></div><div class="bar thin"><i style="width:' + phasePct + '%"></i></div></button>';
  var funds = plan.funds.filter(function (f) { return f.type === 'season' && f.monthly > 0 && f.thisMonth < f.monthly; });
  var fundAlert = funds.length && st.month === st.curMonth ? '<button class="alert g" data-a="go" data-v="phases">' + IC.piggy + '<span style="flex:1" class="sm sb">حوّش الشهر ده: ' + funds.map(function (f) { return esc(f.name) + ' ' + fmt(f.monthly - f.thisMonth); }).join('، ') + '</span>' + IC.chev + '</button>' : '';
  var purch = a.purchases.slice(0, 5);
  var recent = '<section class="card"><div class="row"><h2>آخر المشتريات</h2>' + (a.purchases.length ? '<button class="btn soft sm" data-a="go" data-v="purchases">الكل (' + a.purchases.length + ')</button>' : '') + '</div>' +
    (purch.length ? '<div class="list">' + purch.map(purchaseRow).join('') + '</div>' : '<div class="empty">لسه مفيش مشتريات في ' + monthOnly(st.month) + '</div>') + '</section>';
  return header('أهلاً يا ' + st.me.name, 'لوحة الأدمن') + '<main><div class="row">' + monthSelect() + (st.month !== st.curMonth ? '<button class="btn soft sm" data-a="pickMonthCur">الشهر الحالي</button>' : '') + '</div>' +
    tiles + cashLine + shop + fundAlert + contrib + timelineCard() + owed + phase + recent +
    '<section class="card"><h2>الصرف حسب البند</h2>' + catBars(s.byCategory, true) + '</section></main>' + nav();
}

function timelineCard() {
  var st = App.st, s = st.summary, a = st.admin;
  var tl = a.timeline; if (!tl || !tl.length) return '';
  var W = 340, H = 130, P = 6;
  var maxY = Math.max.apply(null, tl.map(function (r) { return Math.max(r[1], r[2], r[3]); }).concat([1]));
  var x = function (d) { return P + (d - 1) / Math.max(tl.length - 1, 1) * (W - 2 * P); };
  var y = function (v) { return H - P - v / maxY * (H - 2 * P); };
  var cut = st.month === st.curMonth ? s.daysElapsed : (st.month < st.curMonth ? tl.length : 0);
  var path = function (idx, upto) { return tl.slice(0, upto).map(function (r, i) { return (i ? 'L' : 'M') + x(r[0]).toFixed(1) + ' ' + y(r[idx]).toFixed(1); }).join(' '); };
  var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="الفلوس اللي دخلت واللي اتصرفت على مدار الشهر">' +
    '<line x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '" stroke="#E4E0D8"/>' +
    '<path d="' + path(3, tl.length) + '" fill="none" stroke="#9DBDAF" stroke-width="2" stroke-dasharray="4 4"/>' +
    (cut ? '<path d="' + path(1, cut) + '" fill="none" stroke="#1E5B43" stroke-width="2.5"/><path d="' + path(2, cut) + '" fill="none" stroke="#D9894A" stroke-width="2.5"/>' : '') +
    (st.month === st.curMonth && cut ? '<line x1="' + x(cut) + '" y1="' + P + '" x2="' + x(cut) + '" y2="' + (H - P) + '" stroke="#5B625E" stroke-dasharray="2 3"/>' : '') + '</svg>';
  var weeks = a.weeks.map(function (w) {
    var curW = st.month === st.curMonth && s.daysElapsed >= w.from && s.daysElapsed <= w.to;
    return '<div class="tile" style="padding:8px;' + (curW ? 'border-color:var(--pri)' : '') + '"><span>أسبوع ' + w.n + '</span><b style="font-size:14px">' + fmt(w.spent) + '</b><span class="xs">من ' + fmt(w.alloc) + '</span></div>';
  }).join('');
  var up = a.upcoming.length ? '<div class="sm"><span class="muted">دفعات جاية: </span>' + a.upcoming.map(function (u) { return esc(u.name) + ' ' + fmt(u.amount) + ' يوم ' + dateLabel(u.date); }).join('، ') + '</div>' : '';
  var cur = st.month === st.curMonth;
  return '<section class="card"><div class="row"><h2>حركة الفلوس</h2><span class="xs muted">متوسط اليوم ' + fmt(s.dailyAvg) + '</span></div>' +
    (cur ? '<div class="grid2"><div class="tile"><span>تقدر تصرف في اليوم</span><b>' + fmt(s.safePerDay) + '</b></div><div class="tile"><span>رصيد الأسبوع ده</span><b>' + fmt(s.weekLeft) + '</b></div></div>' : '') +
    svg + '<div class="row xs" style="justify-content:flex-start;gap:12px;flex-wrap:wrap"><span><i class="sw" style="background:#1E5B43"></i>اللي دخل</span><span><i class="sw" style="background:#D9894A"></i>اللي اتصرف</span><span><i class="sw" style="background:#9DBDAF"></i>المتوقع يدخل</span></div>' +
    '<div class="tiles" style="grid-template-columns:repeat(4,minmax(0,1fr))">' + weeks + '</div>' +
    (cur && a.projected ? '<div class="xs muted">بالمعدل ده الشهر هيقفل على حوالي ' + money(a.projected) + '</div>' : '') + up + '</section>';
}

function viewPurchases() {
  var st = App.st, list = st.admin.purchases;
  var groups = {}; list.forEach(function (p) { (groups[p.date] = groups[p.date] || []).push(p); });
  var html = Object.keys(groups).sort().reverse().map(function (d) {
    var g = groups[d];
    return '<section class="card" style="gap:4px"><div class="row"><h2>' + dateLabel(d) + '</h2><span class="sm muted">' + fmt(g.reduce(function (s, p) { return s + p.total; }, 0)) + '</span></div><div class="list">' + g.map(purchaseRow).join('') + '</div></section>';
  }).join('');
  return subHeader('مشتريات ' + monthName(st.month)) + '<main><div class="row">' + monthSelect() + '<span class="sb">' + money(st.summary.spent) + '</span></div>' + (html || '<div class="empty">مفيش مشتريات في الشهر ده</div>') + '</main>' + nav();
}

/* ---------- إضافة مشتريات ---------- */
function newDraft(extra) {
  var d = { id: '', date: todayStr(), store: '', paidBy: 'house', items: [], shoppingIds: [], note: '', msg: '', pasteTotal: 0,
    cur: { name: '', qty: '1', unit: 'عدد', price: '', category: '' } };
  for (var k in extra || {}) d[k] = extra[k];
  return d;
}
function viewAdd() {
  var st = App.st, d = App.draft || (App.draft = newDraft());
  var cats = st.categories;
  var quick = mergedCatalog().slice(0, 14);
  var c = d.cur;
  var lines = d.items.map(function (it, i) {
    return '<div class="line"><input class="inp nm" data-bind="draft.items.' + i + '.name" value="' + esc(it.name) + '" aria-label="الحاجة"><button class="x" data-a="delLine" data-i="' + i + '" aria-label="شيل">' + IC.x + '</button>' +
      '<input class="inp" type="text" autocomplete="off" placeholder="1 أو نص" data-bind="draft.items.' + i + '.qty" data-total="1" value="' + esc(it.qty) + '" aria-label="الكمية">' +
      '<select class="inp un" data-bind="draft.items.' + i + '.unit" data-line="' + i + '" aria-label="الوحدة">' + unitOpts(it.unit) + '</select>' +
      '<input class="inp" type="number" inputmode="decimal" step="any" data-bind="draft.items.' + i + '.price" data-total="1" value="' + esc(it.price) + '" placeholder="السعر" aria-label="سعر الوحدة">' +
      '<select class="inp ct" data-bind="draft.items.' + i + '.category" aria-label="التصنيف">' + cats.map(function (k) { return '<option value="' + k.id + '"' + (k.id === it.category ? ' selected' : '') + '>' + esc(k.name) + '</option>'; }).join('') + '</select></div>';
  }).join('');
  var cart = d.items.length ? '<section class="card" style="gap:2px"><div class="row"><h2>الفاتورة (' + d.items.length + ')</h2><span class="xs muted">الكمية · الوحدة · سعر الوحدة</span></div>' + lines +
    '<button class="btn soft sm" style="margin-top:8px" data-a="addEmptyLine">+ صف جديد</button>' + (d.pasteTotal ? '<div id="pasteCheck" style="margin-top:8px">' + pasteCheckHtml() + '</div>' : '') + '</section>' : '';
  var payOpts = '<div class="seg"><button class="' + (d.paidBy === 'house' ? 'on' : '') + '" data-a="paidBy" data-id="house">من فلوس البيت</button><button class="' + (d.paidBy === st.me.id ? 'on' : '') + '" data-a="paidBy" data-id="' + st.me.id + '">من جيبي</button></div>';
  if (st.isAdmin && st.members.length > 1) {
    payOpts += '<select class="inp" data-bind="draft.paidBy" data-rerender="1" aria-label="مين دفع"><option value="house"' + (d.paidBy === 'house' ? ' selected' : '') + '>دفع من فلوس البيت</option>' + st.members.map(function (m) { return '<option value="' + m.id + '"' + (d.paidBy === m.id ? ' selected' : '') + '>دفع من جيب ' + esc(m.name) + '</option>'; }).join('') + '</select>';
  }
  return subHeader(d.id ? 'تعديل المشتريات' : 'إضافة مشتريات', App.backView || 'home') + '<main class="nonav" style="padding-bottom:130px">' +
    (d.id ? '' : '<button class="photo" data-a="pasteOpen">' + IC.paste + 'لصق قائمة</button>') +
    (d.msg ? '<div class="alert ' + (d.msgOk ? 'g' : 'bl') + ' sm">' + esc(d.msg) + '</div>' : '') +
    cart +
    '<div class="divider">' + (d.items.length ? 'ضيف حاجة كمان' : 'أو سجّل بإيدك') + '</div>' +
    (quick.length ? '<div style="display:flex;flex-direction:column;gap:8px"><span class="sm muted">اشتريته قبل كده؟ دوسة واحدة</span><div class="chips">' + quick.map(function (q, i) { return '<button class="chip sm" data-a="quickAdd" data-i="' + i + '">' + esc(q.name) + (q.price ? ' <span class="xs muted">' + fmt(q.price) + (q.unit ? '/' + esc(q.unit) : '') + '</span>' : '') + '</button>'; }).join('') + '</div></div>' : '') +
    '<label class="f">الحاجة<input id="curName" class="inp" list="catalogList" data-bind="draft.cur.name" value="' + esc(c.name) + '" placeholder="مثلاً: بيض 30 أو فاتورة كهربا"></label>' +
    '<datalist id="catalogList">' + mergedCatalog().map(function (q) { return '<option value="' + esc(q.name) + '">'; }).join('') + '</datalist>' +
    '<div class="grid2" style="gap:12px"><div style="display:flex;flex-direction:column;gap:6px"><span class="sb" style="font-size:14px">الكمية</span><div class="stepper"><button data-a="qty" data-d="1" aria-label="زوّد">+</button><input id="curQty" type="text" autocomplete="off" placeholder="1 أو نص" data-bind="draft.cur.qty" value="' + esc(c.qty) + '" aria-label="الكمية"><button data-a="qty" data-d="-1" aria-label="قلّل">−</button></div></div>' +
    '<label class="f">الوحدة<select id="curUnit" class="inp" data-bind="draft.cur.unit">' + unitOpts(c.unit) + '</select></label></div>' +
    '<label class="f"><span id="curPriceLbl">' + priceLbl(c.unit) + '</span><input id="curPrice" class="inp" type="number" inputmode="decimal" step="any" data-bind="draft.cur.price" value="' + esc(c.price) + '" placeholder="0"></label>' +
    '<span class="xs muted" id="curHint" style="margin-top:-8px">' + curHint() + '</span>' +
    '<div style="display:flex;flex-direction:column;gap:8px"><span class="sb" style="font-size:14px">التصنيف</span><div class="grid2">' + cats.map(function (k) { return '<button class="catbtn' + (c.category === k.id ? ' on' : '') + '" data-a="pickCat" data-id="' + k.id + '">' + esc(k.name) + '</button>'; }).join('') + '</div></div>' +
    '<button class="btn soft full" data-a="addLine">+ ضيفها للفاتورة</button>' +
    '<section class="card"><h2>تفاصيل</h2><div class="grid2" style="gap:10px"><label class="f">التاريخ<input class="inp" type="date" data-bind="draft.date" value="' + esc(d.date) + '"></label><label class="f">المحل (اختياري)<input class="inp" data-bind="draft.store" value="' + esc(d.store) + '" placeholder="مثلاً: كارفور"></label></div>' +
    '<div style="display:flex;flex-direction:column;gap:8px"><span class="sb" style="font-size:14px">دفعت منين؟</span>' + payOpts + '</div>' +
    (d.paidBy !== 'house' ? '<div class="xs muted">البيت هيبقى عليه المبلغ ده لـ' + esc(memberName(d.paidBy)) + ' لحد ما الأدمن يسدّده.</div>' : '') + '</section>' +
    '</main><div class="bottom nonav"><div class="in bar2"><div style="display:flex;flex-direction:column;flex:1"><span class="xs muted">الإجمالي</span><span style="font-size:20px" class="b" id="draftTotal">' + money(draftTotal()) + '</span></div><button class="btn" style="padding:0 32px" data-a="savePurchase">' + (d.id ? 'حفظ' : 'سجّل') + '</button></div></div>';
}
var PRESETS = [['عيش', 'food'], ['بيض', 'food'], ['لبن', 'food'], ['زيت', 'food'], ['سكر', 'food'], ['رز', 'food'], ['مكرونة', 'food'], ['شاي', 'food'], ['فراخ', 'food'], ['خضار', 'food'], ['فاكهة', 'food'], ['جبنة', 'food'], ['صابون', 'clean'], ['منظف أطباق', 'clean'], ['مسحوق غسيل', 'clean'], ['مناديل', 'clean'], ['فاتورة كهربا', 'bills'], ['فاتورة غاز', 'bills'], ['فاتورة مية', 'bills']];
var UNITS = ['عدد', 'كيلو', 'رغيف', 'دستة', 'كرتونة', 'ازازة', 'علبة', 'كيس', 'باكو'];
var DEF_UNITS = { 'عيش': 'رغيف', 'بيض': 'دستة', 'لبن': 'كيس', 'زيت': 'ازازة', 'سكر': 'كيلو', 'رز': 'كيلو', 'مكرونة': 'كيس', 'شاي': 'علبة', 'فراخ': 'كيلو', 'خضار': 'كيلو', 'فاكهة': 'كيلو', 'جبنة': 'كيلو', 'منظف أطباق': 'ازازة', 'مسحوق غسيل': 'كيس', 'مناديل': 'باكو' };
function unitOf(u) { return String(u || '').trim() || 'عدد'; }
function unitOpts(cur) {
  cur = unitOf(cur); var list = UNITS.slice(); if (list.indexOf(cur) < 0) list.push(cur);
  return list.map(function (u) { return '<option value="' + esc(u) + '"' + (u === cur ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('');
}
/* v1.4.1: الكمية تقبل كسور وكلام: 0.5، ٠٫٥، 1/2، نص، ربع، تلت تربع، كيلو ونص، 2 وربع، 3 الا ربع */
var QTY_WORDS = { 'نص': 0.5, 'نصف': 0.5, 'ربع': 0.25, 'تلت': 1 / 3, 'ثلث': 1 / 3, 'تلتين': 2 / 3, 'ثلثين': 2 / 3,
  'تلتتربع': 0.75, 'تلاتتربع': 0.75, 'تلاتةتربع': 0.75, 'ثلاثةارباع': 0.75, 'ثلاثأرباع': 0.75, 'ثلاثارباع': 0.75, 'ثلاثةأرباع': 0.75,
  'واحد': 1, 'كيلو': 1, 'اتنين': 2, 'اثنين': 2, 'كيلوين': 2, 'تلاتة': 3, 'تلاته': 3, 'ثلاثة': 3, 'اربعة': 4, 'اربعه': 4, 'أربعة': 4, 'خمسة': 5, 'خمسه': 5 };
function qtyBase(t) {
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  var m = t.match(/^(\d+)\/(\d+)$/); if (m && +m[2]) return +m[1] / +m[2];
  if (QTY_WORDS[t] !== undefined) return QTY_WORDS[t];
  return null;
}
function parseQty(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var t = normDigits(v).replace(/,/g, '.').replace(/[إأآ]/g, 'ا').replace(/\s+/g, ' ').trim()
    .replace(/(.)\s*(كيلو\s*جرام|كيلوجرام|كجم|كيلو|kg)$/i, '$1').replace(/\s*(جرام|جم|g)$/i, function () { return ' g'; });
  var gram = / g$/.test(t); t = t.replace(/ g$/, '');
  var mx = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mx && +mx[3]) { var mr = +mx[1] + mx[2] / mx[3]; return Math.round((gram ? mr / 1000 : mr) * 1000) / 1000; }
  t = t.replace(/\s+/g, '').replace(/^(كيلو(?=و|الا|إلا))/, '1').replace(/^كيلو(?=\d)/, '');
  var r = null, m;
  if ((m = t.match(/^(.+?)(?:ال|إل)ا(نص|ربع|تلت|ثلث)$/))) { var a = qtyBase(m[1]); if (a !== null) r = a - QTY_WORDS[m[2]]; }
  else if ((m = t.match(/^(.+?)و(نص|نصف|ربع|تلت|ثلث|تلتين|ثلثين)$/))) { var b = qtyBase(m[1]); if (b !== null) r = b + QTY_WORDS[m[2]]; }
  else r = qtyBase(t);
  if (r === null || !isFinite(r) || r < 0) return 0;
  if (gram) r = r / 1000;
  return Math.round(r * 1000) / 1000;
}
function fmtQty(q) { q = parseQty(q) || 1; return String(Math.round(q * 1000) / 1000); }
function qtyLabel(q, u) { return fmtQty(q) + ' ' + unitOf(u); }
function catEntry(name) { var k = String(name || '').trim(); return k ? mergedCatalog().filter(function (c) { return c.name === k; })[0] : null; }
function defUnit(name) { var c = catEntry(name); return unitOf((c && c.unit) || DEF_UNITS[String(name || '').trim()]); }
/** آخر سعر اتدفع للحاجة دي بالوحدة دي (نفس منطق السيرفر) */
function lastPrice(name, unit) {
  var c = catEntry(name); if (!c) return 0;
  var u = c.units || {}, w = unitOf(unit);
  if (u[w]) return u[w];
  if (u['']) return u[''];
  return !c.units && unitOf(c.unit) === w ? n(c.price) : 0;
}
function mergedCatalog() {
  var st = App.st, seen = {}, out = [];
  var catOk = {}; st.categories.forEach(function (c) { catOk[c.id] = 1; });
  st.catalog.forEach(function (c) { seen[c.name] = 1; out.push(c); });
  PRESETS.forEach(function (p) { if (!seen[p[0]]) out.push({ name: p[0], category: catOk[p[1]] ? p[1] : st.categories[0].id, price: 0, unit: DEF_UNITS[p[0]] || '', units: {} }); });
  return out;
}
function priceLbl(u) { u = unitOf(u); return (u === 'عدد' ? 'سعر الواحدة' : 'سعر ال' + u) + ' (ج.م)'; }
function curHint() {
  var c = App.draft && App.draft.cur; if (!c || !c.name.trim()) return 'السعر بيتكتب لوحده من آخر مرة، وعدّله لو اتغيّر';
  var p = lastPrice(c.name, c.unit);
  return p ? 'آخر مرة: ' + fmt(p) + ' ج لل' + unitOf(c.unit) + '. لو السعر اتغيّر عدّله، والجديد هيتحفظ' : 'أول مرة نشتريها بالوحدة دي، السعر هيتحفظ للمرة الجاية';
}
function draftTotal() {
  var d = App.draft; if (!d) return 0;
  var t = d.items.reduce(function (s, i) { return s + (parseQty(i.qty) || 1) * n(i.price); }, 0);
  if (d.cur.name && n(d.cur.price)) t += (parseQty(d.cur.qty) || 1) * n(d.cur.price);
  return t;
}
function guessCat(name) {
  var st = App.st, k = String(name || '').trim();
  var hit = mergedCatalog().filter(function (c) { return c.name === k; })[0];
  if (hit) return hit.category;
  if (/صابون|منظف|مسحوق|كلور|مناديل|ديتول|معطر|اسفنج|شامبو|معجون/.test(k)) return pick('clean');
  if (/كهربا|غاز|مية|مياه|نت|انترنت|فاتور/.test(k)) return pick('bills');
  if (/شيبسي|شوكولا|شيكولا|بسكوت|حلويات|ايس|آيس|بيبسي|كولا|سناكس/.test(k)) return pick('snacks');
  return pick('food');
  function pick(id) { return st.categories.some(function (c) { return c.id === id; }) ? id : st.categories[0].id; }
}

/* ---------- قايمة الشراء ---------- */
function viewShopping() {
  var st = App.st, sh = st.shopping;
  var sel = App.selShop, selCount = Object.keys(sel).filter(function (k) { return sel[k]; }).length;
  var open = sh.open.map(function (s) {
    var on = !!sel[s.id], mine = st.isAdmin || s.byId === st.me.id;
    return '<div class="li"><button class="ibtn" style="' + (on ? 'background:var(--pri);color:#fff;border-color:var(--pri)' : '') + '" data-a="selShop" data-id="' + s.id + '" aria-label="اختار ' + esc(s.name) + '" aria-pressed="' + on + '">' + (on ? IC.check : '') + '</button>' +
      '<div class="grow"><span><span class="sb">' + esc(s.name) + '</span> <span class="qty">' + esc(qtyLabel(s.qty, s.unit)) + '</span></span>' +
      '<span class="xs muted">' + (s.price ? 'حوالي ' + fmt(s.est) + ' ج (' + fmt(s.price) + ' لل' + esc(unitOf(s.unit)) + ')' : 'لسه مالهاش سعر') + ' · ' + esc(s.by) + ' · ' + timeAgo(s.at) + '</span></div>' +
      (mine ? '<button class="x" data-a="editShop" data-id="' + s.id + '" aria-label="عدّل الكمية">' + IC.edit + '</button><button class="x" data-a="delShop" data-id="' + s.id + '" aria-label="شيل">' + IC.trash + '</button>' : '') + '</div>';
  }).join('');
  var done = sh.done.map(function (s) { return '<div class="li" style="opacity:.6"><div class="grow"><span style="text-decoration:line-through">' + esc(s.name) + ' · ' + esc(qtyLabel(s.qty, s.unit)) + '</span></div><button class="btn soft sm" data-a="undoShop" data-id="' + s.id + '">رجّعها</button></div>'; }).join('');
  var est = sh.open.length && sh.estTotal ? '<div class="row sm"><span class="muted">المتوقع نصرفه</span><span class="b">حوالي ' + money(sh.estTotal || 0) + '</span></div>' +
    '' : '';
  if (sh.noPrice) est += '<span class="xs muted">' + sh.noPrice + (sh.noPrice > 10 ? ' حاجة' : ' حاجات') + ' لسه مالهاش سعر، أول ما تتشرى سعرها هيتحفظ.</span>';
  var due = st.insights && st.insights.dueSoon && st.insights.dueSoon.length ? st.insights.dueSoon.filter(function (nm) { return !sh.open.some(function (o) { return o.name === nm; }); }) : [];
  var dueHtml = due.length ? '<section class="card"><h2>غالباً هيخلصوا قريب</h2><span class="xs muted">محسوبة من مواعيد الشرا اللي فاتت</span><div class="chips">' + due.map(function (nm) { return '<button class="chip sm" data-a="addShopName" data-name="' + esc(nm) + '">+ ' + esc(nm) + '</button>'; }).join('') + '</div></section>' : '';
  return '<header class="top"><div class="t"><small>بتتحدّث على كل الموبايلات</small><h1>قايمة الشراء</h1></div><div class="hbtns"><button class="ibtn" data-a="go" data-v="settings" aria-label="الإعدادات">' + IC.gear + '</button></div></header><main>' +
    '<section class="card shopadd"><h2>محتاجين إيه؟</h2><input id="shopInput" class="inp" list="catalogList" placeholder="مثلاً: تفاح، عيش، بيض" enterkeyhint="next" autocomplete="off">' +
    '<datalist id="catalogList">' + mergedCatalog().map(function (q) { return '<option value="' + esc(q.name) + '">'; }).join('') + '</datalist>' +
    '<div class="qrow"><label class="f">الكمية<input id="shopQty" class="inp" type="text" autocomplete="off" placeholder="1 أو نص" value="1"></label><label class="f">الوحدة<select id="shopUnit" class="inp">' + unitOpts('عدد') + '</select></label><button class="btn" data-a="addShop">ضيف</button></div>' +
    '<span class="xs muted">مثلاً 2 كيلو تفاح، 10 رغيف عيش، 1 كرتونة بيض</span></section>' +
    '<button class="btn warm full" data-a="ranOut">في حاجة خلصت؟ اختار بسرعة</button>' +
    '<section class="card" style="gap:4px"><div class="row"><h2>محتاجين نشتري (' + sh.open.length + ')</h2></div>' + est + (open ? '<div class="list">' + open + '</div>' : '<div class="empty">القايمة فاضية، كله موجود 👌</div>') +
    (open ? '<span class="xs muted">علّم على اللي اشتريته، وبعدين دوس "اشتريناهم" تحت عشان الفلوس تتحسب.</span>' : '') + '</section>' +
    dueHtml + (done ? '<section class="card" style="gap:4px"><h2>اشتريناه</h2><div class="list">' + done + '</div></section>' : '') + '</main>' +
    (selCount ? '<div class="bottom"><div class="in"><button class="btn" style="flex:1.6" data-a="buySelected">اشتريناهم، سجّل الفلوس (' + selCount + ')</button>' +
      (st.isAdmin ? '<button class="btn ghost" style="flex:1" data-a="confirm" data-do="markShopOnly" data-msg="هتتشال من القايمة من غير ما فلوسها تتحسب في الصرف. استخدمها بس لو حد جابها من برا فلوس البيت ومش عايزين نسجّلها.">من غير فلوس</button>' : '') + '</div></div>' : '') + nav();
}

/* ---------- التحليلات ---------- */
function viewInsights() {
  var st = App.st, I = st.insights;
  if (!I) return subHeader('التحليلات') + '<main><div class="empty">التحليلات مقفولة</div></main>' + nav();
  var max = Math.max.apply(null, I.monthly.map(function (m) { return Math.max(m.total, m.month === st.curMonth ? I.projected : 0); }).concat([1]));
  var bars = '<div class="bars">' + I.monthly.map(function (m) {
    var cur = m.month === st.curMonth;
    var h = Math.round(m.total / max * 120);
    var ph = cur && I.projected > m.total ? Math.round(I.projected / max * 120) : 0;
    return '<div class="col' + (cur ? ' cur' : '') + '"><b>' + fmt(m.total) + '</b>' + (ph ? '<div style="width:100%;height:' + ph + 'px;border:1.5px dashed var(--pri);border-bottom:none;border-radius:8px 8px 0 0;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden"><i style="height:' + h + 'px;border-radius:0"></i></div>' : '<i style="height:' + Math.max(h, 2) + 'px"></i>') + '</div>';
  }).join('') + '</div><div class="blabels">' + I.monthly.map(function (m) { return '<span>' + monthOnly(m.month) + '</span>'; }).join('') + '</div>';
  var tagCls = { need: 'bl', waste: 'o', up: 'o', down: 'g', normal: 'g' };
  var items = I.items.length ? I.items.slice(0, 15).map(function (i) {
    var sub = 'كل ' + i.every + ' ' + (i.every > 10 || i.every < 3 ? 'يوم' : 'أيام') + (i.before ? ' · كان كل ' + i.before : '') + (i.note ? ' · ' + i.note : '') + ' · حوالي ' + fmt(i.monthlyCost) + ' في الشهر';
    return '<div class="li"><div class="grow"><span class="sb" style="font-size:14px">' + esc(i.name) + '</span><span class="xs muted" style="white-space:normal">' + esc(sub) + '</span></div><span class="pill ' + tagCls[i.tag] + ' sb">' + esc(i.label) + '</span></div>';
  }).join('') : '<div class="empty">محتاجين كل حاجة تتشرى مرتين على الأقل عشان نعرف بتخلص كل قد إيه</div>';
  var sp = I.split, tot = sp.essential + sp.flex;
  var split = '<div class="split"><i style="width:' + pct(sp.essential, tot) + '%;background:var(--pri)"></i><i style="width:' + pct(sp.flex, tot) + '%;background:var(--flex)"></i></div>' +
    '<div class="row sm"><span><i class="sw" style="background:var(--pri)"></i>أساسي ' + pct(sp.essential, tot) + '% · ' + fmt(sp.essential) + '</span><span><i class="sw" style="background:var(--flex)"></i>كماليات ' + pct(sp.flex, tot) + '% · ' + fmt(sp.flex) + '</span></div>' +
    (sp.topFlex.length ? '<span class="xs muted">أكتر حاجة في الكماليات: ' + sp.topFlex.map(function (x) { return esc(x.name) + ' (' + fmt(x.cost) + ')'; }).join('، ') + '</span>' : '');
  var budgets = I.budgets.length ? '<section class="card"><h2>الميزانيات الشهر ده</h2>' + I.budgets.map(function (b) {
    return '<div style="display:flex;flex-direction:column;gap:6px"><div class="row sm"><span>' + esc(b.name) + '</span><span><b>' + fmt(b.spent) + '</b> <span class="muted xs">/ ' + fmt(b.budget) + '</span></span></div><div class="bar thin' + (b.over ? ' over' : '') + '"><i style="width:' + pct(b.spent, b.budget) + '%"></i></div>' + (b.over ? '<span class="xs" style="color:var(--warm-ink)">بالمعدل ده هيوصل ' + fmt(b.projected) + '</span>' : '') + '</div>';
  }).join('') + '</section>' : '';
  var tips = I.tips.length ? '<section class="card"><h2>ملاحظات</h2>' + I.tips.map(function (t) { return '<div class="sm" style="display:flex;gap:8px"><span style="color:var(--pri)">•</span><span>' + esc(t) + '</span></div>'; }).join('') + '</section>' : '';
  var lockTxt = st.me.role === 'owner' ? (st.settings.insightsForAdmins ? 'ظاهرة ليك وللأدمنز، الأعضاء مش بيشوفوها' : 'ليك انت بس، محدش تاني بيشوفها') : 'المالك سامحلك تشوفها';
  return '<header class="top"><div class="t"><h1>التحليلات</h1><small>' + lockTxt + '</small></div><span class="ibtn" role="img" aria-label="خاصة">' + IC.lock + '</span></header><main>' +
    '<section class="card"><div class="row"><h2>الصرف الشهري</h2>' + (I.projected ? '<span class="xs muted">' + monthOnly(st.curMonth) + ' متوقع ' + fmt(I.projected) + '</span>' : '') + '</div>' + bars + '</section>' +
    tips + '<section class="card" style="gap:4px"><h2>بيخلص كل قد إيه؟</h2><span class="xs muted" style="margin-bottom:6px">محسوبة من مواعيد الشرا، مقارنة باللي قبلها</span><div class="list">' + items + '</div></section>' +
    '<section class="card"><h2>محتاج ولا كماليات؟</h2>' + (tot ? split : '<div class="empty">لسه مفيش صرف الشهر ده</div>') + '</section>' + budgets + '</main>' + nav();
}

/* ---------- المراحل والتحويش ---------- */
function viewPhases() {
  var st = App.st, P = st.admin.plan, cur = P.phase;
  var canEdit = st.isAdmin;
  var ph = function (num, title, body) {
    var cls = num === cur ? 'on' : (num < cur ? 'done' : '');
    return '<section class="card"><div class="phase ' + cls + '"><span class="n">' + (num < cur ? '✓' : num) + '</span><div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0"><div class="row"><h2>' + title + '</h2>' + (num === cur ? '<span class="pill g">دلوقتي</span>' : '') + '</div>' + body + '</div></div></section>';
  };
  var p1 = '<span class="sm muted">أول ' + P.baselineMonths + ' شهور بنسجّل كل حاجة عشان نعرف أقل مبلغ البيت محتاجه.</span>' +
    '<div class="bar thin"><i style="width:' + pct(P.monthsLogged, P.baselineMonths) + '%"></i></div><span class="xs muted">' + P.monthsLogged + ' من ' + P.baselineMonths + ' شهور كاملة متسجلة</span>' +
    (P.need ? '<div class="grid2"><div class="tile"><span>البيت محتاج في الشهر' + (P.avgMonthly ? '' : ' (تقدير)') + '</span><b>' + fmt(P.need) + '</b></div><div class="tile"><span>منهم أساسي</span><b>' + fmt(P.essentialAvg || 0) + '</b></div></div>' +
      '<div class="sm">المساهمات دلوقتي <b>' + money(P.expectedTotal) + '</b> في الشهر.' + (P.suggestedTotal > P.expectedTotal ? ' <span style="color:var(--warm-ink)">محتاجين حوالي ' + money(P.suggestedTotal) + ' (الاحتياج + 10% احتياطي' + (P.seasonalMonthly ? ' + التحويشات' : '') + ').</span>' : ' <span style="color:var(--pri)">كفاية ومعاها احتياطي.</span>') + '</div>' +
      (P.suggestedShare > st.settings.defaultShare && st.settings.contribMode === 'equal' ? '<button class="btn soft sm" data-a="applyShare" data-v="' + P.suggestedShare + '">خلّي مساهمة الفرد ' + fmt(P.suggestedShare) + '</button>' : (P.suggestedTotal && P.suggestedTotal < P.expectedTotal ? '<span class="xs muted">الفايض كل شهر يروح لفلوس الطوارئ والتحويشات، مش لازم تقللوا المساهمة.</span>' : '')) : '<span class="sm">لسه محتاجين أسبوع تسجيل على الأقل عشان نقدّر.</span>');
  var cats = st.categories;
  var p2 = '<span class="sm muted">لكل بند سقف في الشهر، محسوب من متوسط صرفكم + 5%.</span>' + cats.map(function (c) {
    var sug = P.suggestedBudgets[c.id] || 0;
    return '<div style="display:grid;grid-template-columns:1fr 100px;gap:8px;align-items:center"><div style="display:flex;flex-direction:column"><span class="sm sb">' + esc(c.name) + '</span><span class="xs muted">متوسط ' + fmt(P.catAvg[c.id] || 0) + (sug ? ' · مقترح ' + fmt(sug) : '') + '</span></div><input class="inp" style="min-height:40px" type="number" inputmode="numeric" id="bud_' + c.id + '" value="' + (c.budget || sug || '') + '" placeholder="0" aria-label="ميزانية ' + esc(c.name) + '"></div>';
  }).join('') + (canEdit ? '<button class="btn soft sm" data-a="saveBudgets">احفظ الميزانيات</button>' : '');
  var E = P.emergency;
  var p3 = '<span class="sm muted">' + st.settings.emergencyPct + '% من المساهمات كل شهر في فلوس طوارئ، لحد ما توصل مصروف ' + st.settings.emergencyMonths + ' شهور.</span>' +
    '<div class="row sm"><span>متحوّش <b>' + fmt(E.saved) + '</b></span><span class="muted">الهدف ' + fmt(E.target) + '</span></div><div class="bar thin"><i style="width:' + E.pct + '%"></i></div>' +
    '<div class="xs muted">المقترح كل شهر: ' + money(E.monthly) + (E.thisMonth ? ' · اتحوّش الشهر ده ' + fmt(E.thisMonth) : '') + '</div>' +
    (canEdit ? '<div class="row" style="justify-content:flex-start;gap:8px"><button class="btn soft sm" data-a="efSave" data-v="' + Math.max(0, E.monthly - E.thisMonth) + '">حوّش ' + fmt(Math.max(0, E.monthly - E.thisMonth) || E.monthly) + '</button>' + (E.fundId ? '<button class="btn ghost sm" data-a="fundTxSheet" data-id="' + E.fundId + '" data-dir="-1">اسحب منها</button>' : '') + '</div>' : '');
  var p4 = '<span class="sm muted">بعد ما فلوس الطوارئ تكمل، الفايض كل شهر يتحط في حاجة بتكبر (شهادات بنك، دهب، صناديق). اختاروا اللي مرتاحين ليه وبمخاطرة قليلة.</span>' +
    (P.avgLeftover > 0 ? '<div class="sm">متوسط الفايض في آخر الشهر: <b>' + money(P.avgLeftover) + '</b></div>' : '');
  var funds = P.funds.filter(function (f) { return f.type === 'season'; });
  var fundsHtml = funds.map(function (f) {
    return '<div style="display:flex;flex-direction:column;gap:8px;padding:10px 0;border-bottom:1px solid var(--track)"><div class="row"><div style="display:flex;flex-direction:column"><span class="sb">' + esc(f.name) + '</span><span class="xs muted">' + (f.dueDate ? dateLabel(f.dueDate) + ' ' + f.dueDate.slice(0, 4) + ' · فاضل ' + f.monthsLeft + ' شهر' : 'من غير ميعاد') + '</span></div><button class="x" data-a="fundSheet" data-id="' + f.id + '" aria-label="تعديل">' + IC.edit + '</button></div>' +
      '<div class="row sm"><span><b>' + fmt(f.saved) + '</b> من ' + fmt(f.target) + '</span>' + (f.monthly ? '<span class="pill ' + (f.thisMonth >= f.monthly ? 'g' : 'o') + '">' + fmt(f.monthly) + ' كل شهر</span>' : (f.saved >= f.target && f.target ? '<span class="pill g">كملت ✓</span>' : '')) + '</div><div class="bar thin"><i style="width:' + f.pct + '%"></i></div>' +
      '<div class="row" style="justify-content:flex-start;gap:8px"><button class="btn soft sm" data-a="fundTxSheet" data-id="' + f.id + '" data-dir="1" data-amt="' + Math.max(0, f.monthly - f.thisMonth) + '">حوّش</button><button class="btn ghost sm" data-a="fundTxSheet" data-id="' + f.id + '" data-dir="-1">اسحب للبيت</button></div></div>';
  }).join('');
  var phaseSel = canEdit ? '<div class="seg">' + [1, 2, 3, 4].map(function (k) { return '<button class="' + (k === cur ? 'on' : '') + '" data-a="setPhase" data-v="' + k + '">' + k + '</button>'; }).join('') + '</div>' : '';
  return '<header class="top"><div class="t"><small>من الأساسي للاستثمار</small><h1>المراحل والتحويش</h1></div><div class="hbtns"><button class="ibtn" data-a="go" data-v="settings" aria-label="الإعدادات">' + IC.gear + '</button></div></header><main>' +
    '<div style="display:flex;flex-direction:column;gap:6px"><span class="sm muted">انتو في أنهي مرحلة؟</span>' + phaseSel + '</div>' +
    ph(1, 'نعرف أقل احتياج', p1) + ph(2, 'ميزانية لكل بند', p2) + ph(3, 'فلوس الطوارئ', p3) + ph(4, 'نستثمر الفايض', p4) +
    '<section class="card" style="gap:4px"><div class="row"><h2>تحويشات المواسم</h2><button class="btn soft sm" data-a="fundSheet">+ جديدة</button></div><span class="xs muted">رمضان، العيد، الأضحية، المدارس... نحوّش لها من بدري بدل ما تيجي مرة واحدة.</span>' +
    (fundsHtml || '<div class="empty">لسه مفيش تحويشات</div>') + (P.seasonalMonthly ? '<div class="sm" style="padding-top:8px">مجموع التحويش كل شهر: <b>' + money(P.seasonalMonthly) + '</b></div>' : '') + '</section></main>' + nav();
}

/* ---------- الإعدادات ---------- */
function viewSettings() {
  var st = App.st, isO = st.me.role === 'owner', isA = st.isAdmin, a = st.admin;
  var mine = '<section class="card"><h2>حسابي</h2><div class="row"><span>' + esc(st.me.name) + '</span><span class="pill g">' + ROLE[st.me.role] + '</span></div><div class="grid2"><button class="btn soft sm" data-a="pinSheet">غيّر الرقم السري</button><button class="btn ghost sm" data-a="logout">خروج</button></div></section>';
  if (!isA) return subHeader('الإعدادات') + '<main>' + mine + '<p class="xs muted" style="text-align:center">' + esc(st.household) + '</p></main>' + nav();
  var s = st.settings;
  var house = '<section class="card"><h2>البيت</h2><label class="f">اسم البيت<input id="setHouse" class="inp" value="' + esc(st.household) + '"></label>' +
    '<div style="display:flex;flex-direction:column;gap:8px"><span class="sb" style="font-size:14px">المساهمات</span><div class="seg"><button class="' + (s.contribMode === 'equal' ? 'on' : '') + '" data-a="setMode" data-v="equal">متساوية</button><button class="' + (s.contribMode === 'custom' ? 'on' : '') + '" data-a="setMode" data-v="custom">مختلفة لكل فرد</button></div></div>' +
    (s.contribMode === 'equal' ? '<label class="f">مساهمة الفرد في الشهر<input id="setShare" class="inp" type="number" inputmode="numeric" value="' + esc(s.defaultShare) + '"></label>' : '') +
    '<button class="btn soft sm" data-a="saveHouse">احفظ</button></section>';
  var members = '<section class="card" style="gap:4px"><div class="row"><h2>أفراد البيت</h2>' + (isO ? '<button class="btn soft sm" data-a="memberSheet">+ فرد</button>' : '') + '</div>' + st.members.map(function (m) {
    return '<button class="li" data-a="memberSheet" data-id="' + m.id + '"' + (isO || s.contribMode === 'custom' ? '' : ' disabled') + '><span class="av" style="padding:0"><span class="c" style="width:36px;height:36px">' + esc(m.name.charAt(0)) + '</span></span><div class="grow"><span class="sb">' + esc(m.name) + '</span><span class="xs muted">' + ROLE[m.role] + (s.contribMode === 'custom' ? ' · ' + fmt(m.share) + ' في الشهر' : '') + '</span></div>' + (isO || s.contribMode === 'custom' ? IC.chev : '') + '</button>';
  }).join('') + (isO ? '<span class="xs muted" style="padding-top:6px">انت المالك: تقدر تضيف وتشيل أفراد، وتغيّر مين أدمن.</span>' : '') + '</section>';
  var privacy = isO ? '<section class="card"><div class="row"><div style="display:flex;flex-direction:column;flex:1"><span class="sb">الأدمنز يشوفوا التحليلات</span><span class="xs muted">لو مقفولة، التحليلات الشهرية ليك انت بس</span></div><button class="toggle' + (s.insightsForAdmins ? ' on' : '') + '" data-a="toggleInsights" role="switch" aria-checked="' + !!s.insightsForAdmins + '" aria-label="الأدمنز يشوفوا التحليلات"></button></div></section>' : '';
  var cats = '<section class="card" style="gap:4px"><div class="row"><h2>التصنيفات</h2><button class="btn soft sm" data-a="catSheet">+ تصنيف</button></div>' + st.categories.map(function (c) {
    return '<button class="li" data-a="catSheet" data-id="' + c.id + '"><i class="sw" style="background:' + esc(c.color) + '"></i><div class="grow"><span>' + esc(c.name) + '</span><span class="xs muted">' + (c.kind === 'flex' ? 'كماليات' : 'أساسي') + (c.budget ? ' · ميزانية ' + fmt(c.budget) : '') + '</span></div>' + IC.chev + '</button>';
  }).join('') + '</section>';
  var backup = '<section class="card"><h2>نسخة احتياطية</h2><span class="xs muted">نزّل ملف وابعته لنفسك على واتساب أو خزّنه على هارد البيت. ودوس "احفظ نسخة جوه الشيت" كل فترة (بيحتفظ بآخر 4 نسخ).</span>' +
    '<div class="grid2"><button class="btn soft sm" data-a="exportXlsx">ملف Excel</button><button class="btn soft sm" data-a="exportJson">ملف استرجاع (JSON)</button></div><button class="btn ghost sm" data-a="backupNow">احفظ نسخة جوه الشيت دلوقتي</button>' +
    (isO ? '<button class="btn danger sm" data-a="restorePick">استرجاع من ملف</button>' : '') + (a.sheetUrl ? '<a class="sm" href="' + esc(a.sheetUrl) + '" target="_blank" rel="noopener">افتح شيت البيانات (على إيميل البيت)</a>' : '') + '</section>';
  var log = '<details class="card"><summary>آخر التعديلات</summary><div class="list">' + a.log.slice(0, 25).map(function (l) { return '<div class="li"><div class="grow"><span class="sm">' + esc(l.who) + ' · ' + esc(ACTION_NAMES[l.action] || l.action) + '</span><span class="xs muted" style="white-space:normal">' + esc(l.detail) + ' · ' + timeAgo(l.at) + '</span></div></div>'; }).join('') + '</div></details>';
  return subHeader('الإعدادات') + '<main>' + mine + house + members + privacy + cats + backup + log + '<p class="xs muted" style="text-align:center">ميزانية البيت · نسخة 1.0</p></main>' + nav();
}
var ACTION_NAMES = { addPurchase: 'سجّل مشتريات', updatePurchase: 'عدّل مشتريات', deletePurchase: 'مسح مشتريات', addContribution: 'سجّل مساهمة', updateContribution: 'عدّل مساهمة', deleteContribution: 'مسح مساهمة', settle: 'سدّد فلوس', addShopping: 'ضاف لقايمة الشراء', updateShopping: 'عدّل كمية في القايمة', toggleShopping: 'علّم في القايمة', deleteShopping: 'شال من القايمة', saveCategory: 'عدّل تصنيف', deleteCategory: 'مسح تصنيف', applyBudgets: 'حدّث الميزانيات', saveFund: 'عدّل تحويشة', deleteFund: 'مسح تحويشة', fundTx: 'حركة تحويش', saveSettings: 'غيّر الإعدادات', saveMember: 'عدّل فرد', changePin: 'غيّر رقمه السري', backupNow: 'نسخة احتياطية', backupToDrive: 'نسخة احتياطية', restore: 'استرجاع نسخة' };

/* ============ النوافذ اللي بتطلع من تحت ============ */
function renderSheet() {
  var s = App.sheet;
  if (!s || !App.st) { $('sheet').innerHTML = ''; return; }
  var body = (SHEETS[s.type] || function () { return ''; })(s);
  $('sheet').innerHTML = '<div class="overlay" data-a="closeSheetBg"><div class="sheet" role="dialog" aria-modal="true">' + body + '</div></div>';
}
function sheetHead(title) { return '<div class="row"><h2>' + esc(title) + '</h2><button class="ibtn plain" data-a="closeSheet" aria-label="قفل" style="background:var(--bg)">' + IC.x + '</button></div>'; }
function openSheet(s) { App.sheet = s; renderSheet(); }
function closeSheet() { App.sheet = null; renderSheet(); if (App.pendingRender) render(); }

var SHEETS = {
  shopEdit: function (s) {
    var p = lastPrice(s.name, s.unit);
    return sheetHead(s.name) + '<div class="grid2" style="gap:12px"><div style="display:flex;flex-direction:column;gap:6px"><span class="sb" style="font-size:14px">الكمية</span><div class="stepper"><button data-a="shopEditQty" data-d="1" aria-label="زوّد">+</button><input id="seQty" type="text" autocomplete="off" placeholder="1 أو نص" value="' + esc(s.qty) + '" aria-label="الكمية"><button data-a="shopEditQty" data-d="-1" aria-label="قلّل">−</button></div></div>' +
      '<label class="f">الوحدة<select id="seUnit" class="inp">' + unitOpts(s.unit) + '</select></label></div>' +
      '<span class="xs muted">' + (p ? 'آخر سعر: ' + fmt(p) + ' ج لل' + esc(unitOf(s.unit)) + '، يعني حوالي ' + money(p * (parseQty(s.qty) || 1)) : 'لسه مالهاش سعر بالوحدة دي') + '</span>' +
      '<button class="btn full" data-a="shopEditSave">احفظ</button>';
  },
  ranout: function (s) {
    var open = {}; App.st.shopping.open.forEach(function (o) { open[o.name] = 1; });
    var opts = mergedCatalog().filter(function (c) { return !open[c.name]; }).slice(0, 18);
    var picked = s.picked || {};
    var cnt = Object.keys(picked).filter(function (k) { return picked[k]; }).length;
    return sheetHead('إيه اللي خلص؟') + '<span class="sm muted">اختار حاجة أو أكتر، هتظهر على طول في قايمة الشراء عند الكل.</span>' +
      '<div class="chips">' + opts.map(function (c, i) { return '<button class="chip' + (picked[c.name] ? ' on' : '') + '" data-a="pickRan" data-name="' + esc(c.name) + '">' + esc(c.name) + '</button>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:8px"><input id="ranOther" class="inp" placeholder="حاجة تانية؟ اكتبها"><button class="btn soft sm" data-a="ranOtherAdd">ضيف</button></div>' +
      '<button class="btn full" data-a="sendRan">ابعت (' + cnt + ')</button>';
  },
  contrib: function (s) {
    var m = App.st.admin.membersStatus.filter(function (x) { return x.id === s.id; })[0];
    if (!m) return sheetHead('') ;
    var inst = m.installments.map(function (c) {
      return '<div class="li"><div class="grow"><span class="sb">' + fmt(c.amount) + ' ج.م</span><span class="xs muted">' + dateLabel(c.date) + (c.note ? ' · ' + esc(c.note) : '') + '</span></div>' +
        (c.status === 'planned' ? '<button class="btn soft sm" data-a="contribReceived" data-id="' + c.id + '">وصلت</button>' : '<span class="pill g">وصلت</span>') +
        '<button class="x" data-a="contribDel" data-id="' + c.id + '" aria-label="امسح">' + IC.trash + '</button></div>';
    }).join('');
    var st2 = s.status || 'received';
    return sheetHead('مساهمة ' + m.name + ' · ' + monthOnly(App.st.month)) +
      '<div class="row sm"><span>دفع <b>' + fmt(m.received) + '</b> من ' + fmt(m.expected) + '</span>' + (m.left ? '<span class="pill o">فاضل ' + fmt(m.left) + '</span>' : '<span class="pill g">كمّل ✓</span>') + '</div>' +
      (inst ? '<div class="list">' + inst + '</div>' : '') +
      '<div class="seg"><button class="' + (st2 === 'received' ? 'on' : '') + '" data-a="contribMode" data-v="received">الفلوس وصلت</button><button class="' + (st2 === 'planned' ? 'on' : '') + '" data-a="contribMode" data-v="planned">هتوصل يوم...</button></div>' +
      '<div class="grid2" style="gap:10px"><label class="f">المبلغ<input id="cAmt" class="inp" type="number" inputmode="numeric" value="' + (m.left || '') + '"></label><label class="f">' + (st2 === 'planned' ? 'هتوصل يوم' : 'وصلت يوم') + '<input id="cDate" class="inp" type="date" value="' + (App.st.month === App.st.curMonth ? todayStr() : App.st.month + '-01') + '"></label></div>' +
      '<button class="btn full" data-a="contribSave" data-id="' + m.id + '">سجّل</button>';
  },
  settle: function (s) {
    var o = App.st.admin.owed.filter(function (x) { return x.id === s.id; })[0] || { amount: 0, name: memberName(s.id) };
    var mode = s.mode || 'cash';
    return sheetHead('نسدّد لـ' + o.name) + '<div class="sm">البيت عليه ليه <b>' + money(o.amount) + '</b></div>' +
      '<div class="seg"><button class="' + (mode === 'cash' ? 'on' : '') + '" data-a="settleMode" data-v="cash">رجّعناله كاش</button><button class="' + (mode === 'contribution' ? 'on' : '') + '" data-a="settleMode" data-v="contribution">تتحسب من مساهمته</button></div>' +
      '<span class="xs muted">' + (mode === 'cash' ? 'الفلوس هتطلع من كاش البيت.' : 'المبلغ هيتسجل كأنه دفعه كمساهمة الشهر ده، ومش هيطلع كاش.') + '</span>' +
      '<label class="f">المبلغ<input id="sAmt" class="inp" type="number" inputmode="numeric" value="' + Math.round(o.amount) + '"></label><button class="btn full" data-a="settleSave" data-id="' + s.id + '">تمام</button>';
  },
  purchase: function (s) {
    var st = App.st;
    var p = (st.admin ? st.admin.purchases : []).concat(st.myPurchases).filter(function (x) { return x.id === s.id; })[0];
    if (!p) return sheetHead('العملية مش موجودة');
    var can = st.isAdmin || p.createdBy === st.me.id;
    return sheetHead(dateLabel(p.date) + (p.store ? ' · ' + p.store : '')) +
      '<div class="list">' + p.items.map(function (i) { return '<div class="li"><div class="grow"><span>' + esc(i.name) + '</span><span class="xs muted">' + esc(catName(i.category)) + ' · ' + esc(qtyLabel(i.qty, i.unit)) + ' × ' + fmt(i.price) + '</span></div><span class="sb">' + fmt(i.cost) + '</span></div>'; }).join('') + '</div>' +
      '<div class="row"><span class="b">الإجمالي</span><span class="b">' + money(p.total) + '</span></div>' +
      '<div class="xs muted">سجّلها ' + esc(p.createdByName || '') + (p.paidByName ? ' · دفعها من جيبه ' + esc(p.paidByName) : ' · من فلوس البيت') + '</div>' +
      (can ? '<div class="grid2"><button class="btn soft sm" data-a="editPurchase" data-id="' + p.id + '">تعديل</button><button class="btn danger sm" data-a="confirm" data-msg="تمسح العملية دي؟" data-do="deletePurchase" data-id="' + p.id + '">مسح</button></div>' : '');
  },
  fundTx: function (s) {
    var f = App.st.admin.plan.funds.filter(function (x) { return x.id === s.id; })[0];
    if (!f) return sheetHead('');
    var dir = s.dir;
    return sheetHead((dir > 0 ? 'نحوّش لـ' : 'نسحب من ') + f.name) + '<div class="sm">فيها دلوقتي <b>' + money(f.saved) + '</b></div>' +
      '<span class="xs muted">' + (dir > 0 ? 'المبلغ هيتشال من باقي الشهر ويتحط على جنب.' : 'المبلغ هيرجع لفلوس البيت عشان تصرفوا منه (مثلاً لما رمضان ييجي).') + '</span>' +
      '<label class="f">المبلغ<input id="fAmt" class="inp" type="number" inputmode="numeric" value="' + (s.amt > 0 ? Math.round(s.amt) : (dir < 0 ? Math.round(f.saved) : '')) + '"></label><button class="btn full" data-a="fundTxSave" data-id="' + f.id + '" data-dir="' + dir + '">تمام</button>';
  },
  fund: function (s) {
    var f = s.id ? App.st.admin.plan.funds.filter(function (x) { return x.id === s.id; })[0] : null;
    var presets = [['رمضان', '2027-02-08', 3000], ['عيد الفطر', '2027-03-09', 2000], ['عيد الأضحى والأضحية', '2027-05-16', 8000], ['دخول المدارس', '2027-09-15', 5000], ['المصيف', '2027-07-15', 6000]];
    var pre = s.pre || {};
    return sheetHead(f ? 'تعديل التحويشة' : 'تحويشة جديدة') +
      (f ? '' : '<div class="chips">' + presets.map(function (p, i) { return '<button class="chip sm" data-a="fundPreset" data-i="' + i + '">' + p[0] + '</button>'; }).join('') + '</div><span class="xs muted">المواعيد تقريبية، عدّلها براحتك.</span>') +
      '<label class="f">الاسم<input id="fName" class="inp" value="' + esc(f ? f.name : (pre.name || '')) + '" placeholder="مثلاً: رمضان"></label>' +
      '<div class="grid2" style="gap:10px"><label class="f">محتاجين كام<input id="fTarget" class="inp" type="number" inputmode="numeric" value="' + esc(f ? f.target : (pre.target || '')) + '"></label><label class="f">إمتى<input id="fDue" class="inp" type="date" value="' + esc(f ? f.dueDate : (pre.due || '')) + '"></label></div>' +
      '<button class="btn full" data-a="fundSave" data-id="' + (f ? f.id : '') + '">احفظ</button>' + (f ? '<button class="btn danger sm" data-a="confirm" data-msg="تمسح التحويشة دي؟" data-do="deleteFund" data-id="' + f.id + '">مسح التحويشة</button>' : '') + '<span class="hide" id="fPresets">' + esc(JSON.stringify(presets)) + '</span>';
  },
  member: function (s) {
    var st = App.st, isO = st.me.role === 'owner';
    var m = s.id ? st.members.filter(function (x) { return x.id === s.id; })[0] : null;
    var custom = st.settings.contribMode === 'custom';
    if (!isO) {
      return sheetHead(m.name) + '<label class="f">مساهمته في الشهر<input id="mShare" class="inp" type="number" inputmode="numeric" value="' + esc(m.share) + '"></label><button class="btn full" data-a="memberSave" data-id="' + m.id + '">احفظ</button>';
    }
    var self = m && m.id === st.me.id;
    return sheetHead(m ? m.name : 'فرد جديد') +
      '<label class="f">الاسم<input id="mName" class="inp" value="' + esc(m ? m.name : '') + '"></label>' +
      (self ? '' : '<label class="f">الدور<select id="mRole" class="inp"><option value="member"' + (m && m.role === 'member' ? ' selected' : '') + '>عضو (شاشة بسيطة)</option><option value="admin"' + (m && m.role === 'admin' ? ' selected' : '') + '>أدمن (تحكم كامل)</option>' + (m ? '<option value="owner">المالك (هتتنقل له الملكية وانت تبقى أدمن)</option>' : '') + '</select></label>') +
      (custom || !m ? '<label class="f">مساهمته في الشهر<input id="mShare" class="inp" type="number" inputmode="numeric" value="' + esc(m ? m.share : st.settings.defaultShare) + '"></label>' : '') +
      '<label class="f">' + (m ? 'رقم سري جديد (سيبه فاضي لو مش هتغيّره)' : 'الرقم السري') + '<input id="mPin" class="inp" inputmode="numeric" maxlength="6" value="' + (m ? '' : rndPin()) + '"></label>' +
      '<button class="btn full" data-a="memberSave" data-id="' + (m ? m.id : '') + '">احفظ</button>' +
      (m && !self ? '<button class="btn danger sm" data-a="confirm" data-msg="تشيل ' + esc(m.name) + ' من البيت؟ حساباته القديمة هتفضل محفوظة." data-do="removeMember" data-id="' + m.id + '">شيله من البيت</button>' : '');
  },
  cat: function (s) {
    var c = s.id ? App.st.categories.filter(function (x) { return x.id === s.id; })[0] : null;
    var kind = s.kind || (c ? c.kind : 'essential');
    var colors = ['#1E5B43', '#3F7D63', '#6E9E89', '#9DBDAF', '#D9894A', '#9A4A0B', '#1D3F63', '#7A8F86'];
    var color = s.color || (c ? c.color : colors[7]);
    return sheetHead(c ? 'تعديل التصنيف' : 'تصنيف جديد') + '<label class="f">الاسم<input id="kName" class="inp" value="' + esc(c ? c.name : (s.name || '')) + '"></label>' +
      '<div class="seg"><button class="' + (kind === 'essential' ? 'on' : '') + '" data-a="catKind" data-v="essential">أساسي</button><button class="' + (kind === 'flex' ? 'on' : '') + '" data-a="catKind" data-v="flex">كماليات</button></div>' +
      '<label class="f">ميزانية الشهر (اختياري)<input id="kBudget" class="inp" type="number" inputmode="numeric" value="' + esc(c && c.budget ? c.budget : '') + '"></label>' +
      '<div class="chips">' + colors.map(function (k) { return '<button class="ibtn" data-a="catColor" data-v="' + k + '" aria-label="لون" style="background:' + k + ';' + (k === color ? 'outline:3px solid var(--ink);outline-offset:2px' : '') + '"></button>'; }).join('') + '</div>' +
      '<button class="btn full" data-a="catSave" data-id="' + (c ? c.id : '') + '">احفظ</button>' + (c ? '<button class="btn danger sm" data-a="confirm" data-msg="تمسح التصنيف ده؟ الحاجات اللي فيه هتتنقل لمتفرقات." data-do="deleteCategory" data-id="' + c.id + '">مسح التصنيف</button>' : '');
  },
  pin: function () {
    return sheetHead('غيّر الرقم السري') + '<label class="f">الرقم القديم<input id="pOld" class="inp pin" type="password" inputmode="numeric" maxlength="6"></label><label class="f">الرقم الجديد (4 لـ 6 أرقام)<input id="pNew" class="inp pin" type="password" inputmode="numeric" maxlength="6"></label><button class="btn full" data-a="pinSave">غيّر</button>';
  },
  paste: function (s) {
    return sheetHead('لصق قائمة') +
      '<span class="sm muted">صوّر الفاتورة وابعتها لأي AI مع البرومبت، والصق الرد هنا.</span>' +
      '<button class="btn soft sm" data-a="copyPrompt">نسخ البرومبت</button>' +
      '<details><summary class="xs muted" style="cursor:pointer">عرض البرومبت (لو النسخ ما اشتغلش)</summary><textarea id="promptBox" class="inp paste-ta" readonly style="margin-top:8px;min-height:140px;white-space:pre-wrap">' + esc(buildPrompt()) + '</textarea></details>' +
      '<label class="f">الصق التكست هنا<textarea id="pasteText" class="inp paste-ta" placeholder="كارفور | 2026-11-20 | 236&#10;لبن جهينة | 2 | لتر | 38 | 76 | أكل وشرب&#10;بيض 30 | 1 | كرتونة | 160 | 160 | أكل وشرب">' + esc(s.text || '') + '</textarea></label>' +
      '<button class="btn full" data-a="pasteParse">تحليل</button>';
  },
  confirm: function (s) {
    return sheetHead('متأكد؟') + '<div>' + esc(s.msg) + '</div><div class="grid2"><button class="btn soft" data-a="closeSheet">لأ</button><button class="btn danger" data-a="confirmYes">أيوه</button></div>';
  },
  restore: function (s) {
    var t = s.backup.tables || {};
    return sheetHead('استرجاع نسخة') + '<div class="sm">النسخة دي من <b>' + esc((s.backup.exportedAt || '').slice(0, 10)) + '</b> فيها ' + (t.Purchases || []).length + ' عملية شرا و' + (t.Members || []).length + ' أفراد.</div>' +
      '<div class="alert sm">كل البيانات الحالية هتتبدل بالنسخة دي. هنحفظ نسخة من الحالي جوه الشيت الأول للأمان.</div>' +
      '<div class="grid2"><button class="btn soft" data-a="closeSheet">إلغاء</button><button class="btn danger" data-a="restoreYes">استرجع</button></div>';
  }
};

/* ============ الأفعال ============ */
var A = {
  reload: function () { location.reload(); },
  go: function (d) { App.view = d.v; if (d.v === 'home') App.backView = null; App.sheet = null; render(true); window.scrollTo(0, 0); },
  closeSheet: closeSheet,
  closeSheetBg: function (d, el, e) { if (e.target === el) closeSheet(); },
  logout: function () { logout(); },

  pickLogin: function (d) { App.loginId = d.id; render(true); setTimeout(function () { var p = $('pin'); if (p) p.focus(); }, 50); },
  login: function () {
    var pin = val('pin');
    if (!pin) return toast('اكتب الرقم السري', true);
    call('login', { memberId: App.loginId, pin: pin }, { label: 'بندخّلك...' }).then(function (r) {
      App.token = r.token; LS.set('hb_token', r.token); LS.set('hb_last', App.loginId);
      return call('sync', {}, { label: 'بنجيب البيانات...' });
    }).then(function (r) { App.st = r.state; App.view = 'home'; render(true); startPoll(); }).catch(fail);
  },
  setupAdd: function () { App.setup.members.push({ name: '', pin: rndPin() }); render(true); },
  setupDel: function (d) { App.setup.members.splice(+d.i, 1); render(true); },
  setupSave: function () {
    var s = App.setup;
    if (!s.ownerName.trim()) return toast('اكتب اسمك', true);
    if (!/^\d{4,6}$/.test(s.pin)) return toast('الرقم السري لازم 4 لـ 6 أرقام', true);
    call('setupHousehold', s, { label: 'بنجهّز البيت...' }).then(function (r) {
      App.token = r.token; LS.set('hb_token', r.token);
      return call('sync', {});
    }).then(function (r) { App.st = r.state; App.setup = null; render(true); startPoll(); toast('البيت جاهز 🎉'); }).catch(fail);
  },

  pickMonthCur: function () { App.month = null; call('sync', { viewMonth: App.st.curMonth }).then(function (r) { App.st = r.state; render(true); }).catch(fail); },

  /* قايمة الشراء */
  ranOut: function () { openSheet({ type: 'ranout', picked: {} }); },
  pickRan: function (d) { var p = App.sheet.picked; p[d.name] = !p[d.name]; renderSheet(); },
  ranOtherAdd: function () { var v = val('ranOther').trim(); if (!v) return; App.sheet.picked[v] = true; renderSheet(); },
  sendRan: function () {
    var other = val('ranOther').trim(); if (other) App.sheet.picked[other] = true;
    var names = Object.keys(App.sheet.picked).filter(function (k) { return App.sheet.picked[k]; });
    if (!names.length) return toast('اختار حاجة الأول', true);
    App.sheet = null; renderSheet();
    act('addShopping', { items: names.map(function (nm) { return { name: nm, unit: defUnit(nm) }; }) }, 'اتضافت لقايمة الشراء، والكل هيشوفها. تقدر تعدّل الكمية من القايمة', 'بنبعت...').catch(function () { });
  },
  addShop: function () {
    var v = val('shopInput').trim(); if (!v) return toast('اكتب اسم الحاجة', true);
    var q = parseQty(val('shopQty')) || 1, u = val('shopUnit') || defUnit(v);
    act('addShopping', { items: [{ name: v, qty: q, unit: u }] }, 'اتضافت: ' + v + ' ' + qtyLabel(q, u)).catch(function () { });
  },
  addShopName: function (d) { act('addShopping', { items: [{ name: d.name, unit: defUnit(d.name) }] }, 'اتضافت').catch(function () { }); },
  editShop: function (d) {
    var s = App.st.shopping.open.filter(function (x) { return x.id === d.id; })[0]; if (!s) return;
    openSheet({ type: 'shopEdit', id: s.id, name: s.name, qty: fmtQty(s.qty), unit: unitOf(s.unit) });
  },
  shopEditQty: function (d) {
    var s = App.sheet; s.unit = val('seUnit') || s.unit; s.qty = val('seQty') || s.qty;
    var step = unitOf(s.unit) === 'كيلو' ? 0.25 : 1;
    s.qty = fmtQty(Math.max(step, (parseQty(s.qty) || 1) + n(d.d) * step)); renderSheet();
  },
  shopEditSave: function () {
    var s = App.sheet; var q = parseQty(val('seQty')) || 1, u = val('seUnit') || s.unit;
    App.sheet = null; renderSheet();
    act('updateShopping', { id: s.id, name: s.name, qty: q, unit: u }, 'اتعدّلت').catch(function () { });
  },
  selShop: function (d) { App.selShop[d.id] = !App.selShop[d.id]; render(true); },
  delShop: function (d) { delete App.selShop[d.id]; act('deleteShopping', { id: d.id }).catch(function () { }); },
  undoShop: function (d) { act('toggleShopping', { id: d.id }).catch(function () { }); },
  markSelected: function () {
    var ids = Object.keys(App.selShop).filter(function (k) { return App.selShop[k]; });
    App.selShop = {};
    ids.reduce(function (p, id) { return p.then(function () { return call('toggleShopping', { id: id }, { silent: true }); }); }, Promise.resolve())
      .then(function () { toast('تمام'); render(true); }).catch(fail);
  },
  buySelected: function () {
    var st = App.st, ids = Object.keys(App.selShop).filter(function (k) { return App.selShop[k]; });
    var cat = mergedCatalog();
    var items = st.shopping.open.filter(function (s) { return ids.indexOf(s.id) >= 0; }).map(function (s) {
      var c = cat.filter(function (x) { return x.name === s.name; })[0];
      var u = unitOf(s.unit), pr = s.price || lastPrice(s.name, u);
      return { name: s.name, qty: fmtQty(s.qty), unit: u, price: pr ? String(pr) : '', category: (c && c.category) || s.category || guessCat(s.name) };
    });
    App.selShop = {};
    App.draft = newDraft({ items: items, shoppingIds: ids, msg: 'راجع الكمية والسعر اللي اشتريت بيه فعلاً (لو السعر اتغيّر عدّله)، وبعدين دوس سجّل', msgOk: true });
    App.backView = 'list'; App.view = 'add'; render(true); window.scrollTo(0, 0);
  },

  /* المشتريات */
  newPurchase: function () { App.draft = newDraft(); App.backView = App.view === 'add' ? 'home' : App.view; App.view = 'add'; render(true); window.scrollTo(0, 0); },
  quickAdd: function (d) {
    var q = mergedCatalog()[+d.i]; if (!q) return;
    var u = defUnit(q.name), pr = lastPrice(q.name, u);
    App.draft.items.push({ name: q.name, qty: '1', unit: u, price: pr ? String(pr) : '', category: q.category });
    App.draft.msg = ''; render(true);
    if (!pr) toast('اتضافت، اكتب سعرها في الفاتورة فوق');
  },
  qty: function (d) {
    var c = App.draft.cur; c.unit = val('curUnit') || c.unit;
    var step = unitOf(c.unit) === 'كيلو' ? 0.25 : 1;
    c.qty = fmtQty(Math.max(step, (parseQty(val('curQty') || c.qty) || 1) + n(d.d) * step)); $('curQty').value = c.qty; refreshTotal();
  },
  pickCat: function (d) { syncCur(); App.draft.cur.category = d.id; render(true); },
  addLine: function () {
    syncCur();
    var c = App.draft.cur;
    if (!c.name.trim()) return toast('اكتب اسم الحاجة', true);
    App.draft.items.push({ name: c.name.trim(), qty: c.qty || '1', unit: unitOf(c.unit), price: c.price, category: c.category || guessCat(c.name) });
    App.draft.cur = { name: '', qty: '1', unit: 'عدد', price: '', category: '' }; App.draft.msg = '';
    render(true);
  },
  delLine: function (d) { App.draft.items.splice(+d.i, 1); render(true); },
  paidBy: function (d) { App.draft.paidBy = d.id; render(true); },
  savePurchase: function () {
    syncCur();
    var d = App.draft, items = d.items.slice();
    if (d.cur.name.trim()) items.push({ name: d.cur.name.trim(), qty: d.cur.qty || '1', unit: unitOf(d.cur.unit), price: d.cur.price, category: d.cur.category || guessCat(d.cur.name) });
    items = items.filter(function (i) { return String(i.name).trim(); });
    if (!items.length) return toast('ضيف حاجة واحدة على الأقل', true);
    var noPrice = items.filter(function (i) { return !n(i.price); });
    if (noPrice.length) return toast('في حاجات من غير سعر: ' + noPrice.map(function (i) { return i.name; }).join('، '), true);
    var payload = { id: d.id, date: d.date, store: d.store, paidBy: d.paidBy, shoppingIds: d.shoppingIds, note: d.note,
      items: items.map(function (i) { return { name: i.name, qty: parseQty(i.qty) || 1, unit: i.unit || '', price: n(i.price), category: i.category }; }) };
    call(d.id ? 'updatePurchase' : 'addPurchase', payload, { label: 'بنسجّل...' }).then(function () {
      App.draft = null; App.view = App.backView && App.backView !== 'add' ? App.backView : 'home'; App.backView = null;
      render(true); window.scrollTo(0, 0);
      toast('اتسجل. الباقي في البيت ' + money(App.st.summary.remaining));
    }).catch(fail);
  },
  openPurchase: function (d) { openSheet({ type: 'purchase', id: d.id }); },
  editPurchase: function (d) {
    var st = App.st;
    var p = (st.admin ? st.admin.purchases : []).concat(st.myPurchases).filter(function (x) { return x.id === d.id; })[0];
    if (!p) return;
    App.sheet = null;
    App.draft = newDraft({ id: p.id, date: p.date, store: p.store, paidBy: p.paidBy, note: p.note,
      items: p.items.map(function (i) { return { name: i.name, qty: String(i.qty), unit: i.unit || '', price: String(i.price), category: i.category }; }) });
    App.backView = App.view; App.view = 'add'; render(true); window.scrollTo(0, 0);
  },

  pasteOpen: function () { openSheet({ type: 'paste', text: '' }); setTimeout(function () { var t = $('pasteText'); if (t) t.focus(); }, 80); },
  copyPrompt: function () {
    var txt = buildPrompt();
    var done = function () { toast('البرومبت اتنسخ، ابعته مع صورة الفاتورة'); };
    var fallback = function () {
      var box = $('promptBox'); if (!box) return;
      box.closest('details').open = true; box.focus(); box.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { }
      if (ok) done(); else toast('اضغط مطوّل على البرومبت واختار نسخ', true);
    };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(done, fallback); return; } } catch (e) { }
    fallback();
  },
  pasteParse: function () {
    var text = val('pasteText');
    if (!text.trim()) return toast('الصق التكست الأول', true);
    var r = parsePasted(text, App.st.categories);
    if (!r.items.length) { App.sheet.text = text; return toast('ما لقيتش أصناف. اتأكد إن كل صنف في سطر والخانات مفصولة بـ |', true); }
    var d = App.draft || (App.draft = newDraft());
    if (r.store) d.store = r.store;
    if (r.date) d.date = r.date;
    d.pasteTotal = r.total || 0;
    r.items.forEach(function (i) { d.items.push(i); });
    d.msgOk = true;
    d.msg = 'لقيت ' + r.items.length + ' أصناف' + (r.skipped ? ' (وسبت ' + r.skipped + ' سطر مش مفهوم)' : '') + '. راجعهم وعدّل أي حاجة قبل ما تحفظ.';
    App.sheet = null; render(true); window.scrollTo(0, 0);
  },
  addEmptyLine: function () { App.draft.items.push({ name: '', qty: '1', unit: 'عدد', price: '', category: App.st.categories[0].id }); render(true); },

  /* المساهمات */
  contribSheet: function (d) { openSheet({ type: 'contrib', id: d.id, status: 'received' }); },
  contribMode: function (d) { App.sheet.status = d.v; var amt = val('cAmt'); renderSheet(); if (amt) $('cAmt').value = amt; },
  contribSave: function (d) {
    var amt = n(val('cAmt')); if (amt <= 0) return toast('اكتب المبلغ', true);
    var date = val('cDate') || todayStr();
    act('addContribution', { memberId: d.id, amount: amt, date: date, month: App.st.month, status: App.sheet.status }, App.sheet.status === 'planned' ? 'اتسجلت كدفعة جاية' : 'اتسجلت').then(function () { renderSheet(); }).catch(function () { });
  },
  contribReceived: function (d) { act('updateContribution', { id: d.id, status: 'received', date: todayStr() }, 'تمام، وصلت').then(renderSheet).catch(function () { }); },
  contribDel: function (d) { act('deleteContribution', { id: d.id }, 'اتمسحت').then(renderSheet).catch(function () { }); },
  settleSheet: function (d) { openSheet({ type: 'settle', id: d.id, mode: 'cash' }); },
  settleMode: function (d) { App.sheet.mode = d.v; renderSheet(); },
  settleSave: function (d) {
    var amt = n(val('sAmt')); if (amt <= 0) return toast('اكتب المبلغ', true);
    var mode = App.sheet.mode; App.sheet = null;
    act('settle', { memberId: d.id, amount: amt, mode: mode }, 'اتسدّد').catch(function () { });
  },

  /* المراحل */
  setPhase: function (d) { act('saveSettings', { phase: +d.v }, 'المرحلة ' + d.v).catch(function () { }); },
  applyShare: function (d) { act('saveSettings', { defaultShare: +d.v }, 'مساهمة الفرد بقت ' + fmt(d.v)).catch(function () { }); },
  saveBudgets: function () {
    var b = {}; App.st.categories.forEach(function (c) { var e = $('bud_' + c.id); if (e) b[c.id] = n(e.value); });
    act('applyBudgets', { budgets: b }, 'الميزانيات اتحفظت').catch(function () { });
  },
  efSave: function (d) {
    var P = App.st.admin.plan, amt = n(d.v) || P.emergency.monthly;
    if (!amt) return toast('لسه مش عارفين مصروف الشهر، استنى أسبوع تسجيل', true);
    var p = P.emergency.fundId ? Promise.resolve({ id: P.emergency.fundId }) : call('saveFund', { name: 'فلوس الطوارئ', type: 'emergency', target: P.emergency.target });
    p.then(function (r) { openSheet({ type: 'fundTx', id: r.id, dir: 1, amt: amt }); render(true); }).catch(fail);
  },
  fundSheet: function (d) { openSheet({ type: 'fund', id: d.id || '' }); },
  fundPreset: function (d) {
    var p = JSON.parse($('fPresets').textContent)[+d.i];
    $('fName').value = p[0]; $('fDue').value = p[1]; if (!$('fTarget').value) $('fTarget').value = p[2];
  },
  fundSave: function (d) {
    var name = val('fName').trim(); if (!name) return toast('اكتب اسم التحويشة', true);
    App.sheet = null;
    act('saveFund', { id: d.id, name: name, target: n(val('fTarget')), dueDate: val('fDue'), type: 'season' }, 'اتحفظت').catch(function () { });
  },
  fundTxSheet: function (d) { openSheet({ type: 'fundTx', id: d.id, dir: +d.dir, amt: n(d.amt) }); },
  fundTxSave: function (d) {
    var amt = n(val('fAmt')); if (amt <= 0) return toast('اكتب المبلغ', true);
    App.sheet = null;
    act('fundTx', { fundId: d.id, amount: amt * (+d.dir) }, +d.dir > 0 ? 'اتحوّش' : 'رجع لفلوس البيت').catch(function () { });
  },

  /* الإعدادات */
  pinSheet: function () { openSheet({ type: 'pin' }); },
  pinSave: function () {
    call('changePin', { oldPin: val('pOld'), newPin: val('pNew') }, { label: 'بنغيّر...' }).then(function (r) {
      App.token = r.token; LS.set('hb_token', r.token); App.sheet = null; render(true); toast('الرقم السري اتغيّر');
    }).catch(fail);
  },
  setMode: function (d) { act('saveSettings', { contribMode: d.v }, d.v === 'equal' ? 'المساهمات بقت متساوية' : 'كل فرد ليه مبلغ، حدده من أفراد البيت').catch(function () { }); },
  saveHouse: function () {
    var p = { householdName: val('setHouse').trim() };
    if ($('setShare')) p.defaultShare = n(val('setShare'));
    act('saveSettings', p, 'اتحفظ').catch(function () { });
  },
  toggleInsights: function () { act('saveSettings', { insightsForAdmins: !App.st.settings.insightsForAdmins }, !App.st.settings.insightsForAdmins ? 'الأدمنز هيشوفوا التحليلات' : 'التحليلات بقت ليك انت بس').catch(function () { }); },
  memberSheet: function (d) { openSheet({ type: 'member', id: d.id || '' }); },
  memberSave: function (d) {
    var p = { id: d.id };
    if ($('mName')) p.name = val('mName').trim();
    if ($('mRole')) p.role = val('mRole');
    if ($('mShare')) p.share = n(val('mShare'));
    if ($('mPin') && val('mPin')) p.pin = val('mPin');
    if (!d.id && !p.name) return toast('اكتب الاسم', true);
    var pin = p.pin;
    App.sheet = null;
    act('saveMember', p, d.id ? 'اتحفظ' : ('اتضاف. الرقم السري بتاعه: ' + pin)).catch(function () { });
  },
  catSheet: function (d) { openSheet({ type: 'cat', id: d.id || '' }); },
  catKind: function (d) { App.sheet.kind = d.v; keepInputs(['kName', 'kBudget'], renderSheet); },
  catColor: function (d) { App.sheet.color = d.v; keepInputs(['kName', 'kBudget'], renderSheet); },
  catSave: function (d) {
    var s = App.sheet, c = d.id ? App.st.categories.filter(function (x) { return x.id === d.id; })[0] : null;
    var p = { id: d.id, name: val('kName').trim(), kind: s.kind || (c ? c.kind : 'essential'), budget: n(val('kBudget')), color: s.color || (c ? c.color : '') };
    if (!p.name) return toast('اكتب الاسم', true);
    App.sheet = null;
    act('saveCategory', p, 'اتحفظ').catch(function () { });
  },
  backupNow: function () { act('backupNow', {}, 'اتحفظت كتابة Backup جوه الشيت', 'بنحفظ...').catch(function () { }); },
  exportJson: function () {
    call('exportData', {}, { label: 'بنجهّز الملف...' }).then(function (data) {
      var name = 'house-budget-' + todayStr() + '.json';
      deliverFile(new Blob([JSON.stringify(data)], { type: 'application/json' }), name);
    }).catch(fail);
  },
  exportXlsx: function () {
    var data;
    call('exportData', {}, { label: 'بنجهّز الملف...' }).then(function (d) { data = d; return loadXlsx(); }).then(function () {
      var wb = XLSX.utils.book_new();
      var nameOf = {}; data.tables.Members.forEach(function (m) { nameOf[m.id] = m.name; });
      var catOf = {}; data.tables.Categories.forEach(function (c) { catOf[c.id] = c.name; });
      var friendly = data.tables.Items.map(function (i) { return { 'التاريخ': i.date, 'الحاجة': i.name, 'التصنيف': catOf[i.category] || i.category, 'الكمية': i.qty, 'سعر الواحدة': i.price, 'الإجمالي': i.cost }; });
      var contrib = data.tables.Contributions.map(function (c) { return { 'التاريخ': c.date, 'الشهر': c.month, 'الفرد': nameOf[c.memberId] || '', 'المبلغ': c.amount, 'الحالة': c.status === 'planned' ? 'جاية' : 'وصلت', 'ملاحظة': c.note }; });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(friendly.length ? friendly : [{}]), 'المشتريات');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contrib.length ? contrib : [{}]), 'المساهمات');
      Object.keys(data.tables).forEach(function (t) {
        var rows = data.tables[t].map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; if (t === 'Members') delete o.pinHash; return o; });
        XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([[]]), t);
      });
      var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      deliverFile(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'house-budget-' + todayStr() + '.xlsx');
    }).catch(fail);
  },
  restorePick: function () { $('restoreInput').value = ''; $('restoreInput').click(); },
  restoreYes: function () {
    var b = App.sheet.backup; App.sheet = null;
    call('restore', { backup: b }, { label: 'بنسترجع...' }).then(function (r) {
      if (r.relogin) { toast('اترجعت. ادخل تاني'); logout(); return; }
      render(true); toast('النسخة اترجعت');
    }).catch(fail);
  },

  confirm: function (d) { openSheet({ type: 'confirm', msg: d.msg, act: d['do'], id: d.id }); },
  confirmYes: function () {
    var s = App.sheet; App.sheet = null;
    var map = {
      deletePurchase: ['deletePurchase', { id: s.id }, 'اتمسحت'],
      deleteFund: ['deleteFund', { id: s.id }, 'اتمسحت'],
      deleteCategory: ['deleteCategory', { id: s.id }, 'اتمسح'],
      removeMember: ['saveMember', { id: s.id, active: false }, 'اتشال']
    }[s.act];
    if (s.act === 'markShopOnly') { renderSheet(); return A.markSelected(); }
    if (map) act(map[0], map[1], map[2]).catch(function () { });
    else renderSheet();
  }
};

function keepInputs(ids, fn) { var v = {}; ids.forEach(function (i) { v[i] = val(i); }); fn(); ids.forEach(function (i) { if ($(i)) $(i).value = v[i]; }); }
function syncCur() {
  var c = App.draft && App.draft.cur; if (!c) return;
  if ($('curName')) c.name = $('curName').value;
  if ($('curQty')) c.qty = $('curQty').value;
  if ($('curPrice')) c.price = $('curPrice').value;
  if ($('curUnit')) c.unit = $('curUnit').value;
  if (c.name && !c.category) c.category = guessCat(c.name);
}
function curAutoPrice() {
  var c = App.draft.cur, p = lastPrice(c.name, c.unit);
  if (!n(c.price) || c.price === c.autoPrice) { c.price = p ? String(p) : ''; c.autoPrice = c.price; if ($('curPrice')) $('curPrice').value = c.price; }
  if ($('curPriceLbl')) $('curPriceLbl').textContent = priceLbl(c.unit);
  if ($('curHint')) $('curHint').textContent = curHint();
  refreshTotal();
}
function refreshTotal() { var e = $('draftTotal'); if (e) e.textContent = money(draftTotal()); var c = $('pasteCheck'); if (c) c.innerHTML = pasteCheckHtml(); }

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  var f = A[el.getAttribute('data-a')];
  if (f) { e.preventDefault(); f(el.dataset, el, e); }
});
document.addEventListener('input', function (e) {
  var el = e.target, b = el.getAttribute && el.getAttribute('data-bind');
  if (b) {
    setPath(App, b, el.value);
    if (App.view === 'add') refreshTotal();
  }
});
document.addEventListener('change', function (e) {
  var el = e.target;
  if (el.id === 'monthSel') {
    App.month = el.value;
    el.blur();
    call('sync', { viewMonth: el.value }, { label: 'بنجيب ' + monthName(el.value) }).then(function (r) { App.st = r.state; render(true); }).catch(fail);
    return;
  }
  if (el.getAttribute('data-rerender')) { el.blur(); render(true); }
  if (el.id === 'curName' && App.draft) {
    var c = guessCat(el.value), cur = App.draft.cur; cur.category = c;
    document.querySelectorAll('[data-a="pickCat"]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-id') === c); });
    if (catEntry(el.value)) { cur.unit = defUnit(el.value); if ($('curUnit')) $('curUnit').value = cur.unit; }
    curAutoPrice();
  }
  if (el.id === 'curUnit' && App.draft) { App.draft.cur.unit = el.value; curAutoPrice(); }
  if (el.hasAttribute('data-line') && App.draft) {
    var it = App.draft.items[+el.getAttribute('data-line')];
    if (it) { var pr = lastPrice(it.name, it.unit); if (pr && (!n(it.price) || it.autoPrice === it.price)) { it.price = String(pr); it.autoPrice = it.price; render(true); } }
  }
  if (el.id === 'shopInput' && $('shopUnit') && (catEntry(el.value) || DEF_UNITS[el.value.trim()])) $('shopUnit').value = defUnit(el.value);
  if (el.id === 'seUnit' && App.sheet) { App.sheet.unit = el.value; App.sheet.qty = val('seQty') || App.sheet.qty; renderSheet(); }
});
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var id = e.target.id;
  if (id === 'pin') A.login();
  if (id === 'shopInput') { e.preventDefault(); var q = $('shopQty'); if (q) { q.focus(); q.select(); } }
  if (id === 'shopQty') A.addShop();
  if (id === 'ranOther') A.ranOtherAdd();
});

/* ============ لصق قائمة: التحليل في المتصفح ============ */
function buildPrompt() {
  var cats = App.st.categories.map(function (c) { return c.name; });
  return [
    'طلّع من صورة الفاتورة دي كل الأصناف، واكتبها بالفورمات ده بالظبط، من غير أي كلام قبلها أو بعدها، ومن غير جداول أو علامات تنسيق:',
    '',
    'السطر الأول: المحل | التاريخ | الإجمالي',
    'وبعده سطر لكل صنف: الاسم | الكمية | الوحدة | سعر الوحدة | الإجمالي | القسم',
    '',
    'القواعد:',
    '- افصل بين الخانات بعلامة | بس.',
    '- التاريخ بالشكل ده: 2026-11-20. لو مش موجود سيب الخانة فاضية.',
    '- الأرقام بالإنجليزي (0-9) من غير "ج" أو "جنيه" ومن غير فواصل الآلاف.',
    '- الاسم: اسم قصير بالعربي زي ما بنقوله في البيت (مثلاً: لبن جهينة 1 لتر، بيض 30، عيش). ترجم الأسماء الإنجليزي.',
    '- الكمية: عدد القطع، أو الوزن بالكيلو لو بيتباع بالوزن (مثلاً 1.5).',
    '- الوحدة: زي قطعة، كيلو، لتر، كرتونة. لو مش واضحة سيبها فاضية.',
    '- الإجمالي: اللي اتدفع في السطر ده بعد أي خصم عليه.',
    '- القسم لازم يكون واحد من دول بالظبط: ' + cats.join('، '),
    '- ماتكتبش سطور الضريبة أو التوصيل أو الإجمالي أو طريقة الدفع كأصناف.',
    '- لو أي خانة مش واضحة سيبها فاضية بس خلّي علامات | زي ما هي.',
    '',
    'مثال:',
    'كارفور | 2026-11-20 | 236',
    'لبن جهينة 1 لتر | 2 | لتر | 38 | 76 | ' + (cats[0] || ''),
    'بيض 30 | 1 | كرتونة | 160 | 160 | ' + (cats[0] || '')
  ].join('\n');
}
function normDigits(t) {
  return String(t || '')
    .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x660); })
    .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x6F0); })
    .replace(/٫/g, '.').replace(/٬/g, ',');
}
function parseNum(v) {
  var CUR = '(?:جنيه(?:ات)?|جنية|ج\\s*\\.?\\s*م\\.?|ج\\.?|EGP|L\\.?E\\.?)';
  var t = normDigits(v).replace(/[ ‏‎]/g, ' ').trim()
    .replace(new RegExp('^' + CUR + '\\s*(?=[\\d.,-])', 'i'), '')
    .replace(new RegExp('([\\d.,])\\s*' + CUR + '$', 'i'), '$1')
    .replace(/\s+/g, '');
  if (!t) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  var x = parseFloat(t); return isFinite(x) ? x : null;
}
function parseDate(v) {
  var t = normDigits(v).trim(), m;
  if ((m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))) return ymd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return '';
  function ymd(y, mo, d) { if (mo < 1 || mo > 12 || d < 1 || d > 31) return ''; return y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2); }
}
function normKey(t) {
  return String(t || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/^ال(?=\S{3,})/, '').replace(/[()،,.\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function matchCat(name, cats, itemName) {
  if (!String(name || '').trim()) return guessCat(itemName);
  var k = normKey(name);
  var hit = cats.filter(function (c) { return normKey(c.name) === k || c.id === name; })[0]
    || cats.filter(function (c) { var ck = normKey(c.name); return ck.indexOf(k) >= 0 || k.indexOf(ck) >= 0; })[0];
  if (hit) return hit.id;
  var kw = [[/اكل|طعام|بقال|شرب|مشروب|خضار|فاكه|لحوم|البان|مخبوز/, 'food'], [/منظف|نظاف|ادوات|منزل|بيت/, 'clean'], [/فاتور|كهرب|غاز|ميه|مياه/, 'bills'], [/حلو|سناك|تسالي/, 'snacks']];
  for (var i = 0; i < kw.length; i++) if (kw[i][0].test(k) && cats.some(function (c) { return c.id === kw[i][1]; })) return kw[i][1];
  // أقرب قسم بالحروف المشتركة
  var grams = function (t) { var g = {}; t = t.replace(/\s/g, ''); for (var j = 0; j < t.length - 1; j++) g[t.substr(j, 2)] = 1; return g; };
  var a = grams(k), best = null, bestScore = 0;
  cats.forEach(function (c) {
    var b = grams(normKey(c.name)), inter = 0, tot = 0, x;
    for (x in a) { tot++; if (b[x]) inter++; } for (x in b) if (!a[x]) tot++;
    var sc = tot ? inter / tot : 0; if (sc > bestScore) { bestScore = sc; best = c; }
  });
  if (best && bestScore >= 0.25) return best.id;
  var other = cats.filter(function (c) { return /اخر|متفرق/.test(normKey(c.name)) || c.id === 'misc'; })[0];
  return other ? other.id : cats[cats.length - 1].id;
}
function parsePasted(text, cats) {
  var out = { store: '', date: '', total: 0, items: [], skipped: 0 };
  var lines = normDigits(text).replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); })
    .filter(function (l) { return l && !/^[\s|:\-–—=+*`_]+$/.test(l) && !/^```/.test(l); });
  var split = function (l) {
    var t = l.replace(/^[-*•·]\s+/, '').replace(/^\d+[.)]\s+/, '');
    var parts = /[|｜¦]/.test(t) ? t.split(/\s*[|｜¦]\s*/) : (/\t/.test(t) ? t.split(/\t/) : t.split(/\s*[;؛]\s*/));
    if (/^[|｜¦]/.test(t.trim())) parts.shift();
    if (/[|｜¦]$/.test(t.trim())) parts.pop();
    return parts.map(function (x) { return x.replace(/\*\*/g, '').trim(); });
  };
  lines.forEach(function (l, idx) {
    var f = split(l);
    if (!f[0]) { out.skipped++; return; }
    // سطر عناوين الأعمدة
    if (/الاسم|الصنف/.test(f[0]) && f.some(function (x) { return /الكمي|السعر|الاجمالي|الإجمالي/.test(x); })) return;
    if (/^المحل/.test(f[0]) && f.length <= 3 && !parseDate(f[1] || '')) return;
    // السطر الأول: المحل | التاريخ | الإجمالي
    if (!out.items.length && !out.store && !out.date && f.length <= 3 && (parseDate(f[1] || '') || !f[1])) {
      out.store = f[0].replace(/^المحل\s*[:：]\s*/, '');
      out.date = parseDate(f[1] || '');
      out.total = parseNum(f[2] || '') || 0;
      return;
    }
    // سطر إجمالي في الآخر
    if (/^(ال)?(اجمالي|إجمالي|المجموع|total)/i.test(f[0]) && f.length <= 3) { var tv = parseNum(f[f.length - 1]); if (tv) out.total = tv; return; }
    var name = f[0], qty = null, unit = '', price = null, total = null, cat = '';
    if (f.length >= 5) {
      qty = parseNum(f[1]); unit = parseNum(f[2]) === null ? f[2] : ''; price = parseNum(f[3]); total = parseNum(f[4]); cat = f[5] || '';
    } else {
      var nums = [], texts = [];
      f.slice(1).forEach(function (x) { var v = parseNum(x); if (v !== null) nums.push(v); else if (x) texts.push(x); });
      texts.forEach(function (t) {
        var isCat = cats.some(function (c) { var a = normKey(c.name), b = normKey(t); return a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0; });
        if (isCat && !cat) cat = t; else if (!unit) unit = t; else if (!cat) cat = t;
      });
      if (nums.length >= 3) { qty = nums[0]; price = nums[1]; total = nums[2]; }
      else if (nums.length === 2) { qty = nums[0]; price = nums[1]; }
      else if (nums.length === 1) { total = nums[0]; }
    }
    name = name.replace(/\s+/g, ' ').trim();
    if (!name || parseNum(name) !== null) { out.skipped++; return; }
    if (!qty || qty <= 0) qty = price && total ? Math.round(total / price * 1000) / 1000 : 1;
    if (price === null || price <= 0) price = total ? total / qty : null;
    if (price === null) { out.skipped++; return; }
    out.items.push({ name: name, qty: String(Math.round(qty * 1000) / 1000), unit: unit, price: String(Math.round(price * 100) / 100), category: matchCat(cat, cats, name) });
  });
  return out;
}
function pasteCheckHtml() {
  var d = App.draft; if (!d || !d.pasteTotal) return '';
  var t = d.items.reduce(function (s, i) { return s + (parseQty(i.qty) || 1) * n(i.price); }, 0);
  var diff = Math.abs(t - d.pasteTotal) > 1;
  return '<div class="alert ' + (diff ? '' : 'g') + ' sm" style="padding:10px 12px"><span style="flex:1">المحسوب <b>' + fmt(t) + '</b> · المكتوب في الفاتورة <b>' + fmt(d.pasteTotal) + '</b>' +
    (diff ? '<br>في فرق ' + fmt(Math.abs(t - d.pasteTotal)) + ' ج.م، راجع الأسعار والكميات' : ' ✓') + '</span></div>';
}

/* ============ الملفات ============ */
$('restoreInput').addEventListener('change', function () {
  var f = this.files && this.files[0]; if (!f) return;
  var isX = /\.xlsx$/i.test(f.name);
  var rd = new FileReader();
  rd.onload = function () {
    var p = isX ? loadXlsx().then(function () { return xlsxToBackup(rd.result); }) : Promise.resolve(JSON.parse(rd.result));
    p.then(function (b) {
      if (!b || b.app !== 'house-budget') throw new Error('الملف ده مش نسخة من التطبيق');
      openSheet({ type: 'restore', backup: b });
    }).catch(function (e) { fail(e.message ? e : new Error('الملف بايظ')); });
  };
  if (isX) rd.readAsArrayBuffer(f); else rd.readAsText(f);
});
function xlsxToBackup(buf) {
  var wb = XLSX.read(buf, { type: 'array' });
  var names = ['Members', 'Contributions', 'Purchases', 'Items', 'Settlements', 'Shopping', 'Categories', 'Funds', 'FundTx', 'Settings'];
  var t = {};
  names.forEach(function (nm) { if (wb.Sheets[nm]) t[nm] = XLSX.utils.sheet_to_json(wb.Sheets[nm], { defval: '', raw: false }); });
  if (!t.Members) return null;
  if (t.Members.some(function (m) { return !m.pinHash; })) throw new Error('ملف الـ Excel مفيهوش الأرقام السرية. استخدم ملف الاسترجاع JSON.');
  return { app: 'house-budget', exportedAt: '', tables: t };
}
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  return new Promise(function (res, rej) {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = function () { res(); }; s.onerror = function () { rej(new Error('مش قادر أحمّل أداة الإكسل، جرّب ملف JSON')); };
    document.head.appendChild(s);
  });
}
function deliverFile(blob, name) {
  try {
    var file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).then(function () { toast('تمام'); }).catch(function (e) { if (e && e.name !== 'AbortError') download(blob, name); });
      return;
    }
  } catch (e) { }
  download(blob, name);
}
function download(blob, name) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  toast('الملف نزل في التنزيلات (Downloads). ابعته لنفسك على واتساب');
}

start();
