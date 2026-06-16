import { defineConfig } from 'vitest/config'

const isCi = Boolean(process.env.CI)

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    fileParallelism: !isCi,
    maxWorkers: isCi ? 1 : undefined,
    teardownTimeout: isCi ? 30_000 : 10_000,
    reporters: isCi ? ['default', 'github-actions'] : ['default'],
  },
})
