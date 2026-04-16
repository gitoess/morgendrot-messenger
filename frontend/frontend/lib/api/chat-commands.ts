import { executeCommand } from '@/frontend/lib/api/execute-command'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'

export const sendMessage = (
  recipient: string,
  message: string,
  encrypted = true,
  opts?: { messagingPersistenceMode?: MessagingPersistenceMode; timeoutMs?: number }
) =>
  executeCommand(encrypted ? '/send' : '/send-plain', encrypted ? [message] : [recipient, message], {
    timeoutMs: opts?.timeoutMs,
    messagingPersistenceMode: encrypted ? undefined : opts?.messagingPersistenceMode,
  })

/** Verschlüsseltes /send mit Timeout (Standard 120s – Chain/RPC kann langsam sein). */
export function sendEncryptedMessageWithTimeout(message: string, timeoutMs = 120_000) {
  return executeCommand('/send', [message], { timeoutMs })
}

/** SOS: leichtes Gateway-ACK (Log), **ohne** vollen Mailbox-Speicher — optional vor `/send` im Retry. */
export function sosGatewayAckDigest(digestSha256Hex64: string) {
  return executeCommand('/sos-gateway-ack', [digestSha256Hex64.trim()])
}

/** Nachricht aus Mailbox purgen (Storage-Rebate). Mit /connect: /purge-msg &lt;nonce&gt; [sender]. */
export function purgeMailboxMessage(nonce: string, senderAddress?: string) {
  const args = senderAddress?.trim() ? [nonce, senderAddress.trim()] : [nonce]
  return executeCommand('/purge-msg', args)
}
