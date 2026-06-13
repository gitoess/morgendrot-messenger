'use client'

import { useCallback, useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  getDirectIotaPathUiState,
  getIotaSubmitMode,
  setDirectMailboxDrainEnabled,
  setIotaSubmitMode,
  type DirectIotaPathUiState,
} from '@/frontend/lib/direct-iota-plain-submit'

type SettingsIotaDirectCardProps = {
  backendOnline?: boolean
  /** Eingebettet in „System & Identität“ ohne eigene Karte. */
  embedded?: boolean
}

export function SettingsIotaDirectCard({ backendOnline, embedded = false }: SettingsIotaDirectCardProps) {
  const [iotaPathUi, setIotaPathUi] = useState<DirectIotaPathUiState | null>(null)

  const refresh = useCallback(() => {
    setIotaPathUi(getDirectIotaPathUiState({ backendOnline }))
  }, [backendOnline])

  useEffect(() => {
    refresh()
  }, [refresh])

  const body = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-foreground">Direkt mit IOTA verbinden</span>
        <Switch
          checked={getIotaSubmitMode() === 'client'}
          onCheckedChange={(on) => {
            if (on) {
              setIotaSubmitMode('client')
            } else {
              setIotaSubmitMode('relay')
              setDirectMailboxDrainEnabled(false)
            }
            refresh()
          }}
          aria-label="Direkt mit IOTA verbinden"
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Signatur im Browser; API nur Fallback. Kurzstatus im Chat-Kopf.
      </p>
      {iotaPathUi ? (
        <div className="rounded-lg border border-border/80 bg-muted/15 px-3 py-2 text-xs">
          <p className="font-medium text-foreground">{iotaPathUi.headline}</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">{iotaPathUi.detail}</p>
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <p className="text-sm font-medium text-foreground">IOTA auf diesem Gerät</p>
        {body}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
          <Zap className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <h4 className="font-semibold text-foreground">IOTA auf diesem Gerät</h4>
          {body}
        </div>
      </div>
    </div>
  )
}
