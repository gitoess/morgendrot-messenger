'use client'

import { useMemo, useState } from 'react'
import { Clock, ListOrdered, Package, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isOfflineMailboxQueueEnabled } from '@/frontend/lib/api/offline-queue'
import { openRelaySubmitDialog } from '@/frontend/lib/messenger-imperative-dialogs'
import { loadTxRelayQueue, type TxRelayQueueItem } from '@/frontend/lib/tx-relay-queue'

export type OfflineMailboxQueueListItem = {
  id: string
  recipient: string
  createdAt: number
  attempts: number
  lastError?: string
}

function relayStatusLabel(s: TxRelayQueueItem['status']): string {
  if (s === 'pending') return 'wartet auf Submit'
  if (s === 'draft_unsigned') return 'Entwurf (unsigniert)'
  if (s === 'expired_local_proof') return 'lokal abgelaufen'
  if (s === 'invalid') return 'ungültig'
  return s
}

export function ChatViewPendingSendsButton(p: {
  triggerClassName?: string
  offlineMailboxQueuePending?: number
  offlineMailboxQueueItems?: OfflineMailboxQueueListItem[]
  offlineMailboxQueueErrorHint?: string
  onManualRefresh?: () => void | Promise<void>
  onRemoveOfflineMailboxQueueItems?: (ids: string[]) => void
  /** R1/Relay-Abschnitt — Simple Mode aus. */
  showRelayManage?: boolean
}) {
  const showRelayManage = p.showRelayManage !== false
  const triggerClassName =
    p.triggerClassName ??
    'w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent'
  const [open, setOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [selectedOfflineIds, setSelectedOfflineIds] = useState<string[]>([])

  const relayPending = useMemo(() => {
    void refreshTick
    return loadTxRelayQueue().filter((x) => x.status !== 'anchored')
  }, [refreshTick])

  const offlineItems = p.offlineMailboxQueueItems ?? []
  const offlineCount = p.offlineMailboxQueuePending ?? offlineItems.length
  const totalPending = relayPending.length + offlineCount

  const triggerLabel =
    totalPending > 0 ? `Wartende Sendungen (${totalPending})` : 'Wartende Sendungen (Offline/Relay)'

  const refresh = () => setRefreshTick((x) => x + 1)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          refresh()
          setSelectedOfflineIds([])
          setOpen(true)
        }}
        className={cn(triggerClassName)}
      >
        {triggerLabel}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Wartende Sendungen (noch nicht verankert)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Das sind <strong className="text-foreground">keine</strong> Digest-Listen — hier liegen volle Sende-Payloads (Mailbox-Queue) bzw.
            Relay-Pakete, die noch submitted werden müssen. Verankerte TX-Digests: Menüpunkt{' '}
            <strong className="text-foreground">Verankerte IOTA-Transaktionen</strong>.
          </p>

          <section className="space-y-2 rounded-lg border border-amber-600/35 bg-amber-950/15 p-3 dark:bg-amber-950/25">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListOrdered className="h-4 w-4 shrink-0" aria-hidden />
              Mailbox-Offline-Warteschlange
              {offlineCount > 0 ? (
                <span className="rounded-full bg-amber-600/90 px-2 py-0.5 text-[10px] font-bold text-white">{offlineCount}</span>
              ) : null}
            </h3>
            <p className="text-xs text-muted-foreground">
              Speicher: <span className="font-mono">localStorage</span>
              {isOfflineMailboxQueueEnabled() ? (
                <> (Opt-in aktiv: <span className="font-mono">morgendrot.offlineMailboxQueue=1</span>)</>
              ) : (
                <>
                  {' '}
                  — Opt-in in der Browser-Konsole:{' '}
                  <span className="font-mono">localStorage.setItem(&apos;morgendrot.offlineMailboxQueue&apos;,&apos;1&apos;)</span>
                </>
              )}
              . Nicht im Messaging-Tresor (.morgendrot-vault).
            </p>
            {p.offlineMailboxQueueErrorHint ? (
              <p className="font-mono text-[10px] text-muted-foreground">Letzte Meldung: {p.offlineMailboxQueueErrorHint}</p>
            ) : null}
            {offlineItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Einträge in der Mailbox-Warteschlange.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {offlineItems.map((q) => (
                  <li key={q.id} className="rounded-md border border-border/60 bg-background/80 p-2 text-xs">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedOfflineIds.includes(q.id)}
                        onChange={(e) => {
                          setSelectedOfflineIds((prev) =>
                            e.target.checked ? [...prev, q.id] : prev.filter((id) => id !== q.id)
                          )
                        }}
                      />
                      <span>
                        <span className="font-mono text-[10px] text-muted-foreground">{q.recipient.slice(0, 14)}…</span>
                        <br />
                        {new Date(q.createdAt).toLocaleString('de-DE')} · Versuche {q.attempts}
                        {q.lastError ? (
                          <>
                            <br />
                            <span className="text-amber-800 dark:text-amber-200">{q.lastError}</span>
                          </>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {p.onManualRefresh ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void p.onManualRefresh?.()}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Erneut versuchen (Status)
                </Button>
              ) : null}
              {p.onRemoveOfflineMailboxQueueItems && selectedOfflineIds.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    p.onRemoveOfflineMailboxQueueItems?.(selectedOfflineIds)
                    setSelectedOfflineIds([])
                    refresh()
                  }}
                >
                  Ausgewählte entfernen ({selectedOfflineIds.length})
                </Button>
              ) : null}
            </div>
          </section>

          {showRelayManage ? (
          <section className="space-y-2 rounded-lg border border-border/70 bg-muted/15 p-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package className="h-4 w-4 shrink-0" aria-hidden />
              R1 Kurier / Relay-Pakete
              {relayPending.length > 0 ? (
                <span className="rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {relayPending.length}
                </span>
              ) : null}
            </h3>
            <p className="text-xs text-muted-foreground">
              Speicher: <span className="font-mono">morgendrot.txRelayQueue.v1</span>. Nach erfolgreichem Submit und „verankert“ wandert der Digest
              in <strong className="text-foreground">Verankerte IOTA-Transaktionen</strong>.
            </p>
            {relayPending.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine offenen Relay-Pakete.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {relayPending.map((it) => (
                  <li key={it.id} className="rounded-md border border-border/60 bg-background/80 p-2 text-xs">
                    <p className="font-medium">{relayStatusLabel(it.status)}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {it.envelope.sender.slice(0, 12)}… · {new Date(it.createdLocalAt).toLocaleString('de-DE')}
                    </p>
                    {it.relayReport?.note ? (
                      <p className="mt-1 break-all text-[10px] text-muted-foreground">{it.relayReport.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => {
                setOpen(false)
                openRelaySubmitDialog()
              }}
            >
              <Clock className="mr-2 h-3.5 w-3.5" />
              Relay-Pakete verwalten…
            </Button>
          </section>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={refresh}>
              Liste aktualisieren
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
