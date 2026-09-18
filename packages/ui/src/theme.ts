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

/**
 * Screenshots mein cards ka shadow bahut halka hai.
 *
 * `boxShadow` use karte hain, purane `shadowColor`/`shadowOffset`/`elevation`
 * props nahi — woh React Native 0.76+ mein deprecated hain aur web par har
 * render par warning dete hain. `boxShadow` ek hi value teeno platforms par
 * kaam karti hai.
 */
export const shadow = StyleSheet.create({
  card: { boxShadow: '0px 2px 8px rgba(15, 23, 42, 0.05)' },
  floating: { boxShadow: '0px 4px 16px rgba(15, 23, 42, 0.12)' },
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
