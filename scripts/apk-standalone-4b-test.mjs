/**
 * Standalone Smoke 4b — Klartext-Send (Direkt-RPC), Testnet + Mainnet-Profile.
 */
import {
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
} from './apk-cdp-common.mjs'

const WS_URL = process.env.CDP_WS_URL || ''
const TEST_MESSAGE = process.env.TEST_MSG || `4b-smoke ${new Date().toISOString()}`

if (!WS_URL) {
  console.error('Set CDP_WS_URL (node scripts/apk-cdp-discover.mjs)')
  process.exit(1)
}

assertChainIds()

async function main() {
  const session = createCdpSession(WS_URL)
  await session.init()

  console.log('=== Standalone 4b (APK) ===')
  console.log('Start:', JSON.stringify(await snapshot(session)))

  if (!SKIP_ONBOARDING) {
    console.error('4b ohne SKIP_ONBOARDING=1 nicht implementiert — nutze apk-standalone-smoke.mjs')
    session.close()
    process.exit(1)
  }

  const senderAddress = await unlockVaultIfNeeded(session)
  await configureSoloChain(session, senderAddress)
  await openMessagesComposer(session)

  console.log('8) Sendepfad Klartext …')
  console.log('   Absender:', senderAddress.slice(0, 10) + '…')

  const sendResult = await sendComposerMessage(session, {
    encrypted: false,
    message: TEST_MESSAGE,
    myAddr: senderAddress,
  })

  const fin = await snapshot(session)
  const rpcState = await readDirectRpcReady(session)
  const statusBlob = `${sendResult.lastStatus} ${sendResult.bodyHint}`
  const { directRpc, relay } = isDirectRelay(fin, rpcState)
  const ok = sendOk(statusBlob)
  const frozen = fin.bodyPe === 'none' || fin.vaultOpen

  console.log('\n--- Ergebnis 4b ---')
  console.log('Netzwerk:', fin.networkActive, fin.setupPlan, `TN:${fin.testnetPkg} MN:${fin.mainnetPkg}`)
  console.log('Direkt-RPC (Config):', JSON.stringify(rpcState))
  console.log('Send-Status:', sendResult.lastStatus || '(leer)')
  console.log('Body-Hinweis:', sendResult.bodyHint || '(leer)')
  console.log('Direkt-RPC:', directRpc ? 'ja' : 'nein')
  console.log('Relay:', relay ? 'ja (FAIL)' : 'nein')
  console.log('Send OK:', ok ? 'ja' : 'nein')
  console.log('UI freeze:', frozen ? 'ja' : 'nein')

  session.close()
  if (directRpc && !relay && !frozen && ok) {
    console.log('\n=== RESULT: 4b PASS ===')
    process.exit(0)
  }
  if (directRpc && !relay && !frozen && !ok) {
    console.log('\n=== RESULT: 4b PARTIAL ===')
    process.exit(3)
  }
  console.log('\n=== RESULT: 4b FAIL ===')
  process.exit(2)
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message)
  process.exit(1)
})
