import { Tabs } from 'expo-router';
import { Home, ShoppingCart, ReceiptText, User } from 'lucide-react-native';
import { fontWeight, theme } from '@nearbux/ui';

/**
 * Bottom tabs — hamesha EXACTLY chaar.
 *
 * Expo Router is folder ki HAR route file ka tab banata hai. Pehle search,
 * notifications, store, product, order aur checkout sab yahin the, aur tab
 * bar mein nau buttons aa rahe the.
 *
 * Structure ab yeh decide karta hai ki tab bar kahan dikhega:
 *   (tabs)/(home)/   → nested stack, tab bar DIKHTA hai (home, search)
 *   (tabs)/*.tsx     → chaar tabs khud
 *   app/*            → tabs ke bahar, tab bar ke UPAR full screen
 *                      (store, product, order, checkout, notifications)
 *
 * Yeh sirf cosmetic nahi hai: store aur product screens ka apna sticky CTA
 * hota hai ("Add to Cart"), aur uske neeche tab bar rakhna do competing
 * navigation surfaces bana deta hai.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: fontWeight.medium },
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen
        name="(home)"
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
