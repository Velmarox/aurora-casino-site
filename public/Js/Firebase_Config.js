/* ============================================================================
   Firebase project details for Aurora Casino.

   These are NOT secrets. Google publishes web API keys on purpose - they name
   the project, they do not grant access to it. What actually protects the data
   is firestore.rules plus App Check. Do not go looking for somewhere safer to
   hide this file; there isn't one, and there doesn't need to be.

   Loaded as a plain script so both the public site (classic script) and the
   admin dashboard (ES module) can read the same values off window.

   If the project is ever rebuilt under a different Google account, these values
   change: Firebase Console > Project settings > General > Your apps.
   ========================================================================= */
window.AURORA_FIREBASE = {
  apiKey:     'AIzaSyAyRn635XFwZPNCpNC56lzgoshdVw97kzU',
  authDomain: 'aurora-casino-site.firebaseapp.com',
  projectId:  'aurora-casino-site',
  appId:      '1:19861960466:web:d81810e80464834da3a5cb'
};
