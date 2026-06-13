'use client'

import { useMemo, useState } from 'react'
import { RefreshCw, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { openRelaySubmitDialog } from '@/frontend/lib/messenger-imperative-dialogs'
import { loadTxRelayQueue, type TxRelayQueueItem } from '@/frontend/lib/tx-relay-queue'

export type OfflineMailboxQueueListItem = {
  id: string
  recipient: string
  createdAt: number
  attempts: number
  lastAttemptAt?: number
  deferUntilMs?: number
  statusLabel?: 'queued' | 'backoff' | 'retrying'
  lastError?: string
}

function relayStatusLabel(s: TxRelayQueueItem['status']): string {
  if (s === 'pending') return 'Relay — bereit'
  if (s === 'draft_unsigned') return 'Entwurf'
  if (s === 'expired_local_proof') return 'Abgelaufen'
  if (s === 'invalid') return 'Ungültig'
  return s
}

export function ChatViewPendingSendsButton(p: {
  triggerClassName?: string
  offlineMailboxQueuePending?: number
  offlineMailboxQueueItems?: OfflineMailboxQueueListItem[]
  offlineMailboxQueueErrorHint?: string
  onManualRefresh?: () => void | Promise<void>
  onRemoveOfflineMailboxQueueItems?: (ids: string[]) => void
  showRelayManage?: boolean
}) {
  const showRelayManage = p.showRelayManage !== false
  const triggerClassName =
    p.triggerClassName ??
    'w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm hover:bg-accent'
  const [open, setOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [selectedOfflineIds, setSelectedOfflineIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const relayPending = useMemo(() => {
    void refreshTick
    return loadTxRelayQueue().filter((x) => x.status !== 'anchored')
  }, [refreshTick])

  const offlineItems = p.offlineMailboxQueueItems ?? []
  const offlineCount = p.offlineMailboxQueuePending ?? offlineItems.length
  const totalPending = relayPending.length + offlineCount

  const triggerLabel = totalPending > 0 ? `Ausstehend (${totalPending})` : 'Ausstehend'

  const refresh = () => setRefreshTick((x) => x + 1)

  const runOfflineSubmit = async () => {
    if (!p.onManualRefresh) return
    setSubmitting(true)
    try {
      await p.onManualRefresh()
    } finally {
      setSubmitting(false)
      refresh()
    }
  }

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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ausstehende Sendungen</DialogTitle>
          </DialogHeader>

          {offlineCount > 0 ? (
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  Mailbox ({offlineCount})
                </span>
                {p.onManualRefresh ? (
                  <Button type="button" size="sm" disabled={submitting} onClick={() => void runOfflineSubmit()}>
                    <Send className="mr-2 h-3.5 w-3.5" />
                    {submitting ? 'Sende…' : 'Jetzt senden'}
                  </Button>
                ) : null}
              </div>
              {p.offlineMailboxQueueErrorHint ? (
                <p className="text-xs text-destructive">{p.offlineMailboxQueueErrorHint}</p>
              ) : null}
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {offlineItems.map((q) => (
                  <li key={q.id} className="rounded-md border border-border/60 px-2 py-1.5 text-xs">
                    <label className="flex cursor-pointer items-start gap-2">
                      {p.onRemoveOfflineMailboxQueueItems ? (
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
                      ) : null}
                      <span>
                        {new Date(q.createdAt).toLocaleString('de-DE')}
                        {q.lastError ? ` — ${q.lastError}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
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
                  Entfernen ({selectedOfflineIds.length})
                </Button>
              ) : null}
            </section>
          ) : null}

          {showRelayManage && relayPending.length > 0 ? (
            <section className="space-y-2 border-t border-border/60 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">Relay ({relayPending.length})</span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setOpen(false)
                    openRelaySubmitDialog()
                  }}
                >
                  <Send className="mr-2 h-3.5 w-3.5" />
                  Jetzt absenden
                </Button>
              </div>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {relayPending.map((it) => (
                  <li key={it.id}>
                    {relayStatusLabel(it.status)} · {new Date(it.createdLocalAt).toLocaleString('de-DE')}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {totalPending === 0 ? (
            <p className="text-sm text-muted-foreground">Nichts ausstehend.</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={refresh}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Aktualisieren
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
