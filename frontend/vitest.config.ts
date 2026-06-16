import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    pool: 'forks',
    teardownTimeout: 15_000,
    hookTimeout: 15_000,
    setupFiles: ['./tests/vitest-setup.ts', './tests/i18n-vitest-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
