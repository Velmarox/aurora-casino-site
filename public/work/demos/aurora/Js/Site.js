/* ============================================================================
   Aurora Casino - homepage behaviour. Plain JS, no dependencies, no build step.

   What it does, in order:
     1. Demo disclaimer overlay, dismissed before anything else matters
     2. Owner notice bar across the very top of the page (from the dashboard)
     3. Open / closed neon sign, clocked to Billings time
     4. Weekly promo banners, today first (from the dashboard), and the settings read
     5. The "running today" band under the hero
     6. Mobile menu
     7. Staggered button sheen
     8. Hero video, loaded only where it is worth the bandwidth
     9. Contact form, hidden until a backend is wired
    10. Footer year
   ========================================================================= */
(function () {
  'use strict';

  /* ======================= EDIT ME ==========================================
     Everything the front of house needs to change lives in this block.
     ========================================================================= */

  var HOURS = { open: 8, close: 26 };   // 24h clock; 26 means 2 AM the next day
  var TZ = 'America/Denver';            // Billings, so the sign is right for everyone

  /* The notice bar across the very top of the page is no longer edited here: the
     owner sets it in the dashboard (Notice bar tab), and section 2 below shows
     what was saved. */

  /* Contact form. The section stays hidden unless on is true AND endpoint is
     filled in, so a form that cannot actually send can never reach a visitor -
     a dead form is worse than none, because people think they got through.
     endpoint gets the dashboard backend URL in Phase 2. */
  var CONTACT = { on: false, endpoint: '' };

  /* Weekly promos are no longer edited here. The shipped set lives in
     Js/Promos_Default.js; the owner changes them from the dashboard, and section 4
     below reads what was saved. */
  var PROMOS_WAIT_MS = 3000;   // longest the promo banners wait for the saved set

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


  /* -- 2  owner notice bar -------------------------------------------------- */
  /* Called with the saved notice once the settings read (section 4) answers.
     Hidden in the markup, so a failed read, a notice switched off or an empty
     one shows nothing.
     Fails closed on purpose: any missing or malformed piece just leaves the bar
     hidden. That is the safe direction for something edited without a preview.
     textContent, never innerHTML - this string arrives from the dashboard, so it
     is untrusted input and must not be able to inject markup.
     expires is a plain YYYY-MM-DD read in Billings time: after that day the bar
     hides itself. The link is optional, needs both of its fields, and only
     web, on-site or phone links are accepted. */
  function showNotice(NOTICE) {
    var bar = document.getElementById('notice');
    if (!bar || !NOTICE || typeof NOTICE !== 'object' || NOTICE.on !== true) { return; }

    var text = typeof NOTICE.text === 'string' ? NOTICE.text.trim().slice(0, 200) : '';
    if (!text) { return; }

    if (NOTICE.expires && !/^\d{4}-\d{2}-\d{2}$/.test(NOTICE.expires)) { return; }

    if (NOTICE.expires) {
      // en-CA formats as YYYY-MM-DD, so a string compare is a date compare, and
      // reading it in Billings time means it clears at local midnight, not UTC.
      var today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
      if (today > NOTICE.expires) { return; }
    }

    document.getElementById('noticeText').textContent = text;

    var url = typeof NOTICE.linkUrl === 'string' ? NOTICE.linkUrl.trim() : '';
    var label = typeof NOTICE.linkText === 'string' ? NOTICE.linkText.trim().slice(0, 40) : '';
    if (url && label && /^(https?:\/\/|\/|tel:)/i.test(url)) {
      var link = document.getElementById('noticeLink');
      link.href = url;
      link.textContent = label;
      link.hidden = false;
    }

    bar.hidden = false;
  }

  /* -- 2b  social buttons ------------------------------------------------- */
  /* The row of buttons under the address. index.html ships Facebook and Instagram;
     once the owner saves socials in the dashboard, this replaces them with the
     saved list, in order. An empty saved list hides the row. Nothing saved, or a
     failed read, leaves the shipped buttons alone.
     Only https links, only known platforms (icons come from Js/Socials.js, never
     from saved data), labels length-capped and set with textContent. */
  function showSocials(saved) {
    var box = document.getElementById('socials');
    var SOC = window.AURORA_SOCIALS;
    if (!box || !SOC || !saved || !Array.isArray(saved.links)) { return; }

    var links = saved.links.slice(0, SOC.max).filter(function (l) {
      return l && typeof l.url === 'string' && /^https:\/\/[^\s"<>]+\.[^\s"<>]+$/i.test(l.url.trim());
    });

    box.textContent = '';
    links.forEach(function (l) {
      var key = SOC.platforms[l.platform] ? l.platform : 'other';
      var p = SOC.platforms[key];
      var label = typeof l.label === 'string' && l.label.trim() ? l.label.trim().slice(0, 30) : p.name;
      var a = document.createElement('a');
      a.href = l.url.trim();
      a.target = '_blank';
      a.rel = 'noopener';
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = p.icon;                  // trusted: from Socials.js only
      a.appendChild(svg);
      a.appendChild(document.createTextNode(label));
      box.appendChild(a);
    });
    // .socials sets display:flex, which would beat the hidden attribute.
    box.style.display = links.length ? "" : "none";
  }

  /* -- 2c  show / hide sections -------------------------------------------- */
  /* The dashboard's Show / hide tab. A section switched off disappears, and so
     does every link that jumps to it (top nav, phone menu, footer, the hero
     button, the phone action bar), so nothing points at a section that is not
     there. Only an explicit false hides anything: nothing saved, a failed read or
     a damaged value shows everything. The hero video switch is handled where the
     video starts (section 8). */
  var SECTION_PARTS = {
    promos: { ids: ['week', 'now'], anchor: '#week' },
    room:   { ids: ['room'],        anchor: '#room' },
    club:   { ids: ['club'],        anchor: '#club' }
  };

  function applySections(sections) {
    if (!sections || typeof sections !== 'object') { return; }
    Object.keys(SECTION_PARTS).forEach(function (key) {
      if (sections[key] !== false) { return; }
      var part = SECTION_PARTS[key];
      part.ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.hidden = true; el.style.display = 'none'; }
      });
      // style.display, not hidden: several of these links have display rules
      // in Site.css that would beat the hidden attribute.
      var links = document.querySelectorAll('a[href="' + part.anchor + '"]');
      for (var i = 0; i < links.length; i++) { links[i].style.display = 'none'; }
    });

    // The phone action bar is a three-column grid; size it to what is left.
    var bar = document.querySelector('.actionbar');
    if (bar) {
      var left = 0, kids = bar.children;
      for (var k = 0; k < kids.length; k++) { if (kids[k].style.display !== 'none') { left++; } }
      bar.style.gridTemplateColumns = 'repeat(' + Math.max(left, 1) + ',1fr)';
    }
  }

  /* -- 3  open / closed sign ----------------------------------------------- */

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


  /* -- 4  weekly promos: the saved set, or the shipped one ----------------- */
  /* The owner edits promos in the dashboard, which saves them to Firestore
     (site/config, field "promos"). This reads that document through Firestore's
     public REST endpoint: one GET, no SDK, so the homepage still ships no
     framework. site/config is world-readable by the rules, so no sign-in.

     Any failure - offline, a 403, a 404 because nothing was ever saved, a slow
     answer past PROMOS_WAIT_MS - shows the shipped promos from Promos_Default.js.
     If App Check ENFORCEMENT is ever switched on for Firestore, this read has no
     token and fails, so the site quietly shows the shipped promos: leave
     Firestore unenforced, or teach this read to carry a token first.

     Everything read is treated as untrusted: only known fields, strings
     length-capped, pictures only from the approved list, colours only j/m/p,
     drawing times only whole minutes in range. Text is escaped before it goes
     into markup, because it now comes from outside the codebase. */

  var DEFAULTS = window.AURORA_PROMOS || { imageBase: '', images: [], days: [] };
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cap(v, n) { return typeof v === 'string' ? v.trim().slice(0, n) : ''; }

  // One day, cleaned. Returns null for "no promo" or anything unusable.
  function cleanDay(p) {
    if (!p || typeof p !== 'object' || p.on === false) { return null; }   // switched off in the dashboard
    var title = cap(p.title, 60);
    if (!title) { return null; }
    var okImg = DEFAULTS.images.some(function (im) { return im.file === p.img; });
    return {
      when:  cap(p.when, 30),
      title: title,
      img:   okImg ? p.img : (DEFAULTS.images[0] ? DEFAULTS.images[0].file : ''),
      desc:  cap(p.desc, 300),
      tags:  (Array.isArray(p.tags) ? p.tags : []).slice(0, 4).map(function (t) {
        return t && { text: cap(t.text, 40), color: /^[jmp]$/.test(t.color) ? t.color : 'p' };
      }).filter(function (t) { return t && t.text; }),
      draws: (Array.isArray(p.draws) ? p.draws : []).map(Number).filter(function (n) {
        return n % 1 === 0 && n >= 0 && n < 1800;
      }).sort(function (a, b) { return a - b; }).slice(0, 12)
    };
  }

  function cleanWeek(days) {
    var week = [];
    for (var d = 0; d < 7; d++) { week.push(cleanDay(days && days[d])); }
    return week;
  }

  // Firestore REST returns typed values ({stringValue: 'x'}, {arrayValue: ...}).
  function fsValue(v) {
    if (!v || typeof v !== 'object') { return null; }
    if ('stringValue' in v)  { return v.stringValue; }
    if ('integerValue' in v) { return Number(v.integerValue); }
    if ('doubleValue' in v)  { return Number(v.doubleValue); }
    if ('booleanValue' in v) { return !!v.booleanValue; }
    if ('arrayValue' in v)   { return (v.arrayValue.values || []).map(fsValue); }
    if ('mapValue' in v)     { return fsFields(v.mapValue.fields); }
    return null;
  }
  function fsFields(f) {
    var o = {};
    for (var k in (f || {})) { if (Object.prototype.hasOwnProperty.call(f, k)) { o[k] = fsValue(f[k]); } }
    return o;
  }

  // One read for everything the homepage takes from the dashboard: promos, the
  // notice bar, the social buttons and which sections are shown. Resolves with the parsed document; rejects on any failure.
  function fetchSaved() {
    var fb = window.AURORA_FIREBASE;
    if (!fb || !fb.projectId || !fb.apiKey || !window.fetch) { return Promise.reject(new Error('no config')); }
    var url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(fb.projectId) +
              '/databases/(default)/documents/site/config' +
              '?mask.fieldPaths=promos&mask.fieldPaths=notice&mask.fieldPaths=socials' +
              '&mask.fieldPaths=sections&key=' +
              encodeURIComponent(fb.apiKey);
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error('settings read failed: ' + r.status); }
      return r.json();
    }).then(function (docJson) { return fsFields(docJson.fields); });
  }

  function savedDays(saved) {
    var promos = saved && saved.promos;
    return promos && Array.isArray(promos.days) && promos.days.length === 7 ? promos.days : null;
  }

  /* The line under "This week at Aurora", written from the days that actually
     have a promo, so it can't go stale when the owner changes them:
       Mon-Fri on        "Five promos, Monday through Friday. Today's is at the top."
       every day         "A promo every day of the week. ..."
       Mon, Wed, Fri     "Three promos: Monday, Wednesday and Friday. ..."
       Friday only       "One promo, on Fridays. ..."
     A run that wraps the weekend (Friday to Monday) still reads "through".
     The second sentence says "today's" only when today has one. */
  var NUM_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];

  function weekSummary(WEEK) {
    var on = [];
    for (var d = 0; d < 7; d++) { if (WEEK[d]) { on.push(d); } }
    var n = on.length;
    if (!n) { return 'No promos running right now. Check back soon.'; }

    var first;
    if (n === 7) {
      first = 'A promo every day of the week';
    } else if (n === 1) {
      first = 'One promo, on ' + DAY_NAMES[on[0]] + 's';
    } else {
      // A run of three or more days in a row, allowing the week to wrap.
      var start = -1;
      for (var s = 0; s < n && start === -1; s++) {
        var ok = true;
        for (var k = 0; k < n; k++) { if (!WEEK[(on[s] + k) % 7]) { ok = false; break; } }
        if (ok) { start = on[s]; }
      }
      if (n >= 3 && start !== -1) {
        first = NUM_WORDS[n] + ' promos, ' + DAY_NAMES[start] + ' through ' + DAY_NAMES[(start + n - 1) % 7];
      } else {
        // Two days in a row across the weekend read Saturday and Sunday, not the reverse.
        var names = on.map(function (i, k) { return DAY_NAMES[start === -1 ? i : (start + k) % 7]; });
        first = NUM_WORDS[n] + ' promos: ' + names.slice(0, -1).join(', ') + ' and ' + names[n - 1];
      }
    }
    return first + '. ' + (WEEK[promoDay] ? 'Today\'s is at the top.' : 'The next one is at the top.');
  }

  function renderPromos(WEEK) {
    var grid = document.getElementById('week-grid');
    if (grid) {
      var html = '';
      for (var i = 0; i < 7; i++) {
        var dayIdx = (promoDay + i) % 7, p = WEEK[dayIdx];
        if (!p) { continue; }                            // days off render nothing
        var today = i === 0, dName = DAY_NAMES[dayIdx];
        var tags = p.tags.map(function (g) {
          return '<span class="tag ' + g.color + '">' + esc(g.text) + '</span>';
        }).join('');

        html +=
          '<article class="day' + (today ? ' today' : '') + '">' +
            '<img class="bg" src="' + esc(DEFAULTS.imageBase + p.img) + '" alt="" loading="lazy" decoding="async">' +
            '<div class="body">' +
              '<div class="copy">' +
                '<div class="top"><span class="d">' + (today ? 'Today · ' + dName : dName) + '</span></div>' +
                '<h3 class="title">' + esc(p.title) + '</h3>' +
                (p.draws.length
                  ? '<p class="draw">Drawings <span class="mono">' + p.draws.map(fmtTime).join(' · ') + '</span></p>'
                  : '') +
              '</div>' +
              '<p class="desc">' + esc(p.desc) + '</p>' +
              '<div class="tags">' + tags + '</div>' +
            '</div>' +
          '</article>';
      }
      grid.innerHTML = html;
    }

    var sub = document.getElementById('weekSub');
    if (sub) { sub.textContent = weekSummary(WEEK); }

    /* -- 5  the "running today" band --------------------------------------- */
    /* Hidden in the markup. It is only unhidden once there is something real to
       put in it, so a day off or a JS failure shows no empty strip. */

    var band = document.getElementById('now');
    if (band) {
      var promo = WEEK[promoDay], off = 0;
      if (!promo) {                                      // no promo today: look ahead
        for (off = 1; off <= 7 && !promo; off++) { promo = WEEK[(promoDay + off) % 7]; }
        off--;
      }

      if (promo) {
        band.querySelector('.label').textContent = off === 0 ? 'Today' : 'Next up';
        band.querySelector('.what b').textContent = promo.title;
        band.querySelector('.when').textContent = off === 0 ? promo.when : DAY_NAMES[(promoDay + off) % 7];

        // A countdown only means anything for a drawing still to come tonight.
        // Times past 1440 belong to after midnight, so compare against the
        // clock on the casino-night scale.
        var nightMins = afterMidnight ? mins + 1440 : mins;
        var next = null;
        if (off === 0 && isOpen) {
          for (var j = 0; j < promo.draws.length; j++) {
            if (promo.draws[j] > nightMins) { next = promo.draws[j]; break; }
          }
        }
        var badge = band.querySelector('.next');
        if (next === null) { badge.remove(); }
        else { badge.textContent = 'Next drawing in ' + fmtGap(next - nightMins); }

        band.hidden = false;
      }
    }
  }

  // Promos render once: the saved set if it arrives in time, otherwise the shipped
  // one. The notice bar, social buttons and show/hide apply whenever the read
  // answers. The hero video waits for the same answer (or the same timeout).
  (function () {
    var done = false, videoStarted = false;
    function video(sections) {
      if (videoStarted) { return; }
      videoStarted = true;
      if (!sections || sections.heroVideo !== false) { startHeroVideo(); }
    }
    function show(days) {
      if (done) { return; }
      done = true;
      renderPromos(cleanWeek(days));
    }
    var timer = setTimeout(function () { show(DEFAULTS.days); video(null); }, PROMOS_WAIT_MS);
    fetchSaved().then(function (saved) {
      clearTimeout(timer);
      show(savedDays(saved) || DEFAULTS.days);
      showNotice(saved.notice);
      showSocials(saved.socials);
      applySections(saved.sections);
      video(saved.sections);
    }, function () { clearTimeout(timer); show(DEFAULTS.days); video(null); });
  })();


  /* -- 6  mobile menu ------------------------------------------------------ */

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


  /* -- 7  staggered button sheen ------------------------------------------- */
  /* The animation itself is in Site.css; this only offsets each button so they
     do not all sweep at the same moment. */

  var sweepers = document.querySelectorAll('.btn.shimmer');
  for (var k = 0; k < sweepers.length; k++) {
    sweepers[k].style.setProperty('--sweep', (k * 0.9) + 's');
  }


  /* -- 8  hero video ------------------------------------------------------- */
  /* The mp4 is 9.3 MB, most of the page weight, so it never downloads on phones,
     under reduced motion, or when the browser reports Data Saver or a 2G link.
     Those visitors keep the poster still, which is already on screen. */

  /* Called once the settings read answers (section 4), so a video the owner has
     switched off in the dashboard is never downloaded just to be thrown away.
     A failed or slow read still starts it. */
  function startHeroVideo() {
    var hv = document.getElementById('heroVideo');
    if (hv) {
      var wideEnough = window.matchMedia('(min-width: 820px)').matches;
      var motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var conn = navigator.connection || {};
      var dataOK = conn.saveData !== true && !/2g/.test(conn.effectiveType || '');

      if (wideEnough && motionOK && dataOK) {
        hv.addEventListener('canplay', function () { hv.classList.add('is-ready'); }, { once: true });
        hv.src = '/work/demos/aurora/Assets/Video/Hero_Loop.mp4';
        var attempt = hv.play();
        // Autoplay refused, which some power-saving modes do. Drop the download
        // rather than stall on it.
        if (attempt && attempt.catch) {
          attempt.catch(function () { hv.removeAttribute('src'); hv.load(); });
        }
      }
    }
  }


  /* -- 9  contact form ------------------------------------------------------ */
  (function () {
    var form = document.getElementById('contactForm');
    var section = document.getElementById('contact');
    if (!form || !section || !CONTACT.on || !CONTACT.endpoint) { return; }
    section.hidden = false;

    var status = document.getElementById('cfStatus');
    var btn = document.getElementById('cfSend');
    var PHONE = '(406) 601-1282';

    var fields = [
      { el: document.getElementById('cfName'),  err: document.getElementById('cfNameErr'),
        ok: function (v) { return v.length > 0; } },
      { el: document.getElementById('cfPhone'), err: document.getElementById('cfPhoneErr'),
        ok: function (v) { return v.replace(/\D/g, '').length >= 7; } },
      { el: document.getElementById('cfEmail'), err: document.getElementById('cfEmailErr'),
        ok: function (v) { return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); } },
      { el: document.getElementById('cfMsg'),   err: document.getElementById('cfMsgErr'),
        ok: function (v) { return v.length > 1; } }
    ];

    function say(msg, good) {
      status.textContent = msg;
      status.className = 'cf-status ' + (good ? 'ok' : 'bad');
      status.hidden = false;
    }

    function validate() {
      var firstBad = null;
      fields.forEach(function (f) {
        var good = f.ok(f.el.value.trim());
        f.err.hidden = good;
        f.el.setAttribute('aria-invalid', good ? 'false' : 'true');
        if (!good && !firstBad) { firstBad = f.el; }
      });
      if (firstBad) { firstBad.focus(); }
      return !firstBad;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot filled means a bot. Show the ordinary thank-you and drop it on
      // the floor - telling a bot it was caught just teaches whoever wrote it.
      if (document.getElementById('cfCompany').value) {
        form.reset();
        say('Thanks, we got your message.', true);
        return;
      }

      if (!validate()) { say('Please fix the highlighted fields.', false); return; }

      btn.disabled = true;
      say('Sending your message...', true);

      send({
        name:    document.getElementById('cfName').value.trim(),
        phone:   document.getElementById('cfPhone').value.trim(),
        email:   document.getElementById('cfEmail').value.trim(),
        message: document.getElementById('cfMsg').value.trim()
      }).then(function () {
        form.reset();
        fields.forEach(function (f) { f.el.setAttribute('aria-invalid', 'false'); });
        say('Thanks, we got your message. For anything urgent, call ' + PHONE + '.', true);
      })['catch'](function () {
        say('Sorry, that did not send. Please call ' + PHONE + ' instead.', false);
      }).then(function () { btn.disabled = false; });
    });

    /* Phase 2 replaces the body of this with the Firestore write. It rejects on
       anything less than a clean 2xx, so the form never claims to have sent
       something that did not land. */
    function send(data) {
      return fetch(CONTACT.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) { if (!r.ok) { throw new Error('send failed: ' + r.status); } });
    }
  })();

  /* -- 10  footer year ------------------------------------------------------ */

  var y = document.getElementById('year');
  if (y) { y.textContent = new Date().getFullYear(); }
})();
