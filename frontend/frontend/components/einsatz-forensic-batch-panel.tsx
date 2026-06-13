'use client'

import { useEffect, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import {
  previewForensicBatchArchiveFromInbox,
  runForensicBatchArchiveFromInbox,
} from '@/frontend/lib/einsatz-forensic-batch-flow'
import {
  FORENSIC_BATCH_AUTO_INTERVAL_OPTIONS_MIN,
  readForensicBatchArchiveMode,
  readForensicBatchAutoArchiveEnabled,
  readForensicBatchAutoIntervalMin,
  writeForensicBatchArchiveMode,
  writeForensicBatchAutoArchiveEnabled,
  writeForensicBatchAutoIntervalMin,
  type ForensicBatchArchiveMode,
  type ForensicBatchAutoIntervalMin,
  FORENSIC_BATCH_CHANGED,
} from '@/frontend/lib/forensic-batch-config'
import {
  countForensicBatchRegistry,
  downloadForensicBatchRegistryExport,
  importForensicBatchRegistryJson,
  readForensicBatchRegistry,
} from '@/frontend/lib/forensic-batch-registry'
import { useForensicBatchAutoArchive } from '@/frontend/hooks/use-forensic-batch-auto-archive'
import { shortTxDigestLabel } from '@/frontend/lib/einsatz-explorer-url'
import { fetchForensicBatchConfig, importForensicBatchRegistryToBossApi, postForensicBatchAutoConfig } from '@/frontend/lib/api/forensic-batch-api'
import { isBossApiLikelyOnline } from '@/frontend/lib/api/boss-api-status'

export function EinsatzForensicBatchPanel(p: { apiStatus?: ApiStatus | null }) {
  const myAddress = (p.apiStatus?.myAddress ?? '').trim().toLowerCase()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [autoOn, setAutoOn] = useState(false)
  const [intervalMin, setIntervalMin] = useState<ForensicBatchAutoIntervalMin>(15)
  const [mode, setMode] = useState<ForensicBatchArchiveMode>('plaintext')
  const [registryCount, setRegistryCount] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
  const bossConfigLoaded = useRef(false)

  const preferBossApi = isBossApiLikelyOnline(p.apiStatus)

  const { lastStatus: autoStatus, bossSchedulerHint, useBossPath } =
    useForensicBatchAutoArchive({ apiStatus: p.apiStatus, enabled: autoOn })

  const refreshRegistryCount = () => setRegistryCount(countForensicBatchRegistry())

  useEffect(() => {
    setAutoOn(readForensicBatchAutoArchiveEnabled())
    setIntervalMin(readForensicBatchAutoIntervalMin())
    setMode(readForensicBatchArchiveMode())
    refreshRegistryCount()
    const onChanged = () => refreshRegistryCount()
    window.addEventListener(FORENSIC_BATCH_CHANGED, onChanged)
    return () => window.removeEventListener(FORENSIC_BATCH_CHANGED, onChanged)
  }, [])

  useEffect(() => {
    if (!preferBossApi) {
      bossConfigLoaded.current = false
      return
    }
    if (bossConfigLoaded.current) return
    void fetchForensicBatchConfig().then((cfg) => {
      if (!cfg.ok) return
      bossConfigLoaded.current = true
      const c = cfg.config
      setAutoOn(c.autoEnabled)
      writeForensicBatchAutoArchiveEnabled(c.autoEnabled)
      if (c.autoIntervalMin === 5 || c.autoIntervalMin === 15 || c.autoIntervalMin === 30) {
        setIntervalMin(c.autoIntervalMin)
        writeForensicBatchAutoIntervalMin(c.autoIntervalMin)
      }
      setMode(c.mode)
      writeForensicBatchArchiveMode(c.mode)
    })
  }, [preferBossApi, p.apiStatus?.backendRunning, p.apiStatus?.backendOnline])

  const pushBossAutoConfig = async (patch: {
    autoEnabled?: boolean
    intervalMin?: ForensicBatchAutoIntervalMin
    mode?: ForensicBatchArchiveMode
  }) => {
    if (!preferBossApi) return true
    const out = await postForensicBatchAutoConfig(patch)
    if (!out.ok) {
      setStatus(`Boss-Scheduler: ${out.error}`)
      return false
    }
    setAutoOn(out.autoEnabled)
    setIntervalMin(out.intervalMin as ForensicBatchAutoIntervalMin)
    setMode(out.mode)
    return true
  }

  const onAutoToggle = (on: boolean) => {
    setAutoOn(on)
    writeForensicBatchAutoArchiveEnabled(on)
    void pushBossAutoConfig({ autoEnabled: on, intervalMin, mode })
  }

  const onArchive = async () => {
    if (!/^0x[a-f0-9]{64}$/.test(myAddress)) {
      setStatus('Adresse fehlt — zuerst Handoff importieren oder Basis verbinden.')
      return
    }
    setBusy(true)
    setStatus('Prüfe Posteingang…')
    try {
      const preview = await previewForensicBatchArchiveFromInbox({ onlyNew: true, mode })
      if (!preview.ok) {
        setStatus(preview.error)
        return
      }
      if (preview.preview.preparedCount === 0) {
        setStatus(
          preview.preview.alreadyBatched
            ? `Alle ${preview.preview.alreadyBatched} Nachrichten sind bereits archiviert.`
            : 'Keine neuen Nachrichten zum Archivieren.'
        )
        return
      }
      setStatus(
        `${preview.preview.preparedCount} Nachrichten in ${preview.preview.plans.length} Transaktion(en) — schreibe auf Mainnet…`
      )
      const out = await runForensicBatchArchiveFromInbox({
        archiveRecipient: myAddress,
        onlyNew: true,
        mode,
        preferBossApi,
        onProgress: (m) => setStatus(m),
      })
      if (!out.ok) {
        setStatus(
          out.partialDigests?.length
            ? `${out.error} (${out.partialDigests.length} TX(s) bereits gesendet.)`
            : out.error
        )
        return
      }
      refreshRegistryCount()
      const digestNote = out.digests
        .map((d) => shortTxDigestLabel(d))
        .slice(0, 3)
        .join(', ')
      setStatus(
        `${out.messageCount} Nachrichten auf Mainnet archiviert.` +
          (digestNote ? ` TX: ${digestNote}` : '') +
          (out.alreadyBatched ? ` (${out.alreadyBatched} waren schon archiviert.)` : '')
      )
    } finally {
      setBusy(false)
    }
  }

  const onImportRegistry = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      void file.text().then(async (text) => {
        const out = importForensicBatchRegistryJson(text, 'merge')
        if (!out.ok) {
          setStatus(out.error)
          return
        }
        refreshRegistryCount()
        if (preferBossApi) {
          const sync = await importForensicBatchRegistryToBossApi(readForensicBatchRegistry(), 'merge')
          setStatus(
            sync.ok
              ? `Liste importiert (+${out.merged} lokal, +${sync.merged} Boss-PC).`
              : `Lokal +${out.merged}; Boss-PC: ${sync.error}`
          )
        } else {
          setStatus(`Liste importiert (+${out.merged}, gesamt ${out.total}).`)
        }
      })
    }
    input.click()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Layers className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <h4 className="font-semibold text-foreground">Volles Archiv (Mainnet)</h4>
          <p className="text-sm text-muted-foreground">
            Schreibt den <strong className="font-medium text-foreground">kompletten Nachrichtentext</strong> on-chain
            (bis zu 50 Nachrichten pro Transaktion). Teurer als der Kurz-Beweis unten, dafür im Explorer lesbar.
            Bereits archiviert: {registryCount} Nachrichten auf diesem Gerät bekannt.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={autoOn} onCheckedChange={(v) => onAutoToggle(v === true)} />
          <span>Automatisch{useBossPath ? ' (Boss-PC)' : ''}</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Intervall</span>
          <select
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={intervalMin}
            aria-label="Intervall"
            onChange={(e) => {
              const v = Number(e.target.value) as ForensicBatchAutoIntervalMin
              setIntervalMin(v)
              writeForensicBatchAutoIntervalMin(v)
              if (autoOn) void pushBossAutoConfig({ autoEnabled: autoOn, intervalMin: v, mode })
            }}
          >
            {FORENSIC_BATCH_AUTO_INTERVAL_OPTIONS_MIN.map((m) => (
              <option key={m} value={m}>
                alle {m} Min
              </option>
            ))}
          </select>
        </label>
        <select
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={mode}
          aria-label="Archiv-Modus"
          onChange={(e) => {
            const v = e.target.value === 'encrypted' ? 'encrypted' : 'plaintext'
            setMode(v)
            writeForensicBatchArchiveMode(v)
            if (autoOn) void pushBossAutoConfig({ autoEnabled: autoOn, intervalMin, mode: v })
          }}
        >
          <option value="plaintext">Klartext</option>
          <option value="encrypted">Verschlüsselt</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        {autoOn
          ? `Auto-Batch aktiv — alle ${intervalMin} Min${useBossPath ? ' auf dem Boss-PC' : ' in der PWA'}.`
          : 'Auto-Batch aus — nur manuell archivieren.'}
      </p>

      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={busy || !myAddress}
        onClick={() => void onArchive()}
      >
        {busy ? 'Archiviere…' : 'Neue Nachrichten archivieren'}
      </Button>

      {bossSchedulerHint ? <p className="text-xs text-muted-foreground">{bossSchedulerHint}</p> : null}
      {autoStatus ? <p className="text-xs text-muted-foreground">{autoStatus}</p> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', moreOpen && 'rotate-180')} aria-hidden />
          Geräte-Sync (Liste import/export)
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              downloadForensicBatchRegistryExport()
              refreshRegistryCount()
            }}
          >
            Liste exportieren
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onImportRegistry}>
            Liste importieren
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
