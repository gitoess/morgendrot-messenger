import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const isCi = Boolean(process.env.CI)

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    pool: 'forks',
    /** CI: sequentiell, ein Worker — Fork pro Datei bleibt isoliert (kein singleThread). */
    fileParallelism: !isCi,
    maxWorkers: isCi ? 1 : undefined,
    teardownTimeout: isCi ? 60_000 : 30_000,
    hookTimeout: isCi ? 60_000 : 30_000,
    testTimeout: isCi ? 30_000 : 10_000,
    setupFiles: ['./tests/vitest-setup.ts', './tests/i18n-vitest-setup.ts'],
    globalTeardown: isCi ? ['./tests/vitest-global-teardown.ts'] : undefined,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
