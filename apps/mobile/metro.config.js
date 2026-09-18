const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * Monorepo-aware Metro config.
 *
 * Bina iske Metro sirf apps/mobile ke andar dekhta hai: packages/* ka koi
 * change hot-reload nahi hota, aur imports resolve hi nahi hote.
 *
 * `disableHierarchicalLookup` isliye hai ki Metro node_modules ko upar
 * randomly na dhoonde — sirf wahi do paths jo humne diye hain. Yeh do React
 * copies bundle hone se bachata hai, jo hooks tod deta hai ("invalid hook
 * call") aur debug karna bahut mushkil hota hai.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

/**
 * Workspace packages ko unke TypeScript SOURCE se resolve karo.
 *
 * packages/* ka `exports` field production ke liye compiled dist par point
 * karta hai. App ke andar humein source chahiye — warna har UI change ke baad
 * `pnpm build` chalana padega, aur stale dist ke against debug karna padega.
 */
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['development', 'require', 'import', 'react-native'];

/**
 * `./foo.js` ko `./foo.ts` par resolve karo.
 *
 * Workspace packages apne internal imports mein explicit `.js` likhte hain,
 * kyunki Node ka ESM loader wahi demand karta hai jab apps/api compiled dist
 * chalata hai. Metro un packages ka TypeScript SOURCE padhta hai, jahan woh
 * file `.ts` hai — aur Metro Node wala `.js` → `.ts` rewrite nahi karta.
 *
 * Bina iske option yeh bachta hai ki Metro compiled dist use kare, matlab
 * packages/ui mein har chhote change ke baad `pnpm build` chalana pade.
 *
 * Shim sirf RELATIVE specifiers par lagta hai, aur asli `.js` files ke liye
 * default resolver par gir jaata hai.
 */
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;

  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.slice(0, -'.js'.length), platform);
    } catch {
      // Sach mein ek .js file thi — neeche default path le lega
    }
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
