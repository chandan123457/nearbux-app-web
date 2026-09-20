import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['development'],
    alias: {
      // Components React Native primitives import karte hain. Node mein test
      // karne ke liye unhe react-native-web par map karte hain — wahi
      // browser par chalta hai, isliye test wahi DOM dekhta hai jo user.
      'react-native': 'react-native-web',
      // Icon libraries untranspiled source ship karti hain jo Node nahi
      // chala sakta. Yeh tests DOM structure dekhte hain, icons nahi.
      'lucide-react-native': new URL('./src/__tests__/stubs/icons.tsx', import.meta.url).pathname,
      'react-native-svg': new URL('./src/__tests__/stubs/svg.tsx', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.tsx'],
  },
});
