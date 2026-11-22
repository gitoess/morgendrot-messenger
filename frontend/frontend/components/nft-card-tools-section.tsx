'use client'

/**
 * Guthaben / Zeitkapsel: NFT-wählen nur aus freien Besitz-NFTs (Galerie), nicht aus dem ganzen Index.
 */

import { useEffect, useMemo, useState } from 'react'
import { NftKeycardImagePreview } from '@/frontend/components/nft-keycard-image-preview'
import { NftTimeLeasePanel } from '@/frontend/components/nft-time-lease-panel'
import { NftTimeLeaseReclaimHub } from '@/frontend/components/nft-time-lease-reclaim-hub'
import { NftTokenSpendPanel } from '@/frontend/components/nft-token-spend-panel'
import { NFT_ACTIVITY_CHANGED_EVENT } from '@/frontend/lib/nft-activity-local-log'
import { NFT_BEARER_TREASURY_CHANGED } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { NFT_GUARDED_PURSE_CHANGED } from '@/frontend/lib/nft-guarded-purse-local-store'
import { NFT_KEYCARD_VAULT_CHANGED_EVENT } from '@/frontend/lib/nft-keycard-local-store'
import { buildOwnedNftPickOptions } from '@/frontend/lib/nft-secured-spend-options'
import { NFT_TIME_LEASE_CHANGED } from '@/frontend/lib/nft-time-lease-local-store'
import { NFT_VAULT_PARKED_CHANGED } from '@/frontend/lib/nft-vault-parked-store'

export type NftCardToolKind = 'guthaben' | 'zeitkapsel'

export type NftCardToolOption = {
  objectId: string
  label: string
  previewUrl?: string
}

function isPlausibleOid(raw: string): boolean {
  const t = raw.trim().toLowerCase()
  return /^0x[0-9a-f]{64}$/.test(t)
}

function shortId(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 8)}…${t.slice(-4)}`
}

export function NftCardToolsSection(p: {
  tool: NftCardToolKind
  disabled?: boolean
  /** Geladene Galerie (Besitz) — Quelle für „NFT wählen“. */
  extraOptions?: NftCardToolOption[]
  preferredObjectId?: string
}) {
  const [selected, setSelected] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const onStorage = () => setTick((n) => n + 1)
    window.addEventListener('storage', onStorage)
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, onStorage)
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, onStorage)
    window.addEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, onStorage)
    window.addEventListener(NFT_VAULT_PARKED_CHANGED, onStorage)
    window.addEventListener(NFT_ACTIVITY_CHANGED_EVENT, onStorage)
    window.addEventListener(NFT_TIME_LEASE_CHANGED, onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, onStorage)
      window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, onStorage)
      window.removeEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, onStorage)
      window.removeEventListener(NFT_VAULT_PARKED_CHANGED, onStorage)
      window.removeEventListener(NFT_ACTIVITY_CHANGED_EVENT, onStorage)
      window.removeEventListener(NFT_TIME_LEASE_CHANGED, onStorage)
    }
  }, [])

  const options = useMemo(() => {
    const labelsById: Record<string, string> = {}
    const previewById: Record<string, string> = {}
    const ownedIds: string[] = []
    for (const o of p.extraOptions || []) {
      const k = o.objectId.toLowerCase()
      ownedIds.push(k)
      if (o.label?.trim()) labelsById[k] = o.label.trim()
      if (o.previewUrl) previewById[k] = o.previewUrl
    }

    const map = new Map<string, NftCardToolOption>()
    for (const o of buildOwnedNftPickOptions({
      ownedObjectIds: ownedIds,
      purpose: p.tool,
      labelsById,
    })) {
      map.set(o.objectId, {
        objectId: o.objectId,
        label: o.label,
        previewUrl: previewById[o.objectId],
      })
    }

    /** Aktuelle Auswahl behalten (z. B. gerade angelegtes Guthaben), auch wenn nicht mehr „frei“. */
    const keep = selected.trim().toLowerCase()
    if (keep && isPlausibleOid(keep) && !map.has(keep)) {
      const fromExtra = (p.extraOptions || []).find((x) => x.objectId.toLowerCase() === keep)
      map.set(keep, {
        objectId: keep,
        label: fromExtra?.label?.trim() || `NFT · ${shortId(keep)} · Guthaben`,
        previewUrl: fromExtra?.previewUrl || previewById[keep],
      })
    }

    const prefer = (p.preferredObjectId || '').trim().toLowerCase()
    if (prefer && isPlausibleOid(prefer) && !map.has(prefer)) {
      map.set(prefer, {
        objectId: prefer,
        label: labelsById[prefer] || `NFT · ${shortId(prefer)}`,
        previewUrl: previewById[prefer],
      })
    }

    void tick
    return [...map.values()]
  }, [p.extraOptions, p.preferredObjectId, p.tool, selected, tick])

  useEffect(() => {
    const prefer = (p.preferredObjectId || '').trim().toLowerCase()
    if (!prefer) return
    setSelected(prefer)
  }, [p.preferredObjectId])

  useEffect(() => {
    if (selected || (p.preferredObjectId || '').trim()) return
    if (options[0]) setSelected(options[0].objectId)
  }, [options, p.preferredObjectId, selected])

  const activeId = selected.trim()
  const hintUrl =
    options.find((o) => o.objectId.toLowerCase() === activeId.toLowerCase())?.previewUrl || null
  const title = p.tool === 'guthaben' ? 'NFT gesichert' : 'Neue Leihe'

  return (
    <div className="space-y-3">
      {p.tool === 'guthaben' ? (
        <div className="rounded-md border border-border/80 bg-muted/10 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">{title}</p>
        </div>
      ) : null}

      {p.tool === 'zeitkapsel' ? (
        <div className="space-y-2 rounded-md border border-amber-800/25 bg-amber-950/10 px-3 py-2.5">
          <NftTimeLeaseReclaimHub disabled={p.disabled} sections="list" />
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-border/70 px-3 py-2.5">
        <p className="text-[11px] font-medium text-foreground">
          {p.tool === 'zeitkapsel' ? 'Neue Leihe — freies NFT wählen' : 'Freies NFT wählen'}
        </p>
        {options.length > 0 ? (
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground"
            value={options.some((o) => o.objectId === selected) ? selected : ''}
            disabled={p.disabled}
            onChange={(e) => setSelected(e.target.value)}
          >
            {!options.some((o) => o.objectId === selected) ? (
              <option value="" disabled>
                — bitte wählen —
              </option>
            ) : null}
            {options.map((o) => (
              <option key={o.objectId} value={o.objectId}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Kein freies NFT — Tab „Eigene“ laden. Belegte (mit Guthaben) erscheinen hier nicht; Auszahlen über
            Wallet → Überweisen → NFT gesichert.
          </p>
        )}
        {activeId && isPlausibleOid(activeId) ? (
          <NftKeycardImagePreview
            objectId={activeId}
            hintUrl={hintUrl}
            disabled={p.disabled}
            compact
          />
        ) : null}
      </div>

      <div className="space-y-2 rounded-md border border-border/70 px-3 py-2.5">
        <p className="text-[11px] font-medium text-foreground">
          {p.tool === 'zeitkapsel' ? 'Leihe starten' : title}
        </p>
        {!activeId || !isPlausibleOid(activeId) ? (
          <p className="text-[11px] text-muted-foreground">Bitte zuerst ein NFT wählen.</p>
        ) : p.tool === 'guthaben' ? (
          <NftTokenSpendPanel nftObjectId={activeId} disabled={p.disabled} />
        ) : (
          <NftTimeLeasePanel nftObjectId={activeId} disabled={p.disabled} />
        )}
      </div>

      {p.tool === 'zeitkapsel' ? (
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2.5">
          <NftTimeLeaseReclaimHub disabled={p.disabled} sections="notfall" />
        </div>
      ) : null}
    </div>
  )
}
