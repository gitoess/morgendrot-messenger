'use client'

/**
 * Getrennte Werkzeuge an einer Schlüsselkarte: Guthaben / Zeitkapsel.
 * Nicht in die NFT-Galerie-Karten gemischt.
 */

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { NftKeycardImagePreview } from '@/frontend/components/nft-keycard-image-preview'
import { NftTimeLeasePanel } from '@/frontend/components/nft-time-lease-panel'
import { NftTokenSpendPanel } from '@/frontend/components/nft-token-spend-panel'
import { listNftKeycards } from '@/frontend/lib/nft-keycard-local-store'

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
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const options = useMemo(() => {
    const map = new Map<string, NftCardToolOption>()
    for (const { objectId, entry } of listNftKeycards()) {
      map.set(objectId.toLowerCase(), {
        objectId,
        label: `${entry.label || 'Schlüsselkarte'} · ${objectId.slice(0, 10)}…`,
      })
    }
    for (const o of p.extraOptions || []) {
      const k = o.objectId.toLowerCase()
      const prev = map.get(k)
      if (!prev) map.set(k, o)
      else if (o.previewUrl && !prev.previewUrl) map.set(k, { ...prev, previewUrl: o.previewUrl })
    }
    void tick
    return [...map.values()]
  }, [p.extraOptions, tick])

  useEffect(() => {
    if (selected) return
    const prefer = (p.preferredObjectId || '').trim()
    if (prefer && options.some((o) => o.objectId.toLowerCase() === prefer.toLowerCase())) {
      setSelected(prefer)
      return
    }
    if (options[0]) setSelected(options[0].objectId)
  }, [options, p.preferredObjectId, selected])

  const activeId = isPlausibleOid(manual) ? manual.trim() : selected.trim()
  const hintUrl =
    options.find((o) => o.objectId.toLowerCase() === activeId.toLowerCase())?.previewUrl || null
  const title = p.tool === 'guthaben' ? 'Gesichertes Guthaben' : 'Zeitkapsel'
  const blurb =
    p.tool === 'guthaben'
      ? 'Coins hinter eine Schlüsselkarte legen — getrennt von Galerie und Bild-NFTs.'
      : 'NFT zeitlich verleihen (Lease) — getrennt von Galerie und Guthaben.'

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/80 bg-muted/10 px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{blurb}</p>
      </div>

      <div className="space-y-2 rounded-md border border-border/70 px-3 py-2.5">
        <p className="text-[11px] font-medium text-foreground">1. Schlüsselkarte wählen</p>
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
            Noch keine gemerkte Schlüsselkarte — Object-ID unten eintragen oder zuerst unter „Galerie“ eine Karte
            merken.
          </p>
        )}
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">Oder Object-ID (überschreibt die Auswahl)</span>
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
          <NftKeycardImagePreview
            objectId={activeId}
            hintUrl={hintUrl}
            disabled={p.disabled}
            compact
          />
        ) : null}
      </div>

      <div className="space-y-2 rounded-md border border-border/70 px-3 py-2.5">
        <p className="text-[11px] font-medium text-foreground">2. {title}</p>
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
