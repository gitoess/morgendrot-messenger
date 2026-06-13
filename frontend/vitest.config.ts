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
    setupFiles: ['./tests/vitest-setup.ts', './tests/i18n-vitest-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@morgendrot/shared': path.resolve(__dirname, '../src/shared'),
      '@morgendrot/shared/bytes-base64': path.resolve(__dirname, '../src/shared/bytes-base64.ts'),
      '@morgendrot/shared/morgendrot-crypto': path.resolve(__dirname, '../src/shared/morgendrot-crypto.ts'),
    },
  },
})
