import { Tabs } from 'expo-router';
import { Home, ShoppingCart, ReceiptText, User } from 'lucide-react-native';
import { fontWeight, theme } from '@nearbux/ui';

/**
 * Bottom tabs — screenshots wala navigation.
 *
 * Yahan Expo Router ke `Tabs` use kar rahe hain, @nearbux/ui ke
 * `BottomTabBar` ke bajaye: Tabs asli routing, deep links, web URLs aur
 * back-button behaviour deta hai. UI package ka BottomTabBar ab presentational
 * reference hai — agar baad mein custom tab bar chahiye to Tabs ka
 * `tabBar` prop usse render kar sakta hai.
 */
export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: { fontWeight: fontWeight.medium },
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Home size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => <ShoppingCart size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <ReceiptText size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <User size={22} color={color} /> }}
      />
    </Tabs>
  );
}
