// Storefront content: company info, marketing copy, hero slides, FAQs, and
// welcome-popup offers. PRODUCTS lives in ./products.js.

import { heroImage } from '../lib/images.js';

export const COMPANY = {
  name: 'Alabama Wholesale Inc',
  phone: '(205) 354-4473',
  phoneRaw: '+12053544473',
  whatsapp: '12053544473',
  email: 'Alabamawholesaleinc@gmail.com',
  addressShort: '613 Graymont Ave N, Birmingham AL 35203',
  addressLine1: '613 Graymont Ave N',
  addressLine2: 'Birmingham, AL 35203',
  // The same address in parts: the will-call address a quote sends to a
  // database without submit_quote v2 (src/lib/orders.js, AW-079).
  addressStreet: '613 Graymont Ave N',
  addressCity: 'Birmingham',
  addressState: 'AL',
  addressZip: '35203',
  hoursLine1: 'Mon–Fri 7:00 AM – 6:00 PM',
  hoursLine2: 'Sat–Sun 8:00 AM – 5:30 PM'
};

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

export const HERO_SLIDES = [
  // To use video: set videoUrl to a public MP4 URL (or leave null for image)
  // For demo, all use images. Replace with your real product videos.
  // heroImage() supplies img (plain URL, used as the video poster) and picture
  // (responsive WebP/JPEG set) from the photo in src/assets.
  { eyebrow: 'NEW THIS WEEK', title: 'The brands your customers ask for.', sub: 'Tobacco, novelties, candy, beverages, motor oil, household and more — over 368 SKUs at our Birmingham warehouse.', cta1: 'Shop Catalog', cta2: 'Apply for Account', ...heroImage('hero_candy.jpg'), videoUrl: null, accent: 'orange', goCat: 'NOVELTIES' },
  { eyebrow: 'BESTSELLING NOVELTIES', title: 'Geekbar 25K — now in stock.', sub: 'World\'s first 3D curved screen disposable. Flavors and availability change often. The trade desk confirms what is in stock.', cta1: 'Shop Novelties', cta2: 'See All Vape', ...heroImage('hero_vape.jpg'), videoUrl: null, accent: 'navy', goCat: 'NOVELTIES' },
  { eyebrow: 'COUNTER ESSENTIALS', title: 'BIC lighters & merchandise.', sub: 'Stock up the counter for less. Volume pricing on Bic, Eagle torches, Lattafa air freshener and more.', cta1: 'Shop Merchandise', cta2: 'View Displays', ...heroImage('hero_lighters.jpg'), videoUrl: null, accent: 'orange', goCat: 'MERCHANDISE' },
  { eyebrow: 'DRINKS & BEVERAGES', title: 'Gatorade, Monster, Red Bull — by the case.', sub: 'Free delivery on orders over $1,500 when the stop is on a delivery route in Alabama, Mississippi or Georgia. Net-30 terms for approved accounts.', cta1: 'Shop Drinks', cta2: 'Get a Quote', ...heroImage('hero_gatorade.jpg'), videoUrl: null, accent: 'navy', goCat: 'DRINKS & BAGS' }
];

export const BRANDS = ["HERSHEY'S", 'GATORADE', 'BIC', 'WD-40', 'GEEK BAR', 'GAIN', 'STP', 'WHITE OWL', 'TWANGERZ', 'POM POM', 'NEON', 'JOB'];

export const TRUST = [
  { icon: 'ShieldCheck', title: '100% Authentic',        blurb: 'Sourced direct from manufacturers and authorized distributors. Every SKU verified.' },
  { icon: 'Truck',       title: 'Free Delivery $1,500+', blurb: 'Will-call pickup at the Birmingham warehouse during business hours, or next-day delivery on our routes in Alabama, Georgia and Mississippi.' },
  { icon: 'Tag',         title: 'Volume Discounts',      blurb: 'Tiered case and pallet pricing. Save up to 18% on pallet-quantity orders.' },
  { icon: 'Users',       title: 'Family Owned',          blurb: 'Three generations serving Southeast retailers. Real relationships, honest pricing.' }
];

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
export const ORDER_MINIMUM = 500;

// The date the Trade terms and Privacy policy last changed, as the policy
// pages print it, and the version a trade application records acceptance of
// (profiles.terms_version, AW-019). Change both together when either policy
// changes; content.test.js checks they name the same month.
// TODO(owner): approve the Trade terms and Privacy policy version the
// application records acceptance of (AW-019).
export const POLICIES_UPDATED = 'September 2026';
export const TERMS_VERSION = '2026-09';
