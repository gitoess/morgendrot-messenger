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
    /** CI: sequentiell — vermeidet Singleton-Races (Tab-Persist) in Fork-Workern. */
    fileParallelism: !isCi,
    maxWorkers: isCi ? 1 : undefined,
    teardownTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['./tests/vitest-setup.ts', './tests/i18n-vitest-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
