'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { setHeartbeatEnabled, setHeartbeatInterval } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const LS_STRICT_ONLINE = 'morgendrot.strictOnlineNoMeshFallback'
const LS_LORA_TX = 'morgendrot.loraTxTier'

/** Fallback wenn /api/status noch keine presetsMinutes hat (Server-Presets = Quelle der Wahrheit). */
const FALLBACK_PRESETS_MIN = [1, 5, 15, 30, 60, 120, 240, 360, 720, 1440]

function presetMs(minutes: number): number {
  return minutes * 60_000
}

function formatPresetLabel(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const h = minutes / 60
    return `${h} h`
  }
  return `${minutes} min`
}

function formatActiveInterval(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  const min = ms / 60_000
  if (min >= 60 && Math.abs(min - Math.round(min)) < 1e-6) {
    const r = Math.round(min)
    if (r % 60 === 0) return `${r / 60} h`
  }
  return `${Math.round(ms / 60_000)} min`
}

function isLikelyIotaObjectId(s: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/i.test(s.trim())
}

type IdsOverride = { myAddress: string; packageId: string; streamsAnchorId: string }

type ChatViewPulseSettingsProps = {
  apiStatus: ApiStatus
  onApplied?: () => void | Promise<void>
}

export function ChatViewPulseSettings({ apiStatus, onApplied }: ChatViewPulseSettingsProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'interval' | 'enabled' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [strictOnline, setStrictOnline] = useState(false)
  const [loraTier, setLoraTier] = useState(1)
  const [idsOverride, setIdsOverride] = useState<IdsOverride | null>(null)

  const hb = apiStatus.heartbeat
  const streams = apiStatus.streams
  const presetsMin = hb?.presetsMinutes?.length ? hb.presetsMinutes : FALLBACK_PRESETS_MIN
  const presetsShort = presetsMin.filter((m) => m < 60)
  const presetsLong = presetsMin.filter((m) => m >= 60)

  useEffect(() => {
    try {
      setStrictOnline(typeof window !== 'undefined' && window.localStorage.getItem(LS_STRICT_ONLINE) === '1')
      const t = parseInt(typeof window !== 'undefined' ? window.localStorage.getItem(LS_LORA_TX) || '1' : '1', 10)
      setLoraTier(t >= 0 && t <= 2 ? t : 1)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/current-ids')
        const j = (await res.json()) as {
          ok?: boolean
          myAddress?: string
          packageId?: string
          streamsAnchorId?: string
        }
        if (cancelled || j.ok !== true) return
        setIdsOverride({
          myAddress: (j.myAddress || '').trim(),
          packageId: (j.packageId || '').trim(),
          streamsAnchorId: (j.streamsAnchorId || '').trim(),
        })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const copy = useCallback(async (key: string, text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* ignore */
    }
  }, [])

  const applyInterval = async (minutes: number) => {
    setMsg(null)
    setBusy('interval')
    try {
      const r = await setHeartbeatInterval(presetMs(minutes))
      if (r.ok === false) {
        setMsg((r as { error?: string; message?: string }).error || (r as { message?: string }).message || 'Fehler')
        return
      }
      setMsg(`Intervall: ${formatPresetLabel(minutes)}`)
      await onApplied?.()
    } finally {
      setBusy(null)
    }
  }

  const applyEnabled = async (enabled: boolean) => {
    setMsg(null)
    setBusy('enabled')
    try {
      const r = await setHeartbeatEnabled(enabled)
      if (r.ok === false) {
        setMsg((r as { error?: string; message?: string }).error || (r as { message?: string }).message || 'Fehler')
        return
      }
      setMsg(enabled ? 'Puls aktiv' : 'Puls aus (Stille)')
      await onApplied?.()
    } finally {
      setBusy(null)
    }
  }

  const onStrictChange = (v: boolean) => {
    setStrictOnline(v)
    try {
      window.localStorage.setItem(LS_STRICT_ONLINE, v ? '1' : '0')
    } catch {
      /* ignore */
    }
    setMsg(
      v
        ? 'Strikt: Bei Transport „Online“ kein automatischer Wechsel auf LoRa, wenn IOTA/RPC fehlschlägt.'
        : 'Standard: Online fehlgeschlagen → bei verbundenem Heltec automatisch Funk-Fallback.'
    )
  }

  const onLoraTierChange = (vals: number[]) => {
    const t = vals[0] ?? 1
    setLoraTier(t)
    try {
      window.localStorage.setItem(LS_LORA_TX, String(t))
    } catch {
      /* ignore */
    }
  }

  const anchorFull = (streams?.anchorIdFull?.trim() || idsOverride?.streamsAnchorId || '').trim()
  const addrFull = (apiStatus.myAddressFull?.trim() || idsOverride?.myAddress || '').trim()
  const pkgFull = (apiStatus.packageId?.trim() || idsOverride?.packageId || '').trim()

  const intervalMatches = (m: number) =>
    hb?.intervalMs != null && Math.abs(hb.intervalMs - presetMs(m)) < 2

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/35"
        >
          <span>IDs zum Kopieren · Puls · Funk (Vortrupp)</span>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-4 rounded-lg border border-border/60 bg-card/50 px-3 py-3 text-xs">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Werte kommen aus dem Backend (<span className="font-mono">/api/status</span>, beim Öffnen zusätzlich{' '}
          <span className="font-mono">/api/current-ids</span>). Hier <strong className="text-foreground">nur kopieren</strong> – Bearbeitung von
          Anchor/Package bleibt in der <strong className="text-foreground">.env</strong> / am Server.
        </p>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-foreground">Explorer / Prüfen</p>
          <CopyRow
            label="Streams-Anchor (Objekt-ID)"
            value={anchorFull}
            invalid={!!anchorFull && !isLikelyIotaObjectId(anchorFull)}
            invalidHint="Erwartet: 0x + 64 Hex (IOTA-Objekt-ID). Sonst Explorer/Streams unzuverlässig."
            hint="Explorer: Objekt-ID einfügen und Transaktionen/Channel prüfen."
            copied={copied === 'anchor'}
            onCopy={() => void copy('anchor', anchorFull)}
          />
          <CopyRow
            label="Eigene Adresse"
            value={addrFull}
            invalid={!!addrFull && !isLikelyIotaObjectId(addrFull)}
            invalidHint="Erwartet: 0x + 64 Hex. Nach Wallet-Entsperren laden – oder MY_ADDRESS in .env setzen."
            hint="Wallet-Adresse (z. B. Explorer, Handshake)."
            copied={copied === 'addr'}
            onCopy={() => void copy('addr', addrFull)}
          />
          <CopyRow
            label="Package-ID (Move)"
            value={pkgFull}
            invalid={!!pkgFull && !isLikelyIotaObjectId(pkgFull)}
            invalidHint="Erwartet: 0x + 64 Hex (deployte Package-ID)."
            hint="Mailbox / Move-Bezug."
            copied={copied === 'pkg'}
            onCopy={() => void copy('pkg', pkgFull)}
          />
        </div>

        <div className="space-y-2 border-t border-border/50 pt-3">
          <p className="text-[11px] font-semibold text-foreground">Heartbeat-Intervall (nur Presets)</p>
          {hb?.intervalMatchesPreset === false && (
            <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-950 dark:text-amber-100/90">
              Aktuelles Intervall aus der Konfiguration ist <strong>kein</strong> Standard-Preset – bitte unten ein Preset wählen.
            </p>
          )}
          {presetsShort.length > 0 && (
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Minuten</p>
          )}
          <div className="flex flex-wrap gap-2">
            {presetsShort.map((m) => (
              <Button
                key={`m-${m}`}
                type="button"
                size="sm"
                variant={intervalMatches(m) ? 'default' : 'outline'}
                className={cn('h-8 text-xs', intervalMatches(m) && 'ring-2 ring-primary/40')}
                disabled={busy !== null}
                onClick={() => void applyInterval(m)}
              >
                {formatPresetLabel(m)}
              </Button>
            ))}
          </div>
          {presetsLong.length > 0 && (
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Stunden (Akku schonen)</p>
          )}
          <div className="flex flex-wrap gap-2">
            {presetsLong.map((m) => (
              <Button
                key={`h-${m}`}
                type="button"
                size="sm"
                variant={intervalMatches(m) ? 'default' : 'outline'}
                className={cn('h-8 text-xs', intervalMatches(m) && 'ring-2 ring-primary/40')}
                disabled={busy !== null}
                onClick={() => void applyInterval(m)}
              >
                {formatPresetLabel(m)}
              </Button>
            ))}
          </div>
          {hb?.intervalMs != null && (
            <p className="text-[11px] text-muted-foreground">
              Aktiv: <span className="font-mono text-foreground">{formatActiveInterval(hb.intervalMs)}</span> ({hb.intervalMs} ms)
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold text-foreground">Privacy: Puls stumm</p>
            <p className="text-[11px] text-muted-foreground">Stoppt automatische Heartbeats (Basis sieht weniger Lebenszeichen).</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{hb?.enabled ? 'An' : 'Aus'}</span>
            <Switch
              checked={hb?.enabled === true}
              disabled={busy !== null}
              onCheckedChange={(v) => void applyEnabled(v)}
              aria-label="Heartbeat aktivieren"
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-border/50 pt-3">
          <p className="text-[11px] font-semibold text-foreground">Hybrid-Versand (Chat)</p>
          <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <p className="mb-1.5 text-foreground/90">
              Betrifft nur Nachrichten mit Transport <strong className="text-foreground">Online</strong> (IOTA/Mailbox), nicht den Heartbeat über Streams.
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong className="text-foreground">Aus (Standard):</strong> Schlägt Online fehl und Heltec ist verbunden, wird versucht, denselben Inhalt über{' '}
                <strong className="text-foreground">LoRa/Mesh</strong> zu senden (Fallback).
              </li>
              <li>
                <strong className="text-foreground">Strikt ohne Funk-Fallback an:</strong> Bei Online-Fehler <strong className="text-foreground">kein</strong> automatischer Wechsel auf Funk – z. B. wenn Funkspuren vermieden werden sollen oder nur die Internet-Route erlaubt ist. Dann Fehler anzeigen oder Transport manuell auf „funk“ stellen.
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] text-muted-foreground">Strikt ohne Funk-Fallback bei „Online“</span>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={strictOnline} onCheckedChange={onStrictChange} aria-label="Kein Funk-Fallback bei Online" />
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-border/50 pt-3">
          <p className="text-[11px] font-semibold text-foreground">LoRa Sendeleistung (Vorbereitung)</p>
          <p className="text-[11px] text-muted-foreground">
            Eco → Boost (z. B. bis 22 dBm je nach Firmware). Wert wird lokal gespeichert; Anbindung an Meshtastic/Radio folgt der Geräte-Software – nicht jedes Build setzt die Hardware hier um.
          </p>
          <Slider
            value={[loraTier]}
            onValueChange={onLoraTierChange}
            min={0}
            max={2}
            step={1}
            className="w-full max-w-md"
          />
          <div className="flex max-w-md justify-between font-mono text-[10px] text-muted-foreground">
            <span>Eco</span>
            <span>Normal</span>
            <span>Boost</span>
          </div>
        </div>

        {msg && <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{msg}</p>}
      </CollapsibleContent>
    </Collapsible>
  )
}

function CopyRow(p: {
  label: string
  value: string
  hint: string
  copied: boolean
  onCopy: () => void
  invalid?: boolean
  invalidHint?: string
}) {
  const has = p.value.length > 0
  return (
    <div className="rounded-md border border-border/60 bg-muted/15 px-2 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-foreground">{p.label}</p>
          <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">{has ? p.value : '— (nicht gesetzt)'}</p>
          {p.invalid && p.invalidHint && (
            <p className="mt-1 text-[10px] text-amber-800 dark:text-amber-200/90">{p.invalidHint}</p>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground">{p.hint}</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          disabled={!has}
          onClick={p.onCopy}
          aria-label={`${p.label} kopieren`}
        >
          {p.copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
