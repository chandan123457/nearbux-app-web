/** 4pt scale — screenshots ke gutters isi grid par hain */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/** Breakpoints — phone/tablet native par, aur mobile/desktop browser par */
export const breakpoints = {
  compact: 0,
  medium: 768,
  wide: 1280,
} as const;

/** Web par content isse zyada chaura nahi hota */
export const MAX_CONTENT_WIDTH = 1120;
