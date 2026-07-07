/**
 * Standalone — Handoff-.env lokal anwenden (simuliert Boss-ZIP Import auf APK).
 */
import { execSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadChainGlobals } from './apk-chain-globals.mjs'
import {
  assertChainIds,
  createCdpSession,
  readNetworkProfilesOk,
  unlockVaultIfNeeded,
} from './apk-cdp-common.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOSS_ADDR =
  process.env.HANDOFF_BOSS_ADDRESS ||
  readFileSync(join(ROOT, '.morgendrot-partner'), 'utf8').trim() ||
  '0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5'

function buildLabHandoffEnv() {
  const g = loadChainGlobals()
  const label = process.env.HANDOFF_LABEL || 'Smoke Helfer Lab'
  return `# Morgendrot Handoff Lab (Smoke)
# Einsatz-Bezeichnung: ${label}
HANDOFF_LABEL=${label}
ROLE=messenger
ROLE_ID=12
DEPLOYMENT_PROFILE=einsatz
UI_VARIANT=full
TRANSPORT_PROFILE=iota-anchored
SIMPLE_MODE=false
RPC_URL=${g.testnet.rpcUrl}
NEXT_PUBLIC_DIRECT_IOTA_RPC_URL=${g.testnet.rpcUrl}
PACKAGE_ID=${g.testnet.packageId}
MAILBOX_ID=${g.testnet.mailboxId}
BOSS_ADDRESS=${BOSS_ADDR}
PARTNER_ADDRESS=${BOSS_ADDR}
USE_MAILBOX=true
MAILBOX_STORE_PLAINTEXT=true
ENABLE_PURGE=true
MESSENGER_EDITION=standalone
`
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
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

function parseEnv(text) {
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

async function main() {
  assertChainIds()
  const envText = buildLabHandoffEnv()
  const env = parseEnv(envText)
  execSync(`adb shell am start -n de.morgendrot.messenger/.MainActivity`, { stdio: 'inherit' })
  await sleep(3000)
  const ws = await discoverWs()
  if (!ws) {
    console.error('CDP_WS_URL fehlt')
    process.exit(1)
  }

  console.log('=== Handoff-Apply (APK) ===')
  console.log('Boss:', BOSS_ADDR.slice(0, 14) + '…')
  console.log('Package:', env.PACKAGE_ID?.slice(0, 14) + '…')

  const session = createCdpSession(ws)
  await session.init()
  await unlockVaultIfNeeded(session)

  const applied = await session.evaluate(
    `(() => {
      const envText = ${JSON.stringify(envText)};
      const env = ${JSON.stringify(env)};
      const snap = {
        savedAtMs: Date.now(),
        handoffLabel: env.HANDOFF_LABEL || 'Smoke',
        role: env.ROLE || 'messenger',
        deploymentProfile: 'einsatz',
        transportProfile: 'iota-anchored',
        uiVariant: 'full',
        simpleMode: false,
        packageId: env.PACKAGE_ID,
        mailboxId: env.MAILBOX_ID,
        bossAddress: env.BOSS_ADDRESS,
      };
      localStorage.setItem('morgendrot.handoff.envBackup.v1', envText);
      localStorage.setItem('morgendrot.handoff.localApplied.v1', JSON.stringify(snap));
      localStorage.setItem('morgendrot.standaloneOnboardingPath.v1', 'einsatz');
      localStorage.setItem('morgendrot.directIotaRpcUrl', env.RPC_URL);
      localStorage.setItem('morgendrot.directChain.packageId', env.PACKAGE_ID);
      localStorage.setItem('morgendrot.directChain.mailboxId', env.MAILBOX_ID);
      localStorage.setItem('morgendrot.directMailboxDrain', '1');
      localStorage.removeItem('morgendrot.iotaSubmitMode');
      localStorage.setItem(
        'morgendrot.directChain.flagsJson',
        JSON.stringify({ useMailbox: true, mailboxStorePlaintext: true, messengerCreditsConfigured: false })
      );
      const testnet = {
        rpcUrl: env.RPC_URL,
        packageId: env.PACKAGE_ID,
        mailboxId: env.MAILBOX_ID,
      };
      const mainnet = ${JSON.stringify(loadChainGlobals().mainnet)};
      localStorage.setItem(
        'morgendrot.einsatz.networkProfiles.v1',
        JSON.stringify({ active: 'testnet', setupPlan: 'both', setupPlanChosen: true, testnet, mainnet })
      );
      window.dispatchEvent(new CustomEvent('morgendrot.standaloneHandoffApplied'));
      window.dispatchEvent(new CustomEvent('morgendrot-direct-iota-ui-changed'));
      window.dispatchEvent(new CustomEvent('morgendrot:einsatz-network-profiles-changed'));
      return {
        handoff: Boolean(localStorage.getItem('morgendrot.handoff.localApplied.v1')),
        path: localStorage.getItem('morgendrot.standaloneOnboardingPath.v1'),
        pkg: localStorage.getItem('morgendrot.directChain.packageId')?.slice(0, 14),
      };
    })()`
  )

  const profiles = await readNetworkProfilesOk(session)
  const pass =
    applied?.handoff &&
    applied.path === 'einsatz' &&
    profiles?.ok &&
    applied.pkg === env.PACKAGE_ID.slice(0, 14)

  console.log('Apply:', JSON.stringify(applied))
  console.log('Profiles:', JSON.stringify(profiles))

  session.close()
  if (pass) {
    console.log('\n=== RESULT: Handoff-Apply PASS ===')
    process.exit(0)
  }
  console.log('\n=== RESULT: Handoff-Apply FAIL ===')
  process.exit(2)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
