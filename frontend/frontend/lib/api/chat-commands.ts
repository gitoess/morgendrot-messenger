import { executeCommand } from '@/frontend/lib/api/execute-command'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'

export const sendMessage = (
  recipient: string,
  message: string,
  encrypted = true,
  opts?: {
    messagingPersistenceMode?: MessagingPersistenceMode
    timeoutMs?: number
    mailboxObjectId?: string
  }
) =>
  executeCommand(encrypted ? '/send' : '/send-plain', encrypted ? [message] : [recipient, message], {
    timeoutMs: opts?.timeoutMs,
    messagingPersistenceMode: opts?.messagingPersistenceMode,
    mailboxObjectId: opts?.mailboxObjectId,
  })

/** Verschlüsseltes /send mit Timeout (Standard 120s – Chain/RPC kann langsam sein). */
export function sendEncryptedMessageWithTimeout(
  recipient: string,
  message: string,
  timeoutMs = 120_000,
  opts?: { mailboxObjectId?: string; messagingPersistenceMode?: MessagingPersistenceMode }
) {
  return executeCommand('/send', [recipient.trim(), message], {
    timeoutMs,
    mailboxObjectId: opts?.mailboxObjectId,
    messagingPersistenceMode: opts?.messagingPersistenceMode,
  })
}

/** Bereits verschlüsseltes Wire (Offline-Queue-Drain, Relay). */
export function sendEncryptedWireWithTimeout(
  recipient: string,
  wireJson: string,
  timeoutMs = 120_000,
  opts?: { mailboxObjectId?: string; messagingPersistenceMode?: MessagingPersistenceMode }
) {
  return executeCommand('/send-encrypted', [recipient.trim(), wireJson], {
    timeoutMs,
    mailboxObjectId: opts?.mailboxObjectId,
    messagingPersistenceMode: opts?.messagingPersistenceMode,
  })
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
