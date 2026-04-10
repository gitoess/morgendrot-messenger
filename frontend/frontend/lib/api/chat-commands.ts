import { executeCommand } from '@/frontend/lib/api/execute-command'

export const sendMessage = (recipient: string, message: string, encrypted = true) =>
  executeCommand(encrypted ? '/send' : '/send-plain', encrypted ? [message] : [recipient, message])

/** Verschlüsseltes /send mit Timeout (Standard 120s – Chain/RPC kann langsam sein). */
export function sendEncryptedMessageWithTimeout(message: string, timeoutMs = 120_000) {
  return executeCommand('/send', [message], { timeoutMs })
}

/** Nachricht aus Mailbox purgen (Storage-Rebate). Mit /connect: /purge-msg &lt;nonce&gt; [sender]. */
export function purgeMailboxMessage(nonce: string, senderAddress?: string) {
  const args = senderAddress?.trim() ? [nonce, senderAddress.trim()] : [nonce]
  return executeCommand('/purge-msg', args)
}
