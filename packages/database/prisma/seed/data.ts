/**
 * Seed data seedhe shared UI screens se derive kiya gaya hai.
 *
 * Money hamesha paise mein. Screens ne "$4.99" dikhaya tha, lekin receipts,
 * UPI aur +91 number INR indicate karte hain — isliye wahi numerals ₹ ke
 * roop mein padhe gaye hain (₹499 for 2 organic Hass avocados — India ke
 * liye plausible price hai).
 */
export const BENGALURU = { latitude: 12.9716, longitude: 77.5946 };

const days = <T,>(fn: (d: number) => T) => Array.from({ length: 7 }, (_, d) => fn(d));

export const HOURS_9_TO_22 = days((dayOfWeek) => ({
  dayOfWeek,
  opensAt: '09:00',
  closesAt: '22:00',
}));

export const HOURS_7_TO_23 = days((dayOfWeek) => ({
  dayOfWeek,
  opensAt: '07:00',
  closesAt: '23:00',
}));

/** Metro Hardware — screen [1] mein "Closed · Opens 9 AM" dikhta hai */
export const HOURS_9_TO_18 = days((dayOfWeek) => ({
  dayOfWeek,
  opensAt: '09:00',
  closesAt: '18:00',
}));

export type SeedHours = typeof HOURS_9_TO_22;

export const CATEGORIES = [
  { name: 'Grocery', slug: 'grocery', sortOrder: 1 },
  { name: 'Organic', slug: 'organic', sortOrder: 2 },
  { name: 'Fresh Produce', slug: 'fresh-produce', sortOrder: 3 },
  { name: 'Bakery', slug: 'bakery', sortOrder: 4 },
  { name: 'Dairy', slug: 'dairy', sortOrder: 5 },
  { name: 'Pharmacy', slug: 'pharmacy', sortOrder: 6 },
  { name: 'Cafe', slug: 'cafe', sortOrder: 7 },
  { name: 'Hardware', slug: 'hardware', sortOrder: 8 },
  { name: 'Convenience', slug: 'convenience', sortOrder: 9 },
];

export interface SeedProduct {
  name: string;
  unitLabel: string;
  unitDetail?: string;
  description?: string;
  section: string;
  priceMinor: number;
  mrpMinor?: number;
  badges?: string[];
  shelfLife?: string;
  storageInfo?: string;
  stockQty: number;
  popularityScore: number;
}

export interface SeedStore {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  phone: string;
  addressLine: string;
  /** Bengaluru centre se offset, taaki distances screens se match karein */
  offsetKm: { north: number; east: number };
  categories: string[];
  primaryCategory: string;
  deliveryFeeMinor: number;
  minOrderMinor: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  ratingAvg: number;
  ratingCount: number;
  hours: SeedHours;
  sections: string[];
  products: SeedProduct[];
}

/** Screen [3][5][6] ka poora catalog */
const FRESH_VALLEY_PRODUCTS: SeedProduct[] = [
  {
    name: 'Organic Hass Avocados',
    unitLabel: '2 pcs pack',
    unitDetail: 'approx. 350g - 400g',
    description:
      'Handpicked, perfectly ripe Hass avocados sourced directly from local certified organic orchards. Creamy, rich in healthy fats, and ideal for guacamole, morning toasts, or fresh salads.',
    section: 'Fruits & Veg',
    priceMinor: 49900,
    mrpMinor: 64900, // "23% OFF" badge isse derive hota hai
    badges: ['Organic Certified'],
    shelfLife: '3-5 days',
    storageInfo: 'Room temp / Refrigerate',
    stockQty: 60,
    popularityScore: 980,
  },
  {
    name: 'Fresh Whole Milk',
    unitLabel: '1 Liter',
    description: 'Pasteurised full-cream milk from local dairy farms, delivered cold.',
    section: 'Dairy',
    priceMinor: 24900,
    shelfLife: '2 days',
    storageInfo: 'Refrigerate',
    stockQty: 120,
    popularityScore: 940,
  },
  {
    name: 'Artisan Sourdough Loaf',
    unitLabel: '500g loaf',
    description: 'Slow-fermented wild yeast sourdough, baked fresh every morning.',
    section: 'Bakery',
    priceMinor: 39900,
    shelfLife: '3 days',
    storageInfo: 'Room temp',
    stockQty: 25,
    popularityScore: 870,
  },
  {
    name: 'Organic Baby Spinach',
    unitLabel: '250g bag',
    description: 'Tender baby spinach leaves, triple-washed and ready to use.',
    section: 'Fruits & Veg',
    priceMinor: 29900,
    badges: ['Organic Certified'],
    shelfLife: '4 days',
    storageInfo: 'Refrigerate',
    stockQty: 40,
    popularityScore: 760,
  },
  {
    name: 'Greek Yogurt Tub',
    unitLabel: '500g tub',
    description: 'Thick, creamy strained yogurt with live cultures and no added sugar.',
    section: 'Dairy',
    priceMinor: 42900,
    shelfLife: '10 days',
    storageInfo: 'Refrigerate',
    stockQty: 55,
    popularityScore: 820,
  },
  {
    name: 'Premium Honey 350g',
    unitLabel: '350g jar',
    description: 'Raw, unfiltered multi-floral honey from Western Ghats apiaries.',
    section: 'Pantry',
    priceMinor: 69900,
    mrpMinor: 79900,
    shelfLife: '24 months',
    storageInfo: 'Room temp',
    stockQty: 30,
    popularityScore: 640,
  },
  {
    name: 'Almond Milk Unsweetened',
    unitLabel: '1L carton',
    description: 'Plant-based almond milk with no added sugar or preservatives.',
    section: 'Dairy',
    priceMinor: 34900,
    shelfLife: '6 months',
    storageInfo: 'Room temp until opened',
    stockQty: 45,
    popularityScore: 700,
  },
  {
    name: 'Cold Pressed Olive Oil',
    unitLabel: '500ml',
    description: 'Extra virgin, first cold press. Low acidity, peppery finish.',
    section: 'Pantry',
    priceMinor: 89900,
    mrpMinor: 99900,
    shelfLife: '18 months',
    storageInfo: 'Cool, dark place',
    stockQty: 20,
    popularityScore: 590,
  },
];

export const STORES: SeedStore[] = [
  {
    name: 'Fresh Valley Supermarket',
    slug: 'fresh-valley-supermarket',
    tagline: 'Groceries & Daily Essentials',
    description:
      'A neighbourhood supermarket stocking farm-fresh produce, dairy, bakery and pantry staples. Family-run since 2012.',
    phone: '+918041234567',
    addressLine: '14/A Green Park Avenue, Main Market Road',
    offsetKm: { north: 1.0, east: 0.65 }, // ≈ 1.2 km
    categories: ['Grocery', 'Organic', 'Fresh Produce'],
    primaryCategory: 'Grocery',
    deliveryFeeMinor: 3000,
    minOrderMinor: 19900,
    etaMinMinutes: 15,
    etaMaxMinutes: 20,
    ratingAvg: 4.8,
    ratingCount: 320,
    hours: HOURS_7_TO_23,
    sections: ['Fruits & Veg', 'Dairy', 'Bakery', 'Pantry'],
    products: FRESH_VALLEY_PRODUCTS,
  },
  {
    name: 'Apollo Health Pharmacy',
    slug: 'apollo-health-pharmacy',
    tagline: 'Medical & Healthcare',
    description: 'Licensed pharmacy with prescription fulfilment and everyday wellness products.',
    phone: '+918041234568',
    addressLine: '2nd Cross, Jayanagar 4th Block',
    offsetKm: { north: 0.6, east: 0.53 }, // ≈ 0.8 km
    categories: ['Pharmacy'],
    primaryCategory: 'Pharmacy',
    deliveryFeeMinor: 2000,
    minOrderMinor: 9900,
    etaMinMinutes: 10,
    etaMaxMinutes: 15,
    ratingAvg: 4.6,
    ratingCount: 184,
    hours: HOURS_9_TO_22,
    sections: ['Wellness', 'First Aid', 'Personal Care'],
    products: [
      { name: 'Digital Thermometer', unitLabel: '1 unit', section: 'First Aid', priceMinor: 29900, mrpMinor: 39900, stockQty: 35, popularityScore: 500 },
      { name: 'Vitamin D3 Tablets', unitLabel: '60 tablets', section: 'Wellness', priceMinor: 44900, stockQty: 80, popularityScore: 610 },
      { name: 'Antiseptic Liquid', unitLabel: '500ml', section: 'First Aid', priceMinor: 21900, stockQty: 60, popularityScore: 430 },
    ],
  },
  {
    name: 'Tuscan Cafe & Bakery',
    slug: 'tuscan-cafe-bakery',
    tagline: 'Cafes & Desserts',
    description: 'Wood-fired bakes, espresso and celebration cakes made fresh daily.',
    phone: '+918041234569',
    addressLine: '7 Church Street, Ashok Nagar',
    offsetKm: { north: 1.7, east: 1.2 }, // ≈ 2.1 km
    categories: ['Cafe', 'Bakery'],
    primaryCategory: 'Cafe',
    deliveryFeeMinor: 3900,
    minOrderMinor: 14900,
    etaMinMinutes: 25,
    etaMaxMinutes: 30,
    ratingAvg: 4.9,
    ratingCount: 512,
    hours: HOURS_7_TO_23,
    sections: ['Breads', 'Pastries', 'Coffee'],
    products: [
      { name: 'Butter Croissant', unitLabel: '2 pcs', section: 'Pastries', priceMinor: 21900, stockQty: 40, popularityScore: 890 },
      { name: 'Dark Chocolate Brownie', unitLabel: '4 pcs box', section: 'Pastries', priceMinor: 34900, mrpMinor: 39900, stockQty: 25, popularityScore: 810 },
      { name: 'Cold Brew Coffee', unitLabel: '300ml bottle', section: 'Coffee', priceMinor: 27900, stockQty: 50, popularityScore: 770 },
    ],
  },
  {
    name: 'Metro Hardware & Tools',
    slug: 'metro-hardware-tools',
    tagline: 'Hardware & Home Repair',
    description: 'Tools, fittings, paints and everything for home repair jobs.',
    phone: '+918041234570',
    addressLine: '45 Industrial Layout, Rajajinagar',
    offsetKm: { north: 2.8, east: 1.9 }, // ≈ 3.4 km
    categories: ['Hardware'],
    primaryCategory: 'Hardware',
    deliveryFeeMinor: 49900, // screen [1] par prominently dikhta hai
    minOrderMinor: 29900,
    etaMinMinutes: 45,
    etaMaxMinutes: 60,
    ratingAvg: 4.3,
    ratingCount: 96,
    hours: HOURS_9_TO_18, // band hone par "Opens 9 AM"
    sections: ['Tools', 'Electrical', 'Paint'],
    products: [
      { name: 'Cordless Drill Kit', unitLabel: '1 kit', section: 'Tools', priceMinor: 349900, mrpMinor: 429900, stockQty: 8, popularityScore: 400 },
      { name: 'LED Bulb 9W', unitLabel: 'Pack of 4', section: 'Electrical', priceMinor: 39900, stockQty: 90, popularityScore: 520 },
    ],
  },
  {
    name: 'FreshMart Superstore',
    slug: 'freshmart-superstore',
    tagline: 'Grocery & Daily Essentials',
    description: 'Large-format superstore with staples, fresh produce and household goods.',
    phone: '+918041234571',
    addressLine: '88 Residency Road, Shanti Nagar',
    offsetKm: { north: 0.9, east: 0.7 },
    categories: ['Grocery', 'Fresh Produce'],
    primaryCategory: 'Grocery',
    deliveryFeeMinor: 3000,
    minOrderMinor: 19900,
    etaMinMinutes: 25,
    etaMaxMinutes: 30,
    ratingAvg: 4.7,
    ratingCount: 410,
    hours: HOURS_7_TO_23,
    sections: ['Staples', 'Dairy', 'Bakery', 'Fruits & Veg'],
    products: [
      { name: 'Basmati Rice Premium', unitLabel: '5kg bag', section: 'Staples', priceMinor: 42000, stockQty: 40, popularityScore: 900 },
      { name: 'Fresh Whole Milk', unitLabel: '1 Liter', section: 'Dairy', priceMinor: 13000, stockQty: 150, popularityScore: 950 },
      { name: 'Organic Farm Eggs', unitLabel: 'Pack of 12', section: 'Dairy', priceMinor: 11000, badges: ['Organic Certified'], stockQty: 70, popularityScore: 880 },
      { name: 'Artisan Whole Wheat Sourdough', unitLabel: '400g loaf', section: 'Bakery', priceMinor: 8500, stockQty: 30, popularityScore: 700 },
      { name: 'Organic Hass Avocados', unitLabel: '2 pcs pack', section: 'Fruits & Veg', priceMinor: 49900, mrpMinor: 64900, badges: ['Organic Certified'], stockQty: 45, popularityScore: 860 },
      { name: 'Artisan Sourdough Loaf', unitLabel: '500g loaf', section: 'Bakery', priceMinor: 39900, stockQty: 20, popularityScore: 680 },
    ],
  },
  {
    name: "Nature's Basket Organic",
    slug: 'natures-basket-organic',
    tagline: 'Organic & Health Foods',
    description: 'Certified organic produce, superfoods and clean-label pantry goods.',
    phone: '+918041234572',
    addressLine: '12 Lavelle Road, Bengaluru',
    offsetKm: { north: 1.3, east: 0.9 },
    categories: ['Organic', 'Grocery'],
    primaryCategory: 'Organic',
    deliveryFeeMinor: 3500,
    minOrderMinor: 24900,
    etaMinMinutes: 20,
    etaMaxMinutes: 30,
    ratingAvg: 4.9,
    ratingCount: 268,
    hours: HOURS_9_TO_22,
    sections: ['Dairy', 'Pantry', 'Fruits & Veg'],
    products: [
      { name: 'Greek Yogurt', unitLabel: '500g tub', section: 'Dairy', priceMinor: 42900, stockQty: 35, popularityScore: 720 },
      { name: 'Granola Clusters', unitLabel: '400g pack', section: 'Pantry', priceMinor: 44900, stockQty: 40, popularityScore: 660 },
      { name: 'Chia Seeds', unitLabel: '250g pack', section: 'Pantry', priceMinor: 32900, stockQty: 50, popularityScore: 540 },
    ],
  },
  {
    name: 'Daily Essentials Hub',
    slug: 'daily-essentials-hub',
    tagline: 'Convenience & Daily Needs',
    description: 'Round-the-clock convenience store for everyday top-ups.',
    phone: '+918041234573',
    addressLine: '5 Wilson Garden, 9th Cross',
    offsetKm: { north: 1.9, east: 1.4 },
    categories: ['Convenience', 'Grocery'],
    primaryCategory: 'Convenience',
    deliveryFeeMinor: 2500,
    minOrderMinor: 9900,
    etaMinMinutes: 15,
    etaMaxMinutes: 25,
    ratingAvg: 4.2,
    ratingCount: 143,
    hours: HOURS_7_TO_23,
    sections: ['Bakery', 'Dairy', 'Snacks'],
    products: [
      { name: 'Whole Wheat Bread', unitLabel: '400g loaf', section: 'Bakery', priceMinor: 6000, stockQty: 60, popularityScore: 620 },
      { name: 'Salted Butter', unitLabel: '100g block', section: 'Dairy', priceMinor: 6000, stockQty: 80, popularityScore: 580 },
    ],
  },
  {
    name: 'Pure Juice Co.',
    slug: 'pure-juice-co',
    tagline: 'Juices & Cold Pressed',
    description: 'Cold-pressed juices and wellness shots, bottled the same morning.',
    phone: '+918041234574',
    addressLine: '31 Indiranagar 100ft Road',
    offsetKm: { north: 2.2, east: 1.5 },
    categories: ['Cafe', 'Organic'],
    primaryCategory: 'Cafe',
    deliveryFeeMinor: 3000,
    minOrderMinor: 14900,
    etaMinMinutes: 20,
    etaMaxMinutes: 30,
    ratingAvg: 4.5,
    ratingCount: 97,
    hours: HOURS_7_TO_23,
    sections: ['Juices', 'Shots'],
    products: [
      { name: 'Cold-Pressed Green Detox Juice', unitLabel: '16oz bottle', section: 'Juices', priceMinor: 75000, stockQty: 30, popularityScore: 690 },
      { name: 'Ginger Turmeric Shot', unitLabel: '60ml', section: 'Shots', priceMinor: 14900, stockQty: 70, popularityScore: 510 },
    ],
  },
];
