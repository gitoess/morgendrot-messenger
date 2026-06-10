'use client'

import { explorerTxUrlFromDigest } from '@/frontend/lib/iota-tx-explorer-hint'
import type { Message } from '@/frontend/lib/types'
import {
  tangleInventoryOriginLabel,
  updateTangleInventoryItem,
  type TangleInventoryItem,
} from '@/frontend/lib/tangle-inventory'
import { recoverTangleInventoryText, trimTangleContentPreview } from '@/frontend/lib/tangle-inventory-recover'

export type TangleEvidenceRecord = {
  schema: 'morgendrot.tangle-evidence.v1'
  exportedAt: string
  packageId?: string
  digest: string
  explorerUrl: string
  timestamp: number
  timestampIso: string
  type: TangleInventoryItem['type']
  status: TangleInventoryItem['status']
  origin: string
  originKey?: TangleInventoryItem['origin']
  nonce?: string
  encrypted?: boolean
  chunkSha256?: string
  anchorHashHex?: string
  chunkPart?: number
  chunkTotal?: number
  messageText?: string
  evidenceSecuredAt?: number
  evidenceSecuredAtIso?: string
}

export function buildTangleEvidenceRecord(
  item: TangleInventoryItem,
  opts?: { messageText?: string; packageId?: string }
): TangleEvidenceRecord {
  const text = (opts?.messageText ?? item.contentPreview ?? '').trim()
  const securedAt = item.evidenceSecuredAt
  return {
    schema: 'morgendrot.tangle-evidence.v1',
    exportedAt: new Date().toISOString(),
    packageId: opts?.packageId,
    digest: item.digest,
    explorerUrl: explorerTxUrlFromDigest(item.digest),
    timestamp: item.timestamp,
    timestampIso: new Date(item.timestamp).toISOString(),
    type: item.type,
    status: item.status,
    origin: tangleInventoryOriginLabel(item.origin, item.type),
    originKey: item.origin,
    nonce: item.nonce,
    encrypted: item.encrypted,
    chunkSha256: item.chunkSha256,
    anchorHashHex: item.anchorHashHex,
    chunkPart: item.chunkPart,
    chunkTotal: item.chunkTotal,
    ...(text ? { messageText: text } : {}),
    ...(securedAt
      ? {
          evidenceSecuredAt: securedAt,
          evidenceSecuredAtIso: new Date(securedAt).toISOString(),
        }
      : {}),
  }
}

export async function resolveEvidenceMessageText(
  item: TangleInventoryItem,
  opts?: {
    localMessages?: readonly Message[]
    packageId?: string
    knownText?: string
  }
): Promise<string | undefined> {
  const known = (opts?.knownText ?? item.contentPreview ?? '').trim()
  if (known) return known
  const r = await recoverTangleInventoryText({
    nonce: item.nonce,
    contentPreview: item.contentPreview,
    origin: item.origin,
    localMessages: opts?.localMessages,
    packageId: opts?.packageId,
  })
  return r.ok ? r.text.trim() : undefined
}

/** Text (falls verfügbar) + Metadaten auf dem Gerät festhalten. */
export async function secureTangleEvidenceLocally(
  item: TangleInventoryItem,
  opts?: {
    localMessages?: readonly Message[]
    packageId?: string
    knownText?: string
    tryLoadText?: boolean
  }
): Promise<{ ok: true; textSaved: boolean } | { ok: false; error: string }> {
  let text = (opts?.knownText ?? item.contentPreview ?? '').trim()
  if (!text && opts?.tryLoadText !== false && canTryLoadTextForEvidence(item)) {
    text = (await resolveEvidenceMessageText(item, opts)) ?? ''
  }
  const patch: Partial<TangleInventoryItem> = {
    evidenceSecuredAt: Date.now(),
  }
  if (text) patch.contentPreview = trimTangleContentPreview(text)
  const changed = updateTangleInventoryItem(item.id, patch)
  if (!changed) return { ok: false, error: 'Eintrag nicht gefunden.' }
  return { ok: true, textSaved: Boolean(text) }
}

function canTryLoadTextForEvidence(item: TangleInventoryItem): boolean {
  if (item.origin === 'anchor') return false
  if (item.origin === 'relay' && !item.nonce?.trim()) return false
  return true
}

export function downloadTangleEvidenceJson(
  items: TangleInventoryItem[],
  opts?: { packageId?: string; getText?: (item: TangleInventoryItem) => string | undefined }
) {
  const records = items.map((it) =>
    buildTangleEvidenceRecord(it, {
      packageId: opts?.packageId,
      messageText: opts?.getText?.(it) ?? it.contentPreview,
    })
  )
  const payload = JSON.stringify(records, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `morgendrot-iota-beweis-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function sortTangleInventoryForDisplay(items: TangleInventoryItem[]): TangleInventoryItem[] {
  const rank = (it: TangleInventoryItem) => {
    if (it.origin === 'mailbox') return 0
    if (it.origin === 'path4') return 1
    if (it.origin === 'unknown' || !it.origin) return 2
    if (it.origin === 'relay') return 3
    return 4
  }
  return [...items].sort((a, b) => {
    const dr = rank(a) - rank(b)
    if (dr !== 0) return dr
    return b.timestamp - a.timestamp
  })
}
