/**
 * Abstraktion für `/send` bzw. `/send-plain` — injizierbar (PWA: `executeCommand`, Tests: Mocks).
 */
export type MailboxSendResult = { ok: true } | { ok: false; error?: string }

export type OfflineMailboxSendPort = {
  sendEncrypted(payload: string): Promise<MailboxSendResult>
  sendPlain(recipient: string, payload: string): Promise<MailboxSendResult>
}
