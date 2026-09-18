export const palette = {
  // Primary action — "Order Now", "+", "Proceed to Checkout", active tab
  blue600: '#2563EB',
  blue500: '#3B82F6',
  blue400: '#60A5FA',
  blue50: '#EFF6FF',

  // "Open Now" badge, order-success check
  green600: '#059669',
  green500: '#10B981',
  green50: '#DCFCE7',
  green700: '#15803D',

  // Rating pill (★ 4.8), "In Progress" badge
  amber500: '#F59E0B',
  amber100: '#FEF3C7',
  amber800: '#92400E',

  // Favourite heart (filled), "Log Out", "Cancel Order"
  red600: '#DC2626',
  red500: '#EF4444',
  red50: '#FEF2F2',

  // Sponsored banner
  slate900: '#0F172A',
  slate800: '#1E293B',

  // Neutrals
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',
} as const;

/** Semantic layer — screens hamesha inhe use karti hain, palette ko nahi. */
export const lightTheme = {
  background: palette.gray50,
  surface: palette.white,
  surfaceMuted: palette.gray100,
  border: palette.gray200,

  textPrimary: palette.gray900,
  textSecondary: palette.gray500,
  textDisabled: palette.gray400,
  textInverse: palette.white,

  primary: palette.blue600,
  primaryPressed: palette.blue500,
  primaryGradient: [palette.blue600, palette.blue400] as const,
  primarySubtle: palette.blue50,

  success: palette.green500,
  successSubtle: palette.green50,
  successText: palette.green700,

  warning: palette.amber500,
  warningSubtle: palette.amber100,
  warningText: palette.amber800,

  danger: palette.red600,
  dangerSubtle: palette.red50,

  favorite: palette.red500,
  rating: palette.amber500,

  bannerSurface: palette.slate900,
  skeleton: palette.gray200,
} as const;

export type Theme = typeof lightTheme;
