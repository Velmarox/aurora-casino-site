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

$('signoutBtn').addEventListener('click', () => signOut(auth));

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
