import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { BellOff, ChevronLeft, Package, Tag, User, Info } from 'lucide-react-native';
import type { Notification } from '@nearbux/types';
import {
  EmptyState,
  SectionHeader,
  contentContainer,
  fontSize,
  fontWeight,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { api } from '../../src/lib/api';
import { CenteredSpinner } from './index';
import { keys, useNotifications } from '../../src/lib/queries';

/** Screen [13] */
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useNotifications();

  async function markAllRead() {
    await api.notifications.markAllRead();
    void qc.invalidateQueries({ queryKey: keys.notifications });
    void qc.invalidateQueries({ queryKey: ['home'] });
  }

  if (isLoading) return <CenteredSpinner insetTop={insets.top} />;

  const isEmpty = (data?.today.length ?? 0) + (data?.earlier.length ?? 0) === 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      <View style={[contentContainer, styles.content, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
            <ChevronLeft size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={[text.sectionLabel, styles.title]}>Notifications</Text>
          {(data?.unreadCount ?? 0) > 0 && (
            <Pressable onPress={markAllRead} hitSlop={8} accessibilityRole="button">
              <Text style={text.link}>Mark all as read</Text>
            </Pressable>
          )}
        </View>

        {isEmpty ? (
          <EmptyState
            icon={<BellOff size={40} color={theme.textDisabled} strokeWidth={1.5} />}
            title="Nothing new"
            message="Order updates and offers will show up here."
          />
        ) : (
          <>
            {data!.today.length > 0 && (
              <View style={styles.group}>
                <SectionHeader title="Today" uppercase />
                {data!.today.map((n) => (
                  <NotificationRow key={n.id} notification={n} />
                ))}
              </View>
            )}
            {data!.earlier.length > 0 && (
              <View style={styles.group}>
                <SectionHeader title="Earlier" uppercase />
                {data!.earlier.map((n) => (
                  <NotificationRow key={n.id} notification={n} />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const ICONS = {
  ORDER_UPDATE: Package,
  PROMOTION: Tag,
  ACCOUNT: User,
  SYSTEM: Info,
} as const;

function NotificationRow({ notification }: { notification: Notification }) {
  const Icon = ICONS[notification.type];
  return (
    <View style={[styles.row, !notification.isRead && styles.unread]}>
      <View style={styles.iconWrap}>
        <Icon size={17} color={theme.textSecondary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {notification.title}
        </Text>
        <Text style={text.muted}>{notification.body}</Text>
        <Text style={styles.time}>{notification.relativeLabel}</Text>
      </View>
      {/* Unread dot — screen [13] ka blue indicator */}
      {!notification.isRead && <View style={styles.dot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  group: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  unread: { backgroundColor: theme.primarySubtle },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  time: { fontSize: fontSize.xs, color: theme.primary, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, marginTop: 6 },
});
