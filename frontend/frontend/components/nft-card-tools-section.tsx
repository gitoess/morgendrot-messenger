'use client'

/**
 * Getrennte Werkzeuge an einer Schlüsselkarte: Guthaben / Zeitkapsel.
 * Nicht in die NFT-Galerie-Karten gemischt.
 */

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { NftKeycardImagePreview } from '@/frontend/components/nft-keycard-image-preview'
import { MessengerNftInfoPanel } from '@/frontend/components/messenger-nft-info-panel'
import { NftTimeLeasePanel } from '@/frontend/components/nft-time-lease-panel'
import { NftTimeLeaseReclaimHub } from '@/frontend/components/nft-time-lease-reclaim-hub'
import { NftTokenSpendPanel } from '@/frontend/components/nft-token-spend-panel'
import { NFT_BEARER_TREASURY_CHANGED } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { NFT_GUARDED_PURSE_CHANGED } from '@/frontend/lib/nft-guarded-purse-local-store'
import {
  listNftKeycards,
  NFT_KEYCARD_VAULT_CHANGED_EVENT,
} from '@/frontend/lib/nft-keycard-local-store'
import { buildSecuredSpendOptions } from '@/frontend/lib/nft-secured-spend-options'
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

export function NftCardToolsSection(p: {
  tool: NftCardToolKind
  disabled?: boolean
  /** Zusätzliche Optionen (z. B. geladene Galerie). */
  extraOptions?: NftCardToolOption[]
  /** Vorauswahl (Object-ID). */
  preferredObjectId?: string
}) {
  const [selected, setSelected] = useState('')
  const [manual, setManual] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const onStorage = () => setTick((n) => n + 1)
    window.addEventListener('storage', onStorage)
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, onStorage)
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, onStorage)
    window.addEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, onStorage)
    window.addEventListener(NFT_VAULT_PARKED_CHANGED, onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, onStorage)
      window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, onStorage)
      window.removeEventListener(NFT_KEYCARD_VAULT_CHANGED_EVENT, onStorage)
      window.removeEventListener(NFT_VAULT_PARKED_CHANGED, onStorage)
    }
  }, [])

  const options = useMemo(() => {
    const map = new Map<string, NftCardToolOption>()
    for (const { objectId, entry } of listNftKeycards()) {
      map.set(objectId.toLowerCase(), {
        objectId: objectId.toLowerCase(),
        label: `${entry.label || 'Schlüsselkarte'} · ${objectId.slice(0, 10)}…`,
      })
    }
    for (const o of buildSecuredSpendOptions()) {
      const k = o.objectId.toLowerCase()
      if (!map.has(k)) map.set(k, { objectId: k, label: o.label })
    }
    for (const o of p.extraOptions || []) {
      const k = o.objectId.toLowerCase()
      const prev = map.get(k)
      if (!prev) map.set(k, { ...o, objectId: k })
      else if (o.previewUrl && !prev.previewUrl) map.set(k, { ...prev, previewUrl: o.previewUrl })
    }
    void tick
    return [...map.values()]
  }, [p.extraOptions, tick])

  useEffect(() => {
    const prefer = (p.preferredObjectId || '').trim().toLowerCase()
    if (!prefer) return
    setSelected(prefer)
    setManual(prefer)
  }, [p.preferredObjectId])

  useEffect(() => {
    if (selected || (p.preferredObjectId || '').trim()) return
    if (options[0]) setSelected(options[0].objectId)
  }, [options, p.preferredObjectId, selected])

  const activeId = isPlausibleOid(manual) ? manual.trim() : selected.trim()
  const hintUrl =
    options.find((o) => o.objectId.toLowerCase() === activeId.toLowerCase())?.previewUrl || null
  const title = p.tool === 'guthaben' ? 'Gesichertes Guthaben' : 'Zeitkapsel'

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/80 bg-muted/10 px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>

      {p.tool === 'zeitkapsel' ? (
        <div className="space-y-2 rounded-md border border-amber-800/25 bg-amber-950/10 px-3 py-2.5">
          <p className="text-[11px] font-medium text-foreground">Zurückholen</p>
          <NftTimeLeaseReclaimHub disabled={p.disabled} />
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-border/70 px-3 py-2.5">
        <p className="text-[11px] font-medium text-foreground">
          {p.tool === 'zeitkapsel' ? 'Neue Leihe — NFT wählen' : 'Schlüsselkarte'}
        </p>
        {options.length > 0 ? (
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground"
            value={selected}
            disabled={p.disabled || Boolean(manual.trim())}
            onChange={(e) => setSelected(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.objectId} value={o.objectId}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Kein NFT — Galerie laden oder Object-ID eintragen.
          </p>
        )}
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Oder Object-ID</span>
          <Input
            className="h-8 font-mono text-[11px]"
            value={manual}
            disabled={p.disabled}
            onChange={(e) => setManual(e.target.value)}
            placeholder="0x… NFT-Object-ID"
            spellCheck={false}
          />
        </label>
        {activeId ? (
          <p className="truncate font-mono text-[10px] text-muted-foreground">Aktiv: {activeId}</p>
        ) : null}
        {activeId && isPlausibleOid(activeId) ? (
          <>
            <NftKeycardImagePreview
              objectId={activeId}
              hintUrl={hintUrl}
              disabled={p.disabled}
              compact
            />
            <MessengerNftInfoPanel
              objectId={activeId}
              name={options.find((o) => o.objectId === activeId.toLowerCase())?.label}
              showInfoButton
              variant="compact"
            />
          </>
        ) : null}
      </div>

      <div className="space-y-2 rounded-md border border-border/70 px-3 py-2.5">
        <p className="text-[11px] font-medium text-foreground">
          {p.tool === 'zeitkapsel' ? '3. Leihe starten / Detail' : `2. ${title}`}
        </p>
        {!activeId || !isPlausibleOid(activeId) ? (
          <p className="text-[11px] text-muted-foreground">Bitte zuerst eine gültige NFT-Object-ID wählen.</p>
        ) : p.tool === 'guthaben' ? (
          <NftTokenSpendPanel nftObjectId={activeId} disabled={p.disabled} />
        ) : (
          <NftTimeLeasePanel nftObjectId={activeId} disabled={p.disabled} />
        )}
      </div>
    </div>
  )
}
