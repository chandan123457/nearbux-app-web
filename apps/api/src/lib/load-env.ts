import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * Side-effect module: monorepo root ka .env load karta hai.
 *
 * ALAG file isliye hai kyunki ESM saare imports hoist kar deta hai. Agar
 * `dotenv.config()` entrypoint ke andar likha jaaye — chahe sabse upar hi
 * kyun na ho — woh tab chalega jab saare imported modules already evaluate
 * ho chuke honge. Ek side-effect module ko PEHLE import karna hi woh order
 * guarantee karta hai jo chahiye.
 *
 * Production (Render) mein env vars platform se aate hain aur koi file nahi
 * hoti — dotenv chupchaap skip kar deta hai.
 */
loadDotenv({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true });
