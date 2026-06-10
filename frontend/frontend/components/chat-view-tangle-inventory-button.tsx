'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, RefreshCw, Save, Trash2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { explorerTxUrlFromDigest } from '@/frontend/lib/iota-tx-explorer-hint'
import type { Message } from '@/frontend/lib/types'
import {
  addManyTangleInventoryItems,
  canRecoverTangleInventoryText,
  clearTangleInventory,
  countTangleInventory,
  loadTangleInventory,
  removeTangleInventoryItem,
  tangleInventoryOriginLabel,
  type TangleInventoryItem,
} from '@/frontend/lib/tangle-inventory'
import {
  downloadTangleEvidenceJson,
  secureTangleEvidenceLocally,
  sortTangleInventoryForDisplay,
} from '@/frontend/lib/tangle-inventory-evidence'
import {
  fetchVaultStoredDigestSet,
  importDigestsFromVault,
  isTangleInventoryAutoVaultSaveEnabled,
  removeDigestFromVault,
  saveDigestToVault,
  setTangleInventoryAutoVaultSaveEnabled,
} from '@/frontend/lib/tangle-inventory-vault'
import {
  recoverTangleInventoryText,
  type RecoverTangleTextSource,
} from '@/frontend/lib/tangle-inventory-recover'

export type TangleInventoryScope = 'anchored' | 'all'

type TextResult = { text: string; source?: RecoverTangleTextSource } | { error: string }

function typeLabel(t: TangleInventoryItem['type']): string {
  if (t === 'image') return 'Bild'
  if (t === 'text') return 'Text'
  if (t === 'protocol-hash') return 'Protokoll-Hash'
  if (t === 'protocol-full') return 'Protokoll-voll'
  return 'Sonstiges'
}

function sourceHint(source: RecoverTangleTextSource): string {
  if (source === 'preview') return 'Lokal gespeichert'
  if (source === 'local-inbox') return 'Aus geladenem Posteingang'
  return 'Von Chain/API nachgeladen'
}

function digestKey(d: string): string {
  return d.trim().toLowerCase()
}

function itemToVaultPayload(it: TangleInventoryItem) {
  return {
    digest: it.digest,
    timestamp: it.timestamp,
    type: it.type,
    status: it.status,
    origin: it.origin,
    nonce: it.nonce,
    encrypted: it.encrypted,
    contentPreview: it.contentPreview,
    evidenceSecuredAt: it.evidenceSecuredAt,
  }
}

function textForItem(it: TangleInventoryItem, resultById: Record<string, TextResult>): string | undefined {
  const r = resultById[it.id]
  if (r && !('error' in r) && r.text.trim()) return r.text.trim()
  return it.contentPreview?.trim() || undefined
}

export function ChatViewTangleInventoryButton(p?: {
  triggerClassName?: string
  triggerLabel?: string
  inventoryScope?: TangleInventoryScope
  messages?: readonly Message[]
  packageId?: string
}) {
  const inventoryScope = p?.inventoryScope ?? 'anchored'
  const triggerClassName =
    p?.triggerClassName ??
    'w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent'
  const [open, setOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [showTresorOpts, setShowTresorOpts] = useState(false)
  const [autoVaultSave, setAutoVaultSave] = useState(false)
  const [uiMsg, setUiMsg] = useState<string | null>(null)
  const [vaultDigests, setVaultDigests] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const txCount = useMemo(() => {
    void refreshTick
    return countTangleInventory({
      status: inventoryScope === 'anchored' ? 'anchored' : 'all',
    })
  }, [refreshTick, inventoryScope])
  const defaultTriggerLabel = txCount > 0 ? `IOTA-Transaktionen (${txCount})` : 'IOTA-Transaktionen'
  const triggerLabel = p?.triggerLabel ?? defaultTriggerLabel
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resultById, setResultById] = useState<Record<string, TextResult>>({})

  const items = useMemo(() => {
    void refreshTick
    const all = loadTangleInventory()
    const filtered =
      inventoryScope === 'anchored' ? all.filter((it) => it.status === 'anchored') : all
    return sortTangleInventoryForDisplay(filtered)
  }, [refreshTick, inventoryScope])

  const selectedItems = useMemo(
    () => items.filter((it) => selectedIds.has(it.id)),
    [items, selectedIds]
  )
  const actionTargets = selectedItems.length > 0 ? selectedItems : items

  const allVisibleSelected = items.length > 0 && items.every((it) => selectedIds.has(it.id))
  const someSelected = selectedIds.size > 0

  const refresh = () => setRefreshTick((x) => x + 1)

  const refreshVaultDigests = useCallback(async () => {
    const r = await fetchVaultStoredDigestSet()
    if (r.ok && r.digests) setVaultDigests(r.digests)
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshVaultDigests()
  }, [open, refreshTick, refreshVaultDigests])

  useEffect(() => {
    const visible = new Set(items.map((it) => it.id))
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [items])

  const isInVault = (digest: string) => vaultDigests.has(digestKey(digest))

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(items.map((it) => it.id)))
  }

  const loadText = async (it: TangleInventoryItem) => {
    setBusyId(it.id)
    try {
      const r = await recoverTangleInventoryText({
        nonce: it.nonce,
        contentPreview: it.contentPreview,
        origin: it.origin,
        localMessages: p?.messages,
        packageId: p?.packageId,
      })
      setResultById((m) => ({
        ...m,
        [it.id]: r.ok ? { text: r.text, source: r.source } : { error: r.error },
      }))
      return r.ok ? r.text : undefined
    } finally {
      setBusyId(null)
    }
  }

  const secureEvidence = async (it: TangleInventoryItem, knownText?: string) => {
    const r = await secureTangleEvidenceLocally(it, {
      localMessages: p?.messages,
      packageId: p?.packageId,
      knownText: knownText ?? textForItem(it, resultById),
      tryLoadText: true,
    })
    return r
  }

  const batchSecureEvidence = async () => {
    if (actionTargets.length === 0) return
    setBatchBusy(true)
    setUiMsg(null)
    let ok = 0
    let withText = 0
    for (const it of actionTargets) {
      const r = await secureEvidence(it)
      if (r.ok) {
        ok++
        if (r.textSaved) withText++
      }
    }
    refresh()
    setUiMsg(
      `${ok} Beweis(e) lokal gesichert` +
        (withText < ok ? ` (${withText} mit Text, ${ok - withText} nur IOTA-Daten).` : '.')
    )
    setBatchBusy(false)
  }

  const batchExportJson = () => {
    if (actionTargets.length === 0) return
    downloadTangleEvidenceJson(actionTargets, {
      packageId: p?.packageId,
      getText: (it) => textForItem(it, resultById),
    })
    setUiMsg(`${actionTargets.length} Beweis(e) als JSON exportiert.`)
  }

  const batchLoadText = async () => {
    const targets = actionTargets.filter(canRecoverTangleInventoryText)
    if (targets.length === 0) {
      setUiMsg('Keine Einträge mit ladbarem Text.')
      return
    }
    setBatchBusy(true)
    let ok = 0
    for (const it of targets) {
      if (await loadText(it)) ok++
    }
    setUiMsg(`Text geladen: ${ok}/${targets.length}.`)
    setBatchBusy(false)
  }

  const batchSaveToVault = async () => {
    const targets = actionTargets.filter((it) => !isInVault(it.digest))
    if (targets.length === 0) {
      setUiMsg('Auswahl liegt bereits im Tresor.')
      return
    }
    setBatchBusy(true)
    let ok = 0
    for (const it of targets) {
      const r = await saveDigestToVault(itemToVaultPayload(it))
      if (r.ok) ok++
    }
    await refreshVaultDigests()
    setUiMsg(`${ok} im Tresor gespeichert.`)
    setBatchBusy(false)
  }

  const batchOpenExplorer = () => {
    for (const it of actionTargets.slice(0, 12)) {
      window.open(explorerTxUrlFromDigest(it.digest), '_blank', 'noopener,noreferrer')
    }
    if (actionTargets.length > 12) setUiMsg('Explorer: max. 12 Tabs geöffnet.')
  }

  const batchRemoveFromList = () => {
    for (const it of actionTargets) removeTangleInventoryItem(it.id)
    setSelectedIds(new Set())
    refresh()
    setUiMsg(`${actionTargets.length} aus Liste entfernt.`)
  }

  const batchRemoveFromVault = async () => {
    const inVault = actionTargets.filter((it) => isInVault(it.digest))
    if (inVault.length === 0) {
      setUiMsg('Keine Tresor-Einträge in der Auswahl.')
      return
    }
    setBatchBusy(true)
    let removed = 0
    for (const it of inVault) {
      const r = await removeDigestFromVault(it.digest)
      if (r.ok) removed += r.removed ?? 0
    }
    await refreshVaultDigests()
    setUiMsg(`${removed} aus Tresor entfernt.`)
    setBatchBusy(false)
  }

  const selectedInVaultCount = selectedItems.filter((it) => isInVault(it.digest)).length

  return (
    <>
      <button
        type="button"
        onClick={() => {
          refresh()
          setAutoVaultSave(isTangleInventoryAutoVaultSaveEnabled())
          setUiMsg(null)
          setSelectedIds(new Set())
          setShowTresorOpts(false)
          setOpen(true)
        }}
        className={cn(triggerClassName)}
      >
        {triggerLabel}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>IOTA-Transaktionen — Beweissicherung</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Jede Zeile = eine IOTA-Transaktion (Digest, Nonce, Explorer-Link). Die Liste liegt auf{' '}
            <strong className="font-medium text-foreground">diesem Gerät</strong>.{' '}
            <strong className="font-medium text-foreground">Beweis lokal sichern</strong> hält Text (wenn vorhanden){' '}
            und alle IOTA-Daten fest — für Nachweis und Export.
          </p>

          <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-muted/15 p-2">
            <Button type="button" size="sm" disabled={batchBusy || items.length === 0} onClick={() => void batchSecureEvidence()}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Beweis lokal sichern
              {someSelected ? ` (${selectedIds.size})` : items.length > 0 ? ' (alle)' : ''}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={items.length === 0} onClick={batchExportJson}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              JSON exportieren
              {someSelected ? ` (${selectedIds.size})` : items.length > 0 ? ' (alle)' : ''}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={batchBusy || items.length === 0} onClick={() => void batchLoadText()}>
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', batchBusy && 'animate-spin')} />
              Text nachladen
            </Button>
          </div>

          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => setShowTresorOpts((v) => !v)}
          >
            {showTresorOpts ? '▾ Tresor-Optionen ausblenden' : '▸ Optional: Kopie im Wallet-Tresor'}
          </button>
          {showTresorOpts ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border/80 px-2 py-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const r = await importDigestsFromVault()
                  if (!r.ok) {
                    setUiMsg(r.error ?? 'Tresor-Import fehlgeschlagen.')
                    return
                  }
                  addManyTangleInventoryItems(r.items ?? [])
                  await refreshVaultDigests()
                  refresh()
                  setUiMsg(`${(r.items ?? []).length} aus Tresor übernommen.`)
                }}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Aus Tresor laden
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={batchBusy} onClick={() => void batchSaveToVault()}>
                Im Tresor speichern
              </Button>
              {selectedInVaultCount > 0 ? (
                <Button type="button" size="sm" variant="outline" disabled={batchBusy} onClick={() => void batchRemoveFromVault()}>
                  Aus Tresor löschen ({selectedInVaultCount})
                </Button>
              ) : null}
              <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoVaultSave}
                  onChange={(e) => {
                    setAutoVaultSave(e.target.checked)
                    setTangleInventoryAutoVaultSaveEnabled(e.target.checked)
                  }}
                />
                Neue Sends automatisch im Tresor
              </label>
            </div>
          ) : null}

          {items.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 px-3 py-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                Alle ({items.length})
              </label>
              {someSelected ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={batchOpenExplorer}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Explorer
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={batchRemoveFromList}>
                    Aus Liste
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {uiMsg ? <p className="text-xs text-muted-foreground">{uiMsg}</p> : null}

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine IOTA-Transaktionen — entstehen nach Online-Sendung, Pfad-4-Spiegel oder Protokoll-Verankerung.
              </p>
            ) : (
              items.map((it) => {
                const result = resultById[it.id]
                const recoverable = canRecoverTangleInventoryText(it)
                const secured = Boolean(it.evidenceSecuredAt)
                const inVault = isInVault(it.digest)
                const checked = selectedIds.has(it.id)
                return (
                  <div
                    key={it.id}
                    className={cn(
                      'rounded-lg border border-border/70 bg-muted/10 p-3',
                      checked && 'ring-1 ring-primary/40',
                      secured && 'border-l-4 border-l-emerald-600'
                    )}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                        checked={checked}
                        onChange={() => toggleSelected(it.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {typeLabel(it.type)} · {new Date(it.timestamp).toLocaleString('de-DE')}
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-primary">
                          {tangleInventoryOriginLabel(it.origin, it.type)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {secured ? '✓ Beweis lokal gesichert' : 'Noch nicht gesichert'}
                          {inVault ? ' · Im Tresor' : ''}
                          {it.nonce ? ` · Nonce ${it.nonce}` : ''}
                        </p>
                        <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{it.digest}</p>
                      </div>
                      <a
                        href={explorerTxUrlFromDigest(it.digest)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Explorer
                      </a>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 pl-6">
                      <Button
                        type="button"
                        size="sm"
                        variant={secured ? 'outline' : 'default'}
                        disabled={batchBusy}
                        onClick={async () => {
                          const r = await secureEvidence(it)
                          if (r.ok) {
                            refresh()
                            setUiMsg(
                              r.textSaved
                                ? 'Beweis lokal gesichert (Text + IOTA-Daten).'
                                : 'Beweis lokal gesichert (IOTA-Daten; Text nicht verfügbar).'
                            )
                          } else {
                            setUiMsg(r.error)
                          }
                        }}
                      >
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        Beweis lokal sichern
                      </Button>
                      {recoverable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === it.id || batchBusy}
                          onClick={() => void loadText(it)}
                        >
                          {busyId === it.id ? 'Lädt…' : 'Text nachladen'}
                        </Button>
                      ) : null}
                      {!inVault && showTresorOpts ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const r = await saveDigestToVault(itemToVaultPayload(it))
                            if (r.ok) await refreshVaultDigests()
                            setUiMsg(r.ok ? 'Im Tresor.' : (r.error ?? 'Fehler'))
                          }}
                        >
                          Im Tresor
                        </Button>
                      ) : null}
                      {inVault && showTresorOpts ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const r = await removeDigestFromVault(it.digest)
                            if (r.ok) await refreshVaultDigests()
                            setUiMsg(r.ok ? 'Aus Tresor entfernt.' : (r.error ?? 'Fehler'))
                          }}
                        >
                          Aus Tresor löschen
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => {
                          removeTangleInventoryItem(it.id)
                          refresh()
                        }}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Entfernen
                      </Button>
                    </div>
                    {(it.contentPreview && !result) || result ? (
                      <div className="ml-6 mt-2">
                        {result && 'error' in result ? (
                          <p className="text-xs text-destructive">{result.error}</p>
                        ) : (
                          <div className="space-y-1">
                            {result && !('error' in result) ? (
                              <p className="text-[10px] text-muted-foreground">{sourceHint(result.source!)}</p>
                            ) : null}
                            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/30 p-2 text-xs">
                              {result && !('error' in result) ? result.text : it.contentPreview}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearTangleInventory()
                setResultById({})
                setSelectedIds(new Set())
                refresh()
                setUiMsg('Liste geleert.')
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Liste leeren
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
