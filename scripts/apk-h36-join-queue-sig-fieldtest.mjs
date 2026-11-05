/**
 * § H.36 P2 Join-Queue + sig-Freeze Feldtest (Boss-API + Samsung APK).
 *
 * 1) Boss: Join-Request in Roster-Pending-Queue (POST + GET)
 * 2) Boss: signiertes + ungültiges Team-Update per LAN-Push
 * 3) APK: Posteingang — „Boss-Signatur verifiziert“ vs. blockiert
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
const TEST_ID = `h36-jq-${Date.now()}`
const JOIN_REQUEST_ID = `jr-${TEST_ID}`

const TEAM_UPDATE_PREFIX = '[[MORG_TEAM_MEMBER_UPDATE_V1:'
const JOIN_REQUEST_PREFIX = '[[MORG_TEAM_JOIN_REQUEST_V1:'

function readBossAddress() {
  try {
    return readFileSync(join(ROOT, '.morgendrot-partner'), 'utf8').trim()
  } catch {
    return process.env.BOSS_ADDRESS || ''
  }
}

function buildTeamUpdateMarker(payload) {
  return `${TEAM_UPDATE_PREFIX}${JSON.stringify(payload)}]]`
}

function buildJoinRequestMarker(payload) {
  return `${JOIN_REQUEST_PREFIX}${JSON.stringify(payload)}]]`
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
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15_000), ...opts })
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

async function pushLanWire(lanApi, wire, helperAddr, seq, teamId) {
  return bossFetch(lanApi, '/api/team-sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wire,
      teamId,
      seq,
      recipientAddresses: [helperAddr],
    }),
  })
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

async function waitForLanInboxHit(session, apiBase, helperAddr, needle) {
  for (let i = 0; i < 12; i++) {
    await sleep(1500)
    const inbox = await fetchLanInboxOnDevice(session, apiBase, helperAddr, Date.now() - 180_000)
    const entries = inbox?.entries || []
    const found = entries.some((e) => String(e?.wire || '').includes(needle))
    console.log(`   LAN-Inbox Poll ${i + 1}: entries=${entries.length}`, found ? 'TREFFER' : '…')
    if (found) return true
  }
  return false
}

async function checkInboxUi(session, needle) {
  await clickIfPresent(session, `(t) => /^Zurück/i.test(t)`)
  await sleep(600)
  await openMessagesComposer(session)
  await openMobileMessengerTab(session, 'Posteingang')
  await clickIfPresent(session, `(t) => /Aktualisieren/i.test(t)`)

  const start = Date.now()
  while (Date.now() - start < 45_000) {
    await sleep(2000)
    await clickIfPresent(session, `(t) => /Aktualisieren/i.test(t)`)
    const ui = await session.evaluate(
      `(() => {
        const text = (document.body?.innerText || '').replace(/\\s+/g, ' ');
        const hasNeedle = text.includes(${JSON.stringify(needle)});
        const hasValid = /Boss-Signatur verifiziert/i.test(text);
        const hasBlocked = /Boss-Signatur ungültig|Übernahme blockiert|passt nicht zur Boss-Adresse/i.test(text);
        const hasLan = /Empfangen über:\\s*LAN/i.test(text);
        const hasTeamCard = /Neues Team-Mitglied|Team-Mitglied aktualisiert/i.test(text);
        return { hasNeedle, hasValid, hasBlocked, hasLan, hasTeamCard, snippet: text.slice(0, 900) };
      })()`
    )
    if (ui?.hasNeedle && ui?.hasLan && ui?.hasValid && ui?.hasBlocked) return ui
    if (ui?.hasTeamCard && ui?.hasValid && ui?.hasBlocked) return ui
  }
  return session.evaluate(
    `(() => {
      const text = (document.body?.innerText || '').replace(/\\s+/g, ' ');
      return {
        hasNeedle: text.includes(${JSON.stringify(needle)}),
        hasValid: /Boss-Signatur verifiziert/i.test(text),
        hasBlocked: /Boss-Signatur ungültig|Übernahme blockiert|passt nicht zur Boss-Adresse/i.test(text),
        hasLan: /Empfangen über:\\s*LAN/i.test(text),
        hasTeamCard: /Neues Team-Mitglied/i.test(text),
        snippet: text.slice(0, 900),
      };
    })()`
  )
}

async function testJoinQueue(bossApi, bossAddr, helperAddr, helperName) {
  console.log('\n--- Join-Queue (Boss API) ---')
  const joinWire = buildJoinRequestMarker({
    v: 1,
    requestId: JOIN_REQUEST_ID,
    applicant: { address: helperAddr, name: helperName },
    boss: bossAddr,
    issuedAt: Date.now(),
    note: `Feldtest ${TEST_ID}`,
    teamId: 'Block2 Helfer Smoke',
  })
  console.log('Join-Wire Länge:', joinWire.length)

  const upsert = await bossFetch(bossApi, '/api/roster-pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: JOIN_REQUEST_ID,
      kind: 'join_request',
      requestId: JOIN_REQUEST_ID,
      member: { address: helperAddr, name: helperName },
      boss: bossAddr,
      teamId: 'Block2 Helfer Smoke',
      note: `Feldtest ${TEST_ID}`,
      issuedAt: Date.now(),
    }),
  })
  if (!upsert.json?.ok) {
    throw new Error('roster-pending POST: ' + (upsert.json?.error || upsert.text.slice(0, 160)))
  }
  console.log('   POST join_request:', upsert.json.entry?.id)

  const list = await bossFetch(bossApi, '/api/roster-pending?status=pending')
  const found = (list.json?.entries || []).some(
    (e) => e.requestId === JOIN_REQUEST_ID || e.id === JOIN_REQUEST_ID
  )
  console.log('   GET pending:', found ? 'TREFFER' : 'FEHLT', `(${(list.json?.entries || []).length} Einträge)`)
  if (!found) throw new Error('Join-Request nicht in Boss-Queue')

  const approved = await bossFetch(
    bossApi,
    `/api/roster-pending/${encodeURIComponent(JOIN_REQUEST_ID)}/status`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    }
  )
  if (!approved.json?.ok) {
    throw new Error('Freigabe-Status: ' + (approved.json?.error || approved.text.slice(0, 120)))
  }
  console.log('   Freigabe (approved): OK')

  return { joinQueuePass: true, joinWire }
}

async function requestBossSig(bossApiLocal, payload) {
  const r = await bossFetch(bossApiLocal, '/api/team-sync/sign-team-wire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  })
  if (!r.json?.ok || !r.json?.sig) {
    throw new Error('Boss-Sign fehlgeschlagen: ' + (r.json?.error || r.text.slice(0, 160)))
  }
  return r.json.sig
}

async function testSigFreeze(bossApiLocal, lanApi, bossAddr, helperAddr) {
  console.log('\n--- sig-Freeze (echte Boss-Sig + LAN + Posteingang) ---')
  const seqValid = Math.floor(Date.now() / 1000)
  const seqInvalid = seqValid + 1
  const memberLabel = `JQ-Sig ${TEST_ID}`

  // Gültig: echte Boss-Adresse + echte Server-Signatur (SIGNER=sdk, Tresor offen).
  const validPayload = {
    v: 1,
    kind: 'add',
    seq: seqValid,
    teamId: 'h36-join-queue-sig',
    boss: bossAddr,
    issuedAt: Date.now(),
    member: { address: helperAddr, name: memberLabel },
  }
  const validSig = await requestBossSig(bossApiLocal, validPayload)
  console.log('   Boss-Sig (echt) erhalten:', validSig.slice(0, 16) + '…')
  const validWire = buildTeamUpdateMarker({ ...validPayload, sig: validSig })

  // Ungültig: fremde Boss-Adresse + Fake-Sig → Übernahme muss blockiert werden.
  const invalidPayload = {
    v: 1,
    kind: 'add',
    seq: seqInvalid,
    teamId: 'h36-join-queue-sig',
    boss: `0x${'f'.repeat(64)}`,
    issuedAt: Date.now(),
    member: { address: helperAddr, name: memberLabel },
  }
  const invalidWire = buildTeamUpdateMarker({
    ...invalidPayload,
    sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  })

  const pushInvalid = await pushLanWire(lanApi, invalidWire, helperAddr, seqInvalid, 'h36-join-queue-sig')
  if (!pushInvalid.json?.ok) {
    throw new Error('LAN-Push invalid: ' + (pushInvalid.json?.error || pushInvalid.text.slice(0, 120)))
  }
  console.log('   LAN-Push invalid seq:', seqInvalid)

  const pushValid = await pushLanWire(lanApi, validWire, helperAddr, seqValid, 'h36-join-queue-sig')
  if (!pushValid.json?.ok) {
    throw new Error('LAN-Push valid: ' + (pushValid.json?.error || pushValid.text.slice(0, 120)))
  }
  console.log('   LAN-Push valid seq (echte Boss-Sig):', seqValid)

  return { memberLabel, seqValid, seqInvalid }
}

async function main() {
  console.log('=== § H.36 P2 — Join-Queue + sig-Freeze Feldtest ===\n')
  console.log('TEST_ID:', TEST_ID)

  const bossAddr = readBossAddress()
  if (!/^0x[a-fA-F0-9]{64}$/.test(bossAddr)) {
    throw new Error('BOSS_ADDRESS / .morgendrot-partner fehlt')
  }

  const lanApi = await resolveBossLanApiBase()
  if (!lanApi) {
    console.error('Boss-LAN-API nicht gefunden.')
    process.exit(1)
  }
  console.log('Boss LAN API:', lanApi)

  const localSt = await bossFetch(BOSS_API_LOCAL, '/api/status')
  if (!localSt.ok) throw new Error('Boss localhost nicht erreichbar — npm run dm?')
  console.log('Boss role:', localSt.json?.role, localSt.json?.locked === false ? 'unlocked' : 'locked')

  const ws = await discoverWs()
  if (!ws) {
    console.error('CDP_WS_URL fehlt')
    process.exit(1)
  }

  const session = createCdpSession(ws)
  await session.init()
  await waitForAppReady(session)
  const helperAddr = await unlockVaultIfNeeded(session)
  const helperName = `Helfer ${TEST_ID.slice(-8)}`
  console.log('Helfer:', helperAddr.slice(0, 12) + '…')

  const reach = await setupApkBossReachability(lanApi)
  console.log('APK API-Basis:', reach.apiBase, `(${reach.via})`)
  await setApkLanApiBase(session, reach.apiBase)

  const join = await testJoinQueue(BOSS_API_LOCAL, bossAddr, helperAddr, helperName)

  const sig = await testSigFreeze(BOSS_API_LOCAL, reach.apiBase, bossAddr, helperAddr)

  const lanHit = await waitForLanInboxHit(session, reach.apiBase, helperAddr, sig.memberLabel)
  if (!lanHit) console.warn('   LAN-Inbox API: kein Treffer — UI trotzdem prüfen')

  const ui = await checkInboxUi(session, sig.memberLabel)
  console.log('Posteingang UI:', JSON.stringify(ui))

  session.close()

  const sigPass =
    (lanHit || ui?.hasLan) &&
    ui?.hasValid &&
    ui?.hasBlocked &&
    (ui?.hasNeedle || ui?.hasTeamCard)

  const pass = join.joinQueuePass && sigPass
  console.log('\n========== Zusammenfassung ==========')
  console.log('  Join-Queue (Boss API):', join.joinQueuePass ? 'PASS' : 'FAIL')
  console.log('  sig-Freeze (UI):', sigPass ? 'PASS' : 'PARTIAL/FAIL')
  console.log(`\n=== RESULT: § H.36 P2 Join-Queue + sig ${pass ? 'PASS' : sigPass ? 'PARTIAL (Join only)' : 'FAIL'} ===`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message || e)
  process.exit(1)
})
