/* ============================================================================
   Aurora Casino - the weekly promos as shipped, and the pictures a promo may use.

   ONE copy, read by both the homepage (Site.js) and the dashboard. The homepage
   shows these until the owner saves promos from the dashboard; after that it
   shows what was saved (Firestore site/config, field "promos"), and falls back to
   these only if that read fails.

   days    0 = Sunday through 6 = Saturday. null means no promo that day and no
           banner at all.
     when   short timing line, e.g. "All day" or "7 - 9 PM"
     img    a file name from IMAGES below, never a path or URL
     tags   up to four highlights; color j = jade, m = magenta, p = plain outline
     draws  drawing times in MINUTES past midnight, so half hours work.
            Times after midnight are stored past 1440 (12:30 AM = 1470) so they
            sort after 11:30 PM on the same casino night.

   Same shape as what the dashboard saves, so the homepage reads both the same way.
   ========================================================================= */
window.AURORA_PROMOS = {
  imageBase: '/work/demos/aurora/Assets/Promos/',

  images: [
    { file: 'Promo_Gaming_Floor.avif', label: 'Gaming floor' },
    { file: 'Promo_Cash_On_Bar.avif',  label: 'Cash on the bar' },
    { file: 'Promo_Drawing_Drum.avif', label: 'Drawing drum' },
    { file: 'Promo_Lounge_Wine.avif',  label: 'Lounge and wine' },
    { file: 'Promo_Slots_Night.avif',  label: 'Slots at night' },
    { file: 'Promo_Draft_Taps.avif',   label: 'Draft taps' },
    { file: 'Promo_Neon_Lanes.avif',   label: 'Neon lanes' }
  ],

  days: [
    null,
    {
      when: 'All day', title: '3X Points All Day',
      img: 'Promo_Gaming_Floor.avif',
      desc: 'Triple points on every machine, open to close. It\'s the quickest way up the tiers.',
      tags: [{ text: '3X points all day', color: 'm' }, { text: 'Level up to Platinum', color: 'p' }],
      draws: []
    },
    {
      when: 'All day', title: 'Loyalty Rewards Day',
      img: 'Promo_Cash_On_Bar.avif',
      desc: 'Free play based on your player tier: Silver $10, Gold $20, Platinum $30, Platinum Plus $40.',
      tags: [{ text: 'Log in and get rewards', color: 'j' }, { text: 'All day long', color: 'p' }],
      draws: []
    },
    {
      when: 'All day', title: 'Win-It Wednesdays',
      img: 'Promo_Drawing_Drum.avif',
      desc: 'Every player who logs in on Wednesday is entered into a $25 cash drawing. Two winners are drawn Thursday morning.',
      tags: [{ text: '$25 cash drawing', color: 'j' }, { text: 'Monthly $300 drawing', color: 'm' }, { text: '$1,000 year-end drawing', color: 'm' }],
      draws: []
    },
    {
      when: 'All day', title: 'VIP Rewards Day',
      img: 'Promo_Lounge_Wine.avif',
      desc: 'Platinum and Platinum Plus members collect their VIP free play.',
      tags: [{ text: 'Platinum $30', color: 'j' }, { text: 'Platinum Plus $40', color: 'm' }],
      draws: []
    },
    {
      when: '7 – 9 PM', title: 'Nifty-Fifty Fridays',
      img: 'Promo_Slots_Night.avif',
      desc: 'Drawings every thirty minutes from seven to nine. The prize amount is based on your player rank.',
      tags: [{ text: 'Win up to $50', color: 'j' }, { text: 'Every 30 minutes', color: 'p' }],
      draws: [1140, 1170, 1200, 1230, 1260]
    },
    null
  ]
};
