/**
 * Standalone Smoke 4b–4f — CDP discover + sequentielle Tests auf einem Gerät.
 * 4e/4f: N/A ohne zweites Gerät (Hinweis im Log).
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chainEnvFromGlobals } from './apk-chain-globals.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_ONBOARDING = process.env.SKIP_ONBOARDING === '1'
const RUN_4E = process.env.SMOKE_4E === '1'

function runNode(script, env = {}) {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', script)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const out = (r.stdout || '') + (r.stderr || '')
  if (out.trim()) process.stdout.write(out)
  return r.status ?? 1
}

function discover() {
  const discoverOut = spawnSync(process.execPath, [join(ROOT, 'scripts', 'apk-cdp-discover.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const combined = String(discoverOut.stdout || '') + String(discoverOut.stderr || '')
  if ((discoverOut.status ?? 1) !== 0) {
    process.stdout.write(combined)
    return null
  }
  process.stdout.write(combined)
  const env = {
    SKIP_ONBOARDING: SKIP_ONBOARDING ? '1' : '0',
    ...chainEnvFromGlobals(),
  }
  for (const line of combined.split(/\r?\n/)) {
    const m = line.match(/^(CDP_WS_URL|SOLO_[A-Z_]+)=(.+)$/)
    if (m) env[m[1]] = m[2]
  }
  if (!env.CDP_WS_URL) return null
  return env
}

const env = discover()
if (!env) {
  console.error('CDP_WS_URL nicht gefunden')
  process.exit(1)
}

console.log('\n========== Standalone Smoke 4b–4f ==========\n')

const results = []

const s4b = runNode('apk-standalone-4b-test.mjs', env)
results.push({ id: '4b', status: s4b })

const s4cd = runNode('apk-standalone-4cd-test.mjs', env)
results.push({ id: '4c+4d', status: s4cd })

if (RUN_4E) {
  console.log('\n--- 4e/4f: zweites Gerät erforderlich — SMOKE_4E=1 ohne Implementierung ---')
  results.push({ id: '4e', status: 4 })
  results.push({ id: '4f', status: 4 })
} else {
  console.log('\n--- 4e + 4f: N/A (ein Gerät) — zweites APK + SMOKE_4E=1 für Peering/QR ---')
  results.push({ id: '4e', status: 'N/A' })
  results.push({ id: '4f', status: 'N/A' })
}

console.log('\n========== Zusammenfassung ==========')
for (const r of results) {
  const label =
    r.status === 0
      ? 'PASS'
      : r.status === 3
        ? 'PARTIAL'
        : r.status === 'N/A'
          ? 'N/A'
          : 'FAIL'
  console.log(`  ${r.id}: ${label}`)
}

const coreFail = results.some((r) => typeof r.status === 'number' && r.status !== 0 && r.status !== 3 && r.status !== 4)
const corePartial = results.some((r) => r.status === 3)

if (coreFail) process.exit(2)
if (corePartial) process.exit(3)
process.exit(0)
