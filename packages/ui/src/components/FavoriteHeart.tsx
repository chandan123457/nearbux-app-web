import { Platform, Pressable, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import { shadow, theme } from '../theme.js';

export interface FavoriteHeartProps {
  isFavorite: boolean;
  onToggle: () => void;
  /** Image ke upar floating white circle, ya plain icon */
  variant?: 'floating' | 'plain';
  size?: number;
}

/** Store aur product cards ka heart — filled red jab favourite ho */
export function FavoriteHeart({
  isFavorite,
  onToggle,
  variant = 'floating',
  size = 20,
}: FavoriteHeartProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      // Screen reader ko state batao, sirf "heart" nahi
      accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
      accessibilityState={{ selected: isFavorite }}
      // Touch target 44px — icon 20px hai, uske bina tap karna mushkil hota hai
      hitSlop={12}
      style={({ pressed }) => [
        variant === 'floating' && styles.floating,
        variant === 'floating' && shadow.card,
        pressed && styles.pressed,
      ]}
    >
      <Heart
        size={size}
        color={isFavorite ? theme.favorite : theme.textSecondary}
        fill={isFavorite ? theme.favorite : 'transparent'}
        strokeWidth={2}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floating: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  pressed: { opacity: 0.7 },
});
