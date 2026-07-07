/**
 * Discover CDP + run Standalone smoke 4b–4d (4e/4f N/A ohne 2. Gerät).
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'apk-standalone-smoke.mjs')], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, SKIP_ONBOARDING: process.env.SKIP_ONBOARDING || '1' },
  stdio: 'inherit',
})

process.exit(r.status ?? 1)
