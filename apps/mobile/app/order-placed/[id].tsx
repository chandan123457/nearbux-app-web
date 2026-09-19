import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, Clock } from 'lucide-react-native';
import { formatEta, formatMinor } from '@nearbux/core';
import { Button, Card, contentContainer, fontSize, fontWeight, spacing, text, theme } from '@nearbux/ui';
import { GradientButton } from '../../src/components/GradientButton';
import { CenteredSpinner } from '../../src/components/ScreenState';
import { useOrder } from '../../src/lib/queries';

/**
 * Screen [23] — Order placed.
 *
 * Tracking se ALAG screen hai, sirf ek flag nahi. Iska kaam alag hai: order
 * lag gaya yeh confirm karna aur do raaste dena. Isme na timeline hai, na
 * items, na cancel — us waqt user ko sirf yeh jaanna hai ki paisa gaya aur
 * order pakka hua.
 *
 * `replace` se yahan aate hain, `push` se nahi — back press user ko checkout
 * par wapas nahi le jaana chahiye jahan woh dobara order kar sakta hai.
 */
export default function OrderPlacedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading } = useOrder(id ?? '');

  if (isLoading || !order) return <CenteredSpinner insetTop={insets.top} />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      <View style={[contentContainer, styles.content, { paddingTop: insets.top + spacing['3xl'] }]}>
        <View style={styles.hero}>
          <View style={styles.circle}>
            <Check size={40} color={theme.textInverse} strokeWidth={3} />
          </View>
          <Text style={styles.title}>Order placed!</Text>
          <Text style={styles.message}>
            Your order from {order.storeName} has been confirmed
          </Text>
        </View>

        <Card variant="muted">
          <Row label="Order ID" value={`#${order.orderNumber}`} />
          <Row
            label="Estimated Arrival"
            value={`Arriving in ${formatEta(order.etaMinMinutes, order.etaMaxMinutes)}`}
            icon={<Clock size={14} color={theme.textSecondary} />}
          />
          <Row label="Total Paid" value={formatMinor(order.bill.totalMinor)} />
        </Card>

        <View style={styles.actions}>
          <GradientButton
            label="Track Order"
            onPress={() => router.replace(`/order/${order.id}`)}
            iconRight={<ArrowRight size={18} color={theme.textInverse} />}
          />
          <Button label="Continue Shopping" variant="outline" onPress={() => router.replace('/')} />
        </View>
      </View>
    </ScrollView>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={text.muted}>{label}</Text>
      <View style={styles.rowValue}>
        {icon}
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.md },
  circle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: theme.textPrimary },
  message: {
    fontSize: fontSize.md,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  value: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  actions: { gap: spacing.md },
});
