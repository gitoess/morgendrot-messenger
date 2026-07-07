/**
 * Standalone Smoke 4c + 4d — verschl. Send + Posteingang (Direkt-RPC).
 */
import {
  assertChainIds,
  configureSoloChain,
  createCdpSession,
  isDirectRelay,
  openMessagesComposer,
  readDirectRpcReady,
  refreshInboxAndFindMessage,
  sendComposerMessage,
  sendOk,
  SKIP_ONBOARDING,
  snapshot,
  unlockVaultIfNeeded,
} from './apk-cdp-common.mjs'

const WS_URL = process.env.CDP_WS_URL || ''
const TEST_MESSAGE = process.env.TEST_MSG_ENC || `4cd-smoke ${new Date().toISOString()}`

if (!WS_URL) {
  console.error('Set CDP_WS_URL')
  process.exit(1)
}

assertChainIds()

async function main() {
  const session = createCdpSession(WS_URL)
  await session.init()

  console.log('=== Standalone 4c+4d (APK) ===')
  if (!SKIP_ONBOARDING) {
    console.error('Nutze SKIP_ONBOARDING=1')
    session.close()
    process.exit(1)
  }

  const senderAddress = await unlockVaultIfNeeded(session)
  await configureSoloChain(session, senderAddress)
  await openMessagesComposer(session)

  console.log('8) Verschlüsselt senden …')
  const sendResult = await sendComposerMessage(session, {
    encrypted: true,
    message: TEST_MESSAGE,
    myAddr: senderAddress,
  })

  const rpcState = await readDirectRpcReady(session)
  const fin = await snapshot(session)
  const statusBlob = `${sendResult.lastStatus} ${sendResult.bodyHint}`
  const send4cOk = sendOk(statusBlob) && !/relay/i.test(statusBlob)
  const { directRpc, relay } = isDirectRelay(fin, rpcState)

  console.log('\n--- Ergebnis 4c ---')
  console.log('Send OK:', send4cOk ? 'ja' : 'nein')
  console.log('Status:', sendResult.lastStatus || sendResult.bodyHint || '(leer)')

  console.log('\n9) Posteingang aktualisieren (4d) …')
  const inbox = await refreshInboxAndFindMessage(session, TEST_MESSAGE.slice(0, 24))

  console.log('\n--- Ergebnis 4d ---')
  console.log('Nachricht im Posteingang:', inbox.found ? 'ja' : 'nein')
  console.log('RPC-Hinweis:', inbox.sourceLine || '(kein Direkt-RPC-Text)')

  session.close()

  const pass4c = send4cOk && directRpc && !relay
  const pass4d = inbox.found

  if (pass4c && pass4d) {
    console.log('\n=== RESULT: 4c+4d PASS ===')
    process.exit(0)
  }
  if (pass4c && !pass4d) {
    console.log('\n=== RESULT: 4c PASS, 4d PARTIAL (Inbox-Delay?) ===')
    process.exit(3)
  }
  console.log('\n=== RESULT: 4c+4d FAIL ===')
  process.exit(2)
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message)
  process.exit(1)
})
