/**
 * § H.3n B2.5 — SOS Fan-out Feldtest (Samsung APK).
 */
import { readFileSync } from 'node:fs'
import { spawnSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  applyBossHandoffChainViaStorage,
  assertChainIds,
  clickIfPresent,
  configureSoloChain,
  createCdpSession,
  sleep,
  SKIP_ONBOARDING,
  unlockVaultIfNeeded,
  waitForAppReady,
} from './apk-cdp-common.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOSS_API = (process.env.MORGENDROT_API_URL || 'http://127.0.0.1:3342').replace(/\/$/, '')
const BOSS_PW = process.env.BOSS_TEST_PW || process.env.TEST_PW || '12345678'
const BOSS_ADDR =
  process.env.BOSS_ADDRESS ||
  readFileSync(join(ROOT, '.morgendrot-partner'), 'utf8').trim()
const HANDOFF_ENV =
  process.env.BOSS_HANDOFF_ENV ||
  join(ROOT, 'exports', 'block2-handoff-smoke-unzipped', 'morgendrot-standalone-handoff.env')
const TEST_ID = `sos-fanout-${Date.now()}`
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
    return { packageId: '', mailboxId: '', rpcUrl: 'https://api.testnet.iota.cafe', bossAddress: BOSS_ADDR }
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
  const res = await fetch(`${BOSS_API}${path}`, { signal: AbortSignal.timeout(15_000), ...opts })
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
  if (st.json.locked === false) return st.json
  const unlock = await bossFetch('/api/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: BOSS_PW }),
  })
  if (!unlock.json?.ok) {
    console.warn('   Boss-Unlock übersprungen:', unlock.json?.error || unlock.text.slice(0, 80))
    return st.json
  }
  return (await bossFetch('/api/status')).json
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
  return { hit, snippet: blob.slice(0, 300) }
}

async function readPageStatus(session) {
  return session.evaluate(
    `(() => {
      const text = (document.body?.innerText || '').replace(/\\s+/g, ' ');
      const composerStatus = document.querySelector('[data-testid="chat-composer-send-status"]')?.textContent?.trim() || '';
      const sos = text.match(/SOS —[^.\\n]{0,220}/);
      const fanOut = text.match(/Funk[^.\\n]{0,120}Online[^.\\n]{0,120}/i)
        || composerStatus.match(/Funk[^.\\n]{0,120}Online[^.\\n]{0,120}/i);
      const status = [...document.querySelectorAll('[role="status"],[role="alert"]')]
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean)
        .join(' | ');
      return {
        sosLine: sos ? sos[0] : fanOut ? fanOut[0] : composerStatus.slice(0, 220) || status.slice(0, 220),
        composerStatus: composerStatus.slice(0, 220),
        text: text.slice(0, 1400),
        status,
      };
    })()`
  )
}

async function triggerSosFanOutUi(session, sosText) {
  await clickIfPresent(session, `(t) => t === 'Übersicht' || /^Start/i.test(t)`)
  await sleep(1000)
  const opened = await clickIfPresent(session, `(t) => /SOS — Hilferuf/i.test(t)`)
  if (!opened) throw new Error('SOS-Button auf Übersicht nicht gefunden')
  await sleep(600)
  await session.evaluate(
    `(() => {
      const ta = document.querySelector('#sos-text');
      if (!ta) return { ok: false, why: 'no-textarea' };
      const proto = window.HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      const v = ${JSON.stringify(sosText)};
      if (setter) setter.call(ta, v);
      else ta.value = v;
      ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, len: (ta.value || '').length };
    })()`
  )
  await sleep(400)
  const sheetDiag = await session.evaluate(
    `(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /^SOS senden$/i.test((b.textContent || '').trim()));
      return {
        textLen: (document.querySelector('#sos-text')?.value || '').length,
        sendDisabled: btn ? btn.disabled : null,
      };
    })()`
  )
  console.log('   SOS-Sheet:', JSON.stringify(sheetDiag))
  const sent = await clickIfPresent(session, `(t) => /^SOS senden$/i.test(t)`)
  if (!sent) throw new Error('„SOS senden“ nicht klickbar')
  await sleep(3000)
  const postDiag = await session.evaluate(
    `(() => ({
      pending: sessionStorage.getItem('morgendrot.dashboardSosPending'),
      activeView: sessionStorage.getItem('morgendrot.dashboard.activeView'),
      sendStatus: document.querySelector('[data-testid="chat-composer-send-status"]')?.textContent?.trim() || '',
    }))()`
  )
  console.log('   Nach SOS-Klick:', JSON.stringify(postDiag))
}

async function main() {
  console.log('=== § H.3n B2.5 — SOS Fan-out Feldtest ===\n')
  assertChainIds()

  try {
    execSync(`adb shell am force-stop ${PACKAGE}`, { stdio: 'ignore' })
    execSync(`adb shell am start -n ${PACKAGE}/.MainActivity`, { stdio: 'ignore' })
    await sleep(6000)
  } catch {
    /* ignore */
  }

  const handoff = loadBossHandoffChain()
  if (!/^0x[a-fA-F0-9]{64}$/.test(handoff.bossAddress)) {
    throw new Error('BOSS_ADDRESS / Handoff fehlt')
  }

  await ensureBossUnlocked()

  const ws = await discoverWs()
  if (!ws) {
    console.error('CDP_WS_URL fehlt')
    process.exit(1)
  }

  const session = createCdpSession(ws)
  await session.init()
  await waitForAppReady(session)

  if (!SKIP_ONBOARDING) {
    console.error('SKIP_ONBOARDING=1 setzen')
    session.close()
    process.exit(1)
  }

  const helperAddr = await unlockVaultIfNeeded(session)
  console.log('Helfer:', helperAddr.slice(0, 12) + '…')

  await applyBossHandoffChainViaStorage(session, {
    ...handoff,
    senderAddress: helperAddr,
  })
  await configureSoloChain(session, helperAddr)

  await clickIfPresent(session, `(t) => t === 'Übersicht' || /^Start/i.test(t)`)
  await sleep(1000)

  const sosFreeText = `Feldtest ${TEST_ID} — Hilfe benötigt`
  await triggerSosFanOutUi(session, sosFreeText)

  let status = { sosLine: '', text: '' }
  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    status = await readPageStatus(session)
    console.log(`   Poll ${i + 1}:`, status.sosLine ? status.sosLine.slice(0, 90) : '…')
    if (/SOS —/i.test(status.sosLine) && /Funk/i.test(status.sosLine) && /Online/i.test(status.sosLine)) {
      break
    }
  }

  let bossHit = false
  for (let i = 0; i < 10; i++) {
    await sleep(3000)
    const inbox = await bossInboxFind(TEST_ID, helperAddr)
    console.log(`   Boss-Inbox ${i + 1}:`, inbox.hit ? 'TREFFER' : '…')
    if (inbox.hit) {
      bossHit = true
      break
    }
  }

  session.close()

  const hasFanOutLine =
    (/SOS —/i.test(status.sosLine) ||
      /SOS/i.test(status.status || '') ||
      /Funk/i.test(status.composerStatus || '')) &&
    (/Funk/i.test(status.sosLine + status.status + status.text + (status.composerStatus || '')) &&
      /Online/i.test(status.sosLine + status.status + status.text + (status.composerStatus || '')))
  const onlineOk = /Online OK/i.test(status.sosLine)
  const pass = hasFanOutLine && (onlineOk || bossHit || /Online:/i.test(status.sosLine))

  console.log('\nStatus:', JSON.stringify(status))
  console.log(`\n=== RESULT: § H.3n B2.5 SOS Fan-out ${pass ? 'PASS' : hasFanOutLine ? 'PARTIAL' : 'FAIL'} ===`)
  process.exit(pass ? 0 : hasFanOutLine ? 3 : 1)
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message || e)
  process.exit(1)
})
