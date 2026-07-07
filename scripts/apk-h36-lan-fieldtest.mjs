/**
 * § H.36 P1 — LAN Team-Sync Feldtest (Boss-PC API + Samsung APK).
 *
 * Ablauf:
 * 1) Boss-API auf LAN-IP erreichbar (/api/status, /api/lan-install-urls)
 * 2) APK: Basis-URL → Boss-LAN (morgendrot.apiBaseOverride)
 * 3) Boss: POST /api/team-sync/push
 * 4) APK: GET /api/team-sync/lan-inbox + Posteingang „Empfangen über: LAN“
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import os from 'node:os'
import {
  clickIfPresent,
  createCdpSession,
  openMessagesComposer,
  openMobileMessengerTab,
  sleep,
  unlockVaultIfNeeded,
  waitForAppReady,
} from './apk-cdp-common.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOSS_API_LOCAL = (process.env.MORGENDROT_API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '')
const API_BASE_OVERRIDE_KEY = 'morgendrot.apiBaseOverride'
const TEST_ID = `lan-fieldtest-${Date.now()}`

function readBossAddress() {
  try {
    return readFileSync(join(ROOT, '.morgendrot-partner'), 'utf8').trim()
  } catch {
    return process.env.BOSS_ADDRESS || ''
  }
}

function collectLanHosts() {
  const hosts = []
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const net of entries ?? []) {
      const fam = net.family
      const v4 = fam === 'IPv4' || fam === 4
      if (!v4 || net.internal) continue
      const a = net.address.trim()
      if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(a)) hosts.push(a)
    }
  }
  return [...new Set(hosts)]
}

async function bossFetch(base, path, opts = {}) {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(12_000), ...opts })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function resolveBossLanApiBase() {
  if (process.env.BOSS_LAN_API?.trim()) {
    return process.env.BOSS_LAN_API.trim().replace(/\/$/, '')
  }
  const fromBoss = await bossFetch(BOSS_API_LOCAL, '/api/lan-install-urls')
  const urls = fromBoss.json?.urls
  if (Array.isArray(urls) && urls[0]?.apiBaseUrl) {
    return String(urls[0].apiBaseUrl).replace(/\/$/, '')
  }
  for (const host of collectLanHosts()) {
    const base = `http://${host}:3342`
    const st = await bossFetch(base, '/api/status').catch(() => null)
    if (st?.ok && st.json) return base
  }
  return ''
}

function buildTeamUpdateWire(bossAddress, helperAddress) {
  const payload = {
    v: 1,
    kind: 'add',
    seq: Math.floor(Date.now() / 1000),
    teamId: 'h36-lan-fieldtest',
    boss: bossAddress,
    issuedAt: Date.now(),
    member: {
      address: helperAddress,
      name: `LAN-Test ${TEST_ID}`,
    },
  }
  return `[[MORG_TEAM_MEMBER_UPDATE_V1:${JSON.stringify(payload)}]]`
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

async function setupApkBossReachability(lanApi) {
  if (process.env.SKIP_ADB_REVERSE === '1') {
    return { apiBase: lanApi, via: 'lan-ip' }
  }
  /** USB: Loopback-Reverse (cleartext erlaubt für 127.0.0.1 in network_security_config). */
  try {
    spawnSync('adb', ['reverse', 'tcp:3342', 'tcp:3342'], { stdio: 'ignore' })
    return { apiBase: 'http://127.0.0.1:3342', via: 'adb-reverse' }
  } catch {
    /* ignore */
  }
  return { apiBase: lanApi, via: 'lan-ip' }
}

async function setApkLanApiBase(session, apiBase) {
  await session.evaluate(
    `(() => {
      localStorage.setItem(${JSON.stringify(API_BASE_OVERRIDE_KEY)}, ${JSON.stringify(apiBase)});
      return localStorage.getItem(${JSON.stringify(API_BASE_OVERRIDE_KEY)});
    })()`
  )
}

async function probeApkBossReachable(session, lanApiBase) {
  return session.evaluate(
    `(async () => {
      try {
        const r = await fetch(${JSON.stringify(lanApiBase + '/api/status')}, { method: 'GET' });
        const j = await r.json();
        return { ok: r.ok, role: j?.role || '', locked: j?.locked };
      } catch (e) {
        return { ok: false, error: String(e?.message || e).slice(0, 120) };
      }
    })()`,
    true
  )
}

async function fetchLanInboxOnDevice(session, lanApiBase, helperAddr, sinceMs = 0) {
  return session.evaluate(
    `(async () => {
      const base = ${JSON.stringify(lanApiBase)};
      const addr = ${JSON.stringify(helperAddr)};
      const q = new URLSearchParams({ address: addr, sinceMs: String(${sinceMs}) });
      try {
        const r = await fetch(base + '/api/team-sync/lan-inbox?' + q.toString());
        const j = await r.json();
        return { ok: r.ok, entries: j?.entries || [], error: j?.error };
      } catch (e) {
        return { ok: false, error: String(e?.message || e).slice(0, 160) };
      }
    })()`,
    true
  )
}

async function checkInboxUiForLan(session, needle) {
  await openMessagesComposer(session)
  await openMobileMessengerTab(session, 'Posteingang')
  await clickIfPresent(session, `(t) => /Aktualisieren/i.test(t)`)
  await sleep(2000)
  return session.evaluate(
    `(() => {
      const text = (document.body?.innerText || '').replace(/\\s+/g, ' ');
      const hasWire = text.includes(${JSON.stringify(needle)});
      const hasLanLine = /Empfangen über:\\s*LAN/i.test(text);
      return { hasWire, hasLanLine, snippet: text.slice(0, 500) };
    })()`
  )
}

async function main() {
  console.log('=== § H.36 P1 — LAN Team-Sync Feldtest ===\n')

  const bossAddr = readBossAddress()
  if (!/^0x[a-fA-F0-9]{64}$/.test(bossAddr)) {
    throw new Error('BOSS_ADDRESS / .morgendrot-partner fehlt')
  }

  const lanApi = await resolveBossLanApiBase()
  if (!lanApi) {
    console.error('Boss-LAN-API nicht gefunden.')
    console.error('→ npm run dm mit API_BIND_HOST=0.0.0.0, Firewall 3342, oder BOSS_LAN_API=http://192.168.x.x:3342')
    process.exit(1)
  }
  console.log('Boss LAN API:', lanApi)

  const localSt = await bossFetch(BOSS_API_LOCAL, '/api/status')
  if (!localSt.ok) throw new Error('Boss localhost nicht erreichbar — npm run dm?')
  console.log('Boss localhost:', localSt.json?.role, localSt.json?.locked === false ? 'unlocked' : 'locked')

  const lanSt = await bossFetch(lanApi, '/api/status')
  if (!lanSt.ok) {
    throw new Error(`Boss LAN /api/status FAIL (${lanSt.status}) — Firewall oder API_BIND_HOST prüfen`)
  }
  console.log('Boss LAN /api/status: OK', 'role=', lanSt.json?.role)

  const ws = await discoverWs()
  if (!ws) {
    console.error('CDP_WS_URL fehlt — Samsung APK + USB-Debugging')
    process.exit(1)
  }

  const session = createCdpSession(ws)
  await session.init()
  await waitForAppReady(session)
  const helperAddr = await unlockVaultIfNeeded(session)
  console.log('Helfer:', helperAddr.slice(0, 12) + '…')

  const reach = await setupApkBossReachability(lanApi)
  console.log('APK API-Basis:', reach.apiBase, `(${reach.via})`)

  await setApkLanApiBase(session, reach.apiBase)
  const apkProbe = await probeApkBossReachable(session, reach.apiBase)
  console.log('APK → Boss LAN:', JSON.stringify(apkProbe))
  if (!apkProbe?.ok) {
    throw new Error('APK erreicht Boss-LAN nicht — gleiches WLAN? HTTP cleartext? Firewall?')
  }

  const wire = buildTeamUpdateWire(bossAddr, helperAddr)
  const push = await bossFetch(lanApi, '/api/team-sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wire,
      teamId: 'h36-lan-fieldtest',
      seq: Math.floor(Date.now() / 1000),
      recipientAddresses: [helperAddr],
    }),
  })
  if (!push.json?.ok) {
    throw new Error('LAN-Push fehlgeschlagen: ' + (push.json?.error || push.text.slice(0, 200)))
  }
  console.log('Boss LAN-Push:', push.json.entryId)

  let hit = false
  for (let i = 0; i < 12; i++) {
    await sleep(1500)
    const inbox = await fetchLanInboxOnDevice(session, reach.apiBase, helperAddr, Date.now() - 120_000)
    const entries = inbox?.entries || []
    const found = entries.some((e) => String(e?.wire || '').includes(TEST_ID))
    console.log(`   Poll ${i + 1}: entries=${entries.length}`, found ? 'TREFFER' : '…')
    if (found) {
      hit = true
      break
    }
  }

  const ui = await checkInboxUiForLan(session, TEST_ID)
  console.log('Posteingang UI:', JSON.stringify(ui))

  session.close()

  const pass = hit && ui?.hasLanLine
  console.log(`\n=== RESULT: § H.36 P1 LAN ${pass ? 'PASS' : hit ? 'PARTIAL (API ja, UI-LAN-Zeile fehlt)' : 'FAIL'} ===`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message || e)
  process.exit(1)
})
