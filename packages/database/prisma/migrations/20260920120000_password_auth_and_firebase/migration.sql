-- ════════════════════════════════════════════════════════════════════════
--  Guest accounts → password accounts.
--
--  Account banane ka ab ek hi raasta hai: signup screen (naam + phone +
--  password), jahan phone Firebase Phone Auth se verify hota hai. Har device
--  ko milne wala anonymous account hat raha hai, isliye `users.phone` ab
--  NOT NULL ho sakta hai.
--
--  OTP challenges ka table bhi ja raha hai: code ab hum na banate hain na
--  bhejte hain na verify karte hain — Firebase karta hai, aur server ko ek
--  signed ID token milta hai.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Bache hue guest rows (phone IS NULL) hata do ────────────────────
--
-- `orders` par onDelete: Restrict hai — woh jaan-boojh kar cascade nahi
-- karta (ek order store ka revenue record aur tax document hai). Isliye un
-- guests ke orders pehle explicitly hatane padte hain, warna user DELETE
-- foreign key violation se fail ho jaata hai.
--
-- Yeh sirf DEV data hai: guest accounts kabhi production mein gaye hi nahi.
CREATE TEMP TABLE guest_ids AS
  SELECT id FROM "users" WHERE phone IS NULL;

CREATE TEMP TABLE guest_order_ids AS
  SELECT id FROM "orders" WHERE "userId" IN (SELECT id FROM guest_ids);

DELETE FROM "promotion_redemptions" WHERE "orderId" IN (SELECT id FROM guest_order_ids);
DELETE FROM "product_reviews"       WHERE "userId"  IN (SELECT id FROM guest_ids);
DELETE FROM "store_reviews"         WHERE "orderId" IN (SELECT id FROM guest_order_ids);
DELETE FROM "payments"              WHERE "orderId" IN (SELECT id FROM guest_order_ids);
DELETE FROM "order_status_events"   WHERE "orderId" IN (SELECT id FROM guest_order_ids);
DELETE FROM "order_items"           WHERE "orderId" IN (SELECT id FROM guest_order_ids);
DELETE FROM "orders"                WHERE id        IN (SELECT id FROM guest_order_ids);

-- Baaki sab (carts, addresses, sessions, favourites, notifications…) users
-- par ON DELETE CASCADE hai, isliye woh apne aap chale jaayenge.
DELETE FROM "users" WHERE id IN (SELECT id FROM guest_ids);

DROP TABLE guest_order_ids;
DROP TABLE guest_ids;

-- ── 2. Phone ab mandatory identity hai ─────────────────────────────────
ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;

-- ── 3. Password + Firebase link ────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN "passwordHash" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "firebaseUid"  VARCHAR(128);

CREATE UNIQUE INDEX "users_firebaseUid_key" ON "users"("firebaseUid");

-- ── 4. OTP challenges ab Firebase ke paas hain ─────────────────────────
DROP TABLE IF EXISTS "otp_challenges";
