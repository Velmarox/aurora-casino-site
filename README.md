# Aurora Casino — website revamp (v0.0.1-alpha)

Static site: plain HTML, CSS and JS. No React, no build step, no npm packages.
Deployed to Firebase Hosting as static files.

## Deploy
1. `npm i -g firebase-tools` (once) and `firebase login`
2. Put your project id in `.firebaserc`
3. `firebase deploy` from this folder — serves `public/`

Do **not** run `firebase init hosting` in this folder. It offers to overwrite
`public/index.html` with a placeholder, and firebase.json/.firebaserc already exist.

## Layout
- `public/` — the live site, and the only folder Firebase uploads.
  - `index.html` homepage · `Css/` · `Js/` · `Assets/` (deploy-ready copies)
- `Docs/` — never deployed.
  - `01_Design_System/` — `Aurora_Tokens.css` (the single source of truth for tokens)
    plus the token reference doc. The copy at `public/Css/Aurora_Tokens.css` must stay
    byte-identical to it; edit both together.
  - `02_Assets/` — masters. `Brand/`, `Gallery/`, `Video/`, `Promos/`, `Team/`.
    `public/Assets/` holds the optimized deploy copies.
  - `02_Assets/Promos/Web/` — deploy-ready AVIFs waiting on a promos page.
    Move them to `public/Assets/Promos/` when a page actually references them,
    not before.
  - `04_Notes/` — audits and decision records.
- `_version_archive/` — frozen copies of outgoing versions. Never edit.

## Conventions
- Folders `PascalCase`, files `Snake_Case`. (`public/` is lowercase because Firebase expects it.)
- Nothing lives in the folder that doesn't need to be there. An asset with no page
  that uses it stays in `Docs/`, not `public/`.
- Semver, pre-launch alpha. The version appears in exactly three places and they must agree:
  this folder's name, `<meta name="version">` in `public/index.html`, and `CHANGELOG.txt`.
- Outgoing-version copies are archived in `_version_archive/`, never loose in the tree.
