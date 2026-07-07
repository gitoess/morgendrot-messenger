/**
 * Block 2 §3 — Simple-Mode UI-Checks am APK (CDP).
 * Siehe docs/FELDTEST-BLOCK2-SIMPLE-HANDOFF.md §3
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
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

const BLOCK2_HANDOFF = {
  savedAtMs: Date.now(),
  handoffLabel: 'Block2 Helfer Smoke',
  role: 'messenger',
  deploymentProfile: 'einsatz',
  transportProfile: 'iota-anchored',
  uiVariant: 'full',
  simpleMode: true,
  packageId: '0x06e099c095548b36cfb6eb3373ad1aa73e72f83f6e53c51854df719e7836dc88',
  mailboxId: '0x32b65223c4bef0d932d40b65af4a1a77b0877495d450beb98fc05303714137f6',
  bossAddress: '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5',
}

async function ensureBlock2SimpleHandoff(session) {
  const before = await readSimpleProfile(session)
  if (before.simpleMode === true && before.handoffSimpleMode === true) {
    console.log('… Handoff Simple Mode bereits aktiv')
    return before
  }
  console.log('… Block2-Handoff (Simple Mode) in localStorage setzen + Reload')
  await session.evaluate(
    `(() => {
      const snap = ${JSON.stringify(BLOCK2_HANDOFF)};
      snap.savedAtMs = Date.now();
      localStorage.setItem('morgendrot.handoff.localApplied.v1', JSON.stringify(snap));
      localStorage.setItem('morgendrot.standaloneOnboardingPath.v1', 'einsatz');
      localStorage.setItem('morgendrot.forcedTransport.v1', 'mesh');
      return true;
    })()`
  )
  await session.evaluate(`location.reload()`)
  await sleep(2500)
  await waitForAppReady(session)
  await unlockVaultIfNeeded(session)
  return readSimpleProfile(session)
}

async function discoverWs(retries = 8) {
  for (let i = 0; i < retries; i++) {
    if (i > 0) await sleep(2500)
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'apk-cdp-discover.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const combined = String(r.stdout || '') + String(r.stderr || '')
    if (i === 0 || combined.includes('CDP_WS_URL=')) process.stdout.write(combined)
    for (const line of combined.split(/\r?\n/)) {
      const m = line.match(/^CDP_WS_URL=(.+)$/)
      if (m) return m[1]
    }
  }
  return ''
}

async function readSimpleProfile(session) {
  return session.evaluate(
    `(() => {
      let handoff = null;
      try {
        handoff = JSON.parse(localStorage.getItem('morgendrot.handoff.localApplied.v1') || 'null');
      } catch { /* ignore */ }
      const role = (handoff?.role || '').trim().toLowerCase();
      const simpleMode = handoff?.simpleMode === true;
      const forcedTransport = localStorage.getItem('morgendrot.forcedTransport.v1')
        || localStorage.getItem('morgendrot.chat.forcedTransport')
        || '';
      return {
        role,
        simpleMode,
        transportProfile: handoff?.transportProfile || '',
        deploymentProfile: handoff?.deploymentProfile || '',
        forcedTransport: forcedTransport.trim(),
        hasSigner: Boolean(localStorage.getItem('morgendrot.directIotaSigner.enc.v1')),
        handoffSimpleMode: handoff?.simpleMode === true,
      };
    })()`
  )
}

async function checkDashboard(session) {
  await clickIfPresent(session, `(t) => t === 'Übersicht' || /^Start/i.test(t) || /Zurück/i.test(t)`)
  await sleep(800)
  return session.evaluate(
    `(() => {
      const text = (document.body?.innerText || '').replace(/\\s+/g, ' ');
      const hasNachrichten = /Nachrichten/i.test(text);
      const hasActionCenter = /Action Center/i.test(text);
      const hasEinsatzleitung = /Einsatzleitung/i.test(text) && /Willkommen|Boss/i.test(text);
      const tileNachrichten =
        [...document.querySelectorAll('h3,p,button,span')].some((el) =>
          /^Nachrichten$/i.test((el.textContent || '').trim())
        ) || /Was möchtest du tun/i.test(text);
      return {
        hasNachrichten,
        tileNachrichten,
        noActionCenter: !hasActionCenter,
        noBossWelcome: !hasEinsatzleitung,
      };
    })()`
  )
}

async function checkSendPath(session) {
  await openMessagesComposer(session)
  await openMobileMessengerTab(session, 'Posteingang')
  await sleep(600)
  return session.evaluate(
    `(() => {
      const buttons = [...document.querySelectorAll('button')].map((b) =>
        (b.textContent || '').replace(/\\s+/g, ' ').trim()
      );
      const hasOnline = buttons.some((t) => /^Online$/i.test(t) || t.includes('Online'));
      const hasFunk = buttons.some((t) => /^Funk$/i.test(t) || t.includes('Funk'));
      const hasAdhoc = buttons.some((t) => /^Ad-hoc$/i.test(t) || /Ad-hoc/i.test(t));
      const path4Checkbox = [...document.querySelectorAll('input[type="checkbox"],button[role="checkbox"]')].some((el) => {
        const ctx = (el.closest('label,div')?.textContent || '').replace(/\\s+/g, ' ');
        return /LoRa.*Verankerung|eigene Verankerung|Pfad 4/i.test(ctx);
      });
      const offlineStrip = (document.body?.innerText || '').includes('Offline-Warteschlange');
      const forced = localStorage.getItem('morgendrot.forcedTransport.v1')
        || localStorage.getItem('morgendrot.chat.forcedTransport')
        || 'mesh';
      return {
        hasOnline,
        hasFunk,
        noAdhoc: !hasAdhoc,
        noPath4Checkbox: !path4Checkbox,
        offlineStripVisible: offlineStrip,
        defaultTransportMesh: String(forced).toLowerCase().includes('mesh'),
      };
    })()`
  )
}

async function checkExpertHidden(session) {
  return session.evaluate(
    `(() => {
      const text = (document.body?.innerText || '').replace(/\\s+/g, ' ');
      const packageBanner = /Package-ID.*stimmt nicht|Server-Paket/i.test(text);
      const nurIota = /Nur IOTA/i.test(text);
      const tangleMenu = /Tangle|Relay.*Posteingang/i.test(text);
      return {
        noPackageBanner: !packageBanner,
        noNurIota: !nurIota,
        noTangleRelayMenu: !tangleMenu,
      };
    })()`
  )
}

async function openSettings(session) {
  await clickIfPresent(session, `(t) => t === 'Übersicht' || /^Start/i.test(t) || /Zurück/i.test(t)`)
  await sleep(500)
  const opened = await session.evaluate(
    `(() => {
      const btn = [...document.querySelectorAll('button,[role="button"]')].find(
        (el) => el.getAttribute('aria-label') === 'Einstellungen'
      );
      if (btn) {
        btn.click();
        return { ok: true, via: 'aria' };
      }
      const gear = document.querySelector('header button svg')?.closest('button');
      if (gear) {
        gear.click();
        return { ok: true, via: 'gear' };
      }
      return { ok: false };
    })()`
  )
  await sleep(1200)
  return opened
}

async function checkSettings(session) {
  await openSettings(session)
  return session.evaluate(
    `(() => {
      const text = (document.body?.innerText || '').replace(/\\s+/g, ' ');
      const pulseExpert = /Direkt-RPC.*IDs.*Funk|Puls.*Expertenoptionen|ECDH-JWK anwenden/i.test(text);
      const expertToggle = /Expertenmodus|Expert-Modus/i.test(text) && /aktiv/i.test(text);
      return {
        noPulseExpertBlock: !pulseExpert,
        expertNotForcedOn: !expertToggle,
      };
    })()`
  )
}

function verdict(checks) {
  const failed = checks.filter((c) => !c.pass)
  return { allPass: failed.length === 0, failed }
}

async function main() {
  console.log('=== Block 2 §3 — Simple-Mode UI (APK) ===\n')
  const ws = await discoverWs()
  if (!ws) {
    console.error('CDP_WS_URL nicht gefunden — USB-Debugging + App offen?')
    process.exit(1)
  }

  const session = await createCdpSession(ws)
  await waitForAppReady(session)
  await unlockVaultIfNeeded(session)

  const profile = await ensureBlock2SimpleHandoff(session)
  console.log('Profil:', JSON.stringify(profile))

  const results = []

  const dash = await checkDashboard(session)
  results.push({
    id: '3.1',
    name: 'Dashboard (Nachrichten, kein Action Center)',
    pass: dash.tileNachrichten && dash.noActionCenter && dash.noBossWelcome,
    detail: dash,
  })

  const send = await checkSendPath(session)
  results.push({
    id: '3.2',
    name: 'Sendepfad funk+online, kein adhoc',
    pass: send.hasOnline && send.hasFunk && send.noAdhoc,
    detail: send,
  })

  results.push({
    id: '3.3',
    name: 'Pfad 4 — keine Checkbox, nur Hinweise ok',
    pass: send.noPath4Checkbox,
    detail: { noPath4Checkbox: send.noPath4Checkbox },
  })

  results.push({
    id: '3.4',
    name: 'Offline-Queue-Streifen sichtbar',
    pass: send.offlineStripVisible,
    detail: { offlineStripVisible: send.offlineStripVisible },
  })

  const expertInbox = await checkExpertHidden(session)
  results.push({
    id: '3.5',
    name: 'Expert aus (kein Package-Banner / Nur-IOTA im Chat)',
    pass: expertInbox.noPackageBanner && expertInbox.noNurIota,
    detail: expertInbox,
  })

  const settings = await checkSettings(session)
  results.push({
    id: '3.6',
    name: 'Einstellungen ohne Pulse-Expert-Block',
    pass: settings.noPulseExpertBlock,
    detail: settings,
  })

  console.log('\n--- Ergebnisse ---')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}`)
    if (!r.pass) console.log('       ', JSON.stringify(r.detail))
  }

  const { allPass, failed } = verdict(results)
  console.log(`\n=== RESULT: Block 2 §3 ${allPass ? 'PASS' : 'PARTIAL/FAIL'} (${results.length - failed.length}/${results.length}) ===`)
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
