/* Aurora Casino — homepage behaviour. Plain JS, no dependencies. */
(function () {
  'use strict';

  /* ===================== EDIT ME ===================== */
  var HOURS = { open: 8, close: 26 };   // 8 AM – 2 AM next day, daily (24h; 26 = 2 AM tomorrow)
  var TZ = 'America/Denver';
  /* Weekly promos, 0=Sun … 6=Sat. null = no promo that day.
     draws = drawing times in MINUTES past midnight, so half-hours work. */
  var WEEK = [
    null,
    { d:'Monday',    when:'All day', title:'3X Points All Day',   img:'Assets/Promos/Promo_Gaming_Floor.avif',
      desc:'Triple points on every machine, open to close — the fastest way to climb to a Platinum tier.',
      tags:[['3X points all day','m'],['Level up to Platinum','p']],
      draws:[] },
    { d:'Tuesday',   when:'All day', title:'Loyalty Rewards Day', img:'Assets/Promos/Promo_Cash_On_Bar.avif',
      desc:'Free play based on your player tier — Silver $10, Gold $20, Platinum $30, Platinum Plus $40.',
      tags:[['Log in and get rewards','j'],['All day long','p']],
      draws:[] },
    { d:'Wednesday', when:'All day', title:'Win-It Wednesdays',   img:'Assets/Promos/Promo_Drawing_Drum.avif',
      desc:'Every player who logs in on Wednesday is entered into a $25 cash drawing. Two winners drawn Thursday morning.',
      tags:[['$25 cash drawing','j'],['Monthly $300 drawing','m'],['$1,000 year-end drawing','m']],
      draws:[] },
    { d:'Thursday',  when:'All day', title:'VIP Rewards Day',     img:'Assets/Promos/Promo_Lounge_Wine.avif',
      desc:'Platinum and Platinum Plus members collect their VIP free play.',
      tags:[['Platinum $30','j'],['Platinum Plus $40','m']],
      draws:[] },
    { d:'Friday',    when:'7 – 9 PM', title:'Nifty-Fifty Fridays', img:'Assets/Promos/Promo_Slots_Night.avif',
      desc:'Drawings every thirty minutes from seven to nine. Prize amount is based on your player rank.',
      tags:[['Win up to $50','j'],['Every 30 minutes','p']],
      draws:[1140,1170,1200,1230,1260] },
    null
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
  function fmtTime(t) { var h = Math.floor(t / 60) % 24, m = t % 60, ap = h >= 12 ? 'PM' : 'AM', hh = h % 12; if (hh === 0) hh = 12; return hh + (m ? ':' + (m < 10 ? '0' + m : m) : '') + ' ' + ap; }

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
      var idx = (promoDay + i) % 7, p = WEEK[idx];
      if (!p) { continue; }                              // no promo that day
      var today = i === 0;
      var tags = p.tags.map(function (g) { return '<span class="tag ' + g[1] + '">' + g[0] + '</span>'; }).join('');
      html += '<article class="day' + (today ? ' today' : '') + '">' +
        '<img class="bg" src="' + p.img + '" alt="" loading="lazy" decoding="async">' +
        '<div class="body">' +
          '<div class="copy">' +
            '<div class="top"><span class="d">' + (today ? 'Today · ' + p.d : p.d) + '</span></div>' +
            '<div class="title">' + p.title + '</div>' +
            (p.draws.length ? '<div class="draw">Drawings <span class="mono">' + p.draws.map(fmtTime).join(' · ') + '</span></div>' : '') +
          '</div>' +
          '<p class="desc">' + p.desc + '</p>' +
          '<div class="tags">' + tags + '</div>' +
        '</div>' +
        '</article>';
    }
    week.innerHTML = html;
  }

  /* ---- hero: tonight line ---- */
  var tonight = document.getElementById('tonight');
  if (tonight) {
    var tp = WEEK[promoDay], label = 'Today', off = 0;
    if (!tp) {                                           // weekend: point at the next weekday promo
      for (off = 1; off <= 7 && !tp; off++) { tp = WEEK[(promoDay + off) % 7]; }
      off--;
      label = tp ? tp.d : '';
    }
    if (!tp) {
      tonight.remove();
    } else {
      tonight.querySelector('.chip').textContent = label;
      tonight.querySelector('b').textContent = tp.title;
      tonight.querySelector('.when').textContent = tp.when;
      // countdown only makes sense for a drawing still to come today
      var next = null;
      if (off === 0) {
        for (var j = 0; j < tp.draws.length; j++) { if (tp.draws[j] > mins) { next = tp.draws[j]; break; } }
      }
      var nd = tonight.querySelector('.next');
      if (next !== null && isOpen) {
        var diff = next - mins;
        nd.textContent = 'Next drawing in ' + (diff >= 60 ? Math.floor(diff / 60) + 'h ' : '') + (diff % 60) + 'm';
      } else { nd.remove(); }
    }
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
