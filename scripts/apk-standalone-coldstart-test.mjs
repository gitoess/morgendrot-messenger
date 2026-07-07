/**
 * Standalone — Kaltstart: App killen, neu starten, Tresor + Ketten-IDs prüfen.
 */
import { execSync } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  assertChainIds,
  createCdpSession,
  readNetworkProfilesOk,
  snapshot,
  unlockVaultIfNeeded,
  waitForAppReady,
} from './apk-cdp-common.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE = process.env.APK_PACKAGE || 'de.morgendrot.messenger'

async function discoverEnv(retries = 8) {
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
    const env = { ...process.env }
    for (const line of combined.split(/\r?\n/)) {
      const m = line.match(/^(CDP_WS_URL)=(.+)$/)
      if (m) env.CDP_WS_URL = m[2]
    }
    if (env.CDP_WS_URL) return env
  }
  return null
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  assertChainIds()

  console.log('=== Kaltstart-Test ===')
  console.log('1) App beenden …')
  execSync(`adb shell am force-stop ${PACKAGE}`, { stdio: 'inherit' })
  await sleep(1500)
  execSync(`adb shell am start -n ${PACKAGE}/.MainActivity`, { stdio: 'inherit' })
  await sleep(5000)

  console.log('2) App starten + CDP …')
  const env = await discoverEnv()
  if (!env?.CDP_WS_URL) {
    console.error('CDP_WS_URL fehlt nach Kaltstart')
    process.exit(1)
  }

  const session = createCdpSession(env.CDP_WS_URL)
  await session.init()
  await waitForAppReady(session, { requireEncSigner: true })

  const beforeUnlock = await session.evaluate(
    `(() => ({
      encSigner: Boolean(localStorage.getItem('morgendrot.directIotaSigner.enc.v1')),
      soloPath: localStorage.getItem('morgendrot.standaloneOnboardingPath.v1'),
      sender: localStorage.getItem('morgendrot.directChain.senderAddress')?.slice(0, 14),
      testnetPkg: JSON.parse(localStorage.getItem('morgendrot.einsatz.networkProfiles.v1') || '{}')?.testnet?.packageId?.slice(0, 14),
      mainnetPkg: JSON.parse(localStorage.getItem('morgendrot.einsatz.networkProfiles.v1') || '{}')?.mainnet?.packageId?.slice(0, 14),
    }))()`
  )

  console.log('   Storage vor Entsperren:', JSON.stringify(beforeUnlock))

  if (!beforeUnlock.encSigner) {
    console.error('FAIL — Session-Signer nach Kaltstart weg')
    session.close()
    process.exit(2)
  }

  const addr = await unlockVaultIfNeeded(session)
  const profiles = await readNetworkProfilesOk(session)

  console.log('3) Nach Entsperren:', JSON.stringify(await snapshot(session)))

  const pass =
    addr.length >= 66 &&
    profiles?.ok &&
    beforeUnlock.encSigner &&
    (beforeUnlock.soloPath === 'solo' || beforeUnlock.soloPath === 'einsatz' || beforeUnlock.soloPath === 'boss')

  session.close()
  if (pass) {
    console.log('\n=== RESULT: Kaltstart PASS ===')
    process.exit(0)
  }
  console.log('\n=== RESULT: Kaltstart FAIL ===', JSON.stringify({ addr: addr.slice(0, 10), profiles }))
  process.exit(2)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
