import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  Check,
  ChevronLeft,
  MapPin,
  Package,
  ShoppingBag,
  Tag,
} from 'lucide-react-native';
import type { Notification } from '@nearbux/types';
import {
  EmptyState,
  contentContainer,
  fontSize,
  fontWeight,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { CenteredSpinner } from '../src/components/ScreenState';
import { api } from '../src/lib/api';
import { resolveDeepLink } from '../src/lib/deep-links';
import { keys, useNotifications } from '../src/lib/queries';

/** Screen [27] — Notifications */
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useNotifications();

  function invalidate() {
    void qc.invalidateQueries({ queryKey: keys.notifications });
    // Home ka bell badge isi count par chalta hai — usse bhi refresh karo,
    // warna badge tab tak dikhta rehta hai jab tak feed dobara na khule
    void qc.invalidateQueries({ queryKey: ['home'] });
  }

  const markAllRead = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: invalidate,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: invalidate,
  });

  function open(notification: Notification) {
    // Read mark karna fire-and-forget hai. Navigation ko iska wait nahi
    // karna chahiye — network dheema hone par tap dead mehsoos hota hai.
    if (!notification.isRead) markRead.mutate(notification.id);

    const route = resolveDeepLink(notification.deepLink);
    if (route) router.push(route);
  }

  const total = (data?.today.length ?? 0) + (data?.earlier.length ?? 0);

  return (
    <View style={styles.root}>
      <View style={[contentContainer, styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
          <ChevronLeft size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        {(data?.unreadCount ?? 0) > 0 && (
          <Pressable
            onPress={() => markAllRead.mutate()}
            hitSlop={8}
            accessibilityRole="button"
            disabled={markAllRead.isPending}
          >
            <Text style={text.link}>Mark all as read</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <CenteredSpinner />
      ) : total === 0 ? (
        <EmptyState
          icon={<BellOff size={40} color={theme.textDisabled} strokeWidth={1.5} />}
          title="Nothing new"
          message="Order updates and offers will show up here."
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
          <View style={contentContainer}>
            {data!.today.length > 0 && (
              <Section title="Today" notifications={data!.today} onOpen={open} />
            )}
            {data!.earlier.length > 0 && (
              <Section title="Earlier" notifications={data!.earlier} onOpen={open} />
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Section({
  title,
  notifications,
  onOpen,
}: {
  title: string;
  notifications: Notification[];
  onOpen: (notification: Notification) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionLabel}>{title}</Text>
      {notifications.map((notification) => (
        <NotificationRow key={notification.id} notification={notification} onOpen={onOpen} />
      ))}
    </View>
  );
}

/**
 * Icon notification ke MATLAB se chunta hai, sirf type se nahi.
 *
 * Har order update ek jaisa dikhega agar sirf type dekha jaaye, jabki
 * "delivered" aur "out for delivery" scan karte waqt bilkul alag feel dete
 * hain. Delivered ko green check milta hai — list mein use ek hi nazar mein
 * pehchana jaana chahiye.
 */
function iconFor(notification: Notification) {
  const { type, title } = notification;
  const lower = title.toLowerCase();

  if (type === 'ORDER_UPDATE') {
    if (lower.includes('deliver') && !lower.includes('out for')) {
      return { Icon: Check, color: theme.successText, background: theme.successSubtle };
    }
    if (lower.includes('out for')) {
      return { Icon: ShoppingBag, color: theme.textSecondary, background: theme.surfaceMuted };
    }
    return { Icon: Package, color: theme.textSecondary, background: theme.surfaceMuted };
  }
  if (type === 'PROMOTION') {
    return { Icon: Tag, color: theme.textSecondary, background: theme.surfaceMuted };
  }
  if (type === 'ACCOUNT') {
    return { Icon: MapPin, color: theme.textSecondary, background: theme.surfaceMuted };
  }
  return { Icon: Bell, color: theme.textSecondary, background: theme.surfaceMuted };
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}) {
  const { Icon, color, background } = iconFor(notification);
  const isTappable = resolveDeepLink(notification.deepLink) !== null || !notification.isRead;

  return (
    <Pressable
      onPress={() => onOpen(notification)}
      disabled={!isTappable}
      accessibilityRole={isTappable ? 'button' : undefined}
      accessibilityLabel={`${notification.isRead ? '' : 'Unread. '}${notification.title}. ${notification.body}`}
      style={({ pressed }) => [
        styles.row,
        !notification.isRead && styles.rowUnread,
        pressed && isTappable && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: background }]}>
        <Icon size={17} color={color} strokeWidth={2.2} />
      </View>

      <View style={styles.body}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.rowBody} numberOfLines={3}>
          {notification.body}
        </Text>
        {/* Unread timestamp blue hai, read gray — ek aur signal us dot ke
            alawa, jo colour-blind users ke liye zaroori hai */}
        <Text style={[styles.time, notification.isRead ? styles.timeRead : styles.timeUnread]}>
          {notification.relativeLabel}
        </Text>
      </View>

      {!notification.isRead && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: theme.textPrimary },

  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: theme.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  // Unread rows ek halka blue block banati hain. Adjacent unread rows ek
  // saath ek block ki tarah padhte hain, jo design mein bhi yahi hai.
  rowUnread: { backgroundColor: theme.primarySubtle },
  pressed: { opacity: 0.7 },

  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  rowBody: { fontSize: fontSize.base, color: theme.textSecondary, lineHeight: 21 },
  time: { fontSize: fontSize.sm, marginTop: 2 },
  timeUnread: { color: theme.primary, fontWeight: fontWeight.medium },
  timeRead: { color: theme.textSecondary },

  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.primary, marginTop: 8 },
});
