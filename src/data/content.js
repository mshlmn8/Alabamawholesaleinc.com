// Storefront content: company info, marketing copy, hero slides, FAQs, and
// welcome-popup offers. PRODUCTS lives in ./products.js.

import { IMG } from './theme.js';

export const COMPANY = {
  name: 'Alabama Wholesale Inc',
  phone: '(205) 555-0199',
  phoneRaw: '+12055550199',
  whatsapp: '12055550199',
  email: 'trade@alabamawholesale.com',
  addressShort: '613 Graymont Ave N, Birmingham AL 35203',
  addressLine1: '613 Graymont Ave N',
  addressLine2: 'Birmingham, AL 35203',
  hoursLine1: 'Mon–Fri 7:00 AM – 6:00 PM',
  hoursLine2: 'Sat–Sun 8:00 AM – 5:00 PM'
};

export const ANNOUNCEMENTS = [
  '★ FREE DELIVERY on orders over $1,500 in Alabama, Mississippi & Georgia',
  '★ NET-30 TERMS available for approved retail accounts',
  '★ SAME-DAY WILL-CALL · Order by 11AM, pick up the same afternoon',
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
  { eyebrow: 'NEW THIS WEEK', title: 'The brands your customers ask for.', sub: 'Tobacco, novelties, candy, beverages, motor oil, household and more — over 368 SKUs ready to ship from our Birmingham warehouse.', cta1: 'Shop Catalog', cta2: 'Apply for Account', img: IMG.hero_candy, videoUrl: null, accent: 'orange', goCat: 'NOVELTIES' },
  { eyebrow: 'BESTSELLING NOVELTIES', title: 'Geekbar 25K — now in stock.', sub: 'World\'s first 3D curved screen disposable. Full flavor lineup available, ready to ship today.', cta1: 'Shop Novelties', cta2: 'See All Vape', img: IMG.hero_vape, videoUrl: null, accent: 'navy', goCat: 'NOVELTIES' },
  { eyebrow: 'COUNTER ESSENTIALS', title: 'BIC lighters & merchandise.', sub: 'Stock up the counter for less. Volume pricing on Bic, Eagle torches, Lattafa air freshener and more.', cta1: 'Shop Merchandise', cta2: 'View Displays', img: IMG.hero_lighters, videoUrl: null, accent: 'orange', goCat: 'MERCHANDISE' },
  { eyebrow: 'DRINKS & BEVERAGES', title: 'Gatorade, Monster, Red Bull — by the case.', sub: 'Free delivery within 100 miles of Birmingham on orders over $1,500. Net-30 terms for approved accounts.', cta1: 'Shop Drinks', cta2: 'Get a Quote', img: IMG.hero_gatorade, videoUrl: null, accent: 'navy', goCat: 'DRINKS & BAGS' }
];

export const BRANDS = ["HERSHEY'S", 'GATORADE', 'BIC', 'WD-40', 'GEEK BAR', 'GAIN', 'STP', 'WHITE OWL', 'TWANGERZ', 'POM POM', 'NEON', 'JOB'];

export const TRUST = [
  { icon: 'ShieldCheck', title: '100% Authentic',        blurb: 'Sourced direct from manufacturers and authorized distributors. Every SKU verified.' },
  { icon: 'Truck',       title: 'Free Delivery $1,500+', blurb: 'Same-day pickup or next-day delivery throughout Alabama, Georgia & Mississippi.' },
  { icon: 'Tag',         title: 'Volume Discounts',      blurb: 'Tiered case and pallet pricing. Save up to 18% on pallet-quantity orders.' },
  { icon: 'Users',       title: 'Family Owned',          blurb: 'Three generations serving Southeast retailers. Real relationships, honest pricing.' }
];

export const FAQS = [
  { q: 'Do I need a business license to order?',
    a: 'Yes. Alabama Wholesale only sells to licensed retailers. You\'ll need a valid retail business license, sales tax / resale certificate, and (for tobacco/vape products) a tobacco permit for your state. We verify all documents during account approval.' },
  { q: 'What is your minimum order?',
    a: 'There is no minimum order amount once your wholesale account is approved. However, free delivery only applies to orders of $1,500 or more. Smaller orders qualify for will-call pickup or paid freight.' },
  { q: 'How long does account approval take?',
    a: 'Most applications are approved within 24 hours. Net-30 terms require credit verification which can add 2–3 business days. You can also call us at (205) 555-0199 to expedite.' },
  { q: 'What areas do you deliver to?',
    a: 'We deliver throughout Alabama, Georgia, Mississippi, Tennessee, and parts of Florida and Louisiana. Free delivery on $1,500+ orders within 100 miles of Birmingham. Outside that radius, freight is calculated at order time.' },
  { q: 'Can I pick up my order in person?',
    a: 'Yes. Our Birmingham warehouse offers same-day will-call. Order by 11 AM and your products will be ready to pick up the same afternoon. We\'re located at 613 Graymont Ave N.' },
  { q: 'How does pallet / volume pricing work?',
    a: 'Discounts kick in starting at 5 cases (5%) and scale up to 18% off for 5+ pallet orders. The discount is applied automatically at checkout. Contact your trade rep for custom mixed-pallet pricing.' },
  { q: 'What payment methods do you accept?',
    a: 'Cash, check, ACH transfer, all major credit cards (Visa, Mastercard, Amex, Discover), and Net-30 terms for approved accounts. Card payments may include a small processing fee on orders over $5,000.' },
  { q: 'Do you ship out of state?',
    a: 'For tobacco and vape products, we follow PACT Act and state-by-state regulations. Some products may not be shippable to certain states. Other categories (candy, beverages, household, automotive) ship freely throughout the Southeast.' }
];

export const WELCOME_OFFERS = [
  {
    type: 'NEW',
    color: '#DB6433',
    title: 'Geekbar Pulse X 25K — In Stock Now',
    body: 'World-first 3D curved screen disposable. All 12 flavors available, ready to ship today from our Birmingham warehouse.',
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
  age: 'aw-age-verified',
  cart: 'aw-cart',
  user: 'aw-trade-user',
  welcome: 'aw-welcome-seen'
};

export const FREE_DELIVERY_THRESHOLD = 1500;
