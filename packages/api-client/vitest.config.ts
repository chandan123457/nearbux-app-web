import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace packages ko unke TypeScript source se resolve karo
  resolve: { conditions: ['development'] },
  test: {},
});
