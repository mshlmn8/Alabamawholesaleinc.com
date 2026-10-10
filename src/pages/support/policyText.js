// The title and opening line of each customer policy page. PolicyPage.jsx
// shows them, and src/lib/meta.js uses them for the page title and
// description. They live here, apart from the page, so the head tags don't
// pull the policy page's code into the first download (AW-179).

//
// /shipping is the 'Delivery policy' wherever a link or crumb names it, so
// its h1 and title say that too (NEW-043), apart from /delivery's 'Delivery
// & service area'.

export const POLICY_TEXT = {
  shipping: {
    title: 'Delivery policy',
    intro: 'How orders leave the Birmingham warehouse: on our own trucks along routes in Alabama, Mississippi and Georgia, or will-call pickup during business hours.',
  },
  // In plain language, from what the site actually does (AW-027).
  privacy: {
    title: 'Privacy',
    intro: 'What Alabama Wholesale collects when you apply, sign in and order, why, who handles and sees it, and how to ask for a copy, a correction or deletion.',
  },
  terms: {
    title: 'Trade terms',
    intro: 'The basics of buying from Alabama Wholesale: who can open an account, how pricing and orders work, and what we ask of retail customers.',
  },
};

export const POLICY_TITLES = Object.fromEntries(Object.entries(POLICY_TEXT).map(([k, v]) => [k, v.title]));
export const POLICY_INTROS = Object.fromEntries(Object.entries(POLICY_TEXT).map(([k, v]) => [k, v.intro]));
