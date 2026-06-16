import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const isCi = Boolean(process.env.CI)

/** Node-Unit-Tests: kein jsdom/RTL/i18n-Setup (CI-Hook-Konflikt mit direct-iota-Session).
 *  CI: Workflow führt jsdom- und node-Projekt getrennt aus (sauberer Prozess-Exit). */
const nodeUnitTests = [
  'frontend/lib/direct-iota-mnemonic-session.test.ts',
  'frontend/lib/direct-iota-vault-unlock-sync.test.ts',
  'frontend/lib/handoff-zip-crypto.test.ts',
  'frontend/lib/handoff-zip-import.test.ts',
  'frontend/lib/handoff-iota-wire.test.ts',
]

const sharedPool = {
  pool: 'forks' as const,
  isolate: true,
  fileParallelism: !isCi,
  maxWorkers: isCi ? 1 : undefined,
  teardownTimeout: isCi ? 60_000 : 30_000,
  hookTimeout: isCi ? 60_000 : 30_000,
  testTimeout: isCi ? 30_000 : 10_000,
  globalTeardown: ['./tests/vitest-global-teardown.ts'],
  reporters: isCi ? (['default', 'github-actions'] as ['default', 'github-actions']) : (['default'] as ['default']),
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: false,
    passWithNoTests: true,
    ...sharedPool,
    projects: [
      {
        extends: true,
        test: {
          name: 'frontend-jsdom',
          environment: 'jsdom',
          include: ['frontend/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}'],
          exclude: [...nodeUnitTests, '**/node_modules/**', '**/dist/**'],
          setupFiles: ['./tests/vitest-setup.ts', './tests/i18n-vitest-setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'frontend-node',
          environment: 'node',
          include: nodeUnitTests,
        },
      },
    ],
  },
})
