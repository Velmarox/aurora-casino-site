# Firebase console setup — Aurora Casino admin dashboard

Everything in `/admin` and the contact form is built and deployed, and **none of
it works until this is done**. That is on purpose: the security rules fail closed,
so an unfinished setup denies everything rather than leaving a hole.

Project: **aurora-casino-site** · console: <https://console.firebase.google.com/>

**Do this whole thing under your own Google account.** Transferring ownership to
the client is the last step, not the first — if you hand it over now you lose the
ability to finish setting it up.

Roughly 20 minutes, minus Part 5 which needs the domain sorted first.

---

## Part 1 — Create the Firestore database

- [ ] Console → **aurora-casino-site** → left sidebar → **Build → Firestore Database**
- [ ] **Create database**
- [ ] **Location:** `us-central1` or `nam5 (us-central)`. Either is fine for Montana.
      ⚠️ **This is permanent.** It cannot be changed later without rebuilding the
      database from scratch. Pick one and move on.
- [ ] Start in **production mode** (locked down). Not test mode — test mode leaves
      everything world-writable for 30 days, and we are deploying our own rules
      in Part 4 anyway.
- [ ] **Create**

You may be prompted to add a billing account. If so, see Part 6.

---

## Part 2 — Turn on sign-in

This is the step that is currently missing. Right now the dashboard reports
`auth/configuration-not-found`, which the login screen explains in plain English.

- [ ] **Build → Authentication → Get started**
- [ ] **Sign-in method** tab → **Email/Password** → toggle **Enable**
- [ ] Leave **Email link (passwordless sign-in)** **off** — he has no email address
      he checks, so a magic link would lock him out
- [ ] **Save**

### Create the owner account

- [ ] **Users** tab → **Add user**
- [ ] Email: his real address (the same one that will own the project)
- [ ] Password: something long and temporary. He changes it on first sign-in.
- [ ] **Add user**
- [ ] **Copy the User UID** — the long string in the UID column. You need it next.
      Hover the row and use the copy icon; do not retype it.

---

## Part 3 — Put the UID into the rules

- [ ] Open `firestore.rules` in the project root
- [ ] Find `REPLACE_WITH_OWNER_UID` and paste the UID between the quotes:

```
      && request.auth.uid in ['aBcD1234exampleUID5678'];
```

A UID is not a secret — it is fine in the repo. It only identifies which account
is allowed, and that account still needs the password.

> Hand me the UID and I will paste it in, deploy the rules and check them for you.

---

## Part 4 — Deploy the rules

From the project folder:

```bash
firebase deploy --only firestore:rules
```

- [ ] Command reports success
- [ ] Console → **Firestore Database → Rules** shows the new rules, with the real
      UID rather than the placeholder

**Do not skip the visual check.** Deploying to the wrong project is easy and the
command will happily tell you it succeeded.

---

## Part 5 — App Check (do the domain first)

App Check is what actually keeps bots out of the contact form. The rules require
it, so **until this is done every form submission is rejected.**

⚠️ **Do this after `auroracasinomt.com` points at Firebase.** A reCAPTCHA key is
registered against specific domains. Doing it now means redoing it at launch, and
a half-registered key is the classic cause of "the contact form silently stopped
working."

### Get a reCAPTCHA v3 key

- [ ] <https://www.google.com/recaptcha/admin/create>
- [ ] Type: **reCAPTCHA v3**
- [ ] Domains — add **all** of these:
      - `auroracasinomt.com`
      - `www.auroracasinomt.com`
      - `aurora-casino-site.web.app`
      - `aurora-casino-site.firebaseapp.com`
      - `localhost` (so the form can be tested locally)
- [ ] Submit, then copy **both** the **site key** and the **secret key**

### Register it with Firebase

- [ ] Console → **Build → App Check → Apps** tab
- [ ] Find the web app → **reCAPTCHA v3** → paste the **secret key** → **Save**
- [ ] Put the **site key** into `public/Js/Firebase_Config.js` as `recaptchaSiteKey`

### Leave enforcement OFF for now

- [ ] On the **APIs** tab, leave Cloud Firestore **unenforced** until you have
      watched the metrics for a day or two and confirmed real traffic is passing

Turning enforcement on before verifying is how you lock out your own website.
Monitor first, enforce second.

---

## Part 6 — Billing

Firestore and Authentication both have free allowances that a site this size will
not come close to. The thing that actually costs money is hosting bandwidth,
because of the 9.3 MB hero video.

- [ ] If prompted to upgrade to **Blaze (pay as you go)**, do it — it needs a card
      on file but bills nothing at this traffic
- [ ] **Set a budget alert at $5** either way: Google Cloud Console → Billing →
      Budgets & alerts. This is the seatbelt. Do not skip it.

When the project transfers, billing has to move to **his** card, not yours.

---

## Part 7 — Prove it actually works

Do these in order. Each one checks something different.

- [ ] Go to `/admin` and sign in with the account from Part 2 → the dashboard loads
      rather than an error
- [ ] **Notice bar** → tick the toggle, type anything, **Save notice bar** →
      "Saved" appears
- [ ] Console → **Firestore Database → Data** → a `site` collection exists with a
      `config` document containing what you just typed
- [ ] Load the public homepage → the notice bar appears at the top
- [ ] Untick, save, reload → it disappears
- [ ] Sign out, then visit `/admin` again → you get the login screen, not the
      dashboard

If all six pass, the plumbing is sound.

---

## When something goes wrong

| What you see | What it actually means |
|---|---|
| `auth/configuration-not-found` on sign-in | Part 2 not done — Email/Password is not enabled |
| "Missing or insufficient permissions" when saving | The UID in `firestore.rules` does not match the signed-in account, or the rules were never deployed (Part 3 / Part 4) |
| Dashboard stuck on "Loading your settings…" | Firestore database was never created (Part 1) |
| Contact form always says "did not send" | App Check not registered, or the site key is missing from `Firebase_Config.js` (Part 5) |
| Everything worked, then stopped after enabling enforcement | App Check enforcement turned on before the domain was registered. Turn enforcement back off, fix the domain list, re-verify, then re-enable |

---

## Still outstanding after this

1. **Public-site wiring** — the homepage does not yet read `site/config`, and the
   contact form is still inert. That is Phase 2 part two, and it needs the App
   Check site key from Part 5 before it can be built once rather than twice.
2. **The demo labelling** — `[DEMO]` titles, the disclaimer modal and the footer
   band all have to come off before this is a real client site.
3. **Ownership transfer** — last, not first. Add his Google account as Owner,
   move billing to his card, transfer the GitHub repo, then remove yourself.
4. **The domain** — `auroracasinomt.com` is registered through Wix and expires
   May 2027. Transfer it out **before** cancelling the Wix plan, not after.
