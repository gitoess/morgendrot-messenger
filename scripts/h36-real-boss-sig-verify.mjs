/**
 * § H.36 — Echte Boss-Sig E2E, headless (ohne adb/Gerät).
 *
 * 1) POST /api/team-sync/sign-team-wire → echte Boss-Signatur (SIGNER=sdk, Tresor offen)
 * 2) Kryptografische Verifikation: Signer-Adresse == boss-Feld (verifyPersonalMessageSignature)
 * 3) Gegenprobe: Fremd-Boss + Fake-Sig → muss FEHLSCHLAGEN (invalid/boss-mismatch)
 *
 * Beweist den Server-Signier-Weg unabhängig von der Geräte-UI (gleiche Logik wie
 * verifyTeamWireSignature in src/shared/morg-team-wire-signature.ts).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { apiTestFetchInit } from './api-test-headers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOSS_API = (process.env.MORGENDROT_API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '')
const SIG_DOMAIN = 'MORG_TEAM_WIRE_SIG_V1'

function readBossAddress() {
  try {
    return readFileSync(join(ROOT, '.morgendrot-partner'), 'utf8').trim()
  } catch {
    return process.env.BOSS_ADDRESS || ''
  }
}

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((x) => stableStringify(x)).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

function buildSignBytes(payload) {
  const { sig: _sig, ...rest } = payload
  return new TextEncoder().encode(`${SIG_DOMAIN}:${stableStringify(rest)}`)
}

function toHex64(addr) {
  const t = (addr || '').trim().toLowerCase()
  const hex = t.startsWith('0x') ? t.slice(2) : t
  return /^[a-f0-9]{64}$/.test(hex) ? hex : null
}

async function verifyTeamWire(payload) {
  const boss = toHex64(String(payload.boss ?? ''))
  if (!boss) return { ok: false, reason: 'missing-boss' }
  const sig = String(payload.sig ?? '').trim()
  if (!sig) return { ok: false, reason: 'missing-sig' }
  try {
    const { verifyPersonalMessageSignature } = await import('@iota/iota-sdk/verify')
    const pk = await verifyPersonalMessageSignature(buildSignBytes(payload), sig)
    if (!pk) return { ok: false, reason: 'invalid-sig' }
    const derived = toHex64(typeof pk.toIotaAddress === 'function' ? pk.toIotaAddress() : '')
    if (!derived) return { ok: false, reason: 'invalid-sig' }
    if (derived !== boss) return { ok: false, reason: 'boss-mismatch', derived }
    return { ok: true, derived }
  } catch (e) {
    return { ok: false, reason: 'invalid-sig', error: String(e?.message ?? e) }
  }
}

async function requestBossSig(payload) {
  const r = await fetch(
    `${BOSS_API}/api/team-sync/sign-team-wire`,
    apiTestFetchInit({
      method: 'POST',
      body: JSON.stringify({ payload }),
    })
  )
  const text = await r.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  if (!r.ok || !json?.ok || !json?.sig) {
    throw new Error(`Boss-Sign HTTP ${r.status}: ${json?.error || text.slice(0, 160)}`)
  }
  return json.sig
}

async function main() {
  console.log('=== § H.36 — Echte Boss-Sig E2E (headless) ===\n')
  const bossAddr = readBossAddress()
  if (!toHex64(bossAddr)) throw new Error('BOSS_ADDRESS / .morgendrot-partner fehlt oder ungültig')
  console.log('Boss:', bossAddr.slice(0, 14) + '…')

  const st = await fetch(`${BOSS_API}/api/status`).then((r) => r.json())
  console.log(`Status: role=${st.role} locked=${st.locked} signer=${st.signer}\n`)

  const seq = Math.floor(Date.now() / 1000)
  const validPayload = {
    v: 1,
    kind: 'add',
    seq,
    teamId: 'h36-real-boss-sig',
    boss: bossAddr,
    issuedAt: Date.now(),
    member: { address: bossAddr, name: `RealSig ${seq}` },
  }

  console.log('1) Echte Boss-Signatur anfordern …')
  const sig = await requestBossSig(validPayload)
  console.log('   sig:', sig.slice(0, 24) + '…')

  console.log('2) Verifikation (Signer-Adresse == boss) …')
  const okRes = await verifyTeamWire({ ...validPayload, sig })
  console.log('   →', JSON.stringify(okRes))
  if (!okRes.ok) throw new Error('Echte Boss-Sig verifiziert NICHT — ' + JSON.stringify(okRes))

  console.log('3) Gegenprobe: Fremd-Boss + Fake-Sig (muss fehlschlagen) …')
  const badRes = await verifyTeamWire({
    ...validPayload,
    boss: `0x${'f'.repeat(64)}`,
    sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  })
  console.log('   →', JSON.stringify(badRes))
  if (badRes.ok) throw new Error('Fake-Sig wurde fälschlich akzeptiert!')

  console.log('\n=== RESULT: PASS — echte Boss-Sig validiert, Fake blockiert ===')
}

main().catch((e) => {
  console.error('\n=== RESULT: FAIL ===')
  console.error(e?.message ?? e)
  process.exit(1)
})
