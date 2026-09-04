# Aurora Casino website revamp (v0.0.1-alpha)

Static site: plain HTML, CSS and JS. No React, no build step, no npm packages.
Deployed to Firebase Hosting as static files.

## Deploy
1. `npm i -g firebase-tools` (once) and `firebase login`
2. Put your project id in `.firebaserc`
3. `firebase deploy` from this folder, which serves `public/`

Do **not** run `firebase init hosting` in this folder. It offers to overwrite
`public/index.html` with a placeholder, and firebase.json/.firebaserc already exist.

## Layout
- `public/` is the live site, and the only folder Firebase uploads.
  - `index.html` homepage · `Css/` · `Js/` · `Assets/` (deploy-ready copies)
- `Docs/` is never deployed.
  - `01_Design_System/` holds `Aurora_Tokens.css` (the single source of truth for tokens)
    plus the token reference doc. The copy at `public/Css/Aurora_Tokens.css` must stay
    byte-identical to it; edit both together. The tokens file does **not** load the
    webfonts. `index.html` does, with preconnect, so the download is not serialised
    behind a stylesheet parse. Do not put the `@import` back.
  - `02_Assets/` holds the masters: `Brand/`, `Gallery/`, `Video/`, `Promos/`, `Team/`.
    `public/Assets/` holds the optimized deploy copies.
  - `02_Assets/Promos/Web/` holds deploy-ready AVIFs waiting on a promos page.
    Move them to `public/Assets/Promos/` when a page actually references them,
    not before.
  - `04_Notes/` holds audits and decision records.
- `_version_archive/` is for frozen copies of outgoing versions. It stays empty while
  the build root is itself the git repo: a full tree copy would commit the 9.3 MB hero
  mp4 again on every bump. Outgoing versions are git tags instead.

## Conventions
- Folders `PascalCase`, files `Snake_Case`. (`public/` is lowercase because Firebase expects it.)
- Nothing lives in the folder that doesn't need to be there. An asset with no page
  that uses it stays in `Docs/`, not `public/`.
- Semver, pre-launch alpha. The version appears in exactly three places and they must agree:
  this folder's name, `<meta name="version">` in `public/index.html`, and `CHANGELOG.txt`.
- On a bump, tag the outgoing version (`git tag v0.0.1-alpha <sha>`) before committing
  the new one. `git archive` or `git worktree add` against that tag reproduces it byte
  for byte, which is what `_version_archive/` would otherwise hold.
