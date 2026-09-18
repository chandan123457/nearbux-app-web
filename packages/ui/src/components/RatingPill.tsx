import { StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { fontSize, fontWeight, radius, spacing, theme } from '../theme.js';

export interface RatingPillProps {
  rating: number;
  /** Store card par floating amber pill; inline par plain text + star */
  variant?: 'pill' | 'inline';
  /** "(320)" — sirf inline variant par */
  count?: number;
}

/** "★ 4.8" — store card par amber pill, lists mein inline */
export function RatingPill({ rating, variant = 'pill', count }: RatingPillProps) {
  const value = rating.toFixed(1);

  if (variant === 'inline') {
    return (
      <View style={styles.inline}>
        <Star size={14} color={theme.rating} fill={theme.rating} />
        <Text style={styles.inlineText}>{value}</Text>
        {count !== undefined && <Text style={styles.count}>({count})</Text>}
      </View>
    );
  }

  return (
    <View style={styles.pill}>
      <Star size={12} color={theme.textInverse} fill={theme.textInverse} />
      <Text style={styles.pillText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.rating,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillText: {
    color: theme.textInverse,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  inlineText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: theme.textPrimary,
  },
  count: { fontSize: fontSize.sm, color: theme.textSecondary, marginLeft: 2 },
});
