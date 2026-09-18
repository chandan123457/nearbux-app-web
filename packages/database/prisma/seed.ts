/**
 * NearBux development seed.
 *
 * Yeh database ko wahi state deta hai jo shared UI screens dikhati hain:
 * Rahul Sharma ka account, uske saved addresses, nearby stores, ek active
 * cart, in-progress order NB-4032, purane delivered orders, aur notification
 * feed.
 *
 * Idempotent hai — dobara chalane par pehle clean karta hai, isliye
 * `pnpm db:seed` kabhi bhi safe hai.
 */
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

import { computeBill, formatOrderNumber } from '@nearbux/core';
import { prisma } from '../src/index.js';
import { BENGALURU, CATEGORIES, STORES } from './seed/data.js';

/** Ek reference point se km offset ko lat/lng mein badalta hai */
function offsetCoords(northKm: number, eastKm: number) {
  const latPerKm = 1 / 110.574;
  const lngPerKm = 1 / (111.32 * Math.cos((BENGALURU.latitude * Math.PI) / 180));
  return {
    latitude: Number((BENGALURU.latitude + northKm * latPerKm).toFixed(6)),
    longitude: Number((BENGALURU.longitude + eastKm * lngPerKm).toFixed(6)),
  };
}

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60_000);
}

function daysAgoAt(days: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function clean() {
  // Order matters — FK dependents pehle. Ek transaction taaki partial
  // wipe se database kabhi inconsistent state mein na rahe.
  await prisma.$transaction([
    prisma.productReview.deleteMany(),
    prisma.storeReview.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.orderStatusEvent.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.promotionRedemption.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.favoriteProduct.deleteMany(),
    prisma.favoriteStore.deleteMany(),
    prisma.searchHistory.deleteMany(),
    prisma.banner.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.product.deleteMany(),
    prisma.productCategory.deleteMany(),
    prisma.storeHours.deleteMany(),
    prisma.storeCategoryLink.deleteMany(),
    prisma.store.deleteMany(),
    prisma.category.deleteMany(),
    prisma.savedPaymentMethod.deleteMany(),
    prisma.deviceToken.deleteMany(),
    prisma.session.deleteMany(),
    prisma.address.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function main() {
  console.log('🧹 Cleaning existing data…');
  await clean();

  // ── Categories ────────────────────────────────────────────────────────
  console.log('📂 Categories…');
  await prisma.category.createMany({ data: CATEGORIES });
  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

  // ── Stores + hours + sections + products ──────────────────────────────
  console.log('🏪 Stores, sections and products…');
  const storeBySlug = new Map<string, string>();
  const productKeyToId = new Map<string, string>(); // "slug::Product Name" → id

  for (const s of STORES) {
    const coords = offsetCoords(s.offsetKm.north, s.offsetKm.east);

    const store = await prisma.store.create({
      data: {
        name: s.name,
        slug: s.slug,
        tagline: s.tagline,
        description: s.description,
        phone: s.phone,
        addressLine: s.addressLine,
        city: 'Bengaluru',
        pincode: '560001',
        latitude: coords.latitude,
        longitude: coords.longitude,
        deliveryFeeMinor: s.deliveryFeeMinor,
        minOrderMinor: s.minOrderMinor,
        etaMinMinutes: s.etaMinMinutes,
        etaMaxMinutes: s.etaMaxMinutes,
        ratingAvg: s.ratingAvg,
        ratingCount: s.ratingCount,
        hours: { createMany: { data: s.hours } },
        categories: {
          createMany: {
            data: s.categories.map((name) => ({
              categoryId: categoryByName.get(name)!,
              isPrimary: name === s.primaryCategory,
            })),
          },
        },
        sections: {
          createMany: {
            data: s.sections.map((name, i) => ({ name, sortOrder: i })),
          },
        },
      },
      include: { sections: true },
    });
    storeBySlug.set(s.slug, store.id);

    const sectionByName = new Map(store.sections.map((sec) => [sec.name, sec.id]));

    for (const p of s.products) {
      const product = await prisma.product.create({
        data: {
          storeId: store.id,
          categoryId: sectionByName.get(p.section) ?? null,
          name: p.name,
          description: p.description ?? null,
          unitLabel: p.unitLabel,
          unitDetail: p.unitDetail ?? null,
          images: [],
          badges: p.badges ?? [],
          priceMinor: p.priceMinor,
          mrpMinor: p.mrpMinor ?? null,
          shelfLife: p.shelfLife ?? null,
          storageInfo: p.storageInfo ?? null,
          stockQty: p.stockQty,
          isAvailable: p.stockQty > 0,
          popularityScore: p.popularityScore,
        },
      });
      productKeyToId.set(`${s.slug}::${p.name}`, product.id);
    }
  }

  const pid = (slug: string, name: string): string => {
    const id = productKeyToId.get(`${slug}::${name}`);
    if (!id) throw new Error(`Seed product not found: ${slug}::${name}`);
    return id;
  };

  // Screen [6]: "4.9 · 184 verified reviews · 98% recommended"
  await prisma.product.update({
    where: { id: pid('fresh-valley-supermarket', 'Organic Hass Avocados') },
    data: { ratingAvg: 4.9, ratingCount: 184, recommendCount: 180 },
  });

  // ── User, addresses, payment method ───────────────────────────────────
  console.log('👤 User, addresses and payment methods…');
  const user = await prisma.user.create({
    data: {
      phone: '+919876543210',
      phoneVerified: true,
      fullName: 'Rahul Sharma',
      addresses: {
        create: [
          {
            label: 'HOME',
            line1: '123 MG Road',
            line2: 'Apt 4B',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
            latitude: BENGALURU.latitude,
            longitude: BENGALURU.longitude,
            isDefault: true,
          },
          {
            label: 'WORK',
            line1: '400 Outer Ring Road',
            line2: 'Tower B, 6th Floor',
            landmark: 'Near Bellandur Lake',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560103',
            latitude: 12.9256,
            longitude: 77.6761,
            isDefault: false,
          },
        ],
      },
      paymentMethods: {
        create: [
          { type: 'UPI', displayLabel: 'rahul@upi', isDefault: true },
          { type: 'UPI', displayLabel: 'rahul@okhdfcbank', isDefault: false },
        ],
      },
      // Screen [2][4] ke "RECENT SEARCHES" chips
      searches: {
        create: [
          { query: 'Almond milk', searchedAt: minutesAgo(30) },
          { query: 'Whole foods', searchedAt: minutesAgo(180) },
          { query: 'Avocado', searchedAt: minutesAgo(400) },
          { query: 'Fresh organic', searchedAt: minutesAgo(600) },
        ],
      },
    },
    include: { addresses: true, paymentMethods: true },
  });

  const homeAddress = user.addresses.find((a) => a.isDefault)!;
  const upiMethod = user.paymentMethods.find((m) => m.isDefault)!;

  // ── Favourites (screen [1] ke filled hearts) ──────────────────────────
  await prisma.favoriteStore.createMany({
    data: [
      { userId: user.id, storeId: storeBySlug.get('fresh-valley-supermarket')! },
      { userId: user.id, storeId: storeBySlug.get('tuscan-cafe-bakery')! },
    ],
  });
  await prisma.favoriteProduct.create({
    data: { userId: user.id, productId: pid('fresh-valley-supermarket', 'Organic Hass Avocados') },
  });

  console.log('🎟️  Promotions and banners…');
  const todayAt23 = new Date();
  todayAt23.setHours(23, 0, 0, 0);
  const inThirtyDays = new Date(Date.now() + 30 * 86_400_000);

  const nearbux20 = await prisma.promotion.create({
    data: {
      code: 'NEARBUX20',
      title: 'Flat ₹200 off community voucher',
      description: 'Community voucher — no minimum order',
      scope: 'PLATFORM',
      type: 'FLAT_OFF',
      value: 20000,
      minOrderMinor: 0,
      perUserLimit: 5,
      startsAt: daysAgoAt(7, 0, 0),
      endsAt: inThirtyDays,
    },
  });

  await prisma.promotion.create({
    data: {
      code: 'FRESH20',
      title: 'Flat 20% OFF on Fruits',
      description: 'Use code FRESH20 on orders above ₹2,500',
      scope: 'STORE',
      storeId: storeBySlug.get('fresh-valley-supermarket')!,
      type: 'PERCENT_OFF',
      value: 20,
      maxDiscountMinor: 50000,
      minOrderMinor: 250000,
      startsAt: daysAgoAt(2, 0, 0),
      endsAt: todayAt23, // "Valid till Today, 11 PM"
    },
  });

  await prisma.promotion.create({
    data: {
      code: 'FREEDEL',
      title: 'Free Delivery',
      description: 'No minimum order required',
      scope: 'STORE',
      storeId: storeBySlug.get('freshmart-superstore')!,
      type: 'FREE_DELIVERY',
      minOrderMinor: 0,
      startsAt: daysAgoAt(2, 0, 0),
      endsAt: inThirtyDays,
    },
  });

  await prisma.banner.create({
    data: {
      title: 'Fresh Valley Organic Market',
      subtitle:
        'Get farm-fresh organic produce delivered right to your doorstep in 20 minutes.',
      ctaLabel: 'Order Now',
      targetStoreId: storeBySlug.get('fresh-valley-supermarket')!,
      isSponsored: true,
      sortOrder: 0,
      startsAt: daysAgoAt(3, 0, 0),
      endsAt: inThirtyDays,
    },
  });

  await seedCartAndOrders({
    userId: user.id,
    addressId: homeAddress.id,
    addressSnapshot: {
      label: homeAddress.label as string,
      line1: homeAddress.line1,
      line2: homeAddress.line2,
      city: homeAddress.city,
      state: homeAddress.state,
      pincode: homeAddress.pincode,
      formatted: 'Home — 123 MG Road, Apt 4B, Bengaluru',
    },
    paymentLabel: upiMethod.displayLabel,
    storeBySlug,
    pid,
    nearbux20Id: nearbux20.id,
  });

  console.log('\n✅ Seed complete');
  await summarise();
}

/**
 * Order par copy hone wala address.
 *
 * `type` hai, `interface` nahi — Prisma ke Json input ko implicit index
 * signature chahiye, aur TypeScript woh type aliases ko deta hai, interfaces
 * ko nahi.
 */
type AddressSnapshot = {
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  formatted: string;
};

interface SeedContext {
  userId: string;
  addressId: string;
  addressSnapshot: AddressSnapshot;
  paymentLabel: string;
  storeBySlug: Map<string, string>;
  pid: (slug: string, name: string) => string;
  nearbux20Id: string;
}

async function seedCartAndOrders(ctx: SeedContext) {
  const { userId, addressId, addressSnapshot, storeBySlug, pid } = ctx;
  const freshmartId = storeBySlug.get('freshmart-superstore')!;

  // ── Active cart (screen [7]) ─────────────────────────────────────────
  console.log('🛒 Active cart…');
  await prisma.cart.create({
    data: {
      userId,
      storeId: freshmartId,
      promotionId: ctx.nearbux20Id,
      items: {
        create: [
          { productId: pid('freshmart-superstore', 'Organic Hass Avocados'), quantity: 2 },
          { productId: pid('freshmart-superstore', 'Fresh Whole Milk'), quantity: 1 },
          { productId: pid('freshmart-superstore', 'Artisan Sourdough Loaf'), quantity: 1 },
        ],
      },
    },
  });

  console.log('📦 Orders…');

  // ── NB-4032 — in progress, PREPARING (screens [9][10][11][13]) ───────
  const placedAt = minutesAgo(125); // ~2:10 PM wala scenario
  const lines = [
    { name: 'Organic Hass Avocados', unit: '2 pcs pack', unitPriceMinor: 49900, quantity: 2 },
    { name: 'Fresh Whole Milk', unit: '1 Liter', unitPriceMinor: 13000, quantity: 1 },
    { name: 'Artisan Sourdough Loaf', unit: '500g loaf', unitPriceMinor: 39900, quantity: 1 },
  ];

  // Bill wahi function se banta hai jo app use karta hai — isliye seeded data
  // aur runtime kabhi diverge nahi karenge.
  const bill = computeBill({
    lines: lines.map((l) => ({ unitPriceMinor: l.unitPriceMinor, quantity: l.quantity })),
    deliveryFeeMinor: 3000,
    promotion: { type: 'FLAT_OFF', value: 20000, maxDiscountMinor: null, minOrderMinor: 0 },
  });

  const order4032 = await prisma.order.create({
    data: {
      orderNumber: formatOrderNumber(4032),
      userId,
      storeId: freshmartId,
      addressId,
      deliveryAddressSnapshot: addressSnapshot,
      storeNameSnapshot: 'FreshMart Superstore',
      storePhoneSnapshot: '+918041234571',
      status: 'PREPARING',
      itemTotalMinor: bill.itemTotalMinor,
      deliveryFeeMinor: bill.deliveryFeeMinor,
      taxMinor: bill.taxMinor,
      platformFeeMinor: bill.platformFeeMinor,
      discountMinor: bill.discountMinor,
      totalMinor: bill.totalMinor,
      promotionId: ctx.nearbux20Id,
      etaMinMinutes: 25,
      etaMaxMinutes: 30,
      placedAt,
      acceptedAt: new Date(placedAt.getTime() + 2 * 60_000),
      preparingAt: new Date(placedAt.getTime() + 5 * 60_000),
      idempotencyKey: 'seed-order-nb-4032',
      items: {
        create: lines.map((l) => ({
          productId: pid('freshmart-superstore', l.name),
          nameSnapshot: l.name,
          unitSnapshot: l.unit,
          unitPriceMinor: l.unitPriceMinor,
          quantity: l.quantity,
          lineTotalMinor: l.unitPriceMinor * l.quantity,
        })),
      },
      events: {
        create: [
          { status: 'PLACED', occurredAt: placedAt },
          { status: 'ACCEPTED', occurredAt: new Date(placedAt.getTime() + 2 * 60_000) },
          {
            status: 'PREPARING',
            note: 'Estimated 10 mins',
            occurredAt: new Date(placedAt.getTime() + 5 * 60_000),
          },
        ],
      },
      payment: {
        create: {
          method: 'UPI',
          status: 'PAID',
          amountMinor: bill.totalMinor,
          provider: 'razorpay',
          providerRefId: 'pay_seed_nb4032',
          displayLabel: `UPI • ${ctx.paymentLabel}`,
          paidAt: placedAt,
        },
      },
      redemption: {
        create: { promotionId: ctx.nearbux20Id, userId, discountMinor: bill.discountMinor },
      },
    },
  });

  // ── NB-4029 — delivered. Screen [14] ke EXACT receipt numbers. ───────
  // Item ₹745 + delivery ₹30 + tax & platform ₹22.50 − discount ₹50 = ₹747.50
  const placed4029 = daysAgoAt(2, 13, 20);
  await prisma.order.create({
    data: {
      orderNumber: formatOrderNumber(4029),
      userId,
      storeId: freshmartId,
      addressId,
      deliveryAddressSnapshot: addressSnapshot,
      storeNameSnapshot: 'FreshMart Superstore',
      storePhoneSnapshot: '+918041234571',
      status: 'DELIVERED',
      itemTotalMinor: 74500,
      deliveryFeeMinor: 3000,
      taxMinor: 1750,
      platformFeeMinor: 500,
      discountMinor: 5000,
      totalMinor: 74750,
      etaMinMinutes: 25,
      etaMaxMinutes: 35,
      placedAt: placed4029,
      acceptedAt: new Date(placed4029.getTime() + 3 * 60_000),
      preparingAt: new Date(placed4029.getTime() + 6 * 60_000),
      readyAt: new Date(placed4029.getTime() + 18 * 60_000),
      outForDeliveryAt: new Date(placed4029.getTime() + 22 * 60_000),
      deliveredAt: new Date(placed4029.getTime() + 41 * 60_000),
      idempotencyKey: 'seed-order-nb-4029',
      items: {
        create: [
          { productId: pid('freshmart-superstore', 'Basmati Rice Premium'), nameSnapshot: 'Basmati Rice Premium (5kg)', unitSnapshot: '5kg bag', unitPriceMinor: 42000, quantity: 1, lineTotalMinor: 42000 },
          { productId: pid('freshmart-superstore', 'Fresh Whole Milk'), nameSnapshot: 'Fresh Whole Milk (1L)', unitSnapshot: '1 Liter', unitPriceMinor: 13000, quantity: 1, lineTotalMinor: 13000 },
          { productId: pid('freshmart-superstore', 'Organic Farm Eggs'), nameSnapshot: 'Organic Farm Eggs (Pack of 12)', unitSnapshot: 'Pack of 12', unitPriceMinor: 11000, quantity: 1, lineTotalMinor: 11000 },
          { productId: pid('freshmart-superstore', 'Artisan Whole Wheat Sourdough'), nameSnapshot: 'Artisan Whole Wheat Sourdough', unitSnapshot: '400g loaf', unitPriceMinor: 8500, quantity: 1, lineTotalMinor: 8500 },
        ],
      },
      events: {
        create: [
          { status: 'PLACED', occurredAt: placed4029 },
          { status: 'ACCEPTED', occurredAt: new Date(placed4029.getTime() + 3 * 60_000) },
          { status: 'PREPARING', occurredAt: new Date(placed4029.getTime() + 6 * 60_000) },
          { status: 'READY', occurredAt: new Date(placed4029.getTime() + 18 * 60_000) },
          { status: 'OUT_FOR_DELIVERY', occurredAt: new Date(placed4029.getTime() + 22 * 60_000) },
          { status: 'DELIVERED', occurredAt: new Date(placed4029.getTime() + 41 * 60_000) },
        ],
      },
      payment: {
        create: {
          method: 'UPI',
          status: 'PAID',
          amountMinor: 74750,
          provider: 'razorpay',
          providerRefId: 'pay_seed_nb4029',
          displayLabel: 'UPI (Google Pay)',
          paidAt: placed4029,
        },
      },
    },
  });

  // ── Nature's Basket — delivered aur RATED (screen [11] "Completed") ──
  await createSimpleDeliveredOrder({
    ...ctx,
    orderNumber: formatOrderNumber(4001),
    storeSlug: 'natures-basket-organic',
    storeName: "Nature's Basket Organic",
    storePhone: '+918041234572',
    placedAt: daysAgoAt(8, 18, 30),
    items: [
      { name: 'Greek Yogurt', unit: '500g tub', unitPriceMinor: 42900, quantity: 1 },
      { name: 'Granola Clusters', unit: '400g pack', unitPriceMinor: 44900, quantity: 1 },
      { name: 'Chia Seeds', unit: '250g pack', unitPriceMinor: 32900, quantity: 2 },
    ],
    deliveryFeeMinor: 3500,
    withReview: { rating: 5, comment: 'Everything arrived fresh and well packed.' },
  });

  // ── Daily Essentials Hub — delivered (screen [11]) ───────────────────
  await createSimpleDeliveredOrder({
    ...ctx,
    orderNumber: formatOrderNumber(3980),
    storeSlug: 'daily-essentials-hub',
    storeName: 'Daily Essentials Hub',
    storePhone: '+918041234573',
    placedAt: daysAgoAt(12, 11, 45),
    items: [
      { name: 'Whole Wheat Bread', unit: '400g loaf', unitPriceMinor: 6000, quantity: 1 },
      { name: 'Salted Butter', unit: '100g block', unitPriceMinor: 6000, quantity: 1 },
    ],
    deliveryFeeMinor: 2500,
  });

  await seedNotifications(userId, order4032.id);
}

interface SimpleOrderInput extends SeedContext {
  orderNumber: string;
  storeSlug: string;
  storeName: string;
  storePhone: string;
  placedAt: Date;
  items: Array<{ name: string; unit: string; unitPriceMinor: number; quantity: number }>;
  deliveryFeeMinor: number;
  withReview?: { rating: number; comment: string };
}

async function createSimpleDeliveredOrder(input: SimpleOrderInput) {
  const storeId = input.storeBySlug.get(input.storeSlug)!;
  const bill = computeBill({
    lines: input.items.map((i) => ({ unitPriceMinor: i.unitPriceMinor, quantity: i.quantity })),
    deliveryFeeMinor: input.deliveryFeeMinor,
    promotion: null,
  });
  const t = input.placedAt.getTime();

  const order = await prisma.order.create({
    data: {
      orderNumber: input.orderNumber,
      userId: input.userId,
      storeId,
      addressId: input.addressId,
      deliveryAddressSnapshot: input.addressSnapshot,
      storeNameSnapshot: input.storeName,
      storePhoneSnapshot: input.storePhone,
      status: 'DELIVERED',
      itemTotalMinor: bill.itemTotalMinor,
      deliveryFeeMinor: bill.deliveryFeeMinor,
      taxMinor: bill.taxMinor,
      platformFeeMinor: bill.platformFeeMinor,
      discountMinor: bill.discountMinor,
      totalMinor: bill.totalMinor,
      etaMinMinutes: 20,
      etaMaxMinutes: 30,
      placedAt: input.placedAt,
      acceptedAt: new Date(t + 2 * 60_000),
      preparingAt: new Date(t + 5 * 60_000),
      readyAt: new Date(t + 16 * 60_000),
      outForDeliveryAt: new Date(t + 20 * 60_000),
      deliveredAt: new Date(t + 38 * 60_000),
      idempotencyKey: `seed-order-${input.orderNumber.toLowerCase()}`,
      items: {
        create: input.items.map((i) => ({
          productId: input.pid(input.storeSlug, i.name),
          nameSnapshot: i.name,
          unitSnapshot: i.unit,
          unitPriceMinor: i.unitPriceMinor,
          quantity: i.quantity,
          lineTotalMinor: i.unitPriceMinor * i.quantity,
        })),
      },
      events: {
        create: [
          { status: 'PLACED', occurredAt: input.placedAt },
          { status: 'ACCEPTED', occurredAt: new Date(t + 2 * 60_000) },
          { status: 'PREPARING', occurredAt: new Date(t + 5 * 60_000) },
          { status: 'READY', occurredAt: new Date(t + 16 * 60_000) },
          { status: 'OUT_FOR_DELIVERY', occurredAt: new Date(t + 20 * 60_000) },
          { status: 'DELIVERED', occurredAt: new Date(t + 38 * 60_000) },
        ],
      },
      payment: {
        create: {
          method: 'UPI',
          status: 'PAID',
          amountMinor: bill.totalMinor,
          provider: 'razorpay',
          providerRefId: `pay_seed_${input.orderNumber.toLowerCase()}`,
          displayLabel: `UPI • ${input.paymentLabel}`,
          paidAt: input.placedAt,
        },
      },
    },
  });

  if (input.withReview) {
    // Review sirf delivered order se bandh sakta hai — yahi "verified" ki
    // guarantee hai. Rating aggregates isi transaction mein update hote hain.
    await prisma.$transaction([
      prisma.storeReview.create({
        data: {
          orderId: order.id,
          userId: input.userId,
          storeId,
          rating: input.withReview.rating,
          comment: input.withReview.comment,
          createdAt: new Date(t + 60 * 60_000),
        },
      }),
      prisma.store.update({
        where: { id: storeId },
        data: { ratingCount: { increment: 1 } },
      }),
    ]);
  }
}

/** Screen [13] ka exact notification feed */
async function seedNotifications(userId: string, order4032Id: string) {
  console.log('🔔 Notifications…');
  await prisma.notification.createMany({
    data: [
      {
        userId,
        type: 'ORDER_UPDATE',
        title: 'Your order #NB-4032 is out for delivery',
        body: 'Delivery partner Ramesh is arriving in ~12 mins.',
        deepLink: 'nearbux://orders/NB-4032',
        orderId: order4032Id,
        createdAt: minutesAgo(10),
      },
      {
        userId,
        type: 'PROMOTION',
        title: 'FreshMart Flash Deal: Flat ₹100 Off',
        body: 'Save big on organic produce orders above ₹499 today.',
        deepLink: 'nearbux://stores/freshmart-superstore',
        createdAt: minutesAgo(45),
      },
      {
        userId,
        type: 'ORDER_UPDATE',
        title: 'Order #NB-4032 confirmed',
        body: 'FreshMart Superstore accepted and is preparing your order.',
        deepLink: 'nearbux://orders/NB-4032',
        orderId: order4032Id,
        readAt: minutesAgo(100),
        createdAt: minutesAgo(120),
      },
      {
        userId,
        type: 'ORDER_UPDATE',
        title: 'Your order was delivered',
        body: 'Order #NB-3980 from Daily Essentials Hub was handed over.',
        deepLink: 'nearbux://orders/NB-3980',
        readAt: daysAgoAt(1, 17, 0),
        createdAt: daysAgoAt(1, 16, 15),
      },
      {
        userId,
        type: 'PROMOTION',
        title: '20% off at FreshMart — today only',
        body: 'Special weekend deals across fresh dairy, vegetables and bakery.',
        readAt: daysAgoAt(7, 12, 0),
        createdAt: daysAgoAt(8, 11, 30),
      },
      {
        userId,
        type: 'ACCOUNT',
        title: 'Your saved address was updated',
        body: 'Address "Home — 123 MG Road" changes have been saved.',
        readAt: daysAgoAt(9, 18, 0),
        createdAt: daysAgoAt(10, 17, 40),
      },
      {
        userId,
        type: 'SYSTEM',
        title: 'Welcome to NearBux!',
        body: 'Explore fresh groceries, bakeries, and local stores near you.',
        readAt: daysAgoAt(16, 11, 0),
        createdAt: daysAgoAt(17, 10, 0),
      },
    ],
  });
}

async function summarise() {
  const [stores, products, orders, notifications, cartItems] = await Promise.all([
    prisma.store.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.notification.count(),
    prisma.cartItem.count(),
  ]);
  console.log(`   stores=${stores} products=${products} orders=${orders} notifications=${notifications} cartItems=${cartItems}`);
  console.log('   login: +919876543210 (Rahul Sharma)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
