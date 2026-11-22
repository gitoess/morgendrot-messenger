'use client'

/**
 * Expert-Chain-Scan: Mailbox-DFs (PlainMsgKey + MsgKey-Hinweise) und Chain-Events (Klartext).
 * Verschlüsselte MsgKey-Objekte sind on-chain findbar — Klartext nur mit Session/PWMSG-Tool.
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
  source: 'mailbox-df' | 'event' | 'mailbox-df-enc' | 'object'
  /** true = Ciphertext gefunden, hier nicht entschlüsselt. */
  encrypted?: boolean
  objectId?: string
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
      encryptedDfCount: number
      hint?: string
    }
  | { ok: false; error: string }

function dedupKey(r: Pick<MailboxPlainScanRow, 'sender' | 'recipient' | 'nonce' | 'text' | 'encrypted'>): string {
  return `${r.encrypted ? 'e' : 'p'}:${r.sender.toLowerCase()}:${r.recipient.toLowerCase()}:${r.nonce}:${r.text.slice(0, 64)}`
}

const ENC_STUB =
  '[verschlüsselt · MsgKey on-chain] Lesen: Posteingang mit Handshake/Session. Passphrase-Wire (PWMSG): Optionen → PWMSG entschlüsseln.'

export async function scanMailboxPlaintextForAddress(input: {
  mailboxObjectId?: string
  packageId?: string
  address: string
  limit?: number
  /** false → nur Events (kein Mailbox-Parent nötig). Default true. */
  includeMailboxDfs?: boolean
  includeEvents?: boolean
  /** MsgKey-DFs als Hinweiszeilen (ohne Entschlüsselung). Default true. */
  includeEncryptedStubs?: boolean
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
  const includeEnc = input.includeEncryptedStubs !== false
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
    let encryptedDfCount = 0

    if (canScanDfs) {
      const rows = await fetchMailboxInboxRpcRows(client, {
        mailboxObjectId,
        packageId,
        myAddress: address,
        includePlaintext: true,
        includeEncrypted: includeEnc,
        limit,
        offset: 0,
        maxDynamicFieldPages: 20,
      })
      for (const r of rows) {
        if (r.kind === 'plain') {
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
          continue
        }
        encryptedDfCount++
        const row: MailboxPlainScanRow = {
          sender: r.sender,
          recipient: r.recipient,
          text: ENC_STUB,
          nonce: r.nonce,
          ts: r.ts,
          source: 'mailbox-df-enc',
          encrypted: true,
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
        'Nichts gefunden. Oft: falsche Mailbox/Adresse, oder nur Events ohne Persistenz. ' +
        `Scan: Klartext-DF=${dfCount}, Enc-DF=${encryptedDfCount}, Events=${eventCount}.`
    } else if (dfCount === 0 && encryptedDfCount > 0 && eventCount === 0) {
      hint =
        `${encryptedDfCount} verschlüsselte MsgKey-DF(s) — on-chain sichtbar, Klartext nur mit Session im Posteingang.`
    } else if (dfCount === 0 && eventCount > 0) {
      hint =
        'Nur Chain-Events (Klartext) — typisch bei Persistenz „Schnell/Event“. Mailbox-DFs mit „Anker/Mailbox“.'
    }

    return {
      ok: true,
      mailboxObjectId: mailboxObjectId || '(Events only)',
      packageId,
      address,
      rows,
      dfCount,
      eventCount,
      encryptedDfCount,
      hint,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Einzelnes Nachrichten-Objekt (PlainMsgKey / MsgKey) per Object-ID laden. */
export async function scanMailboxMessageObjectById(input: {
  objectId: string
}): Promise<MailboxPlainScanResult> {
  const objectId = input.objectId.trim().toLowerCase()
  if (!isLikelyIotaHexId(objectId)) {
    return { ok: false, error: 'Object-ID: 0x + 64 Hex.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  }
  const snap = getDirectMailboxChainSnapshot()
  const packageId = (snap?.packageId || '').trim()

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const res = (await client.getObject({
      id: objectId,
      options: { showContent: true, showType: true },
    })) as {
      data?: {
        type?: string | null
        content?: { fields?: Record<string, unknown>; type?: string }
      }
    }
    const typeStr = String(res.data?.type || res.data?.content?.type || '')
    const f = res.data?.content?.fields
    if (!f) {
      return { ok: false, error: 'Objekt nicht gefunden oder ohne Content.' }
    }

    const sender = String(f.sender ?? '')
    const recipient = String(f.recipient ?? '')
    const nonceRaw = f.nonce
    const nonce =
      typeof nonceRaw === 'bigint'
        ? String(nonceRaw)
        : typeof nonceRaw === 'number' && Number.isFinite(nonceRaw)
          ? String(Math.trunc(nonceRaw))
          : typeof nonceRaw === 'string' && nonceRaw.trim()
            ? nonceRaw.trim()
            : '0'
    const tsRaw = f.created_at_ms
    const ts =
      typeof tsRaw === 'number' && Number.isFinite(tsRaw)
        ? tsRaw
        : typeof tsRaw === 'string' && /^\d+$/.test(tsRaw)
          ? Number(tsRaw)
          : undefined

    const isPlainType = /PlainMsgKey\b/.test(typeStr)
    const isEncType = /\bMsgKey\b/.test(typeStr) && !isPlainType
    const isPlain =
      isPlainType || (Array.isArray(f.text) && f.ciphertext == null && f.iv == null && !isEncType)
    const isEnc = isEncType || (f.ciphertext != null && f.iv != null)

    if (isPlain && !isEnc) {
      let text = ''
      const rawText = f.text
      if (typeof rawText === 'string') text = rawText
      else if (Array.isArray(rawText)) {
        try {
          text = new TextDecoder().decode(Uint8Array.from(rawText as number[]))
        } catch {
          text = ''
        }
      }
      if (!text.trim()) {
        return { ok: false, error: 'PlainMsgKey ohne lesbaren Text.' }
      }
      return {
        ok: true,
        mailboxObjectId: '(object)',
        packageId: packageId || '(n/a)',
        address: recipient || sender || objectId,
        rows: [
          {
            sender,
            recipient,
            text,
            nonce,
            ts,
            source: 'object',
            objectId,
          },
        ],
        dfCount: 1,
        eventCount: 0,
        encryptedDfCount: 0,
      }
    }

    if (isEnc || typeStr.includes('MsgKey')) {
      return {
        ok: true,
        mailboxObjectId: '(object)',
        packageId: packageId || '(n/a)',
        address: recipient || sender || objectId,
        rows: [
          {
            sender,
            recipient,
            text: ENC_STUB,
            nonce,
            ts,
            source: 'object',
            encrypted: true,
            objectId,
          },
        ],
        dfCount: 0,
        eventCount: 0,
        encryptedDfCount: 1,
        hint: 'MsgKey gefunden — Ciphertext on-chain. Entschlüsseln im Posteingang (ECDH) bzw. PWMSG unter PWMSG entschlüsseln.',
      }
    }

    return {
      ok: false,
      error: `Kein PlainMsgKey/MsgKey (Typ: ${typeStr.slice(0, 80) || 'unbekannt'}). NFT → Wallet → NFT Suche.`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
