'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { setHeartbeatEnabled, setHeartbeatInterval } from '@/frontend/lib/api'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  getConfiguredDirectIotaRpcUrl,
  probeBrowserDirectIotaIfConfigured,
  sanitizeDirectIotaRpcUrl,
  setBrowserDirectIotaRpcUrlOverride,
} from '@/frontend/lib/direct-iota-rpc'
import {
  applyDirectMailboxChainSnapshotFromNetworkIds,
  loadDirectMailboxChainSnapshotFromLs,
  persistDirectMailboxChainSnapshot,
  persistDirectMailboxTtlDays,
} from '@/frontend/lib/direct-iota-chain-context'
import { isLikelyIotaHexId } from '@morgendrot/core/iota'
import {
  applyDirectIotaMnemonicSession,
  clearDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  applyDirectChatEcdhPrivateJwk,
  clearDirectChatEcdhPrivateKey,
  clearDirectChatEcdhPeerPubs,
  getDirectChatEcdhPrivateKey,
  setDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'
import {
  getIotaSubmitMode,
  isDirectMailboxDrainEnabled,
  setDirectMailboxDrainEnabled,
  setIotaSubmitMode,
  type IotaSubmitMode,
} from '@/frontend/lib/direct-iota-plain-submit'

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

/** Leerzeichen / Zero-Width entfernen; Kleinbuchstaben für 0x-Hex (Copy-Paste von Explorern). */
function normalizeIotaHexInput(s: string): string {
  return String(s || '')
    .trim()
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/^0X/i, '0x')
}

function isLikelyIotaObjectId(s: string): boolean {
  return isLikelyIotaHexId(normalizeIotaHexInput(s))
}

type IdsOverride = { myAddress: string; packageId: string; streamsAnchorId: string; mailboxId: string }

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
  const [directRpcUrl, setDirectRpcUrl] = useState('')
  const [directRpcProbe, setDirectRpcProbe] = useState<'idle' | 'ok' | 'err' | 'checking'>('idle')
  const [directDrainOn, setDirectDrainOn] = useState(false)
  const [ttlDaysStr, setTtlDaysStr] = useState('30')
  /** Direkt-Pfad: Package / Mailbox / Absender — editierbar ohne /api/current-ids (Handy-first Bootstrap). */
  const [chainPkg, setChainPkg] = useState('')
  const [chainMb, setChainMb] = useState('')
  const [chainAddr, setChainAddr] = useState('')
  /** Wenn an: Flags für Klartext-Direktdrain schätzen (Mailbox+Klartext an, keine Messenger-Credits) — nötig wenn Basis offline. */
  const [optimisticDrainFlags, setOptimisticDrainFlags] = useState(false)
  const [mnemoInput, setMnemoInput] = useState('')
  const [sessionAddr, setSessionAddr] = useState<string | null>(null)
  const [ecdhPeerAddr, setEcdhPeerAddr] = useState('')
  const [ecdhPeerB64, setEcdhPeerB64] = useState('')
  const [ecdhJwkInput, setEcdhJwkInput] = useState('')
  const [ecdhPrivActive, setEcdhPrivActive] = useState(false)
  const [iotaSubmitMode, setIotaSubmitModeState] = useState<IotaSubmitMode>('client')

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
      setDirectRpcUrl(getConfiguredDirectIotaRpcUrl() || '')
      setDirectDrainOn(isDirectMailboxDrainEnabled())
      setIotaSubmitModeState(getIotaSubmitMode())
      setSessionAddr(getDirectIotaSessionSignerAddress())
      setEcdhPrivActive(getDirectChatEcdhPrivateKey() != null)
      const snap = loadDirectMailboxChainSnapshotFromLs()
      if (snap) {
        setTtlDaysStr(String(snap.ttlDays))
        setChainPkg(snap.packageId)
        setChainMb(snap.mailboxId)
        setChainAddr(snap.senderAddress)
      }
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
          mailboxId?: string
        }
        if (cancelled || j.ok !== true) return
        const pkg = (j.packageId || '').trim()
        const mb = (j.mailboxId || '').trim()
        const addr = (j.myAddress || '').trim()
        setIdsOverride({
          myAddress: addr,
          packageId: pkg,
          streamsAnchorId: (j.streamsAnchorId || '').trim(),
          mailboxId: mb,
        })
        if (pkg) setChainPkg(pkg)
        if (mb) setChainMb(mb)
        if (addr) setChainAddr(addr)
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

  const onIotaSubmitModeChange = (v: string) => {
    const m: IotaSubmitMode = v === 'relay' ? 'relay' : 'client'
    setIotaSubmitMode(m)
    setIotaSubmitModeState(m)
    if (m === 'relay') {
      setDirectMailboxDrainEnabled(false)
      setDirectDrainOn(false)
      setMsg('Nur Morgendrot-API: Direkt-Mailbox-Drain aus.')
    } else {
      setMsg('Direkt (Standard): Direkt-Pfad möglich — Drain bei Bedarf einschalten.')
    }
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
          <span className="font-mono">/api/current-ids</span>), falls erreichbar. Zum <strong className="text-foreground">Kopieren</strong> die Zeilen
          unten. Für <strong className="text-foreground">Direkt-IOTA ohne dauernd erreichbare Basis</strong>: Ketten-IDs im Abschnitt{' '}
          <strong className="text-foreground">„Direkt-RPC“</strong> eintragen und dort in <span className="font-mono">localStorage</span> speichern
          (siehe Handbuch / Architektur H.15).
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

        <div className="space-y-3 border-t border-border/50 pt-3">
          <p className="text-[11px] font-semibold text-foreground">IOTA-Sendeweg (Handy-first, § H.15)</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Direkt</strong> = Klartext- und (mit ECDH) verschlüsselte Mailbox zuerst über Fullnode + Signer; bei Fehler{' '}
            <strong className="text-foreground">Fallback</strong> über <span className="font-mono">/api</span>, wenn die Basis online ist.{' '}
            <strong className="text-foreground">Nur Morgendrot-API</strong> = kein direkter RPC-Upload; nur Relay. Schalter auch unter{' '}
            <strong className="text-foreground">Einstellungen → IOTA auf diesem Gerät</strong>. Gespeichert:{' '}
            <span className="font-mono">morgendrot.iotaSubmitMode</span> (<span className="font-mono">relay</span> oder leer ={' '}
            <span className="font-mono">client</span>).
          </p>
          <RadioGroup
            className="grid gap-2"
            value={iotaSubmitMode}
            onValueChange={onIotaSubmitModeChange}
            disabled={busy !== null}
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem value="client" id="iota-mode-client" className="mt-0.5" aria-label="Direkt Standard" />
              <Label htmlFor="iota-mode-client" className="cursor-pointer text-[11px] font-normal leading-snug">
                Direkt mit IOTA (Standard)
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="relay" id="iota-mode-relay" className="mt-0.5" aria-label="Nur Morgendrot API" />
              <Label htmlFor="iota-mode-relay" className="cursor-pointer text-[11px] font-normal leading-snug">
                Nur Morgendrot-API (<span className="font-mono">/api</span>)
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-3 border-t border-border/50 pt-3">
          <p className="text-[11px] font-semibold text-foreground">Direkt-RPC (IOTA Fullnode, ohne Morgendrot-API-Pflicht)</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Für die <strong className="text-foreground">Mailbox-Warteschlange</strong>: RPC + Session-Signer + gespeicherte Package/Mailbox/Absender. Klartext und (mit ECDH-Material) Verschlüsseltes zuerst direkt; scheitert der RPC-Versand, wird <span className="font-mono">/api</span> versucht, wenn die Basis erreichbar ist.
          </p>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Fullnode-URL (https://…)</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                className="h-9 font-mono text-xs"
                value={directRpcUrl}
                onChange={(e) => setDirectRpcUrl(e.target.value)}
                placeholder="https://api.testnet.iota.cafe"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 text-xs"
                  disabled={busy !== null}
                  onClick={() => {
                    try {
                      const t = directRpcUrl.trim()
                      if (!t) setBrowserDirectIotaRpcUrlOverride(null)
                      else {
                        sanitizeDirectIotaRpcUrl(t)
                        setBrowserDirectIotaRpcUrlOverride(t)
                      }
                      setMsg(t ? 'Direkt-RPC-URL gespeichert (localStorage).' : 'Direkt-RPC-Override entfernt.')
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : String(e))
                    }
                  }}
                >
                  URL speichern
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs"
                  disabled={busy !== null || directRpcProbe === 'checking'}
                  onClick={() => {
                    void (async () => {
                      setDirectRpcProbe('checking')
                      try {
                        const ok = await probeBrowserDirectIotaIfConfigured()
                        setDirectRpcProbe(ok ? 'ok' : 'err')
                        setMsg(ok ? 'Direkt-RPC: Fullnode antwortet.' : 'Direkt-RPC: keine Antwort oder nicht konfiguriert.')
                      } catch {
                        setDirectRpcProbe('err')
                        setMsg('Direkt-RPC: Prüfung fehlgeschlagen.')
                      }
                    })()
                  }}
                >
                  Erreichbarkeit prüfen
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Status:{' '}
              {directRpcProbe === 'idle' && '—'}
              {directRpcProbe === 'checking' && '…'}
              {directRpcProbe === 'ok' && <span className="text-emerald-600 dark:text-emerald-400">OK</span>}
              {directRpcProbe === 'err' && <span className="text-amber-700 dark:text-amber-300">Fehler / nicht konfiguriert</span>}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold text-foreground">Direkt-Mailbox-Drain (Klartext)</p>
              <p className="text-[10px] text-muted-foreground">
                Warteschlange: Klartext per IOTA-RPC + Signer; Basis darf aus sein. Flags (Mailbox-Klartext, ohne Credits) aus letztem <span className="font-mono">/api/status</span> oder localStorage.
              </p>
            </div>
            <Switch
              checked={directDrainOn}
              disabled={busy !== null || iotaSubmitMode === 'relay'}
              onCheckedChange={(v) => {
                setDirectDrainOn(v)
                setDirectMailboxDrainEnabled(v)
                setMsg(v ? 'Direkt-Mailbox-Drain an — Mnemonic + Ketten-IDs nötig.' : 'Direkt-Mailbox-Drain aus.')
              }}
              aria-label="Direkt-Mailbox-Drain"
            />
          </div>
          <div className="grid max-w-md grid-cols-[1fr_4rem] items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">TTL (Tage, Move)</Label>
              <Input
                className="h-9 font-mono text-xs"
                value={ttlDaysStr}
                onChange={(e) => setTtlDaysStr(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9 text-xs"
              disabled={busy !== null}
              onClick={() => {
                const n = parseInt(ttlDaysStr, 10)
                if (!Number.isFinite(n) || n < 1 || n > 3650) {
                  setMsg('TTL: 1–3650 Tage.')
                  return
                }
                persistDirectMailboxTtlDays(BigInt(n))
                setMsg(`TTL ${n} Tage gespeichert.`)
              }}
            >
              TTL setzen
            </Button>
          </div>
          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[11px] font-semibold text-foreground">Ketten-IDs (Package, Mailbox, eigene Adresse)</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Für Direkt-Klartext ohne dauernd erreichbare Basis: IDs manuell eintragen oder — wenn die Basis antwortet — beim Öffnen dieses Panels per{' '}
              <span className="font-mono">/api/current-ids</span> befüllen, dann hier speichern.
            </p>
            <div className="grid max-w-lg gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Package-ID</Label>
                <Input
                  className="h-9 font-mono text-xs"
                  value={chainPkg}
                  onChange={(e) => setChainPkg(e.target.value)}
                  spellCheck={false}
                  placeholder="0x…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Mailbox-ID</Label>
                <Input
                  className="h-9 font-mono text-xs"
                  value={chainMb}
                  onChange={(e) => setChainMb(e.target.value)}
                  spellCheck={false}
                  placeholder="0x…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Absender (IOTA-Adresse / Objekt)</Label>
                <Input
                  className="h-9 font-mono text-xs"
                  value={chainAddr}
                  onChange={(e) => setChainAddr(e.target.value)}
                  spellCheck={false}
                  placeholder="0x…"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-[10px] leading-snug text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={optimisticDrainFlags}
                onChange={(e) => setOptimisticDrainFlags(e.target.checked)}
              />
              <span>
                Flags für Klartext-Direktdrain <strong className="text-foreground">schätzen</strong> (Mailbox an, Klartext erlaubt,{' '}
                <strong className="text-foreground">ohne</strong> Messenger-Credits) — aktivieren, wenn <span className="font-mono">/api/status</span> zuletzt
                nicht verfügbar war oder die Kette anders konfiguriert ist.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                disabled={busy !== null}
                onClick={() => {
                  const pkg = (idsOverride?.packageId || '').trim()
                  const mb = (idsOverride?.mailboxId || '').trim()
                  const addr = (idsOverride?.myAddress || '').trim()
                  if (!pkg && !mb && !addr) {
                    setMsg('Keine API-IDs im Puffer — Basis verbinden und Panel erneut öffnen, oder manuell eintragen.')
                    return
                  }
                  if (pkg) setChainPkg(pkg)
                  if (mb) setChainMb(mb)
                  if (addr) setChainAddr(addr)
                  setMsg('Felder aus letztem /api/current-ids übernommen (noch nicht gespeichert).')
                }}
              >
                Felder aus API füllen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                disabled={busy !== null}
                onClick={() => {
                  const pkg = normalizeIotaHexInput(chainPkg)
                  const mb = normalizeIotaHexInput(chainMb)
                  const addr = normalizeIotaHexInput(chainAddr)
                  if (!isLikelyIotaHexId(pkg) || !isLikelyIotaHexId(mb) || !isLikelyIotaHexId(addr)) {
                    setMsg(
                      'Ketten-IDs: je genau 0x + 64 Hex (Package, Mailbox, eigene Adresse). Leerzeichen entfernen; ggf. „Felder aus API füllen“.'
                    )
                    return
                  }
                  const ttlN = parseInt(ttlDaysStr, 10)
                  const ttl = BigInt(Number.isFinite(ttlN) && ttlN > 0 && ttlN <= 3650 ? ttlN : 30)
                  const flags = optimisticDrainFlags
                    ? { useMailbox: true, mailboxStorePlaintext: true, messengerCreditsConfigured: false }
                    : {
                        useMailbox: apiStatus.useMailbox === true,
                        mailboxStorePlaintext: apiStatus.mailboxStorePlaintext === true,
                        messengerCreditsConfigured: apiStatus.messengerCreditsConfigured === true,
                      }
                  persistDirectMailboxChainSnapshot({
                    packageId: pkg,
                    mailboxId: mb,
                    senderAddress: addr,
                    ttlDays: ttl,
                    flags,
                  })
                  setChainPkg(pkg)
                  setChainMb(mb)
                  setChainAddr(addr)
                  let out = 'Ketten-IDs für Direkt-Pfad gespeichert (localStorage).'
                  if (!optimisticDrainFlags && flags.messengerCreditsConfigured) {
                    out += ' Hinweis: Messenger-Credits aktiv — Klartext-Direkt-Drain bleibt geblockt, bis die Kette ohne Credits läuft oder du die Flags schätzt.'
                  }
                  setMsg(out)
                }}
              >
                Ketten-IDs speichern
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Session-Signer (Mnemonic / Secret — nur RAM)</Label>
            <textarea
              className="min-h-[72px] w-full max-w-lg rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[11px] text-foreground"
              value={mnemoInput}
              onChange={(e) => setMnemoInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="Nicht persistieren — nach Schließen der Seite weg."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                disabled={busy !== null}
                onClick={() => {
                  const r = applyDirectIotaMnemonicSession(mnemoInput)
                  if (r.ok) {
                    setSessionAddr(r.address)
                    setMnemoInput('')
                    setMsg(`Signer aktiv: ${r.address.slice(0, 10)}…`)
                  } else {
                    setMsg(r.error)
                  }
                }}
              >
                Signer anwenden
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={busy !== null}
                onClick={() => {
                  clearDirectIotaSessionSigner()
                  setSessionAddr(null)
                  setMsg('Session-Signer gelöscht.')
                }}
              >
                Signer löschen
              </Button>
            </div>
            {sessionAddr && (
              <p className="text-[10px] font-mono text-muted-foreground">
                Aktiver Signer: <span className="text-foreground">{sessionAddr}</span>
              </p>
            )}
          </div>
          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[11px] font-semibold text-foreground">Chat-ECDH (verschlüsselter Direkt-Drain / Warteschlange)</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              P-256 wie `/send` auf der Basis: **Peer-Publickey** (raw 65 B, Base64) pro Empfänger in{' '}
              <span className="font-mono">localStorage</span>; **Privatkey** nur als JWK im RAM (nicht persistieren). Wenn
              beides gesetzt ist, kann die Mailbox-Warteschlange verschlüsselte Einträge per Fullnode drainen — ohne erneutes
              `/api/command`.
            </p>
            <div className="grid max-w-lg gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Empfänger (0x…)</Label>
                <Input
                  className="h-9 font-mono text-xs"
                  value={ecdhPeerAddr}
                  onChange={(e) => setEcdhPeerAddr(e.target.value)}
                  spellCheck={false}
                  placeholder="0x…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Peer-Pub (Base64, raw 65 Byte)</Label>
                <Input
                  className="h-9 font-mono text-xs"
                  value={ecdhPeerB64}
                  onChange={(e) => setEcdhPeerB64(e.target.value)}
                  spellCheck={false}
                  placeholder="Aus Handshake / Node-Export"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                disabled={busy !== null}
                onClick={() => {
                  const r = setDirectChatEcdhPeerPubBase64(ecdhPeerAddr, ecdhPeerB64)
                  if (r.ok) {
                    setMsg(ecdhPeerB64.trim() ? 'Peer-Pub gespeichert (localStorage).' : 'Peer-Pub für diese Adresse entfernt.')
                  } else {
                    setMsg(r.error)
                  }
                }}
              >
                Peer-Pub speichern
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={busy !== null}
                onClick={() => {
                  clearDirectChatEcdhPeerPubs()
                  setEcdhPeerB64('')
                  setMsg('Alle gespeicherten Peer-Pubs gelöscht.')
                }}
              >
                Alle Peer-Pubs löschen
              </Button>
            </div>
            <Label className="text-[11px] text-muted-foreground">ECDH-Privatkey (JWK JSON — nur RAM)</Label>
            <textarea
              className="min-h-[56px] w-full max-w-lg rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[10px] text-foreground"
              value={ecdhJwkInput}
              onChange={(e) => setEcdhJwkInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder='{"kty":"EC","crv":"P-256",…}'
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                disabled={busy !== null}
                onClick={() => {
                  void (async () => {
                    const r = await applyDirectChatEcdhPrivateJwk(ecdhJwkInput)
                    if (r.ok) {
                      const on = getDirectChatEcdhPrivateKey() != null
                      setEcdhPrivActive(on)
                      setEcdhJwkInput('')
                      setMsg(on ? 'Chat-ECDH-Privatkey aktiv (nur RAM).' : 'Chat-ECDH-Privatkey entfernt.')
                    } else {
                      setEcdhPrivActive(false)
                      setMsg(r.error)
                    }
                  })()
                }}
              >
                ECDH-JWK anwenden
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={busy !== null}
                onClick={() => {
                  clearDirectChatEcdhPrivateKey()
                  setEcdhPrivActive(false)
                  setMsg('Chat-ECDH-Privatkey gelöscht.')
                }}
              >
                ECDH löschen
              </Button>
            </div>
            {ecdhPrivActive && (
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400">ECDH-Session aktiv.</p>
            )}
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
