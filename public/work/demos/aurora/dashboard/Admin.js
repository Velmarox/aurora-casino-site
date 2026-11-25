/* ============================================================================
   Aurora Casino - admin dashboard.

   ES module, loaded only on /dashboard. The Firebase SDK lives here and nowhere
   near the public homepage, which still ships no framework at all.

   Everything an owner types is written with textContent, never innerHTML. The owner is
   trusted, but text saved here ends up on the public homepage, so it is treated
   as data everywhere.
   ========================================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app  = initializeApp(window.AURORA_FIREBASE);
const auth = getAuth(app);
const db   = getFirestore(app);

const TZ = 'America/Denver';
const $  = (id) => document.getElementById(id);

/* What the site falls back to if a field has never been saved. Mirrors the
   defaults baked into the public site, so an empty database and a fresh install
   look identical. */
const DEFAULTS = {
  notice:   { on: false, text: '', expires: '', linkText: '', linkUrl: '' },
  sections: { heroVideo: true, promos: true, room: true, club: true }
};

let config = structuredClone(DEFAULTS);

/* ---- sign in ------------------------------------------------------------ */

/* Firebase error codes are not for humans. "auth/invalid-credential" tells the
   owner nothing; this does. Wrong email and wrong password deliberately give the
   same answer, so the form cannot be used to discover valid addresses. */
function authMessage(code) {
  switch (code) {
    case 'auth/invalid-email':        return 'That email address does not look right.';
    case 'auth/user-disabled':        return 'This account has been switched off. Get in touch with whoever set up the site.';
    case 'auth/too-many-requests':    return 'Too many tries. Wait a few minutes and go again.';
    case 'auth/network-request-failed': return 'Cannot reach the internet. Check your connection and try again.';

    /* Setup problems, not credential problems. Without these two the dashboard
       says "wrong password" at a person who typed the right one, and they go
       looking for a typo instead of a switch in the Firebase console. */
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Sign-in has not been switched on for this site yet. In the Firebase console, '
           + 'open Authentication, then Sign-in method, and enable Email/Password.';

    /* The page is open on a web address Firebase has not been told about. */
    case 'auth/unauthorized-domain':
      return 'Sign-in is not allowed from this web address yet. In the Firebase console, '
           + 'open Authentication, then Settings, then Authorized domains, and add it.';

    /* Wrong email, wrong password and no such account all land here (Firebase
       reports them as invalid-credential). Deliberately one answer for all. */
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    default:
      return 'Wrong email or password. Check for typos (and Caps Lock) and try again.';
  }
}

function say(el, text, good) {
  el.textContent = text;
  el.className = 'msg ' + (good ? 'ok' : 'bad');
  el.hidden = false;
}

/* Wrong details: the message, a red edge on the boxes, a short shake so it is
   noticed even when eyes are on the keyboard, and the cursor back in the box
   that most likely needs fixing. */
function signinError(text, focusId) {
  const card = $('signinForm');
  say($('signinMsg'), text, false);
  ['email', 'password'].forEach((id) => $(id).setAttribute('aria-invalid', 'true'));
  card.classList.remove('shake');
  void card.offsetWidth;                 // restart the animation on a repeat miss
  card.classList.add('shake');
  if (focusId) { $(focusId).focus(); $(focusId).select && $(focusId).select(); }
}

function busy(on) {
  const btn = $('signinBtn');
  btn.disabled = on;
  btn.classList.toggle('busy', on);
  btn.querySelector('.label').textContent = on ? 'Signing in…' : 'Sign in';
}

['email', 'password'].forEach((id) => {
  $(id).addEventListener('input', () => {
    $(id).removeAttribute('aria-invalid');
    $('signinMsg').hidden = true;
  });
});

$('signinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('email').value.trim(), pass = $('password').value;
  if (!email) { signinError('Type the email address for your account.', 'email'); return; }
  if (!pass)  { signinError('Type your password.', 'password'); return; }

  busy(true);
  $('signinMsg').hidden = true;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    const code = err && err.code;
    signinError(authMessage(code), code === 'auth/invalid-email' ? 'email' : 'password');
    $('password').value = '';
  } finally {
    busy(false);
  }
});

/* Show / hide the password, so a mistyped one can be checked before trying again. */
$('pwToggle').addEventListener('click', () => {
  const pw = $('password'), show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  $('pwToggle').textContent = show ? 'Hide' : 'Show';
  $('pwToggle').setAttribute('aria-pressed', String(show));
  pw.focus();
});

/* Caps Lock is the most common reason a right password is "wrong". */
function capsCheck(e) {
  if (e.getModifierState) { $('capsWarn').hidden = !e.getModifierState('CapsLock'); }
}
$('password').addEventListener('keydown', capsCheck);
$('password').addEventListener('keyup', capsCheck);
$('password').addEventListener('blur', () => { $('capsWarn').hidden = true; });

/* Password reset by email. The answer is the same whether or not the address has
   an account, so this cannot be used to find out who has one. */
$('forgotBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  if (!email) {
    signinError('Type your email address above first, then press "Forgot your password?" again.', 'email');
    return;
  }
  $('forgotBtn').disabled = true;
  try {
    await sendPasswordResetEmail(auth, email);
    say($('signinMsg'), `If ${email} has an account, a link to set a new password is on its way. Check your inbox and spam folder.`, true);
  } catch (err) {
    const code = err && err.code;
    if (code === 'auth/invalid-email' || code === 'auth/network-request-failed' || code === 'auth/too-many-requests') {
      signinError(authMessage(code), 'email');
    } else {
      say($('signinMsg'), `If ${email} has an account, a link to set a new password is on its way. Check your inbox and spam folder.`, true);
    }
  } finally {
    $('forgotBtn').disabled = false;
  }
});

$('signoutBtn').addEventListener('click', () => {
  if ((promosDirty || socialsDirty) && !confirm('Some changes are not saved. Sign out anyway?')) { return; }
  promosDirty = false;
  socialsDirty = false;
  signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  $('signinView').hidden = !!user;
  $('appView').hidden    = !user;
  if (user) { $('acctEmail').textContent = user.email || ''; load(); }
  else {
    $('password').value = '';
    $('email').focus();
  }
});

/* ---- load + save -------------------------------------------------------- */

async function load() {
  $('loading').hidden = false;
  $('panels').hidden = true;
  try {
    const snap = await getDoc(doc(db, 'site', 'config'));
    const saved = snap.exists() ? snap.data() : {};
    config = {
      notice:   { ...DEFAULTS.notice,   ...(saved.notice   || {}) },
      sections: { ...DEFAULTS.sections, ...(saved.sections || {}) }
    };
    fillForms();
    renderPromoDays(promosFromStored(saved.promos && saved.promos.days));
    renderSocials(socialsFromStored(saved.socials));
    $('loading').hidden = true;
    $('panels').hidden = false;
  } catch (err) {
    $('loading').textContent =
      'Could not load your settings. Check your internet and refresh the page.';
    console.error(err);
  }
}

function fillForms() {
  $('nOn').checked    = !!config.notice.on;
  $('nText').value    = config.notice.text || '';
  $('nExpires').value = config.notice.expires || '';
  $('sHeroVideo').checked = !!config.sections.heroVideo;
  $('sPromos').checked    = !!config.sections.promos;
  $('sRoom').checked      = !!config.sections.room;
  $('sClub').checked      = !!config.sections.club;
  refreshPreview();
}

/* merge:true so saving one panel cannot wipe another. Without it, saving the
   notice bar would silently blank the promos. */
async function save(part, data, btn) {
  const flag = document.querySelector(`[data-saved="${part}"]`);
  btn.disabled = true;
  flag.hidden = true;
  try {
    await setDoc(doc(db, 'site', 'config'), { [part]: data }, { merge: true });
    config[part] = data;
    flag.textContent = 'Saved';
    flag.hidden = false;
    setTimeout(() => { flag.hidden = true; }, 3000);
  } catch (err) {
    flag.textContent = 'Not saved — try again';
    flag.hidden = false;
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

document.querySelectorAll('[data-save]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const part = btn.dataset.save;
    if (part === 'notice') {
      save('notice', {
        on: $('nOn').checked,
        text: $('nText').value.trim(),
        expires: $('nExpires').value || '',
        linkText: config.notice.linkText || '',
        linkUrl: config.notice.linkUrl || ''
      }, btn);
    } else {
      save('sections', {
        heroVideo: $('sHeroVideo').checked,
        promos: $('sPromos').checked,
        room: $('sRoom').checked,
        club: $('sClub').checked
      }, btn);
    }
  });
});

/* ---- notice preview ----------------------------------------------------- */

function refreshPreview() {
  const text = $('nText').value.trim();
  $('nCount').textContent = `${$('nText').value.length} of 200 characters`;
  $('nPreviewText').textContent = text;
  $('nPreview').hidden = !text;
}
$('nText').addEventListener('input', refreshPreview);

/* ---- tabs --------------------------------------------------------------- */

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('on', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    document.querySelectorAll('.panel').forEach((p) => {
      p.hidden = p.id !== tab.dataset.panel;
    });
  });
});

/* ---- promos ------------------------------------------------------------- */

/* The seven promo days, saved as site/config.promos.days (Sunday first). Each
   day keeps its content even when switched off ("on": false), so a promo can be
   paused for a week and brought back without retyping it. The homepage reads the
   same shape (Js/Site.js, section 4) and shows Js/Promos_Default.js until the
   first save. Firestore cannot hold an array inside an array, which is why
   highlights are {text, color} maps rather than pairs. */

const P = window.AURORA_PROMOS;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COLORS = [['j', 'Green'], ['m', 'Pink'], ['p', 'Outline']];
const OPEN_HOUR = 8;            // a drawing time before this is after midnight, same night
const MAX_TAGS = 4, MAX_DRAWS = 12;
let promosDirty = false;

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

function blankDay() {
  return { on: false, when: '', title: '', img: P.images[0].file, desc: '', tags: [], draws: [] };
}

/* Saved data is checked the same way the homepage checks it, so a damaged field
   shows as empty rather than as "[object Object]". */
function promosFromStored(days) {
  return DAY_NAMES.map((_, i) => {
    const d = Array.isArray(days) ? days[i] : null;
    if (!d || typeof d !== 'object') { return blankDay(); }
    return {
      on:    d.on !== false,
      when:  str(d.when, 30),
      title: str(d.title, 60),
      img:   P.images.some((im) => im.file === d.img) ? d.img : P.images[0].file,
      desc:  str(d.desc, 300),
      tags:  (Array.isArray(d.tags) ? d.tags : []).slice(0, MAX_TAGS)
               .filter((t) => t && typeof t.text === 'string')
               .map((t) => ({ text: t.text.slice(0, 40), color: /^[jmp]$/.test(t.color) ? t.color : 'p' })),
      draws: (Array.isArray(d.draws) ? d.draws : []).map(Number)
               .filter((n) => Number.isInteger(n) && n >= 0 && n < 1800).slice(0, MAX_DRAWS)
    };
  });
}

// minutes past midnight (past 1440 = after midnight) <-> "HH:MM" for <input type=time>
function minsToInput(n) {
  const m = n % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function inputToMins(v) {
  const hit = /^(\d{1,2}):(\d{2})/.exec(v || '');
  if (!hit) { return null; }
  const h = +hit[1], m = +hit[2];
  return h * 60 + m + (h < OPEN_HOUR ? 1440 : 0);
}

function el(tag, props, kids) {
  const e = document.createElement(tag);
  Object.assign(e, props || {});
  (kids || []).forEach((k) => e.append(k));
  return e;
}

function field(label, input, hintText) {
  const id = input.id;
  const lab = el('label', { htmlFor: id, textContent: label });
  const p = el('p', { className: 'field' }, [lab, input]);
  if (hintText) { p.append(el('span', { className: 'hint', textContent: hintText })); }
  return p;
}

function tagRow(t) {
  const row = el('div', { className: 'prow tagrow' });
  const text = el('input', { type: 'text', maxLength: 40, value: t.text, placeholder: 'e.g. Win up to $50',
                             className: 'tagtext' });
  text.setAttribute('aria-label', 'Highlight text');
  const sel = el('select', { className: 'tagcolor' });
  sel.setAttribute('aria-label', 'Highlight colour');
  COLORS.forEach(([v, name]) => sel.append(el('option', { value: v, textContent: name, selected: v === t.color })));
  const del = el('button', { type: 'button', className: 'btn small', textContent: 'Remove' });
  del.addEventListener('click', () => { row.remove(); markDirty(); refreshAddButtons(); });
  row.append(text, sel, del);
  return row;
}

function drawRow(n) {
  const row = el('div', { className: 'prow drawrow' });
  const time = el('input', { type: 'time', step: 300, value: n == null ? '' : minsToInput(n), className: 'drawtime' });
  time.setAttribute('aria-label', 'Drawing time');
  const del = el('button', { type: 'button', className: 'btn small', textContent: 'Remove' });
  del.addEventListener('click', () => { row.remove(); markDirty(); refreshAddButtons(); });
  row.append(time, del);
  return row;
}

function dayCard(d, i) {
  const name = DAY_NAMES[i];
  const card = el('details', { className: 'pday' + (d.on ? '' : ' off') });
  card.dataset.day = String(i);

  const sumTitle = el('span', { className: 'stitle' });
  const sumState = el('span', { className: 'sstate' });
  card.append(el('summary', {}, [el('span', { className: 'sday', textContent: name }), sumTitle, sumState]));

  const on = el('input', { type: 'checkbox', checked: d.on, className: 'pon' });
  const body = el('div', { className: 'pbody' }, [
    el('label', { className: 'toggle' }, [on, el('span', { textContent: `Run a promo on ${name}s` })])
  ]);

  const title = el('input', { id: `pt${i}`, type: 'text', maxLength: 60, value: d.title, className: 'ptitle',
                              placeholder: 'e.g. Nifty-Fifty Fridays' });
  const when  = el('input', { id: `pw${i}`, type: 'text', maxLength: 30, value: d.when, className: 'pwhen',
                              placeholder: 'e.g. All day, or 7 – 9 PM' });
  const desc  = el('textarea', { id: `pd${i}`, rows: 3, maxLength: 300, value: d.desc, className: 'pdesc' });

  const pics = el('div', { className: 'pics', role: 'radiogroup' });
  pics.setAttribute('aria-label', `Picture for ${name}`);
  P.images.forEach((im) => {
    const r = el('input', { type: 'radio', name: `pimg${i}`, value: im.file, checked: im.file === d.img });
    const img = el('img', { src: P.imageBase + im.file, alt: '', loading: 'lazy', width: 120, height: 68 });
    pics.append(el('label', { className: 'pic' }, [r, img, el('span', { textContent: im.label })]));
  });

  const tags = el('div', { className: 'tags' });
  d.tags.forEach((t) => tags.append(tagRow(t)));
  const addTag = el('button', { type: 'button', className: 'btn small addtag', textContent: 'Add a highlight' });
  addTag.addEventListener('click', () => { tags.append(tagRow({ text: '', color: 'j' })); markDirty(); refreshAddButtons(); });

  const draws = el('div', { className: 'draws' });
  d.draws.forEach((n) => draws.append(drawRow(n)));
  const addDraw = el('button', { type: 'button', className: 'btn small adddraw', textContent: 'Add a drawing time' });
  addDraw.addEventListener('click', () => { draws.append(drawRow(null)); markDirty(); refreshAddButtons(); });

  body.append(
    field('Promo name', title),
    field('When', when, 'Shown under the name, and in the "running today" strip.'),
    field('Description', desc),
    el('div', { className: 'field' }, [el('span', { className: 'flabel', textContent: 'Picture' }), pics]),
    el('div', { className: 'field' }, [
      el('span', { className: 'flabel', textContent: 'Highlights' }),
      el('span', { className: 'hint', textContent: 'Short labels on the banner. Up to four.' }),
      tags, addTag]),
    el('div', { className: 'field' }, [
      el('span', { className: 'flabel', textContent: 'Drawing times' }),
      el('span', { className: 'hint', textContent: 'Leave empty if there is no drawing. A time after midnight counts as the same night.' }),
      draws, addDraw])
  );
  card.append(body);

  const refreshSummary = () => {
    sumTitle.textContent = title.value.trim() || (on.checked ? 'No name yet' : '');
    sumState.textContent = on.checked ? 'On' : 'Off';
    card.classList.toggle('off', !on.checked);
  };
  card.addEventListener('input', refreshSummary);
  card.addEventListener('change', refreshSummary);
  refreshSummary();
  return card;
}

function refreshAddButtons() {
  document.querySelectorAll('.pday').forEach((card) => {
    card.querySelector('.addtag').hidden  = card.querySelectorAll('.tagrow').length >= MAX_TAGS;
    card.querySelector('.adddraw').hidden = card.querySelectorAll('.drawrow').length >= MAX_DRAWS;
  });
}

function renderPromoDays(days) {
  const box = $('promoDays');
  box.textContent = '';
  days.forEach((d, i) => box.append(dayCard(d, i)));
  refreshAddButtons();
  promosDirty = false;
  $('promoMsg').hidden = true;
}

function markDirty() { promosDirty = true; $('promoSaved').hidden = true; }

function collectPromos() {
  return [...document.querySelectorAll('.pday')].map((card) => {
    const checkedImg = card.querySelector('.pics input:checked');
    const draws = [...card.querySelectorAll('.drawtime')].map((t) => inputToMins(t.value))
      .filter((n) => n !== null);
    return {
      on:    card.querySelector('.pon').checked,
      title: card.querySelector('.ptitle').value.trim(),
      when:  card.querySelector('.pwhen').value.trim(),
      desc:  card.querySelector('.pdesc').value.trim(),
      img:   checkedImg ? checkedImg.value : P.images[0].file,
      tags:  [...card.querySelectorAll('.tagrow')]
               .map((r) => ({ text: r.querySelector('.tagtext').value.trim(), color: r.querySelector('.tagcolor').value }))
               .filter((t) => t.text),
      draws: [...new Set(draws)].sort((a, b) => a - b)
    };
  });
}

$('promoDays').addEventListener('input', markDirty);
$('promoDays').addEventListener('change', markDirty);

$('promoSave').addEventListener('click', async () => {
  const btn = $('promoSave'), msg = $('promoMsg'), flag = $('promoSaved');
  const days = collectPromos();

  // A day switched on with no name would show an empty banner. Stop and open it.
  const bad = days.findIndex((d) => d.on && !d.title);
  if (bad !== -1) {
    say(msg, `${DAY_NAMES[bad]} is switched on but has no promo name. Give it a name or switch it off.`, false);
    const card = document.querySelector(`.pday[data-day="${bad}"]`);
    card.open = true;
    card.querySelector('.ptitle').focus();
    return;
  }

  msg.hidden = true;
  flag.hidden = true;
  btn.disabled = true;
  try {
    await setDoc(doc(db, 'site', 'config'), { promos: { days } }, { merge: true });
    promosDirty = false;
    flag.textContent = 'Saved. Your website shows the new promos now.';
    flag.hidden = false;
  } catch (err) {
    say(msg, err && err.code === 'permission-denied'
      ? 'That did not save: this account is not allowed to change the website. The owner account has to be set up in the Firestore rules first.'
      : 'That did not save. Check your internet and try again.', false);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

$('promoReset').addEventListener('click', () => {
  if (!confirm('Replace everything on this page with the original promos?\n\nNothing changes on your website until you press Save.')) { return; }
  renderPromoDays(promosFromStored(P.days));
  promosDirty = true;
});

window.addEventListener('beforeunload', (e) => {
  if (promosDirty) { e.preventDefault(); e.returnValue = ''; }
});

// Drawn straight away from the shipped promos; load() replaces them with the saved set.
renderPromoDays(promosFromStored(P.days));

/* ---- social links ------------------------------------------------------- */

/* The buttons under the address on the homepage. Saved as
   site/config.socials = { links: [{ platform, label, url }] }, in display order.
   Platforms and icons come from Js/Socials.js, shared with the homepage. Until the
   first save the homepage keeps the Facebook and Instagram buttons it ships with;
   saving an empty list hides the row. */

const SOC = window.AURORA_SOCIALS;
let socialsDirty = false;

function socialsFromStored(saved) {
  if (!saved || !Array.isArray(saved.links)) { return SOC.defaults.map((l) => ({ ...l })); }
  return saved.links.slice(0, SOC.max)
    .filter((l) => l && typeof l.url === 'string')
    .map((l) => ({
      platform: SOC.platforms[l.platform] ? l.platform : 'other',
      label: typeof l.label === 'string' ? l.label.slice(0, 30) : '',
      url: l.url.slice(0, 300)
    }));
}

function socialIcon(platform) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = SOC.platforms[platform].icon;      // trusted: from Socials.js only
  return svg;
}

function socialRow(l) {
  const row = el('div', { className: 'slink' });
  const icon = el('span', { className: 'sicon' });

  const plat = el('select', { className: 'splat' });
  plat.setAttribute('aria-label', 'Which site');
  Object.entries(SOC.platforms).forEach(([key, p]) =>
    plat.append(el('option', { value: key, textContent: p.name, selected: key === l.platform })));

  const label = el('input', { type: 'text', className: 'slabel', maxLength: 30, value: l.label });
  label.setAttribute('aria-label', 'Button text');
  const url = el('input', { type: 'url', className: 'surl', maxLength: 300, value: l.url, inputMode: 'url' });
  url.setAttribute('aria-label', 'Link');

  const up   = el('button', { type: 'button', className: 'btn small sup',   textContent: '↑', title: 'Move up' });
  const down = el('button', { type: 'button', className: 'btn small sdown', textContent: '↓', title: 'Move down' });
  const del  = el('button', { type: 'button', className: 'btn small',       textContent: 'Remove' });
  up.setAttribute('aria-label', 'Move up');
  down.setAttribute('aria-label', 'Move down');

  /* Changing the site swaps the icon and the example link, and replaces the button
     text if it was still the old site's name (so a custom label survives). */
  let lastName = SOC.platforms[l.platform].name;
  const sync = () => {
    const p = SOC.platforms[plat.value];
    icon.textContent = '';
    icon.append(socialIcon(plat.value));
    url.placeholder = p.hint;
    label.placeholder = plat.value === 'other' ? 'Button text, e.g. Our menu' : p.name;
    if (!label.value.trim() || label.value.trim() === lastName) {
      label.value = plat.value === 'other' ? '' : p.name;
    }
    lastName = p.name;
  };
  plat.addEventListener('change', sync);
  sync();

  up.addEventListener('click', () => { if (row.previousElementSibling) { row.parentNode.insertBefore(row, row.previousElementSibling); socialsChanged(); } });
  down.addEventListener('click', () => { if (row.nextElementSibling) { row.parentNode.insertBefore(row.nextElementSibling, row); socialsChanged(); } });
  del.addEventListener('click', () => { row.remove(); socialsChanged(); });

  row.append(icon, plat, label, url, el('span', { className: 'sbtns' }, [up, down, del]));
  return row;
}

function refreshSocialButtons() {
  const rows = [...document.querySelectorAll('.slink')];
  rows.forEach((r, i) => {
    r.querySelector('.sup').disabled = i === 0;
    r.querySelector('.sdown').disabled = i === rows.length - 1;
  });
  $('socialAdd').hidden = rows.length >= SOC.max;
  if (!rows.length) {
    $('socialList').dataset.empty = 'No social buttons. The row is hidden on your website.';
  } else {
    delete $('socialList').dataset.empty;
  }
}

function socialsChanged() {
  socialsDirty = true;
  $('socialSaved').hidden = true;
  refreshSocialButtons();
}

function renderSocials(links) {
  const box = $('socialList');
  box.textContent = '';
  links.forEach((l) => box.append(socialRow(l)));
  socialsDirty = false;
  $('socialMsg').hidden = true;
  refreshSocialButtons();
}

$('socialList').addEventListener('input', socialsChanged);
$('socialList').addEventListener('change', socialsChanged);

$('socialAdd').addEventListener('click', () => {
  const row = socialRow({ platform: 'facebook', label: '', url: '' });
  $('socialList').append(row);
  socialsChanged();
  row.querySelector('.splat').focus();
});

$('socialSave').addEventListener('click', async () => {
  const msg = $('socialMsg'), flag = $('socialSaved'), btn = $('socialSave');
  const rows = [...document.querySelectorAll('.slink')];
  const links = [];
  for (const r of rows) {
    const platform = r.querySelector('.splat').value;
    const labelEl = r.querySelector('.slabel'), urlEl = r.querySelector('.surl');
    let url = urlEl.value.trim();
    // People paste "facebook.com/..." without the https:// part. Add it for them.
    if (url && !/^[a-z]+:\/\//i.test(url)) { url = 'https://' + url; }
    const label = labelEl.value.trim() || (platform === 'other' ? '' : SOC.platforms[platform].name);
    let okUrl = false;
    try { okUrl = new URL(url).protocol === 'https:' && url.includes('.'); } catch (e) { okUrl = false; }
    if (!okUrl) {
      say(msg, 'Each social button needs its full web address, starting with https://. Fix the highlighted one.', false);
      urlEl.setAttribute('aria-invalid', 'true');
      urlEl.focus();
      return;
    }
    if (!label) {
      say(msg, 'An "Other link" button needs some button text, e.g. "Our menu".', false);
      labelEl.setAttribute('aria-invalid', 'true');
      labelEl.focus();
      return;
    }
    urlEl.removeAttribute('aria-invalid');
    labelEl.removeAttribute('aria-invalid');
    urlEl.value = url;
    links.push({ platform, label, url });
  }

  msg.hidden = true;
  flag.hidden = true;
  btn.disabled = true;
  try {
    await setDoc(doc(db, 'site', 'config'), { socials: { links } }, { merge: true });
    socialsDirty = false;
    flag.textContent = links.length ? 'Saved. Your website shows these buttons now.' : 'Saved. The social buttons are hidden on your website.';
    flag.hidden = false;
  } catch (err) {
    say(msg, err && err.code === 'permission-denied'
      ? 'That did not save: this account is not allowed to change the website.'
      : 'That did not save. Check your internet and try again.', false);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

window.addEventListener('beforeunload', (e) => {
  if (socialsDirty) { e.preventDefault(); e.returnValue = ''; }
});

renderSocials(socialsFromStored(null));

/* ---- account: change password ------------------------------------------- */

/* Firebase only lets a password change through with a recent sign-in, so the
   current password is asked for and checked first (reauthenticate). That also
   means someone who finds the dashboard left open cannot lock the owner out
   without knowing the password. */

document.querySelectorAll('.pw-toggle[data-for]').forEach((b) => {
  b.addEventListener('click', () => {
    const input = $(b.dataset.for), show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.textContent = show ? 'Hide' : 'Show';
    b.setAttribute('aria-pressed', String(show));
    input.focus();
  });
});

function pwError(text, id) {
  say($('pwMsg'), text, false);
  if (id) { $(id).setAttribute('aria-invalid', 'true'); $(id).focus(); }
}

['pwCurrent', 'pwNew', 'pwConfirm'].forEach((id) => {
  $(id).addEventListener('input', () => { $(id).removeAttribute('aria-invalid'); $('pwMsg').hidden = true; });
});

$('pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const current = $('pwCurrent').value, next = $('pwNew').value, again = $('pwConfirm').value;
  if (!current)             { pwError('Type your current password.', 'pwCurrent'); return; }
  if (next.length < 8)      { pwError('The new password needs at least 8 characters.', 'pwNew'); return; }
  if (next !== again)       { pwError('The two new passwords do not match. Type them again.', 'pwConfirm'); return; }
  if (next === current)     { pwError('That is the same as your current password. Pick a new one.', 'pwNew'); return; }

  const btn = $('pwSave'), user = auth.currentUser;
  if (!user || !user.email) { pwError('You have been signed out. Sign in again, then change your password.'); return; }
  btn.disabled = true;
  $('pwMsg').hidden = true;
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
  } catch (err) {
    const code = err && err.code;
    btn.disabled = false;
    if (code === 'auth/too-many-requests' || code === 'auth/network-request-failed') { pwError(authMessage(code), 'pwCurrent'); }
    else { pwError('Your current password is not right. Check for typos (and Caps Lock) and try again.', 'pwCurrent'); $('pwCurrent').value = ''; }
    return;
  }
  try {
    await updatePassword(user, next);
    ['pwCurrent', 'pwNew', 'pwConfirm'].forEach((id) => { $(id).value = ''; });
    say($('pwMsg'), 'Password changed. Use the new one next time you sign in.', true);
  } catch (err) {
    const code = err && err.code;
    pwError(code === 'auth/weak-password'
      ? 'That password is too easy to guess. Make it longer.'
      : (code === 'auth/network-request-failed' ? authMessage(code) : 'The password did not change. Try again.'), 'pwNew');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});
