/* ============================================================================
   Aurora Casino - social link buttons: the platforms the owner can pick, their
   icons, and the links as shipped.

   ONE copy, read by both the homepage (Site.js) and the dashboard (Socials tab).
   The homepage shows the shipped links (the markup in index.html) until the owner
   saves socials from the dashboard; after that it shows what was saved
   (Firestore site/config, field "socials": { links: [{platform, label, url}] }).

   Icons are 24x24 stroke drawings in the site's style (Site.css colours them).
   They are trusted markup from this file only, never from saved data.
   ========================================================================= */
window.AURORA_SOCIALS = {
  max: 8,

  platforms: {
    facebook:  { name: 'Facebook',  hint: 'https://www.facebook.com/YourPage',
      icon: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v7h4v-7h3l1-4h-4V8z"/>' },
    instagram: { name: 'Instagram', hint: 'https://www.instagram.com/yourname',
      icon: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>' },
    tiktok:    { name: 'TikTok',    hint: 'https://www.tiktok.com/@yourname',
      icon: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.4 4.6 5 5"/>' },
    x:         { name: 'X',         hint: 'https://x.com/yourname',
      icon: '<path d="M4 4l16 16M20 4L4 20"/>' },
    youtube:   { name: 'YouTube',   hint: 'https://www.youtube.com/@yourname',
      icon: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5l4.5 2.5-4.5 2.5z"/>' },
    snapchat:  { name: 'Snapchat',  hint: 'https://www.snapchat.com/add/yourname',
      icon: '<path d="M12 3a5 5 0 0 0-5 5v3l-2 1 2 1c-.8 1.8-2 3-4 3.5 1 1 2.5 1 3.5 1.5.5 1 2.5 2 5.5 2s5-1 5.5-2c1-.5 2.5-.5 3.5-1.5-2-.5-3.2-1.7-4-3.5l2-1-2-1V8a5 5 0 0 0-5-5z"/>' },
    google:    { name: 'Google reviews', hint: 'https://g.page/r/your-review-link',
      icon: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>' },
    yelp:      { name: 'Yelp',      hint: 'https://www.yelp.com/biz/your-business',
      icon: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>' },
    other:     { name: 'Other link', hint: 'https://',
      icon: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>' }
  },

  // What the homepage ships with. Same as the links in index.html.
  defaults: [
    { platform: 'facebook',  label: 'Facebook',  url: 'https://www.facebook.com/AuroraCasinoMT/' },
    { platform: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/aurora_casino/' }
  ]
};
