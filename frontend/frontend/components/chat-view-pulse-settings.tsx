'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
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
  formatDirectChainSnapshotStatusLine,
  getDirectChainSnapshotMeta,
  getDirectChainFieldIdsFromLs,
  getDirectMailboxChainSnapshot,
  isDirectChainOptimisticFlagsEnabled,
  loadDirectMailboxChainSnapshotFromLs,
  persistDirectChainFieldIds,
  persistDirectMailboxChainSnapshot,
  resolveDirectMailboxChainSnapshot,
  persistDirectMailboxTtlDays,
  setDirectChainOptimisticFlagsEnabled,
} from '@/frontend/lib/direct-iota-chain-context'
import { isLikelyIotaHexId } from '@morgendrot/core/iota'
import {
  applyDirectIotaMnemonicSession,
  clearPersistedDirectIotaSessionSigner,
  clearDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
  hasPersistedDirectIotaSessionSigner,
  persistDirectIotaSessionSignerEncrypted,
  restoreDirectIotaSessionSignerFromEncryptedStorage,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  applyDirectChatEcdhPrivateJwk,
  clearDirectChatEcdhKeyMaterial,
  clearDirectChatEcdhPeerPubs,
  getDirectChatEcdhPrivateKey,
  exportDirectChatEcdhPeerPubPreview,
  setDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { resolveConnectedAddresses } from '@/frontend/lib/connected-peers-snapshot'
import Link from 'next/link'
import {
  formatDirectIotaPeeringStatusLine,
  formatDirectIotaPeeringStatusLineForSettings,
  listDirectIotaPeeringExchangeGaps,
  listDirectIotaPeeringGaps,
} from '@/frontend/lib/direct-iota-peering'
import { PeeringQrActions } from '@/frontend/components/peering-qr-actions'
import {
  DIRECT_IOTA_UI_CHANGED,
  getAutarkyChecklistItems,
  getIotaSubmitMode,
  isDirectMailboxDrainEnabled,
  listDirectIotaSetupGaps,
  setDirectMailboxDrainEnabled,
  setIotaSubmitMode,
  type IotaSubmitMode,
} from '@/frontend/lib/direct-iota-plain-submit'

const LS_STRICT_ONLINE = 'morgendrot.strictOnlineNoMeshFallback'
const LS_LORA_TX = 'morgendrot.loraTxTier'
import { isMessengerClientExpertModeEnabled } from '@/frontend/lib/messenger-client-expert-mode'
const LS_AUTARKY_MODE = 'morgendrot.autarkyMode'

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
  /** Simple Mode: kein localStorage-Expert-Bypass. */
  allowDevExpertTools?: boolean
  /** Einstellungen: ohne doppelte Package-ID / IOTA-Modus. */
  settingsEmbedded?: boolean
  /** RPC/Package/Mailbox kommen vom Netzwerk-Schalter — nur Signer zeigen. */
  networkManaged?: boolean
}

export function ChatViewPulseSettings({
  apiStatus,
  allowDevExpertTools = true,
  settingsEmbedded = false,
  networkManaged = false,
}: ChatViewPulseSettingsProps) {
  const [open, setOpen] = useState(networkManaged && settingsEmbedded)
  const [busy] = useState<'interval' | 'enabled' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [expertOpen, setExpertOpen] = useState(false)
  const [showExpertTools, setShowExpertTools] = useState(false)
  /** Letzter Fehler beim Öffnen: `/api/current-ids` (Netzwerk, Rewrite, Basis). */
  const [idsPanelErr, setIdsPanelErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
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
  const [signerStorePassword, setSignerStorePassword] = useState('')
  const [hasPersistedSigner, setHasPersistedSigner] = useState(false)
  const [sessionAddr, setSessionAddr] = useState<string | null>(null)
  const [ecdhPeerAddr, setEcdhPeerAddr] = useState('')
  const [ecdhPeerB64, setEcdhPeerB64] = useState('')
  const [ecdhJwkInput, setEcdhJwkInput] = useState('')
  const [ecdhPrivActive, setEcdhPrivActive] = useState(false)
  const [iotaSubmitMode, setIotaSubmitModeState] = useState<IotaSubmitMode>('client')
  const [autarkyMode, setAutarkyMode] = useState(false)
  const [autarkyChecklist, setAutarkyChecklist] = useState(() => getAutarkyChecklistItems())
  const [directSetupGaps, setDirectSetupGaps] = useState<string[]>([])
  const [chainSnapshotLine, setChainSnapshotLine] = useState('')
  const [chainSnapshotStale, setChainSnapshotStale] = useState(false)
  const [peeringLine, setPeeringLine] = useState('')
  const [peeringGaps, setPeeringGaps] = useState<string[]>([])
  const [peeringStatusHint, setPeeringStatusHint] = useState<string | null>(null)

  const refreshDirectSetupGaps = useCallback(() => {
    setDirectSetupGaps(listDirectIotaSetupGaps())
    setAutarkyChecklist(getAutarkyChecklistItems())
  }, [])

  const refreshChainSnapshotMeta = useCallback(() => {
    const meta = getDirectChainSnapshotMeta()
    setChainSnapshotLine(formatDirectChainSnapshotStatusLine(meta))
    setChainSnapshotStale(meta.stale && meta.hasSnapshot)
  }, [])

  const syncChainFieldsToLs = useCallback(() => {
    persistDirectChainFieldIds({
      packageId: normalizeIotaHexInput(chainPkg),
      mailboxId: normalizeIotaHexInput(chainMb),
      senderAddress: normalizeIotaHexInput(chainAddr),
    })
    refreshChainSnapshotMeta()
    refreshDirectSetupGaps()
  }, [chainPkg, chainMb, chainAddr, refreshChainSnapshotMeta, refreshDirectSetupGaps])

  const refreshPeeringUi = useCallback(() => {
    const backendReachable = apiStatus.backendOnline !== false
    const resolved = resolveConnectedAddresses({
      fromStatus: apiStatus.connectedAddresses,
      preferCacheWhenEmpty: !backendReachable,
    })
    setPeeringLine(
      formatDirectIotaPeeringStatusLine({
        backendReachable,
        connectedAddresses: resolved.addresses,
      })
    )
    if (settingsEmbedded) {
      setPeeringStatusHint(
        formatDirectIotaPeeringStatusLineForSettings({
          backendReachable,
          connectedAddresses: resolved.addresses,
        })
      )
      setPeeringGaps(
        listDirectIotaPeeringExchangeGaps({
          backendReachable,
          connectedAddresses: resolved.addresses,
        })
      )
    } else {
      setPeeringStatusHint(null)
      setPeeringGaps(listDirectIotaPeeringGaps({ backendReachable }))
    }
  }, [apiStatus.backendOnline, apiStatus.connectedAddresses, settingsEmbedded])

  const streams = apiStatus.streams

  const pulseHexChainSuggestions = useMemo(() => {
    const set = new Set<string>()
    const add = (v?: string) => {
      const t = (v || '').trim()
      if (/^0x[a-fA-F0-9]{64}$/.test(t)) set.add(t)
    }
    add(apiStatus.packageId)
    add(apiStatus.myAddress)
    add(apiStatus.myAddressFull)
    const conn = apiStatus.connectedAddresses
    if (Array.isArray(conn)) {
      for (const a of conn) add(a)
    }
    add(apiStatus.streams?.anchorIdFull)
    add(apiStatus.streams?.anchorId)
    add(idsOverride?.packageId)
    add(idsOverride?.mailboxId)
    add(idsOverride?.myAddress)
    add(idsOverride?.streamsAnchorId)
    return Array.from(set)
  }, [
    apiStatus.packageId,
    apiStatus.myAddress,
    apiStatus.myAddressFull,
    apiStatus.connectedAddresses,
    apiStatus.streams?.anchorId,
    apiStatus.streams?.anchorIdFull,
    idsOverride,
  ])

  const pulseWalletPeerSuggestions = useMemo(() => {
    const set = new Set<string>()
    const add = (v?: string) => {
      const t = (v || '').trim()
      if (/^0x[a-fA-F0-9]{64}$/.test(t)) set.add(t)
    }
    add(apiStatus.myAddress)
    add(apiStatus.myAddressFull)
    add(idsOverride?.myAddress)
    const conn = apiStatus.connectedAddresses
    if (Array.isArray(conn)) {
      for (const a of conn) add(a)
    }
    return Array.from(set)
  }, [apiStatus.myAddress, apiStatus.myAddressFull, apiStatus.connectedAddresses, idsOverride?.myAddress])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(LS_STRICT_ONLINE, '0')
      const t = parseInt(typeof window !== 'undefined' ? window.localStorage.getItem(LS_LORA_TX) || '1' : '1', 10)
      setLoraTier(t >= 0 && t <= 2 ? t : 1)
      setDirectRpcUrl(getConfiguredDirectIotaRpcUrl() || '')
      setDirectDrainOn(isDirectMailboxDrainEnabled())
      setIotaSubmitModeState(getIotaSubmitMode())
      setAutarkyMode(window.localStorage.getItem(LS_AUTARKY_MODE) === '1')
      setSessionAddr(getDirectIotaSessionSignerAddress())
      setHasPersistedSigner(hasPersistedDirectIotaSessionSigner())
      setEcdhPrivActive(getDirectChatEcdhPrivateKey() != null)
      setOptimisticDrainFlags(isDirectChainOptimisticFlagsEnabled())
      const devExpert = allowDevExpertTools && isMessengerClientExpertModeEnabled()
      setShowExpertTools(apiStatus.uiVariant !== 'messenger' || devExpert)
      const fields = getDirectChainFieldIdsFromLs()
      if (fields.packageId) setChainPkg(fields.packageId)
      if (fields.mailboxId) setChainMb(fields.mailboxId)
      if (fields.senderAddress) setChainAddr(fields.senderAddress)
      const snap = resolveDirectMailboxChainSnapshot() ?? loadDirectMailboxChainSnapshotFromLs()
      if (snap) {
        setTtlDaysStr(String(snap.ttlDays))
        setChainPkg(snap.packageId)
        setChainMb(snap.mailboxId)
        setChainAddr(snap.senderAddress)
      }
    } catch {
      /* ignore */
    }
  }, [apiStatus.uiVariant, allowDevExpertTools])

  useEffect(() => {
    refreshDirectSetupGaps()
    refreshChainSnapshotMeta()
    refreshPeeringUi()
    const onChange = () => {
      refreshDirectSetupGaps()
      refreshChainSnapshotMeta()
      refreshPeeringUi()
    }
    window.addEventListener(DIRECT_IOTA_UI_CHANGED, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(DIRECT_IOTA_UI_CHANGED, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [
    refreshDirectSetupGaps,
    refreshChainSnapshotMeta,
    refreshPeeringUi,
    iotaSubmitMode,
    directDrainOn,
    directRpcUrl,
    sessionAddr,
    chainPkg,
    chainMb,
    chainAddr,
    optimisticDrainFlags,
  ])

  useEffect(() => {
    if (!open) return
    refreshChainSnapshotMeta()
    const id = window.setInterval(refreshChainSnapshotMeta, 60_000)
    return () => window.clearInterval(id)
  }, [open, refreshChainSnapshotMeta])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIdsPanelErr(null)
    void (async () => {
      try {
        const res = await fetch('/api/current-ids')
        if (cancelled) return
        if (!res.ok) {
          setIdsPanelErr(`/api/current-ids: HTTP ${res.status} — Basis erreichbar? Next-Rewrite → API-Port prüfen.`)
          return
        }
        const j = (await res.json()) as {
          ok?: boolean
          myAddress?: string
          packageId?: string
          streamsAnchorId?: string
          mailboxId?: string
        }
        if (cancelled) return
        if (j.ok !== true) {
          setIdsPanelErr('/api/current-ids: ok≠true (Tresor/API prüfen).')
          return
        }
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
      } catch (e) {
        if (!cancelled) {
          setIdsPanelErr(e instanceof Error ? e.message : String(e))
        }
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

  const toggleAutarkyMode = useCallback(
    (on: boolean) => {
      setAutarkyMode(on)
      try {
        if (on) window.localStorage.setItem(LS_AUTARKY_MODE, '1')
        else window.localStorage.removeItem(LS_AUTARKY_MODE)
      } catch {
        /* ignore */
      }
      if (on) {
        persistDirectChainFieldIds({
          packageId: normalizeIotaHexInput(chainPkg),
          mailboxId: normalizeIotaHexInput(chainMb),
          senderAddress: normalizeIotaHexInput(chainAddr),
        })
        setIotaSubmitMode('client')
        setIotaSubmitModeState('client')
        setDirectMailboxDrainEnabled(true)
        setDirectDrainOn(true)
        setDirectChainOptimisticFlagsEnabled(true)
        setOptimisticDrainFlags(true)
        setMsg('Autarkie-Modus aktiv: Direkt + Drain + Optimistische Flags gesetzt.')
      } else {
        setMsg('Autarkie-Modus aus. Einzeloptionen bleiben manuell steuerbar.')
      }
      refreshDirectSetupGaps()
      refreshChainSnapshotMeta()
    },
    [
      chainPkg,
      chainMb,
      chainAddr,
      refreshDirectSetupGaps,
      refreshChainSnapshotMeta,
    ]
  )

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
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/35"
        >
          <span>
            {networkManaged && settingsEmbedded
              ? 'Wallet-Signer'
              : settingsEmbedded
              ? 'Mailbox · Direkt-RPC · Streams-Puls'
              : 'IDs zum Kopieren · Direkt-RPC · Funk'}
          </span>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-4 rounded-lg border border-border/60 bg-card/50 px-3 py-3 text-xs">
        {settingsEmbedded && !networkManaged ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Mailbox, Direkt-RPC und optionaler Streams-Puls — Erklärung und Checkliste im{' '}
            <Link href="/handbook?file=MESSENGER-CHAT-HANDBUCH.md#einstellungen-system--identität" className="text-primary underline hover:no-underline">
              Handbuch
            </Link>
            .
          </p>
        ) : networkManaged ? (
          <p className="text-[11px] text-muted-foreground">
            Mnemonic für Direkt-Send (ohne dauernd laufenden Boss-PC). Netz kommt von <strong className="text-foreground">Wo senden?</strong> oben.
          </p>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Werte kommen aus dem Backend (<span className="font-mono">/api/status</span>, beim Öffnen zusätzlich{' '}
            <span className="font-mono">/api/current-ids</span>), falls erreichbar. Zum <strong className="text-foreground">Kopieren</strong> die Zeilen
            unten. Für <strong className="text-foreground">Direkt-IOTA ohne dauernd erreichbare Basis</strong>: Ketten-IDs im Abschnitt{' '}
            <strong className="text-foreground">„Direkt-RPC“</strong> eintragen und dort in <span className="font-mono">localStorage</span> speichern
            (siehe Handbuch / Architektur H.15).
          </p>
        )}
        {idsPanelErr ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
            {idsPanelErr}
          </p>
        ) : null}

        {networkManaged && settingsEmbedded ? (
          <>
            {iotaSubmitMode !== 'relay' && directSetupGaps.length > 0 ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-950 dark:text-amber-100">
                <p className="font-semibold">Noch offen:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {directSetupGaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Wallet-Mnemonic (Session-Signer)</Label>
              <textarea
                className="min-h-[72px] w-full max-w-lg rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[11px] text-foreground"
                value={mnemoInput}
                onChange={(e) => setMnemoInput(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                placeholder="12/24 Wörter — nur im Browser-RAM, nicht dauerhaft gespeichert."
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
                      refreshDirectSetupGaps()
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
                    refreshDirectSetupGaps()
                  }}
                >
                  Signer löschen
                </Button>
              </div>
              <div className="mt-2 rounded-md border border-border/70 bg-muted/20 p-2">
                <Label className="mb-1 block text-[10px] text-muted-foreground">
                  Optional: verschlüsselt auf dem Gerät speichern
                </Label>
                <Input
                  type="password"
                  value={signerStorePassword}
                  onChange={(e) => setSignerStorePassword(e.target.value)}
                  placeholder="Lokales Passwort (mind. 8 Zeichen)"
                  className="h-8 max-w-sm text-xs"
                  autoComplete="off"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs"
                    disabled={busy !== null || !mnemoInput.trim()}
                    onClick={() => {
                      void (async () => {
                        const r = await persistDirectIotaSessionSignerEncrypted({
                          signerImportRaw: mnemoInput,
                          password: signerStorePassword,
                        })
                        if (r.ok) {
                          setHasPersistedSigner(true)
                          setMsg('Signer lokal gespeichert.')
                        } else {
                          setMsg(`Speichern fehlgeschlagen: ${r.error}`)
                        }
                      })()
                    }}
                  >
                    Speichern
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={busy !== null || !hasPersistedSigner}
                    onClick={() => {
                      void (async () => {
                        const r = await restoreDirectIotaSessionSignerFromEncryptedStorage({
                          password: signerStorePassword,
                        })
                        if (r.ok) {
                          setSessionAddr(r.address)
                          setMsg(`Signer geladen: ${r.address.slice(0, 10)}…`)
                          refreshDirectSetupGaps()
                        } else {
                          setMsg(`Laden fehlgeschlagen: ${r.error}`)
                        }
                      })()
                    }}
                  >
                    Laden
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {hasPersistedSigner ? 'Lokale Ablage vorhanden' : 'Keine lokale Ablage'}
                </p>
              </div>
              {sessionAddr ? (
                <p className="text-[10px] font-mono text-muted-foreground">
                  Aktiv: <span className="break-all text-foreground">{sessionAddr}</span>
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-foreground">
            {settingsEmbedded ? 'Streams-Puls (optional)' : 'Explorer / Prüfen'}
          </p>
          <CopyRow
            label="Streams-Anchor (Objekt-ID)"
            value={anchorFull}
            invalid={!!anchorFull && !isLikelyIotaObjectId(anchorFull)}
            invalidHint="Erwartet: 0x + 64 Hex (IOTA-Objekt-ID). Nur Puls/Monitor — nicht der Chat-Posteingang."
            hint="Optional: Live-Puls an die Basis (Heartbeat). Chat läuft über Mailbox."
            copied={copied === 'anchor'}
            onCopy={() => void copy('anchor', anchorFull)}
          />
          {!settingsEmbedded ? (
            <>
              <CopyRow
                label="Eigene Adresse"
                value={addrFull}
                invalid={!!addrFull && !isLikelyIotaObjectId(addrFull)}
                invalidHint="Erwartet: 0x + 64 Hex. Nach Wallet-Entsperren laden."
                hint="Wallet-Adresse (Explorer, Handshake)."
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
            </>
          ) : null}
        </div>

        {!settingsEmbedded ? (
        <div className="space-y-2 border-t border-border/50 pt-3">
          <p className="text-[11px] font-semibold text-foreground">Hybrid-Versand (Chat)</p>
          <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <p className="mb-1.5 text-foreground/90">
              Betrifft nur Nachrichten mit Transport <strong className="text-foreground">Online</strong> (IOTA/Mailbox).
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong className="text-foreground">Standard (aktiv):</strong> Schlägt Online fehl und Heltec ist verbunden, wird versucht, denselben Inhalt über{' '}
                <strong className="text-foreground">LoRa/Mesh</strong> zu senden (Fallback).
              </li>
            </ul>
          </div>
        </div>
        ) : null}

        {!settingsEmbedded ? (
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
        ) : null}

        <div className="space-y-3 border-t border-border/50 pt-3">
          <div className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-foreground">Autarkie-Modus (APK/EXE ohne Basis-Pflicht)</p>
              <Switch
                checked={autarkyMode}
                disabled={busy !== null}
                onCheckedChange={toggleAutarkyMode}
                aria-label="Autarkie-Modus"
              />
            </div>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              Setzt Direkt-Pfad, Direkt-Drain und Optimistische Flags als Autarkie-Defaults. RPC, IDs und Signer bleiben
              bewusst unter deiner Kontrolle.
            </p>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-[10px]">
              {autarkyChecklist.map((item) => (
                <li
                  key={item.label}
                  className={item.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}
                >
                  {item.ok ? 'PASS' : 'OFFEN'} — {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/50 pt-3">
          <p className="text-[11px] font-semibold text-foreground">
            {settingsEmbedded ? 'Mailbox & Direkt-RPC (Browser)' : 'Direkt-RPC (IOTA Fullnode, ohne Morgendrot-API-Pflicht)'}
          </p>
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
                refreshDirectSetupGaps()
                setMsg(v ? 'Direkt-Mailbox-Drain an — Mnemonic + Ketten-IDs nötig.' : 'Direkt-Mailbox-Drain aus.')
              }}
              aria-label="Direkt-Mailbox-Drain"
            />
          </div>
          {iotaSubmitMode !== 'relay' && directSetupGaps.length > 0 ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-950 dark:text-amber-100">
              <p className="font-semibold">
                {settingsEmbedded ? 'Noch einzurichten (Direkt-Pfad):' : 'Direkt-Pfad — noch offen:'}
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {directSetupGaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          ) : null}
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
                refreshChainSnapshotMeta()
                setMsg(`TTL ${n} Tage gespeichert.`)
              }}
            >
              TTL setzen
            </Button>
          </div>
          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[11px] font-semibold text-foreground">Ketten-IDs (Package, Mailbox, eigene Adresse)</p>
            {chainSnapshotLine ? (
              <p
                className={cn(
                  'text-[10px] leading-relaxed',
                  chainSnapshotStale
                    ? 'rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-950 dark:text-amber-100'
                    : 'text-muted-foreground'
                )}
              >
                <strong className="font-semibold text-foreground">Snapshot:</strong> {chainSnapshotLine}
              </p>
            ) : null}
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Für Direkt-Klartext ohne dauernd erreichbare Basis: IDs manuell eintragen oder — wenn die Basis antwortet — beim Öffnen dieses Panels per{' '}
              <span className="font-mono">/api/current-ids</span> befüllen, dann hier speichern.
            </p>
            <div className="grid max-w-lg gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Package-ID</Label>
                <Input
                  className="h-9 font-mono text-xs"
                  list="pulse-hex-chain-suggestions"
                  value={chainPkg}
                  onChange={(e) => setChainPkg(e.target.value)}
                  onBlur={syncChainFieldsToLs}
                  spellCheck={false}
                  placeholder="0x…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Mailbox-ID</Label>
                <Input
                  className="h-9 font-mono text-xs"
                  list="pulse-hex-chain-suggestions"
                  value={chainMb}
                  onChange={(e) => setChainMb(e.target.value)}
                  onBlur={syncChainFieldsToLs}
                  spellCheck={false}
                  placeholder="0x…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Absender (IOTA-Adresse / Objekt)</Label>
                <Input
                  className="h-9 font-mono text-xs"
                  list="pulse-hex-chain-suggestions"
                  value={chainAddr}
                  onChange={(e) => setChainAddr(e.target.value)}
                  onBlur={syncChainFieldsToLs}
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
                onChange={(e) => {
                  const on = e.target.checked
                  setOptimisticDrainFlags(on)
                  setDirectChainOptimisticFlagsEnabled(on)
                }}
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
                  const previousFlags = getDirectMailboxChainSnapshot()?.flags
                  const flags = optimisticDrainFlags
                    ? { useMailbox: true, mailboxStorePlaintext: true, messengerCreditsConfigured: false }
                    : apiStatus.backendOnline === false && previousFlags
                      ? previousFlags
                      : {
                          useMailbox: apiStatus.useMailbox === true,
                          mailboxStorePlaintext: apiStatus.mailboxStorePlaintext === true,
                          messengerCreditsConfigured: apiStatus.messengerCreditsConfigured === true,
                        }
                  const persisted = persistDirectMailboxChainSnapshot({
                    packageId: pkg,
                    mailboxId: mb,
                    senderAddress: addr,
                    ttlDays: ttl,
                    flags,
                  })
                  if (!persisted.ok) {
                    setMsg(`Ketten-IDs nicht gespeichert: ${persisted.error}`)
                    return
                  }
                  setChainPkg(pkg)
                  setChainMb(mb)
                  setChainAddr(addr)
                  let out = 'Ketten-IDs für Direkt-Pfad gespeichert (localStorage).'
                  if (!optimisticDrainFlags && apiStatus.backendOnline === false && previousFlags) {
                    out += ' Basis offline: letzte bekannte Direkt-Flags wurden weiterverwendet.'
                  }
                  if (!optimisticDrainFlags && flags.messengerCreditsConfigured) {
                    out += ' Hinweis: Messenger-Credits aktiv — Klartext-Direkt-Drain bleibt geblockt, bis die Kette ohne Credits läuft oder du die Flags schätzt.'
                  }
                  refreshChainSnapshotMeta()
                  refreshDirectSetupGaps()
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
            <div className="mt-2 rounded-md border border-border/70 bg-muted/20 p-2">
              <Label className="mb-1 block text-[10px] text-muted-foreground">
                Optional: lokal verschlüsselt speichern (für Neustart ohne Basis/PC)
              </Label>
              <Input
                type="password"
                value={signerStorePassword}
                onChange={(e) => setSignerStorePassword(e.target.value)}
                placeholder="Lokales Passwort (mind. 8 Zeichen)"
                className="h-8 max-w-sm text-xs"
                autoComplete="off"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs"
                  disabled={busy !== null || !mnemoInput.trim()}
                  onClick={() => {
                    void (async () => {
                      const r = await persistDirectIotaSessionSignerEncrypted({
                        signerImportRaw: mnemoInput,
                        password: signerStorePassword,
                      })
                      if (r.ok) {
                        setHasPersistedSigner(true)
                        setMsg('Session-Signer lokal verschlüsselt gespeichert.')
                      } else {
                        setMsg(`Speichern fehlgeschlagen: ${r.error}`)
                      }
                    })()
                  }}
                >
                  Signer verschlüsselt speichern
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs"
                  disabled={busy !== null || !hasPersistedSigner}
                  onClick={() => {
                    void (async () => {
                      const r = await restoreDirectIotaSessionSignerFromEncryptedStorage({
                        password: signerStorePassword,
                      })
                      if (r.ok) {
                        setSessionAddr(r.address)
                        setMsg(`Signer aus lokaler Ablage geladen: ${r.address.slice(0, 10)}…`)
                      } else {
                        setMsg(`Laden fehlgeschlagen: ${r.error}`)
                      }
                    })()
                  }}
                >
                  Aus lokaler Ablage laden
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={busy !== null || !hasPersistedSigner}
                  onClick={() => {
                    clearPersistedDirectIotaSessionSigner()
                    setHasPersistedSigner(false)
                    setMsg('Lokale Signer-Ablage gelöscht.')
                  }}
                >
                  Lokale Ablage löschen
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Status: {hasPersistedSigner ? 'verschlüsselte Ablage vorhanden' : 'keine lokale Ablage'}
              </p>
            </div>
            {sessionAddr && (
              <p className="text-[10px] font-mono text-muted-foreground">
                Aktiver Signer: <span className="break-all text-foreground">{sessionAddr}</span>
              </p>
            )}
          </div>
          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[11px] font-semibold text-foreground">
              {settingsEmbedded ? 'Partner-Adresse austauschen (QR)' : 'Peering (§ H.15 B.2)'}
            </p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {settingsEmbedded
                ? 'Wallet-Adresse (0x) und optional Verschlüsselungsschlüssel mit dem Chat-Partner tauschen — für verschlüsselten Online-Chat. Anschließend Handshake im Posteingang oder Telefonbuch, nicht LoRa/Mesh.'
                : 'Partner-Wallet und optional ECDH-Pub austauschen; danach Handshake/Connect online.'}
            </p>
            {!settingsEmbedded && peeringLine ? (
              <p className="text-[10px] text-muted-foreground leading-relaxed">{peeringLine}</p>
            ) : null}
            {settingsEmbedded && peeringStatusHint ? (
              <p className="text-[10px] text-muted-foreground">{peeringStatusHint}</p>
            ) : null}
            {peeringGaps.length > 0 ? (
              <ul className="list-inside list-disc space-y-0.5 text-[10px] text-amber-950 dark:text-amber-100">
                {peeringGaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            ) : null}
            <PeeringQrActions
              className="flex flex-wrap gap-2"
              myAddress={(apiStatus.myAddressFull || apiStatus.myAddress || sessionAddr || chainAddr || '').trim()}
              displayName={apiStatus.displayName?.trim()}
              includeNetworkInQr
              disabled={busy !== null}
              onStatus={(m) => setMsg(m)}
              onImported={({ address, peerPubStored }) => {
                setEcdhPeerAddr(address)
                if (peerPubStored) {
                  setEcdhPeerB64(exportDirectChatEcdhPeerPubPreview(address))
                }
                refreshPeeringUi()
              }}
            />
          </div>
          <div className="space-y-2 border-t border-border/40 pt-3">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Chat-ECDH-Peer-Pubs sollten normal über Handshake entstehen. Manuelle Schlüsselpflege und Funkleistung sind nur für Debug/Edge-Fälle.
            </p>
            {showExpertTools ? (
              <Collapsible open={expertOpen} onOpenChange={setExpertOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs">
                    {expertOpen ? 'Expertenoptionen ausblenden' : 'Expertenoptionen anzeigen'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3 rounded-md border border-border/50 bg-muted/15 px-2.5 py-2.5">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-foreground">Chat-ECDH (manuell, nur Experten)</p>
                  <div className="grid max-w-lg gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Empfänger (0x…)</Label>
                      <Input
                        className="h-9 font-mono text-xs"
                        list="pulse-wallet-peer-suggestions"
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
                        clearDirectChatEcdhKeyMaterial()
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
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <p className="text-[11px] font-semibold text-foreground">LoRa Sendeleistung (nur Vorbereitung)</p>
                  <p className="text-[11px] text-muted-foreground">
                    Wird lokal gespeichert; Firmware/Gerät kann den Wert überschreiben. Standard bleibt „Normal“.
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
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Expertenoptionen sind im Messenger ausgeblendet.
              </p>
            )}
          </div>
        </div>
          </>
        )}

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
