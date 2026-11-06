/**
 * Lokales IOTA-Aktivitätsprotokoll (dieses Gerät): Msg-Burn, NFT, später Coin.
 * NFT-Einträge werden aus nft-activity-local-log mitgelesen (eine Liste).
 */

import {
  listNftActivity,
  NFT_ACTIVITY_CHANGED_EVENT,
  type NftActivityEntry,
} from '@/frontend/lib/nft-activity-local-log'

export const IOTA_ACTIVITY_LS_KEY = 'morgendrot.iotaActivity.v1'
export const IOTA_ACTIVITY_CHANGED_EVENT = 'morgendrot:iota-activity'

const MAX_ENTRIES = 120

export type IotaActivityKind =
  | 'msg_burned'
  | 'nft_mint'
  | 'nft_sent'
  | 'nft_received'
  | 'nft_burned'
  | 'coin_in'
  | 'coin_out'

export type IotaActivityEntry = {
  id: string
  atMs: number
  kind: IotaActivityKind
  /** Kurztext für die Zeile */
  summary: string
  digest?: string
  /** Gegenadresse / Peer */
  counterparty?: string
  /** Object-ID (NFT) oder Mailbox-ID (Burn) */
  objectId?: string
  nonce?: string
}

function emitChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(IOTA_ACTIVITY_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

function readLocal(): IotaActivityEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(IOTA_ACTIVITY_LS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    const out: IotaActivityEntry[] = []
    for (const row of j) {
      if (!row || typeof row !== 'object') continue
      const r = row as Partial<IotaActivityEntry>
      if (
        typeof r.id === 'string' &&
        typeof r.atMs === 'number' &&
        typeof r.summary === 'string' &&
        typeof r.kind === 'string'
      ) {
        out.push({
          id: r.id,
          atMs: r.atMs,
          kind: r.kind as IotaActivityKind,
          summary: r.summary.slice(0, 160),
          ...(typeof r.digest === 'string' ? { digest: r.digest } : {}),
          ...(typeof r.counterparty === 'string' ? { counterparty: r.counterparty } : {}),
          ...(typeof r.objectId === 'string' ? { objectId: r.objectId } : {}),
          ...(typeof r.nonce === 'string' ? { nonce: r.nonce } : {}),
        })
      }
    }
    return out
  } catch {
    return []
  }
}

function writeLocal(entries: IotaActivityEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(IOTA_ACTIVITY_LS_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    /* ignore */
  }
  emitChanged()
}

function nftToIota(a: NftActivityEntry): IotaActivityEntry {
  const kind: IotaActivityKind =
    a.kind === 'mint'
      ? 'nft_mint'
      : a.kind === 'sent'
        ? 'nft_sent'
        : a.kind === 'received'
          ? 'nft_received'
          : 'nft_burned'
  const label =
    a.kind === 'mint'
      ? 'NFT Mint'
      : a.kind === 'sent'
        ? 'NFT gesendet'
        : a.kind === 'received'
          ? 'NFT empfangen'
          : 'NFT vernichtet'
  return {
    id: `nft:${a.id}`,
    atMs: a.atMs,
    kind,
    summary: a.label ? `${label}: ${a.label}` : label,
    objectId: a.objectId,
    ...(a.counterparty ? { counterparty: a.counterparty } : {}),
    ...(a.digest ? { digest: a.digest } : {}),
  }
}

export function listIotaActivity(limit = 60): IotaActivityEntry[] {
  const local = readLocal()
  const nft = listNftActivity(80).map(nftToIota)
  return [...local, ...nft].sort((a, b) => b.atMs - a.atMs).slice(0, Math.max(1, limit))
}

export function recordIotaActivity(input: {
  kind: IotaActivityKind
  summary: string
  digest?: string
  counterparty?: string
  objectId?: string
  nonce?: string
  atMs?: number
}): IotaActivityEntry {
  const entry: IotaActivityEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    atMs: input.atMs ?? Date.now(),
    kind: input.kind,
    summary: input.summary.trim().slice(0, 160) || input.kind,
    ...(input.digest?.trim() ? { digest: input.digest.trim() } : {}),
    ...(input.counterparty?.trim()
      ? { counterparty: input.counterparty.trim().toLowerCase() }
      : {}),
    ...(input.objectId?.trim() ? { objectId: input.objectId.trim().toLowerCase() } : {}),
    ...(input.nonce?.trim() ? { nonce: input.nonce.trim() } : {}),
  }
  writeLocal([entry, ...readLocal()])
  return entry
}

export function recordMsgBurnActivity(input: {
  digest?: string
  peer?: string
  mailboxObjectId?: string
  nonce?: string
  plaintext?: boolean
}): IotaActivityEntry {
  return recordIotaActivity({
    kind: 'msg_burned',
    summary: input.plaintext ? 'Nachricht geburnt (Klartext)' : 'Nachricht geburnt',
    digest: input.digest,
    counterparty: input.peer,
    objectId: input.mailboxObjectId,
    nonce: input.nonce,
  })
}

export function clearIotaActivityLocal(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(IOTA_ACTIVITY_LS_KEY)
  } catch {
    /* ignore */
  }
  emitChanged()
}

/** Für UI: NFT- und IOTA-Events gemeinsam beobachten. */
export const IOTA_ACTIVITY_LISTEN_EVENTS = [IOTA_ACTIVITY_CHANGED_EVENT, NFT_ACTIVITY_CHANGED_EVENT] as const

export function iotaActivityKindLabel(kind: IotaActivityKind): string {
  switch (kind) {
    case 'msg_burned':
      return 'Burn'
    case 'nft_mint':
      return 'NFT Mint'
    case 'nft_sent':
      return 'NFT →'
    case 'nft_received':
      return 'NFT ←'
    case 'nft_burned':
      return 'NFT Burn'
    case 'coin_in':
      return 'Coin ←'
    case 'coin_out':
      return 'Coin →'
    default:
      return kind
  }
}
