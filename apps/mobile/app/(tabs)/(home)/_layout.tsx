import { Stack } from 'expo-router';
import { theme } from '@nearbux/ui';

/**
 * Home tab ke andar ka stack.
 *
 * Search yahan rehti hai, root par nahi, taaki:
 *   - tab bar dikhta rahe (screens [16][17] mein dikh raha hai)
 *   - "Home" tab highlighted rahe jab user search kar raha ho
 *   - back button search se home par wapas aaye, kisi aur tab par nahi
 */
export default function HomeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="search" />
    </Stack>
  );
}
