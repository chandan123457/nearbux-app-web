import { Image, StyleSheet, Text, View } from 'react-native';
import { fontWeight, theme } from '../theme.js';

export interface AvatarProps {
  /** Naam se initials derive hote hain jab image na ho */
  name: string;
  imageUrl?: string | null;
  size?: number;
  /** Store logos ke liye white ring (card image ke upar overlap karte hain) */
  ringed?: boolean;
}

/**
 * Initials fallback avatar — "RS" profile par, "FV"/"AH"/"TC" store logos par.
 *
 * Initials server par compute hote hain (@nearbux/core) taaki teeno platforms
 * ek jaisa dikhayein, lekin yahan bhi fallback hai kyunki store cards ke paas
 * sirf naam hota hai.
 */
export function Avatar({ name, imageUrl, size = 40, ringed = false }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[dimension, ringed && styles.ring]}
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View style={[styles.fallback, dimension, ringed && styles.ring]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{deriveInitials(name)}</Text>
    </View>
  );
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: theme.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { borderWidth: 2, borderColor: theme.surface, backgroundColor: theme.surface },
  initials: { fontWeight: fontWeight.semibold, color: theme.primary },
});
