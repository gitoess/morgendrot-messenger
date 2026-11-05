'use client'

/**
 * Expert-Klartext-Scan: Mailbox-DFs (PlainMsgKey) **und** Chain-Events (PlaintextMessage).
 * Default-Sendepfad ist oft „Event“ — dann gibt es keine Klartext-DFs an der MAILBOX_ID.
 */

import {
  createDirectIotaClient,
  fetchMailboxInboxRpcRows,
  fetchMessagingEventInboxRpcRows,
  isLikelyIotaHexId,
} from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'

export type MailboxPlainScanRow = {
  sender: string
  recipient: string
  text: string
  nonce: string
  ts?: number
  source: 'mailbox-df' | 'event'
}

export type MailboxPlainScanResult =
  | {
      ok: true
      mailboxObjectId: string
      packageId: string
      address: string
      rows: MailboxPlainScanRow[]
      dfCount: number
      eventCount: number
      hint?: string
    }
  | { ok: false; error: string }

function dedupKey(r: Pick<MailboxPlainScanRow, 'sender' | 'recipient' | 'nonce' | 'text'>): string {
  return `${r.sender.toLowerCase()}:${r.recipient.toLowerCase()}:${r.nonce}:${r.text.slice(0, 64)}`
}

export async function scanMailboxPlaintextForAddress(input: {
  mailboxObjectId?: string
  packageId?: string
  address: string
  limit?: number
  /** false → nur Events (kein Mailbox-Parent nötig). Default true. */
  includeMailboxDfs?: boolean
  includeEvents?: boolean
}): Promise<MailboxPlainScanResult> {
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  }
  const snap = getDirectMailboxChainSnapshot()
  const mailboxObjectId = (input.mailboxObjectId || snap?.mailboxId || '').trim()
  const packageId = (input.packageId || snap?.packageId || '').trim()
  const address = input.address.trim()
  const includeDfs = input.includeMailboxDfs !== false
  const includeEvents = input.includeEvents !== false
  const limit = Math.min(100, Math.max(1, input.limit ?? 40))

  if (!isLikelyIotaHexId(packageId)) {
    return { ok: false, error: 'PACKAGE_ID fehlt (Chain-Snapshot / Profil).' }
  }
  if (!isLikelyIotaHexId(address)) {
    return { ok: false, error: 'Adresse: 0x + 64 Hex.' }
  }
  const canScanDfs = includeDfs && isLikelyIotaHexId(mailboxObjectId)
  if (!canScanDfs && !includeEvents) {
    return {
      ok: false,
      error: 'MAILBOX_ID fehlt und Events sind aus — Snapshot setzen oder MAILBOX_ID eintragen.',
    }
  }

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const merged = new Map<string, MailboxPlainScanRow>()
    let dfCount = 0
    let eventCount = 0

    if (canScanDfs) {
      const rows = await fetchMailboxInboxRpcRows(client, {
        mailboxObjectId,
        packageId,
        myAddress: address,
        includePlaintext: true,
        includeEncrypted: false,
        limit,
        offset: 0,
        maxDynamicFieldPages: 20,
      })
      for (const r of rows) {
        if (r.kind !== 'plain') continue
        dfCount++
        const row: MailboxPlainScanRow = {
          sender: r.sender,
          recipient: r.recipient,
          text: r.text,
          nonce: r.nonce,
          ts: r.ts,
          source: 'mailbox-df',
        }
        merged.set(dedupKey(row), row)
      }
    }

    if (includeEvents) {
      const evRows = await fetchMessagingEventInboxRpcRows(client, {
        packageId,
        myAddress: address,
        limit,
        offset: 0,
        maxEventPages: 8,
      })
      for (const r of evRows) {
        if (r.kind !== 'plain') continue
        eventCount++
        const row: MailboxPlainScanRow = {
          sender: r.sender,
          recipient: r.recipient,
          text: r.text,
          nonce: String(r.nonce),
          ts: r.tsMs,
          source: 'event',
        }
        const k = dedupKey(row)
        if (!merged.has(k)) merged.set(k, row)
      }
    }

    const rows = [...merged.values()].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, limit)

    let hint: string | undefined
    if (rows.length === 0) {
      hint =
        'Kein Klartext gefunden. Häufige Ursache: Nachrichten als flüchtiges Event ohne Mailbox-Persistenz — ' +
        'oder verschlüsselt (MsgKey). Im Composer „Anker/Mailbox“ für PlainMsgKey-DFs nutzen. ' +
        `Scan: DF=${dfCount}, Events=${eventCount}.`
    } else if (dfCount === 0 && eventCount > 0) {
      hint =
        'Nur Chain-Events (PlaintextMessage) — typisch bei Persistenz „Schnell/Event“. Mailbox-DFs entstehen mit „Anker/Mailbox“.'
    }

    return {
      ok: true,
      mailboxObjectId: mailboxObjectId || '(Events only)',
      packageId,
      address,
      rows,
      dfCount,
      eventCount,
      hint,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
