/**
 * Helfer (Samsung APK) → Boss (PC API): Klartext via Direkt-RPC, Boss-Inbox prüfen.
 *
 * Voraussetzungen:
 * - Boss: npm run env:role:boss && npm run dm (Port 3342)
 * - Samsung: USB-Debugging, APK im Vordergrund
 * - Gleiche Ketten-IDs wie Boss-Handoff (Block2-ZIP)
 */
import { readFileSync } from 'node:fs'
import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  applyBossHandoffChainViaStorage,
  assertChainIds,
  configureSoloChain,
  createCdpSession,
  isDirectRelay,
  openMessagesComposer,
  readDirectRpcReady,
  sendComposerMessage,
  sendOk,
  SKIP_ONBOARDING,
  snapshot,
  unlockVaultIfNeeded,
  waitForAppReady,
} from './apk-cdp-common.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOSS_API = (process.env.MORGENDROT_API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '')
const BOSS_ADDR =
  process.env.BOSS_ADDRESS ||
  readFileSync(join(ROOT, '.morgendrot-partner'), 'utf8').trim()
const BOSS_PW = process.env.BOSS_TEST_PW || process.env.TEST_PW || '12345678'
const HANDOFF_ENV =
  process.env.BOSS_HANDOFF_ENV ||
  join(ROOT, 'exports', 'block2-handoff-smoke-unzipped', 'morgendrot-standalone-handoff.env')

const TEST_MESSAGE = process.env.TEST_MSG || `helper-boss ${new Date().toISOString()}`
const PACKAGE = process.env.APK_PACKAGE || 'de.morgendrot.messenger'

function parseEnvFile(text) {
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 1) continue
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

function loadBossHandoffChain() {
  try {
    const env = parseEnvFile(readFileSync(HANDOFF_ENV, 'utf8'))
    return {
      packageId: env.PACKAGE_ID,
      mailboxId: env.MAILBOX_ID,
      rpcUrl: env.RPC_URL || env.NEXT_PUBLIC_DIRECT_IOTA_RPC_URL || 'https://api.testnet.iota.cafe',
      bossAddress: env.BOSS_ADDRESS || BOSS_ADDR,
    }
  } catch {
    return {
      packageId: process.env.BOSS_PACKAGE_ID || '',
      mailboxId: process.env.BOSS_MAILBOX_ID || '',
      rpcUrl: process.env.BOSS_RPC_URL || 'https://api.testnet.iota.cafe',
      bossAddress: BOSS_ADDR,
    }
  }
}

async function discoverWs() {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'apk-cdp-discover.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const combined = String(r.stdout || '') + String(r.stderr || '')
  process.stdout.write(combined)
  for (const line of combined.split(/\r?\n/)) {
    const m = line.match(/^CDP_WS_URL=(.+)$/)
    if (m) return m[1]
  }
  return ''
}

async function bossFetch(path, opts = {}) {
  const res = await fetch(`${BOSS_API}${path}`, {
    signal: AbortSignal.timeout(15_000),
    ...opts,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function ensureBossUnlocked() {
  const st = await bossFetch('/api/status')
  if (!st.json) throw new Error('Boss-API nicht erreichbar — npm run dm?')
  if (st.json.locked === false && st.json.myAddressFull) {
    console.log('   Boss bereits entsperrt:', String(st.json.myAddressFull).slice(0, 12) + '…')
    return st.json
  }
  console.log('   Boss Tresor entsperren …')
  const unlock = await bossFetch('/api/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: BOSS_PW }),
  })
  if (!unlock.json?.ok) {
    throw new Error('Boss-Unlock fehlgeschlagen: ' + (unlock.json?.error || unlock.text.slice(0, 120)))
  }
  const after = await bossFetch('/api/status')
  return after.json
}

async function bossInboxFind(needle, senderFilter) {
  const body = {
    cmd: '/inbox',
    args: ['50', senderFilter || '', '', 'boss'],
    silentFetch: true,
  }
  const res = await bossFetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = res.json?.data ?? res.json?.messages ?? res.json
  const blob = JSON.stringify(data || res.text).toLowerCase()
  const hit = blob.includes(needle.toLowerCase().slice(0, 24))
  return { hit, ok: res.json?.ok !== false, snippet: blob.slice(0, 400) }
}

async function main() {
  assertChainIds()
  const chain = loadBossHandoffChain()
  if (!/^0x[a-fA-F0-9]{64}$/.test(chain.packageId || '')) {
    throw new Error('Boss PACKAGE_ID fehlt — Block2-Handoff .env oder BOSS_PACKAGE_ID setzen')
  }

  console.log('=== Helfer → Boss Send ===')
  console.log('Boss API:', BOSS_API)
  console.log('Boss Adresse:', chain.bossAddress.slice(0, 12) + '…')
  console.log('Package:', chain.packageId.slice(0, 14) + '…')

  if (process.env.APK_COLD_START === '1') {
    try {
      execSync(`adb shell am force-stop ${PACKAGE}`, { stdio: 'ignore' })
      execSync(`adb shell am start -n ${PACKAGE}/.MainActivity`, { stdio: 'ignore' })
      await new Promise((r) => setTimeout(r, 8000))
    } catch {
      console.log('ADB Neustart übersprungen')
    }
  }

  const bossStatus = await ensureBossUnlocked()
  console.log('   Boss role:', bossStatus?.role, 'package:', String(bossStatus?.packageId || '').slice(0, 14))

  const ws = await discoverWs()
  if (!ws) {
    console.error('CDP_WS_URL fehlt')
    process.exit(1)
  }

  const session = createCdpSession(ws)
  await session.init()
  await waitForAppReady(session)

  if (!SKIP_ONBOARDING) {
    console.error('SKIP_ONBOARDING=1 setzen (bestehendes Helfer-Profil)')
    session.close()
    process.exit(1)
  }

  const helperAddr = await unlockVaultIfNeeded(session)
  console.log('   Helfer:', helperAddr.slice(0, 12) + '…')

  console.log('… Boss-Handoff-Kette auf Helfer setzen (gleiches Package wie Boss)')
  await applyBossHandoffChainViaStorage(session, {
    ...chain,
    senderAddress: helperAddr,
  })
  await configureSoloChain(session, helperAddr)

  await openMessagesComposer(session)

  console.log('8) Klartext an Boss senden …')
  const sendResult = await sendComposerMessage(session, {
    encrypted: false,
    message: TEST_MESSAGE,
    myAddr: helperAddr,
    recipientAddr: chain.bossAddress,
  })

  const fin = await snapshot(session)
  const rpcState = await readDirectRpcReady(session)
  const statusBlob = `${sendResult.lastStatus} ${sendResult.bodyHint}`
  const sendPass = sendOk(statusBlob)
  const { directRpc, relay } = isDirectRelay(fin, rpcState)

  console.log('\n--- Helfer Send ---')
  console.log('Status:', sendResult.lastStatus || sendResult.bodyHint || '(leer)')
  console.log('Direkt-RPC:', directRpc ? 'ja' : 'nein', 'Relay:', relay ? 'ja' : 'nein')

  console.log('\n9) Boss-Inbox pollen …')
  let bossHit = false
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const inbox = await bossInboxFind(TEST_MESSAGE, helperAddr)
    console.log(`   Poll ${i + 1}:`, inbox.hit ? 'TREFFER' : '…')
    if (inbox.hit) {
      bossHit = true
      break
    }
  }

  session.close()

  if (sendPass && directRpc && !relay && bossHit) {
    console.log('\n=== RESULT: Helfer→Boss PASS ===')
    process.exit(0)
  }
  if (sendPass && directRpc && !relay && !bossHit) {
    console.log('\n=== RESULT: Send PASS, Boss-Inbox PARTIAL (Delay/Package?) ===')
    process.exit(3)
  }
  console.log('\n=== RESULT: Helfer→Boss FAIL ===')
  process.exit(2)
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message)
  process.exit(1)
})
