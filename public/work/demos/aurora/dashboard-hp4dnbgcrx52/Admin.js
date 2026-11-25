/* ============================================================================
   Aurora Casino - admin dashboard.

   ES module, loaded only on /admin. The Firebase SDK lives here and nowhere
   near the public homepage, which still ships no framework at all.

   Everything an owner types is written with textContent, never innerHTML. He is
   trusted, but his messages are not: the inbox renders text typed by strangers
   on the internet, and that is exactly where markup injection would land.
   ========================================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc,
  collection, query, orderBy, onSnapshot, updateDoc, deleteDoc
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
  contact:  { phone: '(406) 601-1282',
              facebook: 'https://www.facebook.com/AuroraCasinoMT/',
              instagram: 'https://www.instagram.com/aurora_casino/' },
  sections: { heroVideo: true, promos: true, room: true, club: true, contact: true }
};

let config = structuredClone(DEFAULTS);
let messages = [];
let filter = 'new';
let stopInbox = null;

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

    default:                          return 'That email and password do not match. Check for typos and try again.';
  }
}

function say(el, text, good) {
  el.textContent = text;
  el.className = 'msg ' + (good ? 'ok' : 'bad');
  el.hidden = false;
}

$('signinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('signinBtn'), msg = $('signinMsg');
  const email = $('email').value.trim(), pass = $('password').value;
  if (!email || !pass) { say(msg, 'Fill in both boxes.', false); return; }

  btn.disabled = true;
  msg.hidden = true;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    say(msg, authMessage(err && err.code), false);
  } finally {
    btn.disabled = false;
    $('password').value = '';
  }
});

$('signoutBtn').addEventListener('click', () => {
  if (promosDirty && !confirm('Your promo changes are not saved. Sign out anyway?')) { return; }
  promosDirty = false;
  signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  $('signinView').hidden = !!user;
  $('appView').hidden    = !user;
  if (user) { load(); }
  else if (stopInbox) { stopInbox(); stopInbox = null; }
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
      contact:  { ...DEFAULTS.contact,  ...(saved.contact  || {}) },
      sections: { ...DEFAULTS.sections, ...(saved.sections || {}) }
    };
    fillForms();
    renderPromoDays(promosFromStored(saved.promos && saved.promos.days));
    watchInbox();
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
  $('cPhone').value     = config.contact.phone || '';
  $('cFacebook').value  = config.contact.facebook || '';
  $('cInstagram').value = config.contact.instagram || '';
  $('sHeroVideo').checked = !!config.sections.heroVideo;
  $('sPromos').checked    = !!config.sections.promos;
  $('sRoom').checked      = !!config.sections.room;
  $('sClub').checked      = !!config.sections.club;
  $('sContact').checked   = !!config.sections.contact;
  refreshPreview();
}

/* merge:true so saving one panel cannot wipe another. Without it, saving the
   notice bar would silently blank the contact details. */
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
    } else if (part === 'contact') {
      save('contact', {
        phone: $('cPhone').value.trim(),
        facebook: $('cFacebook').value.trim(),
        instagram: $('cInstagram').value.trim()
      }, btn);
    } else {
      save('sections', {
        heroVideo: $('sHeroVideo').checked,
        promos: $('sPromos').checked,
        room: $('sRoom').checked,
        club: $('sClub').checked,
        contact: $('sContact').checked
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

/* ---- inbox -------------------------------------------------------------- */

/* Ordered by date only, then filtered in the browser. Filtering in the query
   would need a composite index built by hand in the console, and this inbox
   will hold tens of messages, not thousands. Fewer setup steps to get wrong. */
function watchInbox() {
  if (stopInbox) { stopInbox(); }
  const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
  stopInbox = onSnapshot(q,
    (snap) => {
      messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderInbox();
    },
    (err) => {
      $('inboxEmpty').textContent = 'Could not load messages. Refresh the page.';
      $('inboxEmpty').hidden = false;
      console.error(err);
    });
}

function when(ts) {
  if (!ts || !ts.toDate) { return ''; }
  return ts.toDate().toLocaleString('en-US', {
    timeZone: TZ, month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

function renderInbox() {
  const unread = messages.filter((m) => m.status === 'new').length;
  const badge = $('unreadCount');
  badge.textContent = String(unread);
  badge.hidden = unread === 0;

  const list = $('inbox');
  list.textContent = '';
  const shown = messages.filter((m) => (m.status || 'new') === filter);
  $('inboxEmpty').hidden = shown.length > 0;
  $('inboxEmpty').textContent =
    filter === 'new' ? 'No new messages.' :
    filter === 'read' ? 'Nothing read yet.' : 'Nothing archived.';

  shown.forEach((m) => list.appendChild(noteEl(m)));
}

function noteEl(m) {
  const li = document.createElement('li');
  li.className = 'note' + (m.status === 'new' ? ' unread' : '');

  const who = document.createElement('div');
  who.className = 'who';
  const nm = document.createElement('span');
  nm.className = 'nm';
  nm.textContent = m.name || 'No name given';
  const wh = document.createElement('span');
  wh.className = 'when';
  wh.textContent = when(m.createdAt);
  who.append(nm, wh);

  const ct = document.createElement('div');
  ct.className = 'ct';
  if (m.phone) {
    const a = document.createElement('a');
    a.href = 'tel:' + String(m.phone).replace(/[^\d+]/g, '');
    a.textContent = m.phone;
    ct.appendChild(a);
  }
  if (m.email) {
    const a = document.createElement('a');
    a.href = 'mailto:' + m.email;
    a.textContent = m.email;
    ct.appendChild(a);
  }

  const body = document.createElement('p');
  body.className = 'body';
  body.textContent = m.message || '';

  const acts = document.createElement('div');
  acts.className = 'acts';
  acts.append(
    actBtn(m.status === 'new' ? 'Mark as read' : 'Mark as unread',
           () => setStatus(m.id, m.status === 'new' ? 'read' : 'new')),
    actBtn(m.status === 'archived' ? 'Put back' : 'Archive',
           () => setStatus(m.id, m.status === 'archived' ? 'read' : 'archived')),
    actBtn('Delete', () => remove(m), true)
  );

  li.append(who, ct, body, acts);
  return li;
}

function actBtn(label, onClick, danger) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn' + (danger ? ' danger' : '');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

async function setStatus(id, status) {
  try { await updateDoc(doc(db, 'messages', id), { status }); }
  catch (err) { console.error(err); alert('That did not save. Check your internet and try again.'); }
}

/* Deleting a message is permanent and there is no undo, so it asks first and
   names the person - "Delete this?" is too easy to click through by habit. */
async function remove(m) {
  const who = m.name ? `the message from ${m.name}` : 'this message';
  if (!confirm(`Permanently delete ${who}?\n\nThis cannot be undone.`)) { return; }
  try { await deleteDoc(doc(db, 'messages', m.id)); }
  catch (err) { console.error(err); alert('That did not delete. Check your internet and try again.'); }
}

document.querySelectorAll('[data-filter]').forEach((chip) => {
  chip.addEventListener('click', () => {
    filter = chip.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((c) => c.classList.toggle('on', c === chip));
    renderInbox();
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
