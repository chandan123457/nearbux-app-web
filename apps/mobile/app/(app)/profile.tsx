import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  ListRow,
  Screen,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { api } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';

const MENU = [
  { key: 'addresses', title: 'Saved Addresses' },
  { key: 'qr', title: 'QR Scanner' },
  { key: 'payments', title: 'Payment Methods' },
] as const;

const SUPPORT = [
  { key: 'help', title: 'Help & Support' },
  { key: 'terms', title: 'Terms & Privacy' },
] as const;

/**
 * Profile (screen [12]).
 *
 * Yeh app ki PEHLI screen hai jo asli backend data dikhati hai — naam, phone
 * aur initials `GET /v1/me` se aate hain. Menu items abhi inert hain kyunki
 * unke endpoints nahi bane.
 */
export default function ProfileScreen() {
  const { user, signOut } = useSession();
  const insets = useSafeAreaInsets();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      // Server ko batao taaki refresh token revoke ho jaaye. Yeh fail bhi ho
      // jaaye to `signOut` local tokens clear kar hi dega — user ko fasa
      // nahi chhodna.
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
    <Screen bottomInset={insets.bottom} style={{ paddingTop: insets.top + spacing.md }}>
      <Text style={text.screenTitle}>My Profile</Text>

      <Card variant="muted" padded={false}>
        <View style={styles.identity}>
          <Avatar name={user?.fullName ?? 'NearBux User'} imageUrl={user?.avatarUrl} size={48} />
          <View style={styles.identityText}>
            <Text style={text.title} numberOfLines={1}>
              {user?.fullName ?? 'NearBux User'}
            </Text>
            <Text style={text.muted}>{formatPhone(user?.phone)}</Text>
          </View>
          <Text style={text.link}>Edit</Text>
        </View>
      </Card>

      <Card padded={false}>
        {MENU.map((item, index) => (
          <ListRow
            key={item.key}
            title={item.title}
            showChevron
            isLast={index === MENU.length - 1}
          />
        ))}
      </Card>

      <Card padded={false}>
        {SUPPORT.map((item, index) => (
          <ListRow
            key={item.key}
            title={item.title}
            showChevron
            isLast={index === SUPPORT.length - 1}
          />
        ))}
      </Card>

      <Button
        label="Log Out"
        variant="destructive"
        onPress={confirmSignOut}
        loading={isSigningOut}
      />
    </Screen>
  );
}

/** "+919876543210" → "+91 98765 43210" */
function formatPhone(phone?: string): string {
  if (!phone) return '';
  const match = phone.match(/^(\+91)(\d{5})(\d{5})$/);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : phone;
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  identityText: { flex: 1, gap: 2 },
});
