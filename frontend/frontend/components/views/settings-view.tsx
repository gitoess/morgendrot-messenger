'use client'

import { useState, useEffect, useCallback } from 'react'
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
  KeyRound,
  ListOrdered,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  getStatus,
  fetchStatus,
  revealVaultSignerImport,
  restartBackend,
  fetchEinsatzRoleTemplates,
  saveEinsatzRoleTemplates,
  type ApiStatus,
} from '@/frontend/lib/api'
import {
  canEditEinsatzRoleTemplates,
  canUseMessengerExpertTools,
  canViewEinsatzRoleTemplatesSection,
} from '@/frontend/lib/messenger-role-capabilities'
import { validateEinsatzRoleTemplatesBody } from '@/frontend/lib/einsatz-role-templates-validate'
import Link from 'next/link'
import { SettingsWalletSessionCard } from '@/frontend/components/views/settings-wallet-session-card'
import { HandoffImportPanel } from '@/frontend/components/handoff-import-panel'
import { BossHandoffExportPanel } from '@/frontend/components/boss-handoff-export-panel'
import { ActiveProfilePanel } from '@/frontend/components/active-profile-panel'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { ChatViewShadowSweep } from '@/frontend/components/chat-view-shadow-sweep'
import { SettingsTelegramIntegration } from '@/frontend/components/views/settings-telegram-integration'
import { ChatViewPulseSettings } from '@/frontend/components/chat-view-pulse-settings'
import {
  notifyFirstStepsPrefChanged,
  readFirstStepsVisible,
  writeFirstStepsVisible,
} from '@/frontend/lib/dashboard-first-steps-pref'
import {
  getDirectIotaPathUiState,
  getIotaSubmitMode,
  setDirectMailboxDrainEnabled,
  setIotaSubmitMode,
  type DirectIotaPathUiState,
} from '@/frontend/lib/direct-iota-plain-submit'

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
  
  const [restarting, setRestarting] = useState(false)
  const [restartMsg, setRestartMsg] = useState('')

  /** Recovery phrase / SDK-Import aus Vault (SIGNER=sdk). */
  const [recoveryPw, setRecoveryPw] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryErr, setRecoveryErr] = useState('')
  const [revealedSigner, setRevealedSigner] = useState<string | null>(null)

  /** Boss/Werkstatt: `GET/POST /api/einsatz-role-templates` (Roadmap § H.3g Paket 6). */
  const [roleTemplatesJson, setRoleTemplatesJson] = useState('[]')
  const [roleTemplatesBusy, setRoleTemplatesBusy] = useState(false)
  const [roleTemplatesMsg, setRoleTemplatesMsg] = useState('')

  const [iotaPathUi, setIotaPathUi] = useState<DirectIotaPathUiState | null>(null)
  const [advancedIotaStatus, setAdvancedIotaStatus] = useState<ApiStatus | null>(null)
  const refreshIotaPathUi = useCallback(() => {
    setIotaPathUi(getDirectIotaPathUiState())
  }, [])

  const [firstStepsBarVisible, setFirstStepsBarVisible] = useState(true)

  const { directory: contactDirectory } = useContactDirectory()
  const isBossRole =
    (advancedIotaStatus?.role || status?.role || '').trim().toLowerCase() === 'boss'

  const roleCapsStatus: ApiStatus | null = advancedIotaStatus
    ? { ...advancedIotaStatus, backendOnline: status?.backendOnline ?? advancedIotaStatus.backendRunning }
    : status?.backendOnline && (status.role === 'boss' || status.role === 'kommandant')
      ? {
          backendRunning: true,
          backendOnline: status.backendOnline,
          role: status.role,
          deploymentProfile: 'einsatz',
          permissions: status.role === 'boss' ? { configChange: true, teamManage: true } : { teamManage: true },
        }
      : null
  const showEinsatzRoleTemplates = canViewEinsatzRoleTemplatesSection(roleCapsStatus)
  const canSaveEinsatzRoleTemplates = canEditEinsatzRoleTemplates(roleCapsStatus)
  const showAdvancedIotaPulse = advancedIotaStatus && canUseMessengerExpertTools(advancedIotaStatus)

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
    if (!canSaveEinsatzRoleTemplates) {
      setRoleTemplatesMsg('Speichern nur für Boss (configChange).')
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
    const validated = validateEinsatzRoleTemplatesBody({ templates: parsed })
    if (!validated.ok) {
      setRoleTemplatesMsg(validated.error)
      return
    }
    setRoleTemplatesBusy(true)
    try {
      const res = await saveEinsatzRoleTemplates(validated.templates)
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
    if (!showEinsatzRoleTemplates || !status?.backendOnline) return
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
  }, [showEinsatzRoleTemplates, status?.backendOnline])

  const loadStatus = async () => {
    setLoading(true)
    const res = await getStatus()
    if (res.ok && res.data) {
      setStatus(res.data)
    }
    const adv = await fetchStatus()
    if ('pollClockHint' in adv) setAdvancedIotaStatus(adv)
    else setAdvancedIotaStatus(null)
    setLoading(false)
  }

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    setFirstStepsBarVisible(readFirstStepsVisible())
  }, [])

  useEffect(() => {
    refreshIotaPathUi()
  }, [refreshIotaPathUi])

  useEffect(() => {
    if (!loading) refreshIotaPathUi()
  }, [loading, status?.packageId, status?.backendOnline, refreshIotaPathUi])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
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

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-semibold text-foreground">Startseite</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Die schlanke Zeile <strong className="text-foreground">Einrichtung</strong> (Links zum Handbuch) nach dem
              Ausblenden hier wieder aktivieren.
            </p>
          </div>
          <Switch
            checked={firstStepsBarVisible}
            onCheckedChange={(on) => {
              writeFirstStepsVisible(on)
              setFirstStepsBarVisible(on)
              notifyFirstStepsPrefChanged()
            }}
            aria-label="Einrichtungszeile auf dem Dashboard anzeigen"
          />
        </div>
      </div>

      <ActiveProfilePanel status={advancedIotaStatus} />

      {isBossRole ? (
        <BossHandoffExportPanel
          apiSnapshot={advancedIotaStatus}
          contactDirectory={contactDirectory}
          embedded
        />
      ) : (
        <HandoffImportPanel />
      )}

      {isBossRole ? (
        <p className="text-xs text-muted-foreground px-1">
          Gleicher Export-Assistent auch unter Dashboard →{' '}
          <span className="text-foreground">Einsatzleitung</span> oder{' '}
          <span className="text-foreground">Boss-Modus</span>.
        </p>
      ) : null}

      {showAdvancedIotaPulse ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-2 font-semibold text-foreground">Direkt-RPC · IDs · Funk</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            Erweiterte IOTA-/Mailbox-Details, Ketten-IDs, Direkt-RPC und Expertenoptionen aus dem Chat hier zentral.
          </p>
          <ChatViewPulseSettings apiStatus={advancedIotaStatus!} allowDevExpertTools={false} />
        </div>
      ) : null}

      <SettingsWalletSessionCard />

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
            <Zap className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h4 className="font-semibold text-foreground">IOTA auf diesem Gerät</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                <strong className="text-foreground">Handy-first:</strong> Signatur und PTB laufen direkt im Browser
                über die konfigurierte Fullnode. Die Morgendrot-API ist dabei optionaler Relay/Fallback.
              </p>
            </div>
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
                  refreshIotaPathUi()
                }}
                aria-label="Direkt mit IOTA verbinden"
              />
            </div>
            {iotaPathUi ? (
              <div className="rounded-lg border border-border/80 bg-muted/15 px-3 py-2 text-xs">
                <p className="font-medium text-foreground">{iotaPathUi.headline}</p>
                <p className="mt-1 text-muted-foreground leading-relaxed">{iotaPathUi.detail}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">PWA installieren</strong> und <strong className="text-foreground">IOTA überweisen</strong> liegen
        auf dem <strong className="text-foreground">Haupt-Dashboard</strong> (Kachel-Ansicht).
      </p>

      {showEinsatzRoleTemplates ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <ListOrdered className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-foreground">Einsatz-Rollen-Vorlagen (Geräte / Worker)</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  <strong className="text-foreground">Wozu?</strong> Vorgefertigte <strong>Rollen-Labels und Kurztexte</strong>, die
                  der Boss beim Anlegen oder Zuweisen von Geräten/Workern nutzen kann (kein Chat-Inhalt). Landet in{' '}
                  <span className="font-mono text-xs">.morgendrot-einsatz-templates.json</span> am Backend (API wie Lite-Provisioning).
                  {!canSaveEinsatzRoleTemplates ? (
                    <>
                      {' '}
                      <strong className="text-foreground">Kommandant:</strong> nur Lesen — Speichern nur Boss.
                    </>
                  ) : null}{' '}
                  Spezifikation:{' '}
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
                disabled={roleTemplatesBusy || !status?.backendOnline || !canSaveEinsatzRoleTemplates}
                readOnly={!canSaveEinsatzRoleTemplates}
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
                {canSaveEinsatzRoleTemplates ? (
                  <button
                    type="button"
                    disabled={roleTemplatesBusy || !status?.backendOnline}
                    onClick={() => void saveRoleTemplates()}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {roleTemplatesBusy ? '…' : 'Speichern'}
                  </button>
                ) : null}
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
                Signer-Mnemonic aus der Vault nur anzeigen, wenn du sie beim Speichern mit abgelegt hast (
                <span className="font-mono text-xs">Signer-Import mit speichern</span>). Ohne Backup geht bei Verlust der
                Zugriff verloren — der Server hält keinen Klartext-Key. Hintergrund:{' '}
                <Link
                  href="/handbook?file=RECOVERY-PHRASE-BACKUP.md"
                  className="text-primary underline underline-offset-2 hover:text-primary/90"
                >
                  Recovery / Backup
                </Link>
                ,{' '}
                <Link
                  href="/handbook?file=ONBOARDING-WALLET-UX-SPEC.md"
                  className="text-primary underline underline-offset-2 hover:text-primary/90"
                >
                  Wallet-Onboarding
                </Link>
                .
              </p>
            </div>
          </div>

          {status.signer === 'sdk' ? (
            <>
              {!status.vaultHasLocal ? (
                <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                  Keine lokale Vault-Datei — im Tresor <strong className="font-medium">lokal sichern</strong> (optional
                  Signer-Import) oder von der Chain laden.
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
              <span className="font-mono">SIGNER={status.signer ?? '?'}</span> — Vault-Mnemonic-Anzeige nur bei{' '}
              <span className="font-mono">sdk</span>. Bei <span className="font-mono">cli</span> /{' '}
              <span className="font-mono">remote</span>:{' '}
              <Link
                href="/handbook?file=RECOVERY-PHRASE-BACKUP.md"
                className="text-primary underline underline-offset-2 hover:text-primary/90"
              >
                Handbuch
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {status?.backendOnline ? <ChatViewShadowSweep /> : null}

      <SettingsTelegramIntegration backendOnline={status?.backendOnline ?? false} />

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
        <p className="text-sm text-muted-foreground">
          Die Vault-Datei (<span className="font-mono">.morgendrot-vault</span> /{' '}
          <span className="font-mono">VAULT_FILE</span>) ist ohne das richtige Passwort nicht lesbar — es gibt keinen
          technischen Reset. Neu anlegen, Chain-Backup und{' '}
          <span className="font-mono">PACKAGE_ID</span>:{' '}
          <Link
            href="/handbook?file=VAULT-EINRICHTEN.md"
            className="text-primary underline underline-offset-2 hover:text-primary/90"
          >
            Tresor einrichten (Handbuch)
          </Link>
          .
        </p>
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
