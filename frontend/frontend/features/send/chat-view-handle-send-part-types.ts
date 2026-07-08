import type { GroupSendDelivery } from '@/frontend/features/send/chat-view-handle-send-group'

export type MailboxSendCapture = {
  payloadUtf8: string
  messageNonceU64: bigint
  encrypted: boolean
  txDigest?: string
}

/** Ergebnis eines `sendOnePart`-Durchlaufs (Mailbox, Mesh, Gruppe, Path-4). */
export type SendPartOk =
  | {
      ok: true
      meshFallback?: { onlineErr: string }
      mailboxCapture?: MailboxSendCapture
      path4Footnote?: string
      groupDelivery?: GroupSendDelivery
      pairwiseTargetCount?: number
      /** 1:1 „Alle“-Broadcast: Anzahl IOTA-Empfänger. */
      broadcastTargetCount?: number
    }
  | { ok: false }

export type MailboxPartResult = SendPartOk | { ok: false; error: string }

export type QueueMailboxOutcome = 'queued' | 'duplicate' | 'skipped' | { reject: string }

export function isSendPartSuccess(
  part: SendPartOk | null | undefined
): part is Extract<SendPartOk, { ok: true }> {
  return part?.ok === true
}
