# NearBux

Hyperlocal multi-store delivery marketplace — ek shared TypeScript codebase se
**web + Android + iOS**, plus ek Node.js backend.

> **Status:** Phase 0 (monorepo foundation) aur Phase 1 (data model) complete.
> `apps/api` aur `apps/mobile` abhi nahi bane — woh Phase 2 aur Phase 4 hain.

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
pnpm typecheck                     # saare packages
pnpm --filter @nearbux/core test   # business logic tests
pnpm db:studio                     # data browse karo
```

Seeded login: **+91 98765 43210** (Rahul Sharma)

## Workspace

```
apps/                        # Phase 2+: api (Fastify), mobile (Expo)
packages/
├── config/      shared tsconfig / prettier / editorconfig
├── types/       domain DTOs + enums — har screen ka API contract
├── validation/  Zod schemas — client form AND server request, ek hi definition
├── core/        pure business logic: bill, money, geo, store hours, order FSM
├── api-client/  platform boundary (TokenStorage) + typed fetch (Phase 3)
├── ui/          design tokens screens se extract kiye hue (Phase 3: components)
└── database/    Prisma schema, migrations, seed, client singleton
```

**Import rule:** `packages/database` sirf `apps/api` import karta hai. Prisma
kabhi client bundle mein nahi jaana chahiye — warna DB schema aur query logic
har user ke device par ship ho jaayega.

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
