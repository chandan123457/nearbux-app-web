import { useWindowDimensions } from 'react-native';
import { breakpoints } from '../tokens/spacing.js';

export interface Breakpoint {
  width: number;
  isCompact: boolean;
  isMedium: boolean;
  isWide: boolean;
  /** Grid columns — catalog screens 2 par hain */
  columns: number;
}

/**
 * Ek responsive hook, teeno platforms ke liye.
 *
 * `useWindowDimensions` native aur web par bilkul same kaam karta hai, isliye
 * yeh phone-vs-tablet aur mobile-vs-desktop browser dono handle karta hai
 * bina kisi Platform check ke.
 *
 * Screens ko `isWide` par branch karna chahiye, alag `Screen.web.tsx` aur
 * `Screen.native.tsx` banane ke bajaye — duplicate screens hafton mein
 * diverge kar jaate hain.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return {
    width,
    isCompact: width < breakpoints.medium,
    isMedium: width >= breakpoints.medium && width < breakpoints.wide,
    isWide: width >= breakpoints.wide,
    columns: 2,
  };
}
