'use client'

import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Message } from '@/frontend/lib/types'
import {
  anchorEinsatzprotokollOnIota,
  type ProtokollAnchorScope,
} from '@/frontend/lib/einsatzprotokoll-anchor'

type ScopeMode = 'all' | 'ids' | 'range'

export function ChatViewProtokollAnchorButton(p: {
  messageCount: number
  messages: readonly Message[]
  myAddress: string
  recipient: string
  apiConnected: boolean
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
}) {
  const { messageCount, messages, myAddress, recipient, apiConnected, setStatus, setStatusMsg } = p
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [variant, setVariant] = useState<'hash' | 'full'>('hash')
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all')
  const [idsText, setIdsText] = useState('')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [ackFull, setAckFull] = useState(false)

  function buildScope(): ProtokollAnchorScope | { error: string } {
    if (scopeMode === 'all') return { kind: 'all' }
    if (scopeMode === 'ids') {
      const ids = idsText
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter(Boolean)
      if (!ids.length) return { error: 'Mindestens eine Nachrichten-ID angeben.' }
      return { kind: 'ids', ids }
    }
    const a = rangeFrom ? Date.parse(rangeFrom) : NaN
    const b = rangeTo ? Date.parse(rangeTo) : NaN
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return { error: 'Zeitraum: gültiges Von- und Bis-Datum wählen.' }
    }
    if (a > b) return { error: '„Von“ muss vor „Bis“ liegen.' }
    return { kind: 'range', fromMs: a, toMs: b }
  }

  async function runAnchor() {
    const sc = buildScope()
    if ('error' in sc) {
      setStatus('error')
      setStatusMsg(sc.error)
      setTimeout(() => setStatus('idle'), 6000)
      return
    }
    if (variant === 'full' && !ackFull) {
      setStatus('error')
      setStatusMsg('Variante B: bitte die Checkbox bestätigen.')
      setTimeout(() => setStatus('idle'), 6000)
      return
    }
    const rec = recipient.trim() || myAddress.trim()
    if (variant === 'hash' && !rec) {
      setStatus('error')
      setStatusMsg('Für Hash-Anker: Empfänger-Adresse setzen (oder eigene Adresse).')
      setTimeout(() => setStatus('idle'), 7000)
      return
    }
    setBusy(true)
    try {
      const r = await anchorEinsatzprotokollOnIota({
        variant,
        messages,
        scope: sc,
        exportedByAddress: myAddress,
        recipientForPlain: rec,
      })
      if (r.ok) {
        setOpen(false)
        setStatus('success')
        setStatusMsg(
          variant === 'hash'
            ? 'Hash-Anker per /send-plain gesendet (Explorer).'
            : 'Vollbericht verschlüsselt (/send) verarbeitet.'
        )
        setTimeout(() => setStatus('idle'), 7000)
      } else {
        setStatus('error')
        setStatusMsg(r.error)
        setTimeout(() => setStatus('idle'), 9000)
      }
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 8000)
    } finally {
      setBusy(false)
    }
  }

  const anchorDisabled = messageCount === 0 || !apiConnected
  const anchorTitle =
    messageCount === 0
      ? 'Keine Nachrichten zum Verankern.'
      : !apiConnected
        ? 'Braucht API-Verbindung (/connect) und entsperrten Tresor (nicht locked).'
        : 'Hash oder Vollbericht auf IOTA verankern'

  return (
    <>
      <button
        type="button"
        disabled={anchorDisabled}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        title={anchorTitle}
      >
        <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Protokoll auf Chain verankern
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Protokoll auf Chain verankern</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Standard ist <strong className="text-foreground">Variante A</strong> (nur Hash) – günstig und reicht für
              einen zeitlichen Nachweis.
            </p>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label className="mb-2 block text-foreground">Variante</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setVariant('hash')
                    setAckFull(false)
                  }}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left text-xs transition-colors',
                    variant === 'hash'
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-foreground'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <span className="font-semibold text-foreground">A — Nur Hash</span>
                  <span className="mt-1 block text-[11px] leading-snug">
                    Empfohlen: SHA-256 über den Auszug, öffentlich per /send-plain. Günstig, manipulationssicherer
                    Existenznachweis.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setVariant('full')}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left text-xs transition-colors',
                    variant === 'full'
                      ? 'border-amber-500/60 bg-amber-500/10 text-foreground'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <span className="font-semibold text-foreground">B — Vollbericht</span>
                  <span className="mt-1 block text-[11px] leading-snug">
                    Gesamtes JSON (verschlüsselt /send). Nur wenn du wirklich alles on-chain brauchst.
                  </span>
                </button>
              </div>
            </div>

            {variant === 'hash' && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:text-amber-100/90">
                Der Hash erscheint als <strong>Klartext</strong> in der Chain – Inhalte der Nachrichten sind nicht
                lesbar, nur der Hash ist der Nachweis.
              </p>
            )}

            {variant === 'full' && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2.5 text-xs text-red-50">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={ackFull}
                  onChange={(e) => setAckFull(e.target.checked)}
                />
                <span>
                  <strong>Variante B bestätigen:</strong> Sehr teuer und groß – wirklich den vollständigen Bericht
                  (alle Nachrichten inkl. Inhalt) auf Chain speichern? Ich habe die Kosten- und Größenrisiken
                  verstanden.
                </span>
              </label>
            )}

            <div>
              <Label className="text-foreground">Umfang</Label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-foreground"
                value={scopeMode}
                onChange={(e) => setScopeMode(e.target.value as ScopeMode)}
              >
                <option value="all">Gesamter Posteingang</option>
                <option value="ids">Nur bestimmte Nachrichten-IDs</option>
                <option value="range">Zeitraum (lokal)</option>
              </select>
            </div>

            {scopeMode === 'ids' && (
              <div>
                <Label className="text-foreground">IDs (kommagetrennt)</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-xs text-foreground"
                  rows={3}
                  value={idsText}
                  onChange={(e) => setIdsText(e.target.value)}
                  placeholder="id1, id2, …"
                />
              </div>
            )}

            {scopeMode === 'range' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-foreground">Von</Label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-foreground"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-foreground">Bis</Label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-foreground"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                  />
                </div>
              </div>
            )}

            {variant === 'hash' && (
              <p className="text-[11px] text-muted-foreground">
                Empfänger für /send-plain:{' '}
                <span className="font-mono">{recipient.trim() || myAddress || '(—)'}</span> – leer = eigene Adresse.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="button" onClick={() => void runAnchor()} disabled={busy}>
              {busy ? '…' : 'Verankern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
