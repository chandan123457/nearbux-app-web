import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace packages ko unke TypeScript source se resolve karo, compiled
  // dist se nahi — warna tests stale build ke against chalte hain.
  resolve: { conditions: ['development'] },
  test: {
    setupFiles: ['./tests/setup.ts'],
    // Integration tests ek hi database share karte hain — parallel files
    // ek doosre ka data wipe kar denge.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
