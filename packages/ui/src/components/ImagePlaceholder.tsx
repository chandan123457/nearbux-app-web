import { Image, StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';
import { ImageIcon } from 'lucide-react-native';
import { radius, theme } from '../theme.js';

export interface ImagePlaceholderProps {
  uri?: string | null;
  style?: ViewStyle & ImageStyle;
  iconSize?: number;
  accessibilityLabel?: string;
}

/**
 * Image with a graceful empty state.
 *
 * Screenshots mein dono dikhte hain: asli photos aur grey placeholder jisme
 * beech mein image icon hai. Catalog mein har product ki photo nahi hoti,
 * isliye placeholder ek design state hai, bug nahi.
 */
export function ImagePlaceholder({
  uri,
  style,
  iconSize = 34,
  accessibilityLabel,
}: ImagePlaceholderProps) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, style]}
        resizeMode="cover"
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <View style={[styles.base, styles.empty, style]} accessibilityLabel={accessibilityLabel}>
      <ImageIcon size={iconSize} color={theme.textDisabled} strokeWidth={1.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: theme.surfaceMuted, borderRadius: radius.md },
  empty: { alignItems: 'center', justifyContent: 'center' },
});
