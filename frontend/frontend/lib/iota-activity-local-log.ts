/**
 * Lokales IOTA-Aktivitätsprotokoll (dieses Gerät): Msg-Burn, NFT, später Coin.
 * NFT-Einträge werden aus nft-activity-local-log mitgelesen (eine Liste).
 */

import {
  listNftActivity,
  NFT_ACTIVITY_CHANGED_EVENT,
  type NftActivityEntry,
} from '@/frontend/lib/nft-activity-local-log'
import { formatMistAsWalletUiIota } from '@/frontend/lib/nft-vault-balance'

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

export type NftVaultActivityOp =
  | 'purse_create'
  | 'purse_deposit'
  | 'purse_spend'
  | 'purse_destroy'
  | 'treasury_create'
  | 'treasury_deposit'
  | 'treasury_withdraw'
  | 'treasury_freeze'
  | 'treasury_reclaim'
  | 'treasury_destroy'
  | 'vault_indexed'

/** Gesichertes Guthaben → IOTA-Aktivität (frei → Vault oder Vault → Empfänger). */
export function recordNftVaultActivity(input: {
  op: NftVaultActivityOp
  /** Purse- oder Treasury-Object-ID */
  vaultObjectId?: string
  nftObjectId?: string
  /** Betrag in MIST, wenn bekannt */
  amountMist?: bigint | string | number
  digest?: string
  recipient?: string
  nftLabel?: string
}): IotaActivityEntry {
  const mistRaw = input.amountMist
  let iotaPart = ''
  if (mistRaw != null && mistRaw !== '') {
    try {
      const mist = typeof mistRaw === 'bigint' ? mistRaw : BigInt(mistRaw)
      const label = formatMistAsWalletUiIota(mist, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      })
      iotaPart = ` · ${label} IOTA`
    } catch {
      /* ignore */
    }
  }
  const nftBit = input.nftObjectId
    ? ` · NFT ${input.nftObjectId.slice(0, 10)}…${input.nftLabel ? ` (${input.nftLabel.slice(0, 24)})` : ''}`
    : ''
  const titles: Record<NftVaultActivityOp, { kind: IotaActivityKind; summary: string }> = {
    purse_create: { kind: 'coin_out', summary: `Guarded-Purse angelegt${iotaPart}${nftBit}` },
    purse_deposit: { kind: 'coin_out', summary: `Guarded-Purse Einzahlung${iotaPart}${nftBit}` },
    purse_spend: { kind: 'coin_out', summary: `Guarded-Purse Auszahlung${iotaPart}${nftBit}` },
    purse_destroy: { kind: 'coin_out', summary: `Guarded-Purse gelöscht${nftBit}` },
    treasury_create: { kind: 'coin_out', summary: `Bearer-Treasury angelegt${iotaPart}${nftBit}` },
    treasury_deposit: { kind: 'coin_out', summary: `Bearer-Treasury Einzahlung${iotaPart}${nftBit}` },
    treasury_withdraw: { kind: 'coin_out', summary: `Bearer-Treasury Auszahlung${iotaPart}${nftBit}` },
    treasury_freeze: { kind: 'coin_out', summary: `Bearer-Treasury Freeze/Thaw${nftBit}` },
    treasury_reclaim: { kind: 'coin_in', summary: `Bearer-Treasury Admin-Reclaim${iotaPart}${nftBit}` },
    treasury_destroy: { kind: 'coin_out', summary: `Bearer-Treasury gelöscht${nftBit}` },
    vault_indexed: {
      kind: 'coin_out',
      summary: `Gesichertes Guthaben (lokal erkannt)${iotaPart}${nftBit}`,
    },
  }
  const t = titles[input.op]
  const objectId = (input.vaultObjectId || input.nftObjectId || '').trim().toLowerCase()
  // „lokal erkannt“ nur einmal pro Vault — parallele Wallet-Refreshs sonst spammt die Liste.
  if (input.op === 'vault_indexed' && objectId) {
    const existing = readLocal().find(
      (e) =>
        e.objectId === objectId &&
        (e.summary || '').includes('Gesichertes Guthaben (lokal erkannt)')
    )
    if (existing) return existing
  }
  return recordIotaActivity({
    kind: t.kind,
    summary: t.summary,
    digest: input.digest,
    objectId: objectId || undefined,
    counterparty: input.recipient,
  })
}

/** Doppelte „lokal erkannt“-Zeilen (Race bei Wallet-Refresh) auf eine pro Vault kürzen. */
export function dedupeVaultIndexedActivity(): number {
  const rows = readLocal()
  const seen = new Set<string>()
  const next: IotaActivityEntry[] = []
  let removed = 0
  for (const e of rows) {
    const isIdx =
      (e.summary || '').includes('Gesichertes Guthaben (lokal erkannt)') && Boolean(e.objectId)
    if (isIdx) {
      const key = e.objectId!.toLowerCase()
      if (seen.has(key)) {
        removed += 1
        continue
      }
      seen.add(key)
    }
    next.push(e)
  }
  if (removed > 0) writeLocal(next)
  return removed
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
      return 'Guthaben'
    default:
      return kind
  }
}
