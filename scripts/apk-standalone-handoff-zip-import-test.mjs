/**
 * Standalone — echter Boss-Handoff-ZIP-Import über UI (CDP + optional ADB push).
 */
import { execSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  clickButton,
  createCdpSession,
  clickIfPresent,
  readNetworkProfilesOk,
  sleep,
  unlockVaultIfNeeded,
  waitForAppReady,
} from './apk-cdp-common.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ZIP_PATH =
  process.env.HANDOFF_ZIP_PATH || join(ROOT, 'exports', 'block2-handoff-smoke.zip')
const EXPECT_LABEL = process.env.HANDOFF_LABEL || 'Block2 Helfer Smoke'
const PACKAGE = process.env.APK_PACKAGE || 'de.morgendrot.messenger'

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

async function openSettingsHandoff(session) {
  for (let i = 0; i < 6; i++) {
    const st = await session.evaluate(
      `(() => {
        const root = document.getElementById('settings-handoff-import');
        const input = document.querySelector('#settings-handoff-import input[type="file"]')
          || document.querySelector('input[type="file"][accept*="zip"]');
        if (root && input) {
          root.scrollIntoView({ block: 'start' });
          return { done: true, hasRoot: true, hasInput: true, step: 'ready' };
        }
        const backBtn = [...document.querySelectorAll('button')].find((b) => {
          const t = (b.textContent || '').replace(/\\s+/g, ' ').trim();
          return /^Zurück/i.test(t);
        });
        const settingsBtn = [...document.querySelectorAll('button,[role="button"]')].find((el) => {
          const al = (el.getAttribute('aria-label') || '').trim();
          return al === 'Einstellungen' || al === 'Settings';
        });
        const inSettings = /Einstellungen|Settings/i.test(
          (document.querySelector('header span.font-semibold')?.textContent || '').trim()
        );
        return {
          done: false,
          hasRoot: Boolean(root),
          hasInput: Boolean(input),
          hasBack: Boolean(backBtn),
          hasSettingsBtn: Boolean(settingsBtn),
          inSettings,
        };
      })()`
    )
    if (st?.done) return st

    if (st?.inSettings || st?.hasRoot) {
      await session.evaluate(
        `(() => {
          try {
            sessionStorage.setItem('morgendrot.settingsActiveCategory', 'general');
          } catch { /* ignore */ }
          const tabs = [...document.querySelectorAll('[role="tab"]')];
          const general = tabs.find((t) => /Allgemein|General/i.test((t.textContent || '').trim()));
          general?.click();
        })()`
      )
      await sleep(1000)
      continue
    }

    if (st?.hasBack) {
      await clickIfPresent(session, `(t) => /^Zurück/i.test(t)`)
      await sleep(900)
      continue
    }

    if (st?.hasSettingsBtn) {
      await session.evaluate(
        `(() => {
          const btn = [...document.querySelectorAll('button,[role="button"]')].find((el) => {
            const al = (el.getAttribute('aria-label') || '').trim();
            return al === 'Einstellungen' || al === 'Settings';
          });
          btn?.click();
          return Boolean(btn);
        })()`
      )
      await sleep(1200)
      continue
    }

    await clickIfPresent(session, `(t) => /Handoff-ZIP importieren/i.test(t)`)
    await sleep(1200)
  }

  return session.evaluate(
    `(() => {
      const root = document.getElementById('settings-handoff-import');
      const input = document.querySelector('#settings-handoff-import input[type="file"]')
        || document.querySelector('input[type="file"][accept*="zip"]');
      root?.scrollIntoView({ block: 'start' });
      return { hasRoot: Boolean(root), hasInput: Boolean(input) };
    })()`
  )
}

async function injectZipFile(session, zipB64, fileName) {
  return session.evaluate(
    `(() => {
      const b64 = ${JSON.stringify(zipB64)};
      const name = ${JSON.stringify(fileName)};
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], name, { type: 'application/zip' });
      const input = document.querySelector('#settings-handoff-import input[type="file"]')
        || document.querySelector('input[type="file"][accept*="zip"]');
      if (!input) return { ok: false, why: 'no-file-input' };
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, size: bytes.length };
    })()`
  )
}

async function waitForHandoffApplyButton(session, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const st = await session.evaluate(
      `(() => {
        const root = document.getElementById('settings-handoff-import');
        const buttons = [...(root?.querySelectorAll('button') || [])].map((b) =>
          (b.textContent || '').replace(/\\s+/g, ' ').trim()
        );
        const apply = buttons.find(
          (t) =>
            /Handoff übernehmen/i.test(t) ||
            /Lokal vormerken/i.test(t) ||
            /Import bestätigen/i.test(t)
        );
        const hasError = Boolean(root?.querySelector('.text-destructive, [class*="destructive"]'));
        const errText = [...(root?.querySelectorAll('li') || [])].map((li) => (li.textContent||'').trim()).join(' | ');
        return { apply: apply || '', buttons: buttons.slice(0, 8), hasError, errText: errText.slice(0, 240) };
      })()`
    )
    if (st?.apply) return st
    if (st?.hasError && st?.errText) throw new Error('ZIP-Vorschau Fehler: ' + st.errText)
    await sleep(1000)
  }
  throw new Error('Handoff-Apply-Button Timeout')
}

async function waitForHandoffPreview(session, timeoutMs = 45_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const st = await session.evaluate(
      `(() => {
        const root = document.getElementById('settings-handoff-import');
        const text = (root?.textContent || '').replace(/\\s+/g, ' ').trim();
        const hasPreview = /Vorschau|Bezeichnung:|Handoff übernehmen|Import bestätigen/i.test(text);
        const hasError = Boolean(root?.querySelector('.text-destructive, [class*="destructive"]'));
        const errText = [...(root?.querySelectorAll('li') || [])].map((li) => (li.textContent||'').trim()).join(' | ');
        return { hasPreview, hasError, errText: errText.slice(0, 240), snippet: text.slice(0, 200) };
      })()`
    )
    if (st?.hasPreview && !st?.hasError) return st
    if (st?.hasError && st?.errText) throw new Error('ZIP-Vorschau Fehler: ' + st.errText)
    await sleep(1000)
  }
  throw new Error('ZIP-Vorschau Timeout')
}

async function applyStandaloneHandoff(session) {
  const btn = await waitForHandoffApplyButton(session)
  console.log('   Apply-Button:', btn.apply)
  await clickButton(
    session,
    `(t) => /Handoff übernehmen/i.test(t) || /Lokal vormerken/i.test(t) || /Import bestätigen/i.test(t)`
  )
  await sleep(2500)
}

async function readHandoffState(session) {
  return session.evaluate(
    `(() => {
      let snap = null;
      try {
        snap = JSON.parse(localStorage.getItem('morgendrot.handoff.localApplied.v1') || 'null');
      } catch { /* ignore */ }
      const backup = localStorage.getItem('morgendrot.handoff.envBackup.v1') || '';
      return {
        handoff: Boolean(snap),
        label: snap?.handoffLabel || snap?.label || '',
        snapPackageId: (snap?.packageId || '').slice(0, 14),
        snapMailboxId: (snap?.mailboxId || '').slice(0, 14),
        packageId: (localStorage.getItem('morgendrot.directChain.packageId') || '').slice(0, 14),
        mailboxId: (localStorage.getItem('morgendrot.directChain.mailboxId') || '').slice(0, 14),
        rpcUrl: localStorage.getItem('morgendrot.directIotaRpcUrl') || '',
        path: localStorage.getItem('morgendrot.standaloneOnboardingPath.v1') || '',
        hasEnvBackup: backup.length > 80,
        bossInBackup: backup.includes('BOSS_ADDRESS'),
      };
    })()`
  )
}

async function main() {
  console.log('=== Handoff-ZIP Import (echt, UI) ===')
  console.log('ZIP:', ZIP_PATH)

  let zipBytes
  try {
    zipBytes = readFileSync(ZIP_PATH)
  } catch (e) {
    console.error('ZIP nicht gefunden:', e.message)
    console.error('→ Zuerst am Boss-PC exportieren (exports/block2-handoff-smoke.zip)')
    process.exit(1)
  }

  try {
    execSync(`adb push "${ZIP_PATH.replace(/\\/g, '/')}" /sdcard/Download/block2-handoff-smoke.zip`, {
      stdio: 'inherit',
    })
    console.log('ADB: ZIP nach /sdcard/Download/ gepusht')
  } catch {
    console.log('ADB push übersprungen (Gerät nicht verbunden oder Fehler)')
  }

  execSync(`adb shell am start -n ${PACKAGE}/.MainActivity`, { stdio: 'inherit' })
  await sleep(2500)

  const ws = await discoverWs()
  if (!ws) {
    console.error('CDP_WS_URL fehlt')
    process.exit(1)
  }

  const session = createCdpSession(ws)
  await session.init()
  await waitForAppReady(session)

  await unlockVaultIfNeeded(session)
  const nav = await openSettingsHandoff(session)
  console.log('Settings Handoff:', JSON.stringify(nav))
  if (!nav?.hasInput) {
    session.close()
    process.exit(2)
  }

  const zipB64 = zipBytes.toString('base64')
  const injected = await injectZipFile(session, zipB64, 'block2-handoff-smoke.zip')
  console.log('ZIP injiziert:', JSON.stringify(injected))
  if (!injected?.ok) {
    session.close()
    process.exit(2)
  }

  console.log('… warte auf Vorschau + Apply-Button')
  const preview = await waitForHandoffPreview(session)
  console.log('   Vorschau:', JSON.stringify(preview))
  const applyBtn = await waitForHandoffApplyButton(session)
  console.log('   Button:', JSON.stringify(applyBtn))

  console.log('… Handoff übernehmen (Standalone)')
  await applyStandaloneHandoff(session)

  const state = await readHandoffState(session)
  const profiles = await readNetworkProfilesOk(session)
  console.log('State:', JSON.stringify(state))
  console.log('Profiles:', JSON.stringify(profiles))

  session.close()

  const pass =
    state.handoff &&
    (state.label.includes('Block2') || state.label.includes(EXPECT_LABEL)) &&
    (state.snapPackageId.length >= 12 || state.packageId.length >= 12) &&
    state.path.length > 0

  if (pass) {
    console.log('\n=== RESULT: Handoff-ZIP Import PASS ===')
    process.exit(0)
  }
  console.log('\n=== RESULT: Handoff-ZIP Import FAIL ===', JSON.stringify({ state, profiles }))
  process.exit(2)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
