/**
 * Reihenfolge nach Standalone-Kern: Logbuch-Vorbereitung → Kaltstart → Handoff → Smoke-Hinweis.
 * Nutzung: node scripts/apk-standalone-followup.mjs
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(script) {
  console.log(`\n########## ${script} ##########\n`)
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', script)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, SKIP_ONBOARDING: '1' },
    stdio: 'inherit',
  })
  return r.status ?? 1
}

console.log('=== Standalone Follow-up (1 Gerät) ===')
console.log('4e/4f: bewusst übersprungen — zweites Gerät später.\n')

const results = []
results.push({ id: 'kaltstart', status: run('apk-standalone-coldstart-test.mjs') })
results.push({ id: 'handoff-apply', status: run('apk-standalone-handoff-apply-test.mjs') })

console.log('\n========== Zusammenfassung ==========')
for (const r of results) {
  const label = r.status === 0 ? 'PASS' : 'FAIL'
  console.log(`  ${r.id}: ${label}`)
}
console.log('  4e/4f: N/A (2. Gerät)')
console.log('\nBlock-2 Boss-ZIP am PC: npm run env:role:boss && npm run dev → Export-Assistent')
console.log('Dann APK: Einstellungen → Handoff importieren (manuell mit echter ZIP).')

const fail = results.some((r) => r.status !== 0)
process.exit(fail ? 2 : 0)
