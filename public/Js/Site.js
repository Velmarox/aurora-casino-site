/* ============================================================================
   Aurora Casino - homepage behaviour. Plain JS, no dependencies, no build step.

   What it does, in order:
     1. Demo disclaimer overlay, dismissed before anything else matters
     2. Open / closed neon sign, clocked to Billings time
     3. Weekly promo banners, today first
     4. The "running today" band under the hero
     5. Mobile menu
     6. Staggered button sheen
     7. Hero video, loaded only where it is worth the bandwidth
     8. Footer year
   ========================================================================= */
(function () {
  'use strict';

  /* ======================= EDIT ME ==========================================
     Everything the front of house needs to change lives in this block.
     ========================================================================= */

  var HOURS = { open: 8, close: 26 };   // 24h clock; 26 means 2 AM the next day
  var TZ = 'America/Denver';            // Billings, so the sign is right for everyone

  /* Weekly promos, 0 = Sunday through 6 = Saturday. null means no promo that day
     and no banner at all. Saturday and Sunday are deliberately null.
       tags  [text, colour] where j = jade, m = magenta, p = plain outline
       draws drawing times in MINUTES past midnight, so half hours work */
  var WEEK = [
    null,
    {
      d: 'Monday', when: 'All day', title: '3X Points All Day',
      img: 'Assets/Promos/Promo_Gaming_Floor.avif',
      desc: 'Triple points on every machine, open to close. It\'s the quickest way up the tiers.',
      tags: [['3X points all day', 'm'], ['Level up to Platinum', 'p']],
      draws: []
    },
    {
      d: 'Tuesday', when: 'All day', title: 'Loyalty Rewards Day',
      img: 'Assets/Promos/Promo_Cash_On_Bar.avif',
      desc: 'Free play based on your player tier: Silver $10, Gold $20, Platinum $30, Platinum Plus $40.',
      tags: [['Log in and get rewards', 'j'], ['All day long', 'p']],
      draws: []
    },
    {
      d: 'Wednesday', when: 'All day', title: 'Win-It Wednesdays',
      img: 'Assets/Promos/Promo_Drawing_Drum.avif',
      desc: 'Every player who logs in on Wednesday is entered into a $25 cash drawing. Two winners are drawn Thursday morning.',
      tags: [['$25 cash drawing', 'j'], ['Monthly $300 drawing', 'm'], ['$1,000 year-end drawing', 'm']],
      draws: []
    },
    {
      d: 'Thursday', when: 'All day', title: 'VIP Rewards Day',
      img: 'Assets/Promos/Promo_Lounge_Wine.avif',
      desc: 'Platinum and Platinum Plus members collect their VIP free play.',
      tags: [['Platinum $30', 'j'], ['Platinum Plus $40', 'm']],
      draws: []
    },
    {
      d: 'Friday', when: '7 – 9 PM', title: 'Nifty-Fifty Fridays',
      img: 'Assets/Promos/Promo_Slots_Night.avif',
      desc: 'Drawings every thirty minutes from seven to nine. The prize amount is based on your player rank.',
      tags: [['Win up to $50', 'j'], ['Every 30 minutes', 'p']],
      draws: [1140, 1170, 1200, 1230, 1260]
    },
    null
  ];

  /* ===================== END EDIT ME ======================================= */


  /* -- 1  demo disclaimer overlay ------------------------------------------ */
  /* The overlay and the scroll lock ship in index.html so they are on screen with
     the first frame. All this does is take them away again, and put the page back
     within reach of a screen reader and the keyboard while they are up. */

  var modal = document.getElementById('demoModal');
  if (modal) {
    // Everything the overlay covers. Marked inert so tab and swipe navigation
    // stay inside the dialog instead of wandering the page behind it.
    var behind = [];
    var kids = document.body.children;
    for (var b = 0; b < kids.length; b++) {
      if (kids[b] !== modal && kids[b].tagName !== 'SCRIPT' && kids[b].tagName !== 'NOSCRIPT') {
        behind.push(kids[b]);
      }
    }
    behind.forEach(function (el) { el.inert = true; el.setAttribute('aria-hidden', 'true'); });

    var closeBtn = document.getElementById('demoModalClose');
    if (closeBtn) { closeBtn.focus({ preventScroll: true }); }

    var dismiss = function () {
      modal.hidden = true;
      document.body.classList.remove('demo-open');
      behind.forEach(function (el) { el.inert = false; el.removeAttribute('aria-hidden'); });
      document.removeEventListener('keydown', onKey, true);
    };

    var onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); dismiss(); return; }
      if (e.key !== 'Tab') { return; }
      // inert already blocks the page behind; this wraps the two controls inside.
      var stops = modal.querySelectorAll('button, [href]');
      if (!stops.length) { return; }
      var first = stops[0], last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    if (closeBtn) { closeBtn.addEventListener('click', dismiss); }
    document.addEventListener('keydown', onKey, true);
  }


  /* -- helpers ------------------------------------------------------------- */

  // Billings local time, whatever zone the visitor is actually in.
  function localNow() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hour12: false, weekday: 'short', hour: 'numeric', minute: 'numeric'
    }).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: days[o.weekday], h: (+o.hour) % 24, m: +o.minute };
  }

  function fmtHour(h) {
    h = h % 24;
    var hh = h % 12 || 12;
    return hh + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  // minutes past midnight -> "7:30 PM"
  function fmtTime(t) {
    var h = Math.floor(t / 60) % 24, m = t % 60;
    var hh = h % 12 || 12;
    return hh + (m ? ':' + (m < 10 ? '0' + m : m) : '') + ' ' + (h >= 12 ? 'PM' : 'AM');
  }

  function fmtGap(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    if (!h) { return m + 'm'; }
    return m ? h + 'h ' + m + 'm' : h + 'h';
  }


  /* -- 2  open / closed sign ----------------------------------------------- */

  var now = localNow();
  var mins = now.h * 60 + now.m;
  var openM = HOURS.open * 60, closeM = (HOURS.close % 24) * 60;
  var isOpen = mins >= openM || mins < closeM;          // the open window wraps midnight

  var sign = document.getElementById('sign');
  if (sign) {
    var tube = sign.querySelector('.tube'), until = sign.querySelector('.until');
    sign.classList.toggle('closed', !isOpen);
    tube.textContent = isOpen ? 'Open' : 'Closed';
    until.innerHTML = isOpen
      ? 'Until <b>' + fmtHour(HOURS.close) + '</b> tonight · Mountain time'
      : 'Doors open <b>' + fmtHour(HOURS.open) + '</b> · Mountain time';
  }

  /* The casino day runs 8 AM to 2 AM, so between midnight and 2 AM the promo
     on the floor is still yesterday's. afterMidnight matters for the drawing
     countdown: the clock has rolled over but the promo's times have not, so
     every drawing time still reads as "later today" when it is already past. */
  var afterMidnight = mins < closeM;
  var promoDay = afterMidnight ? (now.day + 6) % 7 : now.day;


  /* -- 3  weekly promo banners, today first -------------------------------- */

  var grid = document.getElementById('week-grid');
  if (grid) {
    var html = '';
    for (var i = 0; i < 7; i++) {
      var p = WEEK[(promoDay + i) % 7];
      if (!p) { continue; }                              // weekends render nothing
      var today = i === 0;
      var tags = p.tags.map(function (g) {
        return '<span class="tag ' + g[1] + '">' + g[0] + '</span>';
      }).join('');

      html +=
        '<article class="day' + (today ? ' today' : '') + '">' +
          '<img class="bg" src="' + p.img + '" alt="" loading="lazy" decoding="async">' +
          '<div class="body">' +
            '<div class="copy">' +
              '<div class="top"><span class="d">' + (today ? 'Today · ' + p.d : p.d) + '</span></div>' +
              '<h3 class="title">' + p.title + '</h3>' +
              (p.draws.length
                ? '<p class="draw">Drawings <span class="mono">' + p.draws.map(fmtTime).join(' · ') + '</span></p>'
                : '') +
            '</div>' +
            '<p class="desc">' + p.desc + '</p>' +
            '<div class="tags">' + tags + '</div>' +
          '</div>' +
        '</article>';
    }
    grid.innerHTML = html;
  }


  /* -- 4  the "running today" band ----------------------------------------- */
  /* Hidden in the markup. It is only unhidden once there is something real to
     put in it, so a weekend or a JS failure shows no empty strip. */

  var band = document.getElementById('now');
  if (band) {
    var promo = WEEK[promoDay], off = 0;
    if (!promo) {                                        // weekend: look ahead to Monday
      for (off = 1; off <= 7 && !promo; off++) { promo = WEEK[(promoDay + off) % 7]; }
      off--;
    }

    if (promo) {
      band.querySelector('.label').textContent = off === 0 ? 'Today' : 'Next up';
      band.querySelector('.what b').textContent = promo.title;
      band.querySelector('.when').textContent = off === 0 ? promo.when : promo.d;

      // A countdown only means anything for a drawing still to come today, on
      // the same side of midnight as the clock.
      var next = null;
      if (off === 0 && isOpen && !afterMidnight) {
        for (var j = 0; j < promo.draws.length; j++) {
          if (promo.draws[j] > mins) { next = promo.draws[j]; break; }
        }
      }
      var badge = band.querySelector('.next');
      if (next === null) { badge.remove(); }
      else { badge.textContent = 'Next drawing in ' + fmtGap(next - mins); }

      band.hidden = false;
    }
  }


  /* -- 5  mobile menu ------------------------------------------------------ */

  var menuBtn = document.getElementById('menuBtn'), mnav = document.getElementById('mobileNav');
  if (menuBtn && mnav) {
    menuBtn.addEventListener('click', function () {
      var open = mnav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    mnav.addEventListener('click', function (e) {
      if (!e.target.closest('a')) { return; }
      mnav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-label', 'Open menu');
    });
  }


  /* -- 6  staggered button sheen ------------------------------------------- */
  /* The animation itself is in Site.css; this only offsets each button so they
     do not all sweep at the same moment. */

  var sweepers = document.querySelectorAll('.btn.shimmer');
  for (var k = 0; k < sweepers.length; k++) {
    sweepers[k].style.setProperty('--sweep', (k * 0.9) + 's');
  }


  /* -- 7  hero video ------------------------------------------------------- */
  /* The mp4 is 9.3 MB, most of the page weight, so it never downloads on phones,
     under reduced motion, or when the browser reports Data Saver or a 2G link.
     Those visitors keep the poster still, which is already on screen. */

  var hv = document.getElementById('heroVideo');
  if (hv) {
    var wideEnough = window.matchMedia('(min-width: 820px)').matches;
    var motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var conn = navigator.connection || {};
    var dataOK = conn.saveData !== true && !/2g/.test(conn.effectiveType || '');

    if (wideEnough && motionOK && dataOK) {
      hv.addEventListener('canplay', function () { hv.classList.add('is-ready'); }, { once: true });
      hv.src = 'Assets/Video/Hero_Loop.mp4';
      var attempt = hv.play();
      // Autoplay refused, which some power-saving modes do. Drop the download
      // rather than stall on it.
      if (attempt && attempt.catch) {
        attempt.catch(function () { hv.removeAttribute('src'); hv.load(); });
      }
    }
  }


  /* -- 8  footer year ------------------------------------------------------ */

  var y = document.getElementById('year');
  if (y) { y.textContent = new Date().getFullYear(); }
})();
