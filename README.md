# NearBux

Hyperlocal multi-store delivery marketplace — ek shared TypeScript codebase se
**web + Android + iOS**, plus ek Node.js backend.

> **Status:** Phase 0-5 complete. Saare 14 screens asli data ke saath chalti
> hain — discovery, search, catalog, cart, checkout, order tracking —
> ek codebase se web + iOS + Android par.

## Requirements

| Tool | Version | Note |
|---|---|---|
| Node.js | **24.11+** (LTS) | Prisma 7 ki minimum. `nvm use 24` |
| pnpm | 12.x | `corepack enable --install-directory ~/.local/bin` |
| Docker | any recent | local PostgreSQL ke liye |

## Quick start

```bash
cp .env.example .env    # phir DATABASE_URL + DIRECT_DATABASE_URL bharo
pnpm install
pnpm db:deploy          # migrations apply
pnpm db:generate        # Prisma Client
pnpm db:seed            # screens wala demo data
```

Local Postgres chahiye (offline kaam / tests) to `pnpm db:up` se Docker par
18.6 chalu ho jaata hai; phir dono URLs ko localhost par point kar do.

### Do database URLs kyun

| Variable | Endpoint | Kaun use karta hai |
|---|---|---|
| `DATABASE_URL` | **pooled** | App runtime (`packages/database/src/index.ts`) |
| `DIRECT_DATABASE_URL` | **direct** (`-pooler` ke bina) | Prisma Migrate + seed |

Migrations Postgres advisory locks leti hain. PgBouncer transaction mode
(Neon ka pooler) mein har statement alag backend connection par ja sakta hai,
isliye lock release hi nahi hota aur migration hang ho jaati hai. Local Docker
par dono same rehte hain.

Verify:

```bash
pnpm typecheck        # saare workspaces
pnpm test             # unit + integration (local Postgres chahiye)

pnpm dev              # API on http://localhost:3000
pnpm dev:web          # app browser mein
pnpm dev:device       # physical phone (Expo Go) — QR scan
pnpm dev:ios          # iOS simulator (macOS)
pnpm dev:android      # Android emulator (adb chahiye)
```

App ko API chahiye — dono terminals chalao.

### Physical device par testing

```bash
pnpm dev          # terminal 1
pnpm dev:device   # terminal 2 → QR scan karo Expo Go se
```

`dev:device` LAN IP detect karta hai aur `REACT_NATIVE_PACKAGER_HOSTNAME`
plus `EXPO_PUBLIC_API_URL` dono set karta hai.

**Ye zaroori kyun hai:** phone par `localhost` ka matlab PHONE khud hai. Do
alag cheezein loopback par tooti hain — Metro (JS bundle) aur API. Expo ka
apna LAN detection kabhi-kabhi `127.0.0.1` par gir jaata hai (VPN, container,
ya kai network interfaces hone par), aur tab QR code `exp://127.0.0.1` hota
hai jise phone kabhi load nahi kar sakta.

Koi custom native module nahi hai, isliye **Expo Go kaafi hai** — development
build banane ki zaroorat nahi.

Seeded login: **+91 98765 43210** (Rahul Sharma)

## Workspace

```
apps/
├── api/         Fastify backend — auth, health, profile
└── mobile/      Expo app — web + iOS + Android, ek codebase
packages/
├── config/      shared tsconfig / prettier / editorconfig
├── types/       domain DTOs + enums — har screen ka API contract
├── validation/  Zod schemas — client form AND server request, ek hi definition
├── core/        pure business logic: bill, money, geo, store hours, order FSM
├── api-client/  typed fetch client + refresh rotation
├── ui/          RN components + design tokens (screens se extract)
└── database/    Prisma schema, migrations, seed, client singleton
```

**Import rule:** `packages/database` sirf `apps/api` import karta hai. Prisma
kabhi client bundle mein nahi jaana chahiye — warna DB schema aur query logic
har user ke device par ship ho jaayega.

**Package resolution:** shared packages `dist/` ship karte hain, `src/` nahi.
`exports` mein ek `development` condition hai jo TypeScript source par point
karti hai; `tsx` aur `vitest` `--conditions=development` pass karte hain, aur
production `node` `default` → compiled JS par jaata hai. Iske bina production
build ek `.ts` file import karne ki koshish karti hai aur crash ho jaati hai.

## API

Base path `/v1`. Sab errors ek hi envelope mein:
`{ code, message, details? }` — client `code` par branch kare, `message` par nahi.

| Method | Route | Auth | Kya karta hai |
|---|---|---|---|
| GET | `/health` | — | Liveness. DB touch nahi karta. |
| GET | `/health/ready` | — | Readiness. DB check karta hai. |
| POST | `/auth/otp/request` | — | 6-digit code bhejta hai (dev mein log) |
| POST | `/auth/otp/verify` | — | Login ya signup (201 = naya user) |
| POST | `/auth/refresh` | — | Token rotate karta hai |
| POST | `/auth/logout` | — | Ek session revoke |
| POST | `/auth/logout-all` | ✓ | Sab devices se logout |
| GET | `/me` | ✓ | Profile (screen [12]) |
| PATCH | `/me` | ✓ | Naam / email update |
| GET | `/home` | ✓ | Screen [1] — banners, offers, stores, unread — ek call |
| GET | `/stores` | ✓ | Nearby, distance-sorted |
| GET | `/search` | ✓ | Screen [4] — stores + products (pg_trgm) |
| GET | `/search/recent` | ✓ | Recent search chips |
| GET | `/stores/:slug` | ✓ | Screen [3] — detail + sections |
| GET | `/stores/:id/products` | ✓ | Screens [3][5] — catalog |
| GET | `/products/:id` | ✓ | Screen [6] |
| GET/POST | `/carts`, `/cart/items` | ✓ | Screen [7] |
| PATCH | `/carts/:storeId/items/:productId` | ✓ | Stepper (0 = remove) |
| POST/DELETE | `/carts/:storeId/promotion` | ✓ | Promo code |
| POST | `/orders` | ✓ | Screens [8][9] — **idempotent** |
| GET | `/orders`, `/orders/:id` | ✓ | Screens [10][11][14] |
| POST | `/orders/:id/cancel` | ✓ | Screen [10] |
| GET | `/notifications` | ✓ | Screen [13] |
| GET/POST | `/addresses` | ✓ | Saved addresses |
| PUT/DELETE | `/favorites/{stores,products}/:id` | ✓ | Heart toggles |

### Order placement

Sabse important operation. Poora **ek transaction** mein, is order mein:

1. **Idempotency check** — client per-checkout UUID bhejta hai; retry par wahi
   order wapas milta hai, naya nahi. Mobile par network retry aam hai, aur
   iske bina user do baar charge hota hai.
2. Cart, address, store aur promo validate
3. **Bill server par dobara compute** — client ka bheja total sirf CHECK hai,
   price ka source nahi. Mismatch par 409 `PRICE_CHANGED`, taaki user ko wahi
   amount charge ho jo usne dekha.
4. **Conditional stock decrement** — `WHERE stockQty >= n`. "padho, check karo,
   likho" karne par do parallel checkouts aakhri item dono ko bech dete hain.
5. Order + items (**snapshots** ke saath) + timeline + payment + redemption
6. Cart delete

Notification transaction ke **baahar** bhejta hai — woh fail ho to order fail
nahi hona chahiye.

### Auth model

- **Phone OTP** — koi password nahi. Pehla login hi signup hai.
- **Access token**: JWT, 15 min, memory mein rakho.
- **Refresh token**: opaque random string, database mein SHA-256 hash.
  JWT deliberately nahi — signed JWT expiry se pehle revoke nahi ho sakta.
- **Rotation + reuse detection**: har refresh purana token maarta hai. Ek
  already-rotated token dobara use hua = chori ka signal → us user ke saare
  sessions revoke.
- **OTP**: Argon2id se hashed (6 digits ki entropy bahut kam hai), 5 min TTL,
  attempt limit, ek waqt par ek valid code, per-phone throttle IP limit ke upar.

## Design invariants

In rules par poora stack khada hai — inhe todne se pehle soch lena:

1. **Money hamesha integer paise.** Field suffix `Minor`. Koi float nahi.
   `itemTotal + delivery + tax + platformFee − discount == total` — yeh ek
   Postgres CHECK constraint hai, sirf convention nahi.
2. **Orders immutable hain.** `OrderItem` product ka naam/price snapshot karta
   hai; `Order` address aur store ka. Catalog badle to purani receipt nahi badalti.
3. **Bill server par compute hota hai.** Client ka bheja price kabhi trust nahi.
   `computeBill()` (@nearbux/core) dono jagah chalta hai; mismatch = 409.
4. **Ek cart per store.** `@@unique([userId, storeId])`.
5. **Order place karna idempotent hai.** Client per-attempt UUID bhejta hai;
   retry par wahi key = koi double charge nahi.
6. **Invariants DB mein enforce hote hain**, application code mein nahi —
   application checks race karte hain, CHECK constraints nahi.

## Database

26 tables. Poora design, screen→table mapping aur relationship rationale
architecture document mein hai.

```bash
pnpm db:migrate   # dev: naya migration banao + apply karo
pnpm db:deploy    # prod/CI: sirf pending apply karo (generate/reset kabhi nahi)
pnpm db:reset     # sab data wipe + re-seed (sirf local)
```

> **`pnpm db:seed` DESTRUCTIVE hai.** Woh saari application tables TRUNCATE
> karta hai. `NODE_ENV=production` par refuse karta hai, aur chalne se pehle
> target host print karta hai — run karne se pehle woh line padh lo.

Migrations commit hoti hain aur apply hone ke baad **immutable** hain. Applied
migration edit mat karna — naya likho.

Do migrations:
- `*_init` — generated schema + `pg_trgm` extension
- `*_search_geo_and_check_constraints` — handwritten: `earthdistance` GiST geo
  index, partial indexes, aur saare CHECK constraints. Yeh sab Prisma schema se
  express nahi ho sakta.

## UI kit

`@nearbux/ui` — ek codebase, teeno platforms. React Native primitives, jo
react-native-web ke through browser mein DOM ban jaate hain.

Primitives: `Button` `Card` `Badge` `Chip` `Avatar` `SearchBar` `ListRow`
`RatingPill` `FavoriteHeart` `QuantityStepper` `ImagePlaceholder`
`SectionHeader` `EmptyState`

Composites: `StoreCard` `ProductCard` `CartItemRow` `BillSummary`
`BottomTabBar` `Screen`

**Web layout:** `Screen` content ko 480px column mein center karta hai. Saare
designs mobile ke liye bane hain; desktop par unhe stretch karne se layout
toot jaata hai (10 inch chaudi cart rows). Native par `maxWidth` ka koi asar
nahi — isliye ek hi component teeno platforms par chalta hai, zero
`Platform.OS` checks screens mein.

`useBreakpoint()` — `useWindowDimensions` native aur web par same kaam karta
hai, isliye phone-vs-tablet aur mobile-vs-desktop dono ek hi hook se.

## API client

`@nearbux/api-client` — typed fetch, auth header injection, error
normalization, aur refresh rotation.

**Sabse important hissa:** concurrent 401s par sirf **ek** refresh jaata hai.
App load par 3-4 requests ek saath chalti hain; token expire ho to sab 401
dengi. Bina dedup ke sab apna refresh bhejengi — aur server tokens rotate
karta hai, to pehli ke baad baaki "reuse" dikhengi aur server saare sessions
revoke kar dega. User bina kisi galti ke logout, aur bug reproduce karna
lagbhag namumkin.

Input types `@nearbux/validation` ke Zod schemas se infer hote hain — wahi
schemas jo server request validate karta hai. Schema badla to dono taraf
compile error.

## App (apps/mobile)

Expo SDK 57 · React Native 0.86 · React 19.2 · Expo Router.
**Ek codebase, teen platforms** — kuch bhi duplicate nahi.

```
app/                   Expo Router: file path = route = URL
├── _layout.tsx        providers + auth gate (ek jagah, har screen ke liye)
├── +html.tsx          web-only HTML shell
├── (auth)/            sign-in → verify
└── (app)/             tabs: index · cart · orders · profile
src/lib/
├── token-storage.native.ts   Keychain / Android Keystore
├── token-storage.web.ts      localStorage
├── token-storage.ts          memory (static-render fallback)
├── api.ts                    client wiring + LAN IP resolution
└── session.tsx               session state
```

### Platform-specific code

Sirf **ek** cheez platform ke hisaab se badalti hai: token storage. Metro
`.native.ts` / `.web.ts` apne aap chunta hai, caller ko pata bhi nahi chalta.
Verified: web bundle mein `localStorage` hai aur SecureStore nahi; iOS bundle
mein SecureStore hai.

Baaki har jagah — screens, components, business logic, API client — ek hi
file teeno platforms par chalti hai. Screens mein ek bhi `Platform.OS` check
nahi.

### Metro ka `.js` → `.ts` shim

`metro.config.js` mein ek resolver shim hai. Workspace packages apne internal
imports mein explicit `.js` likhte hain (Node ka ESM loader demand karta hai
jab apps/api compiled dist chalata hai), lekin Metro un packages ka
TypeScript **source** padhta hai jahan woh file `.ts` hai. Bina shim ke Metro
ko compiled `dist` use karna padta — matlab `packages/ui` mein har chhote
change ke baad `pnpm build`.

### Web build

`pnpm --filter @nearbux/mobile run export:web` → `dist/`, static HTML har
route ke liye.

Do cheezein jaan lo:

1. **Bundle ~3.8 MB** hai. Yeh react-native-web ki keemat hai, wahi jo
   architecture mein flag ki thi. Equivalent React DOM app kaafi halka hota.
2. **Pre-rendered HTML loading spinner hai**, asli content nahi. App poori
   tarah login ke peeche hai, to static render ke waqt session check pending
   rehta hai. Auth-gated screens ke liye yeh sahi hai — unhe index hona bhi
   nahi chahiye. Agar kabhi public SEO pages chahiye, woh alag Next.js app
   banega.

## Deploy (Render)

`render.yaml` blueprint repo mein hai. Ek cheez sabse zyada important:

**Root Directory KHAALI rakhna.** `apps/api` set karne par build fail hogi —
Render root ke bahar ki files build time par nahi deta, aur yeh service
`packages/*` par depend karti hai.

Migrations `preDeployCommand` mein hain, `startCommand` mein nahi. Warna har
instance ek saath migrate karega.

Render dashboard mein set karo: `DATABASE_URL` (pooled), `DIRECT_DATABASE_URL`
(direct), `CORS_ORIGINS` (asli origin, `*` nahi). JWT secrets blueprint
auto-generate karta hai.

## Notes for later

- **Prisma 7:** connection URL `schema.prisma` mein nahi hai. Migrate/introspect
  `prisma.config.ts` dekhte hain; runtime client ko `@prisma/adapter-pg` driver
  adapter milta hai (`packages/database/src/index.ts`).
- **PostgreSQL 18 Docker:** volume `/var/lib/postgresql` par mount hota hai,
  `/var/lib/postgresql/data` par nahi. Purana path = restart loop.
- **Expo monorepo (Phase 4):** `.npmrc` mein `node-linker=hoisted` chahiye —
  Metro pnpm ke strict symlinks reliably resolve nahi karta.
- **Serverless Postgres cold starts:** Neon idle compute suspend kar deta hai.
  Seed connect par retry karta hai aur dono clients ka connection timeout 30s
  hai. Pehli request ke baad latency normal ho jaati hai.
