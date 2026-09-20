import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Clock, MapPin, Truck } from 'lucide-react-native';
import { Avatar } from './Avatar.js';
import { Badge } from './Badge.js';
import { FavoriteHeart } from './FavoriteHeart.js';
import { ImagePlaceholder } from './ImagePlaceholder.js';
import { RatingPill } from './RatingPill.js';
import { cardStyle, fontSize, spacing, text, theme } from '../theme.js';

export interface StoreCardProps {
  name: string;
  tagline?: string | null;
  coverUrl?: string | null;
  logoUrl?: string | null;
  rating: number;
  distanceLabel: string;
  etaLabel: string;
  isOpen: boolean;
  /** Band store ke liye: "Opens 9 AM" */
  opensAtLabel?: string | null;
  /** Sirf tab dikhta hai jab zero na ho — screenshot mein "$4.99 Delivery" */
  deliveryFeeLabel?: string | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}

/** "STORES NEAR YOU" ka card (screen [1]) */
export function StoreCard({
  name,
  tagline,
  coverUrl,
  logoUrl,
  rating,
  distanceLabel,
  etaLabel,
  isOpen,
  opensAtLabel,
  deliveryFeeLabel,
  isFavorite,
  onToggleFavorite,
  onPress,
}: StoreCardProps) {
  /*
   * Favourite heart Pressable ke BAHAR hai, uske andar nahi.
   *
   * Web par react-native-web ek Pressable ko `accessibilityRole="button"`
   * ke saath asli <button> element banata hai. Heart bhi ek button hai, to
   * use card ke andar rakhne se <button> ke andar <button> aa jaata tha —
   * jo invalid HTML hai, browser DOM ko silently restructure kar deta hai,
   * aur screen readers ke liye nested controls announce hote hain.
   *
   * Isliye dono ek container ke SIBLINGS hain aur heart absolutely position
   * hota hai. Rating pill aur logo andar hi rehte hain — woh interactive
   * nahi hain, sirf dikhte hain.
   */
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${isOpen ? 'open now' : 'closed'}, ${distanceLabel}`}
        style={({ pressed }) => [styles.pressableArea, pressed && styles.pressed]}
      >
      <View style={styles.cover}>
        <ImagePlaceholder uri={coverUrl} style={styles.coverImage} accessibilityLabel={name} />

        <View style={styles.ratingSlot}>
          <RatingPill rating={rating} />
        </View>

        {/* Store logo cover ke bottom-left par overlap karta hai */}
        <View style={styles.logoSlot}>
          <Avatar name={name} imageUrl={logoUrl} size={36} ringed />
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[text.title, styles.name]} numberOfLines={1}>
            {name}
          </Text>
          <Badge label={isOpen ? 'Open Now' : 'Closed'} tone={isOpen ? 'success' : 'neutral'} />
        </View>

        {tagline && (
          <Text style={text.muted} numberOfLines={1}>
            {tagline}
          </Text>
        )}

        <View style={styles.metaRow}>
          <Meta icon={<MapPin size={13} color={theme.textSecondary} />} label={distanceLabel} />
          {/* Band store ETA nahi dikhata — woh "Opens 9 AM" dikhata hai */}
          <Meta
            icon={<Clock size={13} color={theme.textSecondary} />}
            label={isOpen ? etaLabel : (opensAtLabel ?? etaLabel)}
          />
          {deliveryFeeLabel && (
            <Meta icon={<Truck size={13} color={theme.textSecondary} />} label={deliveryFeeLabel} />
          )}
        </View>
      </View>
      </Pressable>

      <View style={styles.heartSlot}>
        <FavoriteHeart isFavorite={isFavorite} onToggle={onToggleFavorite} />
      </View>
    </View>
  );
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.meta}>
      {icon}
      <Text style={styles.metaLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...cardStyle, position: 'relative' },
  pressableArea: Platform.select({
    web: { cursor: 'pointer' } as object,
    default: {},
  }) as object,
  pressed: { opacity: 0.9 },
  cover: { position: 'relative' },
  coverImage: { height: 150, borderRadius: 0 },
  // Rating pill heart ke liye jagah chhodti hai — heart uske daayein float hota hai
  ratingSlot: { position: 'absolute', top: spacing.md, right: spacing.md + 42 },
  heartSlot: { position: 'absolute', top: spacing.md, right: spacing.md },
  logoSlot: { position: 'absolute', left: spacing.md, bottom: spacing.md },
  body: { padding: spacing.lg, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaLabel: { fontSize: fontSize.sm, color: theme.textSecondary },
});
