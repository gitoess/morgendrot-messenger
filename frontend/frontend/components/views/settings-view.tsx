'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import {
  Settings,
  Wifi,
  WifiOff,
  Copy,
  Check,
  RefreshCw,
  RotateCw,
  Globe,
  Package,
  Wallet,
  Server,
  Smartphone,
  KeyRound,
  Users,
  ListOrdered,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  getStatus,
  revealVaultSignerImport,
  transferCoins,
  restartBackend,
  applyInitialProfileProvisioning,
  fetchEinsatzRoleTemplates,
  saveEinsatzRoleTemplates,
  type EinsatzRoleTemplate,
} from '@/frontend/lib/api'
import {
  extractInitialProfileFromPaste,
  queueInitialProfileForNextApply,
  clearPendingInitialProfile,
  persistOfflineBriefingFromProfile,
  LS_OFFLINE_BRIEFING_DISPLAY,
} from '../../lib/initial-profile-import'
import Link from 'next/link'

/** Minimal typing for `beforeinstallprompt` (nicht überall als DOM-Typ geladen). */
type DeferredPwaPrompt = {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface SettingsViewProps {
  onOpenConfig?: () => void
  /** Arbeiter/Lock: Kachel-Ansicht dauerhaft (localStorage). */
  showAllTiles?: boolean
  onShowAllTilesChange?: (value: boolean) => void
  canToggleFullTiles?: boolean
}

export function SettingsView({
  onOpenConfig,
  showAllTiles = false,
  onShowAllTilesChange,
  canToggleFullTiles = false,
}: SettingsViewProps) {
  const [status, setStatus] = useState<{
    network: string
    address: string
    packageId: string
    backendOnline: boolean
    chatConnected: boolean
    signer?: string
    vaultHasLocal?: boolean
    role?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  
  // Transfer state
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferStatus, setTransferStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [transferMsg, setTransferMsg] = useState('')
  const [restarting, setRestarting] = useState(false)
  const [restartMsg, setRestartMsg] = useState('')
  /** Chrome/Edge/Android: gespeichertes beforeinstallprompt */
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<DeferredPwaPrompt | null>(null)
  const [pwaStandalone, setPwaStandalone] = useState(false)

  /** Recovery phrase / SDK-Import aus Vault (SIGNER=sdk). */
  const [recoveryPw, setRecoveryPw] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryErr, setRecoveryErr] = useState('')
  const [revealedSigner, setRevealedSigner] = useState<string | null>(null)

  /** jsonConfig oder reines initialProfile (JSON) — siehe docs/API-INITIAL-PROFILE.md */
  const [einsatzProfilJson, setEinsatzProfilJson] = useState('')
  const [einsatzProfilBusy, setEinsatzProfilBusy] = useState(false)
  const [einsatzProfilMsg, setEinsatzProfilMsg] = useState('')
  /** Aus initialProfile.offlineBriefing (lokal, nach Import) */
  const [offlineBriefingDisplay, setOfflineBriefingDisplay] = useState<string | null>(null)

  /** Boss/Werkstatt: `GET/POST /api/einsatz-role-templates` (Roadmap § H.3g Paket 6). */
  const [roleTemplatesJson, setRoleTemplatesJson] = useState('[]')
  const [roleTemplatesBusy, setRoleTemplatesBusy] = useState(false)
  const [roleTemplatesMsg, setRoleTemplatesMsg] = useState('')

  const canManageEinsatzRoleTemplates =
    status?.role === 'boss' || status?.role === 'messenger'

  const loadRoleTemplates = async () => {
    setRoleTemplatesMsg('')
    if (!status?.backendOnline) {
      setRoleTemplatesMsg('Backend offline.')
      return
    }
    setRoleTemplatesBusy(true)
    try {
      const res = await fetchEinsatzRoleTemplates()
      if (res.ok && res.templates) {
        setRoleTemplatesJson(JSON.stringify(res.templates, null, 2))
      } else {
        setRoleTemplatesMsg(res.error || 'Vorlagen konnten nicht geladen werden.')
      }
    } finally {
      setRoleTemplatesBusy(false)
    }
  }

  const saveRoleTemplates = async () => {
    setRoleTemplatesMsg('')
    if (!status?.backendOnline) {
      setRoleTemplatesMsg('Backend offline.')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(roleTemplatesJson || '[]')
    } catch {
      setRoleTemplatesMsg('Kein gültiges JSON.')
      return
    }
    if (!Array.isArray(parsed)) {
      setRoleTemplatesMsg('Erwartet: JSON-Array von Vorlagen-Objekten.')
      return
    }
    setRoleTemplatesBusy(true)
    try {
      const res = await saveEinsatzRoleTemplates(parsed as EinsatzRoleTemplate[])
      if (res.ok && res.templates) {
        setRoleTemplatesJson(JSON.stringify(res.templates, null, 2))
        setRoleTemplatesMsg(res.message || 'Gespeichert.')
      } else {
        setRoleTemplatesMsg(res.error || 'Speichern fehlgeschlagen.')
      }
    } finally {
      setRoleTemplatesBusy(false)
    }
  }

  useEffect(() => {
    const r = status?.role
    if (!status?.backendOnline || (r !== 'boss' && r !== 'messenger')) return
    let cancelled = false
    void (async () => {
      const res = await fetchEinsatzRoleTemplates()
      if (cancelled) return
      if (res.ok && res.templates) {
        setRoleTemplatesJson(JSON.stringify(res.templates, null, 2))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status?.role, status?.backendOnline])

  const loadStatus = async () => {
    setLoading(true)
    const res = await getStatus()
    if (res.ok && res.data) {
      setStatus(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const v = localStorage.getItem(LS_OFFLINE_BRIEFING_DISPLAY)
      setOfflineBriefingDisplay(v && v.trim() ? v : null)
    } catch {
      setOfflineBriefingDisplay(null)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(display-mode: standalone)')
    const syncStandalone = () => {
      setPwaStandalone(
        mq.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      )
    }
    syncStandalone()
    mq.addEventListener('change', syncStandalone)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPwaPrompt(e as unknown as DeferredPwaPrompt)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => {
      mq.removeEventListener('change', syncStandalone)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount) return
    setTransferring(true)
    setTransferStatus('idle')
    
    const res = await transferCoins(transferTo, parseFloat(transferAmount))
    
    if (res.ok) {
      setTransferStatus('success')
      setTransferMsg('Transfer erfolgreich!')
      setTransferTo('')
      setTransferAmount('')
    } else {
      setTransferStatus('error')
      setTransferMsg(res.error || 'Transfer fehlgeschlagen')
    }
    
    setTransferring(false)
    setTimeout(() => setTransferStatus('idle'), 5000)
  }

  const handleRestart = async () => {
    setRestarting(true)
    setRestartMsg('')
    try {
      const res = await restartBackend()
      if (res.ok) {
        setRestartMsg('Neustart ausgelöst – Verbindung bricht ab; Seite in Kürze neu laden.')
      } else {
        setRestartMsg(res.error || 'Neustart fehlgeschlagen')
      }
    } catch (e) {
      setRestartMsg(String((e as Error)?.message || e))
    }
    setRestarting(false)
  }

  const maskAddress = (addr: string) => {
    if (!addr || addr.length < 16) return addr
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`
  }

  const handleRevealSignerImport = async () => {
    setRecoveryErr('')
    if (!recoveryPw.trim()) {
      setRecoveryErr('Vault-Passwort eingeben.')
      return
    }
    setRecoveryBusy(true)
    try {
      const res = await revealVaultSignerImport(recoveryPw.trim())
      if (res.ok && res.signerImport) {
        setRevealedSigner(res.signerImport)
        setRecoveryPw('')
      } else {
        setRecoveryErr(res.error || res.message || 'Anzeige fehlgeschlagen.')
      }
    } finally {
      setRecoveryBusy(false)
    }
  }

  const handlePwaInstallClick = async () => {
    if (!deferredPwaPrompt) return
    try {
      await deferredPwaPrompt.prompt()
      await deferredPwaPrompt.userChoice
    } finally {
      setDeferredPwaPrompt(null)
    }
  }

  const handleEinsatzProfilApplyNow = async () => {
    setEinsatzProfilMsg('')
    const extracted = extractInitialProfileFromPaste(einsatzProfilJson)
    if (!extracted) {
      setEinsatzProfilMsg('Kein gültiges initialProfile: vollständiges JSON oder jsonConfig mit Feld initialProfile.')
      return
    }
    if (!status?.backendOnline) {
      setEinsatzProfilMsg('Backend offline — zuerst API erreichbar machen.')
      return
    }
    setEinsatzProfilBusy(true)
    try {
      const res = await applyInitialProfileProvisioning(extracted)
      if (res.ok) {
        persistOfflineBriefingFromProfile(extracted)
        if (typeof extracted.offlineBriefing === 'string' && extracted.offlineBriefing.trim()) {
          setOfflineBriefingDisplay(extracted.offlineBriefing.trim())
        }
        setEinsatzProfilMsg(res.message || `${res.applied ?? 0} Kontakt(e) übernommen.`)
      } else {
        setEinsatzProfilMsg(res.error || 'Import fehlgeschlagen.')
      }
    } finally {
      setEinsatzProfilBusy(false)
    }
  }

  const handleEinsatzProfilQueue = () => {
    setEinsatzProfilMsg('')
    const extracted = extractInitialProfileFromPaste(einsatzProfilJson)
    if (!extracted) {
      setEinsatzProfilMsg('Kein gültiges initialProfile — siehe Hilfetext.')
      return
    }
    queueInitialProfileForNextApply(extracted)
    persistOfflineBriefingFromProfile(extracted)
    if (typeof extracted.offlineBriefing === 'string' && extracted.offlineBriefing.trim()) {
      setOfflineBriefingDisplay(extracted.offlineBriefing.trim())
    }
    setEinsatzProfilMsg('Gespeichert. Wird beim nächsten erfolgreichen API-Kontakt automatisch ins Telefonbuch geschrieben.')
  }

  const handleEinsatzProfilClearQueue = () => {
    clearPendingInitialProfile()
    setEinsatzProfilMsg('Warteschlange geleert.')
  }

  const handleEinsatzProfilFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      setEinsatzProfilJson(typeof r.result === 'string' ? r.result : '')
      setEinsatzProfilMsg('Datei geladen.')
    }
    r.readAsText(f)
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Einstellungen</h2>
          <p className="text-sm text-muted-foreground">Netzwerk-Status und Konfiguration</p>
        </div>
      </div>

      {/* PWA: zum Home-Bildschirm (Chrome/Edge/Android; Safari iOS: manuell) */}
      {!pwaStandalone && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Smartphone className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h4 className="font-semibold text-foreground">App auf den Startbildschirm</h4>
              <p className="text-sm text-muted-foreground">
                Installierte PWAs starten ohne Browser-Leiste. Auf <strong className="text-foreground">iPhone/iPad</strong>{' '}
                (Safari): Teilen-Menü → <strong className="text-foreground">Zum Home-Bildschirm</strong>.
              </p>
              {deferredPwaPrompt ? (
                <button
                  type="button"
                  onClick={() => void handlePwaInstallClick()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Installation anbieten
                </button>
              ) : (
              <p className="text-xs text-muted-foreground">
                Wenn der Browser eine Installation erlaubt (meist HTTPS oder localhost), erscheint hier ein Button –
                sonst Browser-Menü „App installieren“ nutzen.
              </p>
              )}
              <p className="text-xs text-muted-foreground">
                <Link href="/handbook" className="text-primary underline hover:no-underline">
                  Handbuch (Boss-Orientierung, Offline-Hinweise)
                </Link>{' '}
                — im Produktionsbuild per Service Worker gecacht.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Einsatz-Profil (initialProfile aus Provisioning / jsonConfig) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h4 className="font-semibold text-foreground">Einsatz-Profil / Kontakte</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                JSON aus dem Boss-Export einfügen: entweder nur <span className="font-mono text-xs">initialProfile</span> oder
                die gesamte <span className="font-mono text-xs">jsonConfig</span> (enthält{' '}
                <span className="font-mono text-xs">initialProfile</span>). Wird ins Backend{' '}
                <span className="font-mono text-xs">.morgendrot-contact-labels.json</span> geschrieben — siehe{' '}
                <span className="font-mono text-xs">docs/API-INITIAL-PROFILE.md</span>. Optional:{' '}
                <span className="font-mono text-xs">offlineBriefing</span> (Kurznotiz, z. B. Funkabbruch).
              </p>
            </div>
            {offlineBriefingDisplay ? (
              <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
                  Einsatz-Notiz (aus Provisioning)
                </p>
                <p className="mt-1 whitespace-pre-wrap text-amber-50/95">{offlineBriefingDisplay}</p>
              </div>
            ) : null}
            <Textarea
              value={einsatzProfilJson}
              onChange={(e) => setEinsatzProfilJson(e.target.value)}
              placeholder='{"version":1,"contacts":[],"offlineBriefing":"Bei Funkabbruch: …"}'
              className="min-h-[120px] font-mono text-xs"
              spellCheck={false}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium hover:bg-muted">
                JSON-Datei wählen
                <input type="file" accept=".json,application/json" className="sr-only" onChange={handleEinsatzProfilFile} />
              </label>
              <button
                type="button"
                disabled={einsatzProfilBusy || !status?.backendOnline}
                onClick={() => void handleEinsatzProfilApplyNow()}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {einsatzProfilBusy ? 'Import…' : 'Jetzt ins Telefonbuch'}
              </button>
              <button
                type="button"
                onClick={handleEinsatzProfilQueue}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
              >
                Für später merken
              </button>
              <button
                type="button"
                onClick={handleEinsatzProfilClearQueue}
                className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
              >
                Warteschlange leeren
              </button>
            </div>
            {einsatzProfilMsg ? (
              <p className="text-xs text-muted-foreground" role="status">
                {einsatzProfilMsg}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {canManageEinsatzRoleTemplates ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <ListOrdered className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-foreground">Einsatz-Rollen-Vorlagen</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Schreibt die Boss-Datei <span className="font-mono text-xs">.morgendrot-einsatz-templates.json</span> am
                  Backend (gleiche API wie Lite-Provisioning). Spezifikation:{' '}
                  <Link
                    href="/handbook/API-EINSATZ-ROLE-TEMPLATES.md"
                    className="text-primary underline hover:no-underline"
                  >
                    API: Einsatz-Rollen-Templates
                  </Link>{' '}
                  (offline nach erstem Abruf) — Orientierung:{' '}
                  <Link href="/handbook/BOSS-ORIENTIERUNG.md" className="text-primary underline hover:no-underline">
                    Boss-Handbuch
                  </Link>
                  .
                </p>
              </div>
              <Textarea
                value={roleTemplatesJson}
                onChange={(e) => setRoleTemplatesJson(e.target.value)}
                className="min-h-[160px] font-mono text-xs"
                spellCheck={false}
                disabled={roleTemplatesBusy || !status?.backendOnline}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={roleTemplatesBusy || !status?.backendOnline}
                  onClick={() => void loadRoleTemplates()}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
                >
                  Vom Backend laden
                </button>
                <button
                  type="button"
                  disabled={roleTemplatesBusy || !status?.backendOnline}
                  onClick={() => void saveRoleTemplates()}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {roleTemplatesBusy ? '…' : 'Speichern'}
                </button>
              </div>
              {roleTemplatesMsg ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {roleTemplatesMsg}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Status Card */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h4 className="font-semibold text-foreground">Verbindungsstatus</h4>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />
            Lade Status...
          </div>
        ) : status ? (
          <div className="divide-y divide-border">
            {/* Backend vs Chat-Partner (connected = nur /connect, nicht „API offline“) */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-emerald-400/90" />
                <div>
                  <span className="text-foreground">Backend (API)</span>
                  <p className="text-xs text-muted-foreground">Erreichbar, solange diese Seite Status laden kann</p>
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  status.backendOnline
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                )}
              >
                {status.backendOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {status.chatConnected ? (
                  <Wifi className="h-5 w-5 text-emerald-400" />
                ) : (
                  <WifiOff className="h-5 w-5 text-amber-500/90" />
                )}
                <div>
                  <span className="text-foreground">Chat-Partner</span>
                  <p className="text-xs text-muted-foreground">
                    Nach <code className="rounded bg-muted px-1">/connect</code> mit Messenger-Peer
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  status.chatConnected
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                )}
              >
                {status.chatConnected ? 'Verbunden' : 'Nicht gekoppelt'}
              </span>
            </div>

            {/* Network */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Netzwerk (RPC)</span>
              </div>
              <span className="max-w-[min(100%,14rem)] truncate font-mono text-sm text-muted-foreground" title={status.network}>
                {status.network && status.network !== '—' ? status.network : '—'}
              </span>
            </div>

            {/* Address */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Adresse</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {maskAddress(status.address)}
                </span>
                <button
                  onClick={() => copyToClipboard(status.address, 'address')}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {copied === 'address' ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Package ID */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Package-ID</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {status.packageId ? maskAddress(status.packageId) : '—'}
                </span>
                {!!status.packageId && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(status.packageId, 'packageId')}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {copied === 'packageId' ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <WifiOff className="mx-auto mb-2 h-8 w-8" />
            Keine Verbindung zum Backend
          </div>
        )}
      </div>

      {/* Wallet & Backup: explizite Anzeige gespeicherter Recovery-Daten (SIGNER=sdk) */}
      {status?.backendOnline && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h4 className="font-semibold text-foreground">Wallet & Backup</h4>
              <p className="text-sm text-muted-foreground">
                Wenn beim ersten Einrichten eine Mnemonic nur kurz sichtbar war: Ohne sicheres Backup sind bei
                Geräteverlust <strong className="text-foreground">Identität und gebundene Berechtigungen</strong> (z. B.
                Messenger-Credits auf der Chain) nicht wiederherstellbar — der Server speichert keinen Klartext-Key.
                Hier kannst du den <strong className="text-foreground">in der Vault-Datei gespeicherten</strong>{' '}
                Signer-Import erneut anzeigen, wenn du ihn beim Tresor-Speichern mit abgelegt hast (
                <span className="font-mono text-xs">Signer-Import mit speichern</span> in der Lite-UI / Tresor).
              </p>
              <p className="text-xs text-muted-foreground">
                Technik und Risiken: <span className="font-mono">docs/RECOVERY-PHRASE-BACKUP.md</span>,{' '}
                <span className="font-mono">docs/ONBOARDING-WALLET-UX-SPEC.md</span>.
              </p>
            </div>
          </div>

          {status.signer === 'sdk' ? (
            <>
              {!status.vaultHasLocal ? (
                <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                  Keine lokale Vault-Datei am erwarteten Ort — zuerst Tresor „lokal sichern“ mit aktiviertem Signer-Import,
                  oder Vault von der Chain laden.
                </p>
              ) : null}
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="text-muted-foreground">Vault-Passwort (erneut eingeben)</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={recoveryPw}
                    onChange={(e) => setRecoveryPw(e.target.value)}
                    className="mt-1 w-full max-w-md rounded-lg border border-border bg-input px-3 py-2 text-foreground"
                    placeholder="••••••••"
                  />
                </label>
                {recoveryErr ? <p className="text-sm text-destructive">{recoveryErr}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={recoveryBusy || !status.vaultHasLocal}
                    onClick={() => void handleRevealSignerImport()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {recoveryBusy ? 'Lade…' : 'Recovery / Signer-Import anzeigen'}
                  </button>
                  {revealedSigner ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRevealedSigner(null)
                        setRecoveryErr('')
                      }}
                      className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
                    >
                      Ausblenden
                    </button>
                  ) : null}
                </div>
                {revealedSigner ? (
                  <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                      Nur an einem sicheren Ort notieren — nicht teilen, nicht Screenshots in unsichere Clouds.
                    </p>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/50 p-3 font-mono text-xs text-foreground">
                      {revealedSigner}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(revealedSigner)
                        setCopied('signerImport')
                        setTimeout(() => setCopied(null), 2000)
                      }}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {copied === 'signerImport' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      In Zwischenablage kopieren
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">SIGNER={status.signer ?? '?'}</span>: Die Recovery-Phrase wird hier nur für{' '}
              <span className="font-mono">sdk</span> aus der Morgendrot-Vault gelesen. Bei{' '}
              <span className="font-mono">cli</span> nutzt du das Backup des IOTA-CLI-Keystores; bei{' '}
              <span className="font-mono">remote</span> verwaltet der Boss die Signatur.
            </p>
          )}
        </div>
      )}

      {canToggleFullTiles && onShowAllTilesChange && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-foreground">Volle Oberfläche</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Alle Funktions-Kacheln anzeigen (wie nach „Alle Funktionen“ auf dem Dashboard). Wird in diesem Browser gespeichert.
              </p>
            </div>
            <Switch
              checked={showAllTiles}
              onCheckedChange={onShowAllTilesChange}
              aria-label="Alle Kacheln anzeigen"
            />
          </div>
        </div>
      )}

      {/* Transfer Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-4 font-semibold text-foreground">IOTA überweisen</h4>
        
        {transferStatus !== 'idle' && (
          <div
            className={cn(
              'mb-4 flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
              transferStatus === 'success'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            {transferStatus === 'success' ? <Check className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {transferMsg}
          </div>
        )}
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">Empfänger</label>
            <input
              type="text"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">Betrag (IOTA)</label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="0.1"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleTransfer}
          disabled={transferring || !transferTo || !transferAmount}
          className="mt-4 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {transferring ? 'Überweise...' : 'Überweisen'}
        </button>
      </div>

      {/* Backend neu starten */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-2 font-semibold text-foreground">Backend</h4>
        <p className="mb-3 text-sm text-muted-foreground">
          Serverprozess neu starten (z. B. nach .env-Änderungen). Verbindung bricht kurz ab.
        </p>
        <button
          onClick={handleRestart}
          disabled={restarting}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-500/20 disabled:opacity-50"
        >
          <RotateCw className={cn('h-4 w-4', restarting && 'animate-spin')} />
          {restarting ? 'Starte neu…' : 'Backend neu starten'}
        </button>
        {restartMsg && (
          <p className="mt-2 text-sm text-muted-foreground">{restartMsg}</p>
        )}
      </div>

      {/* .env anpassen */}
      {onOpenConfig && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-2 font-semibold text-foreground">Konfiguration</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            Alle Umgebungs-Keys anzeigen und setzen (Config-View).
          </p>
          <button
            onClick={onOpenConfig}
            className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            .env anpassen
          </button>
        </div>
      )}

      {/* Lokales Vault-Passwort vergessen */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
        <h4 className="mb-2 font-semibold text-foreground">Lokales Vault-Passwort vergessen?</h4>
        <p className="mb-2 text-sm text-muted-foreground">
          Die Datei <span className="font-mono">.morgendrot-vault</span> (oder <span className="font-mono">VAULT_FILE</span>)
          ist verschlüsselt – ohne Passwort ist der Inhalt nicht wiederherstellbar.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Neu anlegen:</span> alte Vault-Datei wegsichern/umbenennen, Wallet über
            Mnemonic/Keystore wiederherstellen oder neu erzeugen, <span className="font-mono">MY_ADDRESS</span> in{' '}
            <span className="font-mono">.env</span> anpassen.
          </li>
          <li>
            <span className="text-foreground">PACKAGE_ID:</span> oft gleich lassen, wenn alle dasselbe Move-Paket nutzen;
            sonst neues Paket deployen und überall die neue ID setzen.
          </li>
          <li>
            Nach Handshake/Connect: <span className="font-mono">/vault-save</span> oder Tresor „lokal sichern“ – erzeugt
            eine neue verschlüsselte Datei mit <strong>neuem</strong> Passwort deiner Wahl.
          </li>
          <li>
            War der Tresor nur lokal und nie on-chain: Inhalt ist verloren. War er on-chain: mit <strong>bekanntem</strong>{' '}
            Wallet-Passwort <span className="font-mono">/vault-load-from-chain</span> möglich – nicht mit einem
            erfundenen Passwort.
          </li>
        </ul>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-2 font-semibold text-foreground">Hilfe</h4>
        <p className="text-sm text-muted-foreground">
          Next-UI (Kacheln): <span className="font-mono">http://127.0.0.1:3341</span> · Backend-API:{' '}
          <span className="font-mono">http://127.0.0.1:3342</span> (Port kann weichen – in der Kopfzeile „API:…“).
          Lite-UI liegt auf dem API-Port. Start: <code>npm run dev</code>.{' '}
          <span className="font-mono">.env</span> prüfen.
        </p>
      </div>
    </div>
  )
}
