#!/usr/bin/env node
/**
 * Standalone-Smoke Schreibtisch-Vorbereitung (§ H.15, docs/STANDALONE-SMOKE-CHECKLIST.md §0).
 * Führt H.15 Vitest aus und gibt die nächsten Handy-Schritte aus.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const frontendDir = join(root, 'frontend')

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  return r.status ?? 1
}

console.log('=== Morgendrot Standalone-Smoke — Schreibtisch (Phase 0) ===\n')

const apkPath = join(frontendDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
const apkBuilt = existsSync(apkPath)

console.log('Automatisiert:')
const h15 = run('npm', ['run', 'test:h15-direct-submit'], root)
if (h15 !== 0) {
  console.error('\n[FAIL] test:h15-direct-submit — Feldtest 4b–4f erst nach grünem Schreibtisch.')
  process.exit(h15)
}
console.log('\n[OK] test:h15-direct-submit')

console.log('\nManuell (Checkliste §0):')
console.log(`  [${apkBuilt ? 'x' : ' '}] APK: cd frontend && npm run apk:debug:build`)
console.log(`       → ${apkPath}`)
console.log('  [ ] Zwei Handoff-ZIPs (verschiedene Profile) — Boss-Export mit Team-Postfach')
console.log('      Team-Broadcast-Key liegt in .morgendrot-handoff-extras.json (Passwort-ZIP: mitverschlüsselt)')
console.log('  [ ] Commit/Build-ID notieren für Geräterunde')

console.log('\nGerät (docs/STANDALONE-SMOKE-CHECKLIST.md):')
console.log('  A — 4b: Handoff → Seed → Klartext-Send (Direkt-RPC)')
console.log('  B — 4c/4d: ECDH + verschl. Send + Posteingang RPC')
console.log('  C — 4e/4f: Peering + QR (2 Geräte, PC-API aus)')
console.log('\nLogbuch: docs/TEST-RUN-LOGBOOK.md — eine Zeile pro Runde\n')

process.exit(0)
