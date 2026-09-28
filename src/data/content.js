// Storefront content: company info, marketing copy, hero slides, FAQs, and
// welcome-popup offers. PRODUCTS lives in ./products.js.

import { heroImage } from '../lib/images.js';

export const COMPANY = {
  name: 'Alabama Wholesale Inc',
  phone: '(205) 458-4788',
  phoneRaw: '+12054584788',
  whatsapp: '12054584788',
  email: 'Alabamawholesaleinc@gmail.com',
  addressShort: '613 Graymont Ave N, Birmingham AL 35203',
  addressLine1: '613 Graymont Ave N',
  addressLine2: 'Birmingham, AL 35203',
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

// Owner photos of the Birmingham warehouse. heroImage() supplies img and picture
// from src/assets/hero_wh_*.jpg. The homepage carousel is a short reel; the
// contact page shows the rest. Frames with an identifiable person are omitted.
const warehousePhoto = (file, title) => ({ title, videoUrl: null, ...heroImage(file) });

export const HERO_SLIDES = [
  warehousePhoto('hero_wh_sign.jpg', 'Warehouse sign'),
  warehousePhoto('hero_wh_truck.jpg', 'Delivery truck'),
  warehousePhoto('hero_wh_graymont.jpg', 'Graymont Ave N'),
  warehousePhoto('hero_wh_aisle.jpg', 'Warehouse aisle'),
  warehousePhoto('hero_wh_cooler.jpg', 'Drink coolers'),
  warehousePhoto('hero_wh_chips.jpg', 'Chip aisle'),
  warehousePhoto('hero_wh_candy.jpg', 'Candy aisle'),
  warehousePhoto('hero_wh_floor.jpg', 'Snack aisle'),
];

export const WAREHOUSE_GALLERY = [
  warehousePhoto('hero_wh_truck_front.jpg', 'Delivery truck at the warehouse'),
  warehousePhoto('hero_wh_truck_door.jpg', 'Alabama Wholesale truck'),
  warehousePhoto('hero_wh_truck_cab.jpg', 'Truck parked at the warehouse'),
  warehousePhoto('hero_wh_truck_lot.jpg', 'Truck in the warehouse lot'),
  warehousePhoto('hero_wh_truck_side.jpg', 'Truck beside the warehouse'),
  warehousePhoto('hero_wh_aisle_cases.jpg', 'Cases along a warehouse aisle'),
  warehousePhoto('hero_wh_aisle_long.jpg', 'Long warehouse aisle'),
  warehousePhoto('hero_wh_aisle_snacks.jpg', 'Snack aisle'),
  warehousePhoto('hero_wh_aisle_end.jpg', 'End of a warehouse aisle'),
  warehousePhoto('hero_wh_snacks.jpg', 'Snack shelves'),
  warehousePhoto('hero_wh_candy_rack.jpg', 'Candy rack'),
  warehousePhoto('hero_wh_drinks.jpg', 'Drink shelves'),
  warehousePhoto('hero_wh_candy_boxes.jpg', 'Candy boxes'),
  warehousePhoto('hero_wh_endcap.jpg', 'Warehouse endcap'),
  warehousePhoto('hero_wh_candy_bags.jpg', 'Bagged candy'),
  warehousePhoto('hero_wh_household.jpg', 'Household aisle'),
  warehousePhoto('hero_wh_juice.jpg', 'Juice and drink aisle'),
  warehousePhoto('hero_wh_gummies.jpg', 'Gummy candy'),
  warehousePhoto('hero_wh_candy_wall.jpg', 'Candy wall'),
  warehousePhoto('hero_wh_chips_close.jpg', 'Chip bags'),
  warehousePhoto('hero_wh_counter.jpg', 'Counter snacks'),
  warehousePhoto('hero_wh_truck_parked.jpg', 'Truck parked outside'),
  warehousePhoto('hero_wh_counter_display.jpg', 'Counter display'),
  warehousePhoto('hero_wh_truck_gate.jpg', 'Truck near the gate'),
  warehousePhoto('hero_wh_truck_row.jpg', 'Trucks at the warehouse'),
  warehousePhoto('hero_wh_aisle_far.jpg', 'Far warehouse aisle'),
  warehousePhoto('hero_wh_aisle_back.jpg', 'Back warehouse aisle'),
  warehousePhoto('hero_wh_aisle_near.jpg', 'Near warehouse aisle'),
  warehousePhoto('hero_wh_aisle_center.jpg', 'Center warehouse aisle'),
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
    a: 'Most applications are approved within 24 hours. Net-30 terms require credit verification which can add 2–3 business days. You can also call us at (205) 458-4788 to expedite.' },
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
  age: 'aw-age-verified',
  cart: 'aw-cart',
  user: 'aw-trade-user',
  welcome: 'aw-welcome-seen'
};

export const FREE_DELIVERY_THRESHOLD = 1500;
export const ORDER_MINIMUM = 500;
