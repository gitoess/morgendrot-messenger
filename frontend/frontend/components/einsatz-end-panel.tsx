'use client'

import { useMemo, useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { ApiStatus } from '@/frontend/lib/api'
import { resolveActiveEinsatzChainMode } from '@/frontend/lib/einsatz-chain-mode-local'
import { performEinsatzEndCacheWipe } from '@/frontend/lib/einsatz-end-cache-wipe'
import { runEinsatzManifestAnchorFlow } from '@/frontend/lib/einsatz-manifest-anchor-flow'
import { explorerTxUrlForMainnetAnchor, shortTxDigestLabel } from '@/frontend/lib/einsatz-explorer-url'

export type EinsatzEndPanelProps = {
  backendOnline?: boolean
  apiStatus?: ApiStatus | null
  compact?: boolean
  onCompleted?: () => void
}

export function EinsatzEndPanel(p: EinsatzEndPanelProps) {
  const chainMode = resolveActiveEinsatzChainMode()
  const showMainnetAnchorOption = chainMode === 'testnet-with-mainnet-anchor'
  const rpcHint = p.apiStatus?.rpcUrlLabel || p.apiStatus?.network

  const [busy, setBusy] = useState(false)
  const [clearQueues, setClearQueues] = useState(true)
  const [mainnetAnchor, setMainnetAnchor] = useState(showMainnetAnchorOption)
  const [status, setStatus] = useState('')
  const [anchorDigest, setAnchorDigest] = useState('')

  const anchorHint = useMemo(() => {
    if (!showMainnetAnchorOption) return ''
    return 'Baut die Zusammenfassung, speichert den Hash auf Mainnet und legt optional eine JSON-Datei ab.'
  }, [showMainnetAnchorOption])

  const handleEndEinsatz = async () => {
    if (
      !window.confirm(
        'Lokale Einsatz-Daten auf diesem Gerät löschen?\n\n' +
          'Posteingang-Cache, Filter und gespeicherte Einsatz-IDs werden entfernt. ' +
          'Nichts auf der Chain. Wallet und Tresor bleiben.\n\n' +
          (mainnetAnchor && showMainnetAnchorOption
            ? 'Zuvor: Mainnet-Anker (falls möglich).\n\n'
            : '') +
          'Danach neues Handoff importieren.'
      )
    ) {
      return
    }
    setBusy(true)
    setStatus('')
    setAnchorDigest('')

    let digestFromAnchor = ''
    if (mainnetAnchor && showMainnetAnchorOption) {
      const anchor = await runEinsatzManifestAnchorFlow({
        apiStatus: p.apiStatus,
        chainMode,
        rpcHint,
        downloadJson: true,
        anchorOnChain: true,
      })
      if (!anchor.ok) {
        setBusy(false)
        setStatus(`Mainnet-Anker fehlgeschlagen: ${anchor.error}`)
        return
      }
      if (anchor.digest) {
        digestFromAnchor = anchor.digest
        setAnchorDigest(anchor.digest)
      }
    }

    const res = await performEinsatzEndCacheWipe({
      clearServerInbox: p.backendOnline === true,
      clearTransportQueues: clearQueues,
    })
    setBusy(false)
    if (!res.ok && res.serverError) {
      setStatus(`Lokal geleert; Server-Cache: ${res.serverError}`)
    } else {
      const anchorNote = digestFromAnchor
        ? ' Mainnet-Anker bleibt on-chain.'
        : mainnetAnchor && showMainnetAnchorOption
          ? ' Manifest gespeichert (ohne Chain-Digest).'
          : ''
      setStatus(`Einsatz lokal beendet.${anchorNote} Neues Handoff importieren (Einstellungen).`)
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
          <div className="min-w-0 space-y-2">
            <h4 className="font-semibold text-foreground">Einsatz beenden</h4>
            <p className="text-sm text-muted-foreground">
              Löscht <strong className="font-medium text-foreground">nur Daten auf diesem Gerät</strong> (Posteingang-Cache,
              Filter, Einsatz-IDs). Wallet und Tresor bleiben. Chain-Einträge auf Mainnet bleiben unberührt.
            </p>
            <p className="text-xs text-muted-foreground">
              Optional vorher einen Kurz-Beweis schreiben (wie unter Erweitert → Kurz-Beweis). Danach neues Handoff
              importieren.
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

      {showMainnetAnchorOption ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="einsatz-end-mainnet-anchor"
              checked={mainnetAnchor}
              onCheckedChange={(v) => setMainnetAnchor(v === true)}
              disabled={busy}
            />
            <Label htmlFor="einsatz-end-mainnet-anchor" className="text-sm font-normal cursor-pointer">
              Vorher Kurz-Beweis auf Mainnet speichern
            </Label>
          </div>
          {anchorHint ? <p className="text-xs text-muted-foreground">{anchorHint}</p> : null}
        </div>
      ) : null}

      <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void handleEndEinsatz()}>
        {busy ? 'Beende…' : 'Einsatz beenden'}
      </Button>

      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      {anchorDigest ? (
        <p className="text-xs">
          <a
            href={explorerTxUrlForMainnetAnchor(anchorDigest)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Mainnet-Anker: {shortTxDigestLabel(anchorDigest)}
          </a>
        </p>
      ) : null}
    </div>
  )
}
