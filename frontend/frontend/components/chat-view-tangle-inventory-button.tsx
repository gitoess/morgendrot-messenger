'use client'

import { useMemo, useState } from 'react'
import { Database, ExternalLink, RefreshCw, Save, Search, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { explorerTxUrlFromDigest } from '@/frontend/lib/iota-tx-explorer-hint'
import {
  addManyTangleInventoryItems,
  addTangleInventoryItem,
  clearTangleInventory,
  loadTangleInventory,
  type TangleInventoryItem,
} from '@/frontend/lib/tangle-inventory'
import { fetchMailboxInboxPage } from '@/frontend/lib/mailbox-inbox-page-fetch'
import { scanMailboxAndReassembleProtokollFull } from '@/frontend/lib/protokoll-chunk-mailbox-scan'
import {
  importDigestsFromVault,
  isTangleInventoryAutoVaultSaveEnabled,
  saveDigestToVault,
  setTangleInventoryAutoVaultSaveEnabled,
} from '@/frontend/lib/tangle-inventory-vault'

function typeLabel(t: TangleInventoryItem['type']): string {
  if (t === 'image') return 'Bild'
  if (t === 'text') return 'Text'
  if (t === 'protocol-hash') return 'Protokoll-Hash'
  if (t === 'protocol-full') return 'Protokoll-voll'
  return 'Unbekannt'
}

export function ChatViewTangleInventoryButton(p?: {
  triggerClassName?: string
  triggerLabel?: string
}) {
  const triggerClassName =
    p?.triggerClassName ??
    'w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent'
  const triggerLabel = p?.triggerLabel ?? 'Gespeicherte IOTA-Transaktionen'
  const [open, setOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [digestSearch, setDigestSearch] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | TangleInventoryItem['type']>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | TangleInventoryItem['status']>('all')
  const [filterRecovery, setFilterRecovery] = useState<'all' | 'found' | 'not-found'>('all')
  const [manualDigest, setManualDigest] = useState('')
  const [manualType, setManualType] = useState<TangleInventoryItem['type']>('unknown')
  const [manualStatus, setManualStatus] = useState<TangleInventoryItem['status']>('anchored')
  const [autoVaultSave, setAutoVaultSave] = useState(isTangleInventoryAutoVaultSaveEnabled())
  const [resultById, setResultById] = useState<Record<string, string>>({})
  const [uiMsg, setUiMsg] = useState<string | null>(null)

  const allItems = useMemo(() => {
    void refreshTick
    return loadTangleInventory()
  }, [refreshTick])

  const items = useMemo(() => {
    const q = digestSearch.trim().toLowerCase()
    return allItems.filter((it) => {
      if (filterType !== 'all' && it.type !== filterType) return false
      if (filterStatus !== 'all' && it.status !== filterStatus) return false
      if (q) {
        const hay = `${it.digest} ${it.nonce ?? ''} ${it.chunkSha256 ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filterRecovery !== 'all') {
        const res = resultById[it.id] ?? ''
        const found = res.length > 0 && !/nicht gefunden/i.test(res)
        if (filterRecovery === 'found' && !found) return false
        if (filterRecovery === 'not-found' && found) return false
      }
      return true
    })
  }, [allItems, digestSearch, filterRecovery, filterStatus, filterType, resultById])

  const refresh = () => setRefreshTick((x) => x + 1)

  const fetchNonceWithPaging = async (nonce: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    const limit = 200
    const maxPages = 6
    for (let page = 0; page < maxPages; page++) {
      const offset = page * limit
      let lastErr = ''
      for (let retry = 0; retry < 2; retry++) {
        const r = await tryFetchDirectMailboxInboxViaIota({ limit, offset })
        if (!r.ok) {
          lastErr = r.error
          continue
        }
        const hit = r.rows.find((row) => String(row.nonce ?? '') === nonce)
        if (hit) {
          const text = String(hit.text ?? '')
          return {
            ok: true,
            text:
              text.length > 0
                ? text
                : '[Gefunden, aber kein Klartextinhalt zurückgegeben. ECDH/Session-Key oder Payload prüfen.]',
          }
        }
        break
      }
      if (lastErr) {
        return { ok: false, error: `RPC-Fehler (Offset ${offset}): ${lastErr}` }
      }
    }
    return { ok: false, error: 'Eintrag nicht gefunden (Paging durchsucht: 6 Fenster à 200).' }
  }

  const loadAndDecrypt = async (it: TangleInventoryItem) => {
    if (!it.nonce) {
      setResultById((m) => ({ ...m, [it.id]: 'Kein Nonce gespeichert — für diesen Eintrag kein Direkt-Recovery möglich.' }))
      return
    }
    setBusyId(it.id)
    try {
      const r = await fetchNonceWithPaging(String(it.nonce))
      setResultById((m) => ({ ...m, [it.id]: r.ok ? r.text : r.error }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          refresh()
          setAutoVaultSave(isTangleInventoryAutoVaultSaveEnabled())
          setOpen(true)
        }}
        className={cn(triggerClassName)}
      >
        {triggerLabel}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gespeicherte IOTA-Transaktionen (dieses Gerät)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
              Merkt sich Transaction-Digests von Sendungen und Verankerungen <strong className="text-foreground">nur in diesem Browser</strong>{' '}
              (localStorage). „Vom Tangle laden“ nutzt <strong className="text-foreground">Direkt-RPC</strong> oder — ohne RPC-URL — das Backend{' '}
              <strong className="text-foreground">/inbox</strong>. Nonce aus der Verankerungs-Maske kopieren.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  setUiMsg(null)
                  const r = await importDigestsFromVault()
                  if (!r.ok) {
                    setUiMsg(r.error ?? 'Tresor-Import fehlgeschlagen.')
                    return
                  }
                  addManyTangleInventoryItems(r.items ?? [])
                  refresh()
                  setUiMsg(`Aus Tresor übernommen: ${(r.items ?? []).length} Digest-Einträge.`)
                }}
              >
                <Upload className="mr-2 h-3.5 w-3.5" />
                Aus Tresor laden
              </Button>
              <label className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={autoVaultSave}
                  onChange={(e) => {
                    const next = e.target.checked
                    setAutoVaultSave(next)
                    setTangleInventoryAutoVaultSaveEnabled(next)
                  }}
                />
                Neue Digests automatisch im Tresor speichern
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const payload = JSON.stringify(allItems, null, 2)
                  const blob = new Blob([payload], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `morgendrot-tangle-inventory-${Date.now()}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                  setUiMsg('Inventory als JSON exportiert.')
                }}
              >
                JSON export
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const raw = window.prompt('JSON einfügen (Array aus Inventory-Einträgen):')
                  if (!raw) return
                  try {
                    const parsed = JSON.parse(raw) as Array<Partial<TangleInventoryItem>>
                    const mapped = parsed
                      .filter((x) => typeof x?.digest === 'string' && x.digest.trim().length > 0)
                      .map((x) => ({
                        digest: String(x.digest),
                        timestamp: Number.isFinite(x.timestamp) ? Number(x.timestamp) : Date.now(),
                        type: (x.type as TangleInventoryItem['type']) ?? 'unknown',
                        status: (x.status as TangleInventoryItem['status']) ?? 'anchored',
                        nonce: typeof x.nonce === 'string' ? x.nonce : undefined,
                        encrypted: typeof x.encrypted === 'boolean' ? x.encrypted : undefined,
                      }))
                    addManyTangleInventoryItems(mapped)
                    refresh()
                    setUiMsg(`JSON importiert: ${mapped.length} Einträge.`)
                  } catch {
                    setUiMsg('JSON-Import fehlgeschlagen.')
                  }
                }}
              >
                JSON import
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
              <input
                value={manualDigest}
                onChange={(e) => setManualDigest(e.target.value)}
                placeholder="Manueller Digest (0x...)"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value as TangleInventoryItem['type'])}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="unknown">Typ: Unbekannt</option>
                <option value="text">Typ: Text</option>
                <option value="image">Typ: Bild</option>
                <option value="protocol-hash">Typ: Protokoll-Hash</option>
                <option value="protocol-full">Typ: Protokoll-voll</option>
              </select>
              <select
                value={manualStatus}
                onChange={(e) => setManualStatus(e.target.value as TangleInventoryItem['status'])}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="anchored">Status: anchored</option>
                <option value="queued">Status: queued</option>
                <option value="failed">Status: failed</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const d = manualDigest.trim()
                  if (!d) {
                    setUiMsg('Digest fehlt.')
                    return
                  }
                  addTangleInventoryItem({ digest: d, type: manualType, status: manualStatus })
                  refresh()
                  setUiMsg('Manueller Digest zur lokalen Liste hinzugefügt.')
                }}
              >
                Hinzufügen
              </Button>
            </div>
            {uiMsg ? <p className="text-xs text-muted-foreground">{uiMsg}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={digestSearch}
              onChange={(e) => setDigestSearch(e.target.value)}
              placeholder="Digest / Nonce / Chunk-Hash suchen…"
              className="min-w-[12rem] flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={scanBusy}
              onClick={async () => {
                setScanBusy(true)
                setScanResult(null)
                setUiMsg(null)
                try {
                  const r = await scanMailboxAndReassembleProtokollFull()
                  if (!r.ok) {
                    setScanResult(r.error)
                    return
                  }
                  const preview = r.json.length > 4000 ? `${r.json.slice(0, 4000)}…` : r.json
                  setScanResult(
                    `Vollbericht zusammengesetzt (${r.partsFound}/${r.partsExpected} Teile, SHA-256 ${r.contentSha256.slice(0, 12)}…):\n${preview}`
                  )
                  setUiMsg('Protokoll-Chunks in der Mailbox gefunden und zusammengesetzt.')
                } finally {
                  setScanBusy(false)
                }
              }}
            >
              <Search className="mr-2 h-3.5 w-3.5" />
              {scanBusy ? 'Suche…' : 'Protokoll-Chunks suchen'}
            </Button>
          </div>
          {scanResult ? (
            <pre className="max-h-40 overflow-auto rounded-md border border-border/70 bg-background/80 p-2 text-[10px] whitespace-pre-wrap">
              {scanResult}
            </pre>
          ) : null}
          <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/10 p-2 md:grid-cols-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | TangleInventoryItem['type'])}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="all">Typ: alle</option>
              <option value="text">Text</option>
              <option value="image">Bild</option>
              <option value="protocol-hash">Protokoll-Hash</option>
              <option value="protocol-full">Protokoll-voll</option>
              <option value="unknown">Unbekannt</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | TangleInventoryItem['status'])}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="all">Status: alle</option>
              <option value="anchored">anchored</option>
              <option value="queued">queued</option>
              <option value="failed">failed</option>
            </select>
            <select
              value={filterRecovery}
              onChange={(e) => setFilterRecovery(e.target.value as 'all' | 'found' | 'not-found')}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="all">Recovery: alle</option>
              <option value="found">Recovery: gefunden</option>
              <option value="not-found">Recovery: nicht gefunden</option>
            </select>
          </div>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine lokalen txDigests gespeichert. Einträge entstehen nach erfolgreichen Verankerungen/Sendungen.
              </p>
            ) : (
              items.map((it) => (
                <div key={it.id} className="rounded-lg border border-border/70 bg-muted/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {typeLabel(it.type)} · {new Date(it.timestamp).toLocaleString('de-DE')}
                      </p>
                      <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{it.digest}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Status: {it.status}
                        {it.encrypted != null ? ` · ${it.encrypted ? 'verschlüsselt' : 'Klartext'}` : ''}
                        {it.nonce ? ` · Nonce ${it.nonce}` : ''}
                        {it.chunkPart && it.chunkTotal
                          ? ` · Teil ${it.chunkPart}/${it.chunkTotal}`
                          : ''}
                        {it.chunkSha256 ? ` · Chunk-Hash ${it.chunkSha256.slice(0, 12)}…` : ''}
                        {it.anchorHashHex ? ` · Bericht-Hash ${it.anchorHashHex.slice(0, 12)}…` : ''}
                      </p>
                    </div>
                    <a
                      href={explorerTxUrlFromDigest(it.digest)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Explorer
                    </a>
                  </div>
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === it.id}
                      onClick={() => void loadAndDecrypt(it)}
                    >
                      {busyId === it.id ? (
                        <>
                          <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Lädt…
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-3.5 w-3.5" />
                          Nachricht laden (RPC oder /inbox)
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={async () => {
                        setUiMsg(null)
                        const r = await saveDigestToVault({
                          digest: it.digest,
                          timestamp: it.timestamp,
                          type: it.type,
                          status: it.status,
                          nonce: it.nonce,
                          encrypted: it.encrypted,
                        })
                        setUiMsg(r.ok ? 'Digest im Tresor gespeichert.' : (r.error ?? 'Tresor-Speichern fehlgeschlagen.'))
                      }}
                    >
                      <Save className="mr-2 h-3.5 w-3.5" />
                      Digest im Tresor speichern
                    </Button>
                    {resultById[it.id] ? (
                      <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/30 p-2 text-xs">
                        {resultById[it.id]}
                      </pre>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearTangleInventory()
                setResultById({})
                refresh()
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Lokale Liste leeren
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
