-- ════════════════════════════════════════════════════════════════════════
--  Yeh sab Prisma schema se express nahi ho sakta, isliye handwritten SQL.
--  Migration file commit hoti hai, aur `prisma migrate deploy` production
--  mein isse waise hi apply karta hai jaise generated migrations ko.
-- ════════════════════════════════════════════════════════════════════════

-- ── Extensions ─────────────────────────────────────────────────────────
-- pg_trgm: fuzzy product/store search ("Fresh organic" → "Organic Fairtrade
--   Bananas"). LIKE '%...%' bina index ke har row scan karta hai.
-- cube + earthdistance: "Stores Near You" ka radius + distance sort.
--   PostGIS abhi zaroorat nahi — screens sirf simple radius search dikhate
--   hain, aur earthdistance managed Postgres par by default available hai.
--   PostGIS tab jab polygon delivery zones ya routing chahiye ho.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- NOTE: pg_trgm GIN indexes schema.prisma mein declare hain (init migration),
-- kyunki Prisma unhe represent kar sakta hai. Yahan sirf woh cheezein hain jo
-- Prisma schema se express NAHI ho sakti.

-- ── Geo index — nearby store query isi par chalti hai ──────────────────
CREATE INDEX IF NOT EXISTS stores_earth_idx
  ON "stores" USING GIST (ll_to_earth(latitude, longitude));

-- ── Partial indexes: chhote aur exactly us query ke liye jo chalti hai ──
-- Unread notification badge (screen [1] ki bell)
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON "notifications" ("userId", "createdAt" DESC)
  WHERE "readAt" IS NULL;

-- Merchant dashboard ki "action chahiye" queue
CREATE INDEX IF NOT EXISTS orders_active_idx
  ON "orders" ("storeId", "placedAt" DESC)
  WHERE status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY');

-- Active catalog — deleted products ko index mein rakhne ka koi matlab nahi
CREATE INDEX IF NOT EXISTS products_active_idx
  ON "products" ("storeId", "priceMinor")
  WHERE "deletedAt" IS NULL AND "isAvailable" = true;

-- ── Invariants: DB level par, kyunki application checks race karte hain ──
ALTER TABLE "store_reviews"
  ADD CONSTRAINT store_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE "product_reviews"
  ADD CONSTRAINT product_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE "cart_items"
  ADD CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);

-- Line total hamesha unit price × quantity ke barabar. Ek buggy service bhi
-- galat total nahi likh sakti.
ALTER TABLE "order_items"
  ADD CONSTRAINT order_items_line_total_matches
  CHECK ("lineTotalMinor" = "unitPriceMinor" * quantity);

-- Money kabhi negative nahi
ALTER TABLE "order_items"
  ADD CONSTRAINT order_items_price_nonneg CHECK ("unitPriceMinor" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT products_price_nonneg CHECK ("priceMinor" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT products_stock_nonneg CHECK ("stockQty" >= 0);

-- Bill ka fundamental invariant. Receipt kabhi mismatch nahi dikha sakti,
-- chahe koi bhi code path order likhe.
ALTER TABLE "orders"
  ADD CONSTRAINT orders_bill_reconciles
  CHECK (
    "totalMinor" =
      "itemTotalMinor" + "deliveryFeeMinor" + "taxMinor"
      + "platformFeeMinor" - "discountMinor"
  );

ALTER TABLE "orders"
  ADD CONSTRAINT orders_total_nonneg CHECK ("totalMinor" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT orders_eta_valid CHECK ("etaMinMinutes" <= "etaMaxMinutes");

-- Store hours "HH:MM" hi hona chahiye — @nearbux/core ka parser isi par depend karta hai
ALTER TABLE "store_hours"
  ADD CONSTRAINT store_hours_day_range CHECK ("dayOfWeek" BETWEEN 0 AND 6);

ALTER TABLE "store_hours"
  ADD CONSTRAINT store_hours_time_format
  CHECK ("opensAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     AND "closesAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Ek user ka ek hi default address / default payment method.
-- Partial unique index yeh guarantee deta hai; application code nahi de sakta.
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user
  ON "addresses" ("userId")
  WHERE "isDefault" = true AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_one_default_per_user
  ON "saved_payment_methods" ("userId")
  WHERE "isDefault" = true AND "deletedAt" IS NULL;

-- Ek store par ek hi primary category (store card ka tagline)
CREATE UNIQUE INDEX IF NOT EXISTS store_category_one_primary
  ON "store_category_links" ("storeId")
  WHERE "isPrimary" = true;
