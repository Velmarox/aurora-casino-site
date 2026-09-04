/* Aurora Casino — homepage behaviour. Plain JS, no dependencies. */
(function () {
  'use strict';

  /* ===================== EDIT ME ===================== */
  var HOURS = { open: 8, close: 26 };   // 8 AM – 2 AM next day, daily (24h; 26 = 2 AM tomorrow)
  var TZ = 'America/Denver';
  /* Weekly promo schedule (0=Sun … 6=Sat). draws = drawing hours in 24h time. */
  var WEEK = [
    { d:'Sunday',    t:'8 AM – 12 PM', title:'2X Points Morning',        desc:'Double points on everything you play from open until noon.', draws:[] },
    { d:'Monday',    t:'All day',      title:'2X Points Monday',         desc:'Double points all day, plus Happy Hour at the bar 4–7 PM.', draws:[] },
    { d:'Tuesday',   t:'All day',      title:'Match Play Tuesday',       desc:'Grab a match play coupon — $5 to $25 in match plays, redeemable within 7 days.', draws:[] },
    { d:'Wednesday', t:'All day',      title:'Wine Down Wednesday',      desc:'3X points all day and $1 off every glass of wine.', draws:[] },
    { d:'Thursday',  t:'4, 6 & 8 PM',  title:'$20 Free Play Drawings',   desc:'Three drawings for $20 in free machine play. Be on the floor when your name is called.', draws:[16,18,20] },
    { d:'Friday',    t:'6 – 8 PM',     title:'Nifty Fifty Fri-Yay',      desc:'$50 free machine play drawings from six to eight.', draws:[18,19,20] },
    { d:'Saturday',  t:'9 AM – 10 PM', title:'Seahorse Races',           desc:'Races all day 9 AM–10 PM, plus $25 free machine play drawings 5–8 PM.', draws:[17,18,19,20] }
  ];
  /* =================================================== */

  function localNow() {
    // Billings local time regardless of the visitor's zone
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, weekday: 'short', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date());
    var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
    var days = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
    return { day: days[o.weekday], h: (+o.hour) % 24, m: +o.minute };
  }
  function fmtHour(h) { h = h % 24; var ap = h >= 12 ? 'PM' : 'AM'; var hh = h % 12; if (hh === 0) hh = 12; return hh + ' ' + ap; }

  /* ---- open / closed status ---- */
  var now = localNow();
  var mins = now.h * 60 + now.m;
  var openM = HOURS.open * 60, closeM = (HOURS.close % 24) * 60;
  var isOpen = mins >= openM || mins < closeM;          // open window wraps midnight
  var sign = document.getElementById('sign');
  if (sign) {
    var tube = sign.querySelector('.tube'), until = sign.querySelector('.until');
    sign.classList.toggle('closed', !isOpen);
    tube.textContent = isOpen ? 'Open' : 'Closed';
    tube.setAttribute('aria-label', isOpen ? 'Open now' : 'Closed');
    until.innerHTML = isOpen ? 'Until <b>' + fmtHour(HOURS.close) + '</b> tonight · Mountain time' : 'Doors open <b>' + fmtHour(HOURS.open) + '</b> · Mountain time';
  }

  /* ---- promo day: the "casino day" runs 8 AM → 2 AM, so before 2 AM it's still yesterday's promo ---- */
  var promoDay = mins < closeM ? (now.day + 6) % 7 : now.day;

  /* ---- render the week, today first ---- */
  var week = document.getElementById('week-grid');
  if (week) {
    var html = '';
    for (var i = 0; i < 7; i++) {
      var idx = (promoDay + i) % 7, p = WEEK[idx], today = i === 0;
      html += '<article class="day' + (today ? ' today' : '') + '">' +
        '<div class="top"><span class="d">' + (today ? 'Today' : p.d) + '</span>' +
        (today ? '<span class="chip jade">Today</span>' : '') +
        '<span class="t">' + p.t + '</span></div>' +
        '<div class="title">' + p.title + '</div>' +
        '<p class="desc">' + p.desc + '</p>' +
        (p.draws.length ? '<div class="draw">Drawings <span class="mono">' + p.draws.map(fmtHour).join(' · ') + '</span></div>' : '') +
        '</article>';
    }
    week.innerHTML = html;
  }

  /* ---- hero: tonight line ---- */
  var tonight = document.getElementById('tonight');
  if (tonight) {
    var tp = WEEK[promoDay];
    tonight.querySelector('b').textContent = tp.title;
    tonight.querySelector('.when').textContent = tp.t;
    // next drawing countdown if there is one still to come today
    var next = null;
    for (var j = 0; j < tp.draws.length; j++) { if (tp.draws[j] * 60 > mins) { next = tp.draws[j]; break; } }
    var nd = tonight.querySelector('.next');
    if (next !== null && isOpen) {
      var diff = next * 60 - mins;
      nd.textContent = 'Next drawing in ' + (diff >= 60 ? Math.floor(diff / 60) + 'h ' : '') + (diff % 60) + 'm';
    } else { nd.remove(); }
  }

  /* ---- mobile menu ---- */
  var menuBtn = document.getElementById('menuBtn'), mnav = document.getElementById('mobileNav');
  if (menuBtn && mnav) {
    menuBtn.addEventListener('click', function () {
      var open = mnav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open);
    });
    mnav.addEventListener('click', function (e) { if (e.target.closest('a')) { mnav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });
  }

  /* ---- staggered shimmer so buttons don't sweep in unison ---- */
  document.querySelectorAll('.btn.shimmer').forEach(function (b, i) { b.style.setProperty('--d', (i * .9) + 's'); b.style.animationDelay = ''; b.querySelectorAll && (b.dataset.i = i); });
  var st = document.createElement('style');
  st.textContent = '.btn.shimmer::after{animation-delay:var(--d,0s)}';
  document.head.appendChild(st);

  /* ---- hero video: only load it when it is worth the bandwidth ----
     The mp4 is 9.3 MB — most of the page weight — so it never downloads on phones,
     under reduced-motion, or when the browser reports Data Saver / a 2G link.
     Those visitors keep the poster still, which is already on screen. */
  var hv = document.getElementById('heroVideo');
  if (hv) {
    var wideEnough = window.matchMedia('(min-width: 820px)').matches;
    var motionOK   = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var conn       = navigator.connection || {};
    var dataOK     = conn.saveData !== true && !/2g/.test(conn.effectiveType || '');
    if (wideEnough && motionOK && dataOK) {
      hv.addEventListener('canplay', function () { hv.classList.add('is-ready'); }, { once: true });
      hv.src = 'Assets/Video/Hero_Loop.mp4';
      var attempt = hv.play();
      // autoplay refused (some power-saving modes): drop the download rather than stall on it
      if (attempt && attempt.catch) attempt.catch(function () { hv.removeAttribute('src'); hv.load(); });
    }
  }

  /* ---- footer year ---- */
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
})();
