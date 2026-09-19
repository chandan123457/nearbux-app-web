import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  ListRow,
  contentContainer,
  fontSize,
  fontWeight,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { api } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';

const ACCOUNT_MENU = [
  { key: 'addresses', title: 'Saved Addresses' },
  { key: 'qr', title: 'QR Scanner' },
  { key: 'payments', title: 'Payment Methods' },
] as const;

const SUPPORT_MENU = [
  { key: 'help', title: 'Help & Support' },
  { key: 'terms', title: 'Terms & Privacy' },
] as const;

/** Screen [26] — My Profile */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, isVerified, signOut } = useSession();
  const insets = useSafeAreaInsets();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      // Server ko batao taaki refresh token revoke ho. Yeh fail bhi ho jaaye
      // to local tokens clear hote hi hain — user ko fasa nahi chhodna.
      await api.auth.logoutAll().catch(() => undefined);
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  function confirmSignOut() {
    // Alert.alert web par no-op hai — wahan native confirm() use karo
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Log out of NearBux?')) void handleSignOut();
      return;
    }
    Alert.alert('Log out', 'Log out of NearBux?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void handleSignOut() },
    ]);
  }

  return (
    <ScrollView
      style={styles.root}
      // Log Out screen ke NEECHE baithta hai, cards ke turant baad nahi.
      // `flexGrow` + spacer se woh chhoti screen par bhi neeche rehta hai
      // aur bade content par scroll ho jaata hai.
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={[contentContainer, styles.content]}>
        <Text style={styles.title}>My Profile</Text>

        {/*
          Guest ko yahan ek WALL nahi, ek invitation milta hai. Woh already
          browse kar sakta hai, cart bana sakta hai aur order de sakta hai —
          phone sirf tab chahiye jab account devices ke beech chalna ho.
        */}
        <Card variant="muted" padded={false}>
          <View style={styles.identity}>
            <Avatar
              name={isVerified ? (user?.fullName ?? 'NearBux User') : 'G'}
              imageUrl={user?.avatarUrl}
              size={52}
            />
            <View style={styles.identityText}>
              <Text style={text.title} numberOfLines={1}>
                {isVerified ? user!.fullName : 'Guest'}
              </Text>
              <Text style={text.muted}>
                {isVerified ? formatPhone(user?.phone) : 'Add your number to save your account'}
              </Text>
            </View>
            <Pressable
              onPress={() => !isVerified && router.push('/sign-in')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isVerified ? 'Edit profile' : 'Add phone number'}
            >
              <Text style={text.link}>{isVerified ? 'Edit' : 'Add'}</Text>
            </Pressable>
          </View>
        </Card>

        <Card variant="muted" padded={false}>
          {ACCOUNT_MENU.map((item, index) => (
            <ListRow
              key={item.key}
              title={item.title}
              showChevron
              isLast={index === ACCOUNT_MENU.length - 1}
            />
          ))}
        </Card>

        <Card variant="muted" padded={false}>
          {SUPPORT_MENU.map((item, index) => (
            <ListRow
              key={item.key}
              title={item.title}
              showChevron
              isLast={index === SUPPORT_MENU.length - 1}
            />
          ))}
        </Card>

        <View style={styles.spacer} />

        {/* Guest ke paas sign out karne ko kuch hai hi nahi — woh button
            confusing hota, aur tap karne par kuch hota bhi nahi dikhta */}
        {isVerified && (
          <Button
            label="Log Out"
            variant="destructive"
            onPress={confirmSignOut}
            loading={isSigningOut}
          />
        )}
      </View>
    </ScrollView>
  );
}

/** "+919876543210" → "+91 98765 43210". Guest par phone null hota hai. */
function formatPhone(phone?: string | null): string {
  if (!phone) return '';
  const match = phone.match(/^(\+91)(\d{5})(\d{5})$/);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : phone;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  scroll: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.lg },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: theme.textPrimary },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  identityText: { flex: 1, gap: 2 },
  spacer: { flex: 1, minHeight: spacing['3xl'] },
});
