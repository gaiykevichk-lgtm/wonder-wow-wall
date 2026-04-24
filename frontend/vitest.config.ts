import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 30000,
  },
  // B50 — Vitest 4 moved `poolOptions` out of `test`. Keeping the same
  // bounded thread budget (sandbox has limited RAM) just under the new key.
  pool: 'threads',
  poolOptions: {
    threads: {
      maxThreads: 2,
      minThreads: 1,
    },
  },
});
