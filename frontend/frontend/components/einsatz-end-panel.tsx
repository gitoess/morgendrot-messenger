'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { performEinsatzEndCacheWipe } from '@/frontend/lib/einsatz-end-cache-wipe'

export type EinsatzEndPanelProps = {
  backendOnline?: boolean
  compact?: boolean
  onCompleted?: () => void
}

export function EinsatzEndPanel(p: EinsatzEndPanelProps) {
  const [busy, setBusy] = useState(false)
  const [clearQueues, setClearQueues] = useState(true)
  const [status, setStatus] = useState('')

  const handleEndEinsatz = async () => {
    if (
      !window.confirm(
        'Lokale Einsatz-Daten auf diesem Gerät löschen?\n\n' +
          'Posteingang-Cache, Filter und gespeicherte Einsatz-IDs werden entfernt. ' +
          'Nichts auf der Chain. Wallet und Tresor bleiben.\n\n' +
          'Danach neues Handoff importieren.'
      )
    ) {
      return
    }
    setBusy(true)
    setStatus('')
    const res = await performEinsatzEndCacheWipe({
      clearServerInbox: p.backendOnline === true,
      clearTransportQueues: clearQueues,
    })
    setBusy(false)
    if (!res.ok && res.serverError) {
      setStatus(`Lokal geleert; Server-Cache: ${res.serverError}`)
    } else {
      setStatus(
        'Einsatz lokal beendet. Posteingang leer — neues Handoff importieren (Einstellungen).'
      )
      p.onCompleted?.()
    }
  }

  return (
    <div
      className={
        p.compact
          ? 'space-y-3'
          : 'rounded-xl border border-border bg-card p-4 space-y-3'
      }
    >
      {!p.compact ? (
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Flag className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h4 className="font-semibold text-foreground">Einsatz beenden</h4>
            <p className="text-sm text-muted-foreground">
              Lokaler Cache und Einsatz-IDs entfernen — nichts auf der Chain. Wallet bleibt.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Checkbox
          id="einsatz-end-clear-queues"
          checked={clearQueues}
          onCheckedChange={(v) => setClearQueues(v === true)}
          disabled={busy}
        />
        <Label htmlFor="einsatz-end-clear-queues" className="text-sm font-normal cursor-pointer">
          Offline-Warteschlangen leeren
        </Label>
      </div>

      <Button type="button" variant="outline" disabled={busy} onClick={() => void handleEndEinsatz()}>
        {busy ? 'Lösche…' : 'Einsatz beenden'}
      </Button>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  )
}
