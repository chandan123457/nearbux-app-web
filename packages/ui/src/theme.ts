import { StyleSheet } from 'react-native';
import { lightTheme, type Theme } from './tokens/colors.js';
import { MAX_CONTENT_WIDTH, radius, spacing } from './tokens/spacing.js';
import { fontSize, fontWeight } from './tokens/typography.js';

export const theme = lightTheme;
export type { Theme };

/**
 * Card surface jo har screen par repeat hota hai.
 *
 * Screenshots mein cards ka border nahi hai — woh gray background par apne
 * white fill se alag dikhte hain. Border add karna design ko bhaari bana
 * deta hai.
 */
export const cardStyle = {
  backgroundColor: theme.surface,
  borderRadius: radius.lg,
  overflow: 'hidden',
} as const;

/**
 * Web par content ko phone width par center karta hai.
 *
 * Saare designs mobile ke liye bane hain. Desktop par unhe stretch karne se
 * layout toot jaata hai (10 inch chaudi cart rows), isliye content ko phone
 * column mein rakha jaata hai aur baaki jagah background rehta hai.
 * Native par `maxWidth` ka koi asar nahi — screen pehle hi chhoti hai.
 */
export const contentContainer = {
  width: '100%',
  maxWidth: MAX_CONTENT_WIDTH,
  alignSelf: 'center',
} as const;

/** Screenshots mein cards ka shadow bahut halka hai */
export const shadow = StyleSheet.create({
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

export const text = StyleSheet.create({
  /** "My Cart", "Stores Near You" */
  screenTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: theme.textPrimary,
  },
  /** "OFFERS FOR YOU", "STORES NEAR YOU", "ORDER SUMMARY" */
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: theme.textPrimary,
  },
  /** "DELIVER TO", "RECENT SEARCHES" — uppercase, chhota, muted */
  overline: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: theme.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  /** Store / product ka naam */
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: theme.textPrimary,
  },
  body: { fontSize: fontSize.base, color: theme.textPrimary },
  /** "Groceries & Daily Essentials", "2 pcs pack • 350g" */
  muted: { fontSize: fontSize.sm, color: theme.textSecondary },
  /** "See All", "Clear All", "Remove" */
  link: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.primary },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: theme.textPrimary },
});

export { spacing, radius, fontSize, fontWeight, MAX_CONTENT_WIDTH };
