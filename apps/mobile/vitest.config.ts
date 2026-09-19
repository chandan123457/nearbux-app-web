import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace packages ko TypeScript source se resolve karo
  resolve: { conditions: ['development'] },
  test: {
    // Sirf pure logic — RN component tests ko apna runtime chahiye, aur woh
    // alag setup hai. Yahan woh hai jo bina render kiye test ho sakta hai.
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
