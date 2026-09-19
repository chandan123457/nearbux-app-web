/**
 * Server ke deep links ko in-app routes mein badalta hai.
 *
 * Notifications `nearbux://orders/NB-4032` jaise custom-scheme links carry
 * karti hain, kyunki wahi links push notifications mein bhi jaate hain, jahan
 * OS ko poora URL chahiye. App ke andar humein Expo Router ka path chahiye.
 *
 * Unknown ya malformed link par `null` return hota hai, throw nahi — ek
 * purani notification ka link kabhi bhi aisa ho sakta hai jise naya build na
 * samjhe, aur us par app crash nahi honi chahiye.
 */
const SCHEME = 'nearbux://';

export function resolveDeepLink(deepLink: string | null): string | null {
  if (!deepLink) return null;

  const path = deepLink.startsWith(SCHEME) ? deepLink.slice(SCHEME.length) : deepLink;
  const [segment, ...rest] = path.split('/').filter(Boolean);
  const target = rest.join('/');

  if (!segment || !target) return null;

  switch (segment) {
    // Order id UUID ya order number ("NB-4032") dono ho sakta hai — API
    // dono accept karti hai
    case 'orders':
    case 'order':
      return `/order/${target}`;
    case 'stores':
    case 'store':
      return `/store/${target}`;
    case 'products':
    case 'product':
      return `/product/${target}`;
    default:
      return null;
  }
}
