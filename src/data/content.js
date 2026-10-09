// Storefront content: company info, marketing copy, hero slides, FAQs, and
// welcome-popup offers. PRODUCTS lives in ./products.js.

import { heroImage } from '../lib/images.js';

export const COMPANY = {
  name: 'Alabama Wholesale Inc',
  phone: '(205) 354-4473',
  phoneRaw: '+12053544473',
  whatsapp: '12053544473',
  // TODO(owner): Which domain email address is monitored, so it can replace the Gmail address? (AW-127)
  email: 'Alabamawholesaleinc@gmail.com',
  addressShort: '613 Graymont Ave N, Birmingham AL 35203',
  addressLine1: '613 Graymont Ave N',
  addressLine2: 'Birmingham, AL 35203',
  // The same address in parts: the will-call address a quote sends to a
  // database without submit_quote v3 (src/lib/orders.js, AW-079).
  addressStreet: '613 Graymont Ave N',
  addressCity: 'Birmingham',
  addressState: 'AL',
  addressZip: '35203',
  hoursLine1: 'Mon–Fri 7:00 AM – 6:00 PM',
  hoursLine2: 'Sat–Sun 8:00 AM – 5:30 PM'
};

// TODO(owner): Who gets Net-30, and what is the real volume discount behind "up to 18%"? Kept exactly as published until you say (decision 2). (AW-025)
export const ANNOUNCEMENTS = [
  '★ FREE DELIVERY on orders over $1,500 on our delivery routes in Alabama, Mississippi & Georgia',
  '★ NET-30 TERMS available for approved retail accounts',
  '★ WILL-CALL · Pickup at the Birmingham warehouse during business hours',
  '★ VOLUME DISCOUNTS · Save up to 18% on pallet quantities'
];

export const SHOP_CATS = [
  { name: 'TOBACCO',       count: 68, color: ['#3A1F1A', '#8C6F3D'], icon: 'cigar' },
  { name: 'NOVELTIES',     count: 51, color: ['#2D1A4A', '#9333EA'], icon: 'vape' },
  { name: 'MERCHANDISE',   count: 60, color: ['#1A1A1A', '#DB6433'], icon: 'shopping' },
  { name: 'CANDIES',       count: 57, color: ['#A0282E', '#F59E0B'], icon: 'candy' },
  { name: 'FOOD STUFF',    count: 25, color: ['#1F4A3D', '#10B981'], icon: 'snack' },
  { name: 'GROCERY',       count: 47, color: ['#1F4A2A', '#22C55E'], icon: 'cleaning' },
  { name: 'MOTOR OIL',     count: 16, color: ['#1F2A1A', '#EF4444'], icon: 'oil' },
  { name: 'DRINKS & BAGS', count: 44, color: ['#1F2A4A', '#0EA5E9'], icon: 'drink' }
];

// The home page's pitch: the h1's supporting line (HomeHero) and the meta
// description (src/lib/meta.js HOME_DESCRIPTION), so the page says what the
// search result says (AW-004). It is the meta description as published, word
// for word; nothing new is claimed.
// The delivery wording (next-day, the three states, the Birmingham
// warehouse) should come from the business-facts module once the commerce
// lane's AW-283 lands.
export const HOME_PITCH = 'Wholesale tobacco, vapes, candy, drinks, grocery and motor oil for licensed retailers. Next-day delivery on our routes in Alabama, Mississippi and Georgia from our Birmingham warehouse.';

// The home page's split hero (src/components/HomeHero.jsx, AW-004): the
// eyebrow and the h1 come from the site's title and meta description.
// TODO(owner): Approve the home headline "Wholesale for licensed retailers." and its supporting line, and say whether the hero beside it keeps the four rotating photos or shows one fixed photo. (AW-004)
export const HOME_HERO = {
  eyebrow: 'WHOLESALE DISTRIBUTOR · BIRMINGHAM, AL',
  title: 'Wholesale for licensed retailers.',
  text: HOME_PITCH,
};

// The photos beside the home hero (src/components/HeroCarousel.jsx). Each
// slide links to its department (goCat) and describes its photo in `alt`.
// heroImage() supplies img (plain URL) and picture (the responsive WebP/JPEG
// set) from the photo in src/assets. Photos only: no slide ever used a video,
// so the carousel's video support was dropped.
// TODO(owner): Wide licensed photos of the warehouse or a multi-department assortment for the hero; the current hero photos are unchanged until then. (AW-006)
// eyebrow, title, sub, cta1 and cta2 are kept as published (decision 2) but
// no longer shown anywhere, not even as alt text (AW-169).
// TODO(owner): The unshown slide copy makes claims the catalog doesn't support: "over 368 SKUs", "Geekbar 25K" (the photo and catalog say Geek Bar Pulse X), "World's first 3D curved screen", Monster and Red Bull (only Gatorade and G2 are pictured) and Eagle torches. May eyebrow, title, sub, cta1 and cta2 be deleted? (AW-169)
export const HERO_SLIDES = [
  { eyebrow: 'NEW THIS WEEK', title: 'The brands your customers ask for.', sub: 'Tobacco, novelties, candy, beverages, motor oil, household and more — over 368 SKUs at our Birmingham warehouse.', cta1: 'Shop Catalog', cta2: 'Apply for Account', ...heroImage('hero_candy.jpg'), alt: 'Display box of Turtles Bites chocolates', accent: 'orange', goCat: 'CANDIES' },
  { eyebrow: 'BESTSELLING NOVELTIES', title: 'Geekbar 25K — now in stock.', sub: 'World\'s first 3D curved screen disposable. Flavors and availability change often. The trade desk confirms what is in stock.', cta1: 'Shop Novelties', cta2: 'See All Vape', ...heroImage('hero_vape.jpg'), alt: 'Geek Bar Pulse X disposable vape advertisement', accent: 'navy', goCat: 'NOVELTIES', nicotineWarning: true },
  { eyebrow: 'COUNTER ESSENTIALS', title: 'BIC lighters & merchandise.', sub: 'Stock up the counter for less. Volume pricing on Bic, Eagle torches, Lattafa air freshener and more.', cta1: 'Shop Merchandise', cta2: 'View Displays', ...heroImage('hero_lighters.jpg'), alt: 'BIC lighters in a counter display tray', accent: 'orange', goCat: 'MERCHANDISE' },
  { eyebrow: 'DRINKS & BEVERAGES', title: 'Gatorade, Monster, Red Bull — by the case.', sub: 'Free delivery on orders over $1,500 when the stop is on a delivery route in Alabama, Mississippi or Georgia. Net-30 terms for approved accounts.', cta1: 'Shop Drinks', cta2: 'Get a Quote', ...heroImage('hero_gatorade.jpg'), alt: 'Gatorade and G2 bottles', accent: 'navy', goCat: 'DRINKS & BAGS' }
];

export const BRANDS = ["HERSHEY'S", 'GATORADE', 'BIC', 'WD-40', 'GEEK BAR', 'GAIN', 'STP', 'WHITE OWL', 'TWANGERZ', 'POM POM', 'NEON', 'JOB'];

// Not shown on the site.
// TODO(owner): Years in business, account or route counts, warehouse and truck photos, and which brand logos may be shown, before any trust claim like these is published. (AW-005)
export const TRUST = [
  { icon: 'ShieldCheck', title: '100% Authentic',        blurb: 'Sourced direct from manufacturers and authorized distributors. Every SKU verified.' },
  { icon: 'Truck',       title: 'Free Delivery $1,500+', blurb: 'Will-call pickup at the Birmingham warehouse during business hours, or next-day delivery on our routes in Alabama, Georgia and Mississippi.' },
  { icon: 'Tag',         title: 'Volume Discounts',      blurb: 'Tiered case and pallet pricing. Save up to 18% on pallet-quantity orders.' },
  { icon: 'Users',       title: 'Family Owned',          blurb: 'Three generations serving Southeast retailers. Real relationships, honest pricing.' }
];

// Not shown on the site.
// TODO(owner): Confirm the FAQ answers (including Net-30, approval time and volume discounts) before they are published. (AW-279)
export const FAQS = [
  { q: 'Do I need a business license to order?',
    a: 'Yes. Alabama Wholesale only sells to licensed retailers. You\'ll need a valid retail business license, sales tax / resale certificate, and (for tobacco/vape products) a tobacco permit for your state. We verify all documents during account approval.' },
  { q: 'What is your minimum order?',
    a: 'The minimum order is $500.00. Free delivery applies to orders of $1,500 or more when the stop is on a delivery route. Will-call is pickup at the Birmingham warehouse during business hours.' },
  { q: 'How long does account approval take?',
    a: 'Most applications are approved within 24 hours. Net-30 terms require credit verification which can add 2–3 business days. You can also call us at (205) 354-4473 to expedite.' },
  { q: 'What areas do you deliver to?',
    a: 'We deliver on routes in Alabama, Mississippi and Georgia. Next-day delivery on our own trucks and free delivery on orders over $1,500 apply when the stop is on a delivery route.' },
  { q: 'Can I pick up my order in person?',
    a: 'Yes. Will-call is pickup at the Birmingham warehouse, 613 Graymont Ave N, during business hours: Monday–Friday 7:00 AM–6:00 PM, Saturday–Sunday 8:00 AM–5:30 PM.' },
  { q: 'How does pallet / volume pricing work?',
    a: 'Discounts kick in starting at 5 cases (5%) and scale up to 18% off for 5+ pallet orders. The discount is applied automatically at checkout. Contact your trade rep for custom mixed-pallet pricing.' },
  { q: 'What payment methods do you accept?',
    a: 'Cash, checks, and electronic wiring and transfers. Net-30 terms for approved accounts.' },
  { q: 'Do you deliver outside Alabama, Mississippi and Georgia?',
    a: 'Delivery is currently on routes in Alabama, Mississippi and Georgia.' }
];

export const WELCOME_OFFERS = [
  {
    type: 'NEW',
    color: '#DB6433',
    title: 'Geekbar Pulse X 25K — In Stock Now',
    body: 'World-first 3D curved screen disposable. Flavors and availability change often. The trade desk confirms what is in stock at our Birmingham warehouse.',
    cta: 'Shop Vapes',
    target: 'NOVELTIES'
  },
  {
    type: 'RESTOCK',
    color: '#1E1B5C',
    title: 'BIC Lighters — Counter Displays Restocked',
    body: '50-count assorted color displays back in stock. Perfect for high-traffic counters. Volume pricing available.',
    cta: 'Shop Lighters',
    target: 'MERCHANDISE'
  },
  {
    type: 'SALE',
    color: '#1F7A47',
    title: 'Pallet Rates — Up To 18% Off',
    body: 'Save up to 18% on pallet quantities. Mix and match any combination of SKUs. Net-30 terms for approved accounts.',
    cta: 'Get a Quote',
    target: null
  }
];

export const STORAGE = {
  // localStorage: the dated 21+ confirmation (src/lib/ageGate.js, AW-340).
  age: 'aw-age-verified',
  // sessionStorage: "No, exit" on the age gate, for this tab's session (AW-176).
  ageDeclined: 'aw-age-declined',
  // localStorage: the cart, one per account on this device plus one for
  // guests ('aw-cart-v2:guest', 'aw-cart-v2:<user id>'), and lines from an
  // older cart that still need a variant ('aw-cart-legacy:<owner>'). See
  // src/lib/cartStorage.js (AW-189, AW-354). The first builds' 'aw-cart',
  // 'aw-trade-user' and 'aw-welcome-seen' are moved or removed there.
  cart: 'aw-cart-v2',
  cartLegacy: 'aw-cart-legacy'
};

export const FREE_DELIVERY_THRESHOLD = 1500;
// TODO(owner): Is the $500 minimum order a hard rule that blocks submission, or only a guideline that orders below it may still be submitted? It is not enforced; checkout only notes it. (AW-076)
export const ORDER_MINIMUM = 500;

// The date the Trade terms and Privacy policy last changed, as the policy
// pages print it, and the version a trade application records acceptance of
// (profiles.terms_version, AW-019). Change both together when either policy
// changes; content.test.js checks they name the same month.
// TODO(owner): approve the Trade terms and Privacy policy version the
// application records acceptance of (AW-019).
// TODO(owner): The exact date each policy should show. (AW-277)
export const POLICIES_UPDATED = 'September 2026';
export const TERMS_VERSION = '2026-09';
