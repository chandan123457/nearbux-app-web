import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace packages ko unke TypeScript source se resolve karo, compiled
  // dist se nahi — warna tests stale build ke against chalte hain.
  resolve: { conditions: ['development'] },
  test: {},
});
