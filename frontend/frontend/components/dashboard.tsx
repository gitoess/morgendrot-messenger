'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  MessageSquare,
  Lock,
  Eye,
  Crown,
  Shield,
  ArrowRight,
  Wifi,
  WifiOff,
  Settings,
  ChevronLeft,
  HelpCircle,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchStatus, unlockBackend, fetchHelp, type ApiStatus } from '@/frontend/lib/api'
import type { ProjectType, ProjectVariant } from '../lib/types'
import {
  WorkspaceProjectsPanel,
  readWorkspaceTileSet,
  writeWorkspaceTileSet,
  type WorkspaceTileSet,
} from './workspace-projects-panel'

// Views
import { ChatView } from './views/chat-view'
import { LockView } from './views/lock-view'
import { MonitorView } from './views/monitor-view'
import { BossView } from './views/boss-view'
import { VaultView } from './views/vault-view'
import { SettingsView } from './views/settings-view'
import { ConfigView } from './views/config-view'
import { WorkerActionCenterView } from './views/worker-action-center-view'
import { DeviceRadarView } from './views/device-radar-view'
import { SetupOverlay } from '@/components/setup-overlay'
import { MeshStatus, type MeshPathMode } from './mesh-status'
import { tryApplyPendingInitialProfileFromStorage } from '../lib/initial-profile-import'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

interface Feature {
  id: ProjectType
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  variants: {
    id: ProjectVariant
    title: string
    hint: string
  }[]
}

const features: Feature[] = [
  {
    id: 'chat',
    title: 'Nachrichten',
    subtitle: 'Sicher kommunizieren',
    icon: <MessageSquare className="h-6 w-6" />,
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    variants: [
      { id: 'private-chat', title: 'Privat', hint: 'Verschlüsselt mit Partner' },
      { id: 'pinnwand', title: 'Pinnwand', hint: 'Sichtbar für alle' },
    ],
  },
  {
    id: 'lock',
    title: 'Zugang',
    subtitle: 'Schlüssel verwalten',
    icon: <Lock className="h-6 w-6" />,
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    variants: [
      { id: 'smart-lock', title: 'Türschloss', hint: 'Per IOTA öffnen' },
      { id: 'access-key-ticket', title: 'Schlüssel', hint: 'NFT-Berechtigungen' },
      { id: 'payment-trigger', title: 'Zahlung', hint: 'Bezahlen & Freischalten' },
    ],
  },
  {
    id: 'monitor',
    title: 'Überwachung',
    subtitle: 'Geräte im Blick',
    icon: <Eye className="h-6 w-6" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    variants: [
      { id: 'sensor-central', title: 'Sensoren', hint: 'Alarme empfangen' },
      { id: 'device-monitor', title: 'Geräte', hint: 'Online-Status prüfen' },
      { id: 'heartbeat-sender', title: 'Heartbeat', hint: 'Lebenszeichen senden' },
    ],
  },
  {
    id: 'boss',
    title: 'Steuerung',
    subtitle: 'Geräte befehligen',
    icon: <Crown className="h-6 w-6" />,
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    variants: [
      { id: 'boss-signer', title: 'Boss-Modus', hint: 'Befehle an Geräte' },
      { id: 'pinnwand-admin', title: 'Admin', hint: 'Kanäle verwalten' },
    ],
  },
  {
    id: 'vault',
    title: 'Tresor & Passwortmanager',
    subtitle: 'Keys & Zugänge sichern',
    icon: <Shield className="h-6 w-6" />,
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    variants: [
      { id: 'local-vault', title: 'Tresor öffnen', hint: 'Sichern, Passwortmanager' },
      { id: 'emergency-purge', title: 'Notfall', hint: 'Alles löschen' },
    ],
  },
]

interface ActiveView {
  type: ProjectType | 'settings' | 'config'
  variant?: ProjectVariant
}

const FULL_TILES_STORAGE_KEY = 'morgendrot_show_all_tiles'
const FIRST_STEPS_DISMISS_KEY = 'morgendrot.hideFirstStepsCard'

function readShowAllTilesPref(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(FULL_TILES_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeShowAllTilesPref(value: boolean) {
  try {
    window.localStorage.setItem(FULL_TILES_STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

const SIGNER_IMPORT_REQUIRED_CODE = 'SIGNER_IMPORT_REQUIRED' as const

function normalizeSignerWords(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

function countSignerWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

/** Genug für POST /api/unlock (Mnemonic ≥12 Wörter oder Hex32 / langes Bech32-Secret). */
function isPlausibleSdkImport(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (countSignerWords(t) >= 12) return true
  const hex = t.replace(/^0x/i, '').replace(/\s+/g, '')
  if (/^[a-fA-F0-9]{64}$/i.test(hex)) return true
  if (!/\s/.test(t) && t.length >= 60 && /^[a-z]{2,10}1[02-9ac-hj-np-z]+$/i.test(t)) return true
  return false
}

export function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [networkInfo, setNetworkInfo] = useState<string>('')
  const [hoveredFeature, setHoveredFeature] = useState<ProjectType | null>(null)
  const [locked, setLocked] = useState(false)
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  /** Zusatz zu POST /api/unlock bei SIGNER=sdk (Mnemonic / Bech32), wenn nicht im Vault. */
  const [signerImport, setSignerImport] = useState('')
  const [signerImportConfirm, setSignerImportConfirm] = useState('')
  /** Öffnen = bestehende Vault-Datei / Sitzung; Neu anlegen = erstes Setup ohne lokale Datei (SIGNER=sdk: Seed+Vault-PW jeweils doppelt). */
  const [unlockFlow, setUnlockFlow] = useState<'open' | 'create'>('open')
  /** Bei „Öffnen“ + sdk: Mnemonic-Feld erst nach Bedarf (Backend-Code) oder Klick anzeigen. */
  const [showSignerImportOpen, setShowSignerImportOpen] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpText, setHelpText] = useState('')
  const [helpLoading, setHelpLoading] = useState(false)
  const [role, setRole] = useState<string>('')
  const [myAddress, setMyAddress] = useState<string>('')
  const [showAllTiles, setShowAllTiles] = useState(false)
  const [rpcProxyActive, setRpcProxyActive] = useState(false)
  const [workspaceTileSet, setWorkspaceTileSet] = useState<WorkspaceTileSet>('full')
  const [apiSnapshot, setApiSnapshot] = useState<(ApiStatus & { error?: string }) | null>(null)
  /** Hinweis nach automatischem Import aus „Einsatz-Profil“ (localStorage-Warteschlange). */
  const [initialProfileBanner, setInitialProfileBanner] = useState<string | null>(null)
  /** Roadmap H.0 / ONBOARDING L2: „Erste Schritte“-Hinweis (per „Ausblenden“ dauerhaft aus). */
  const [hideFirstStepsCard, setHideFirstStepsCard] = useState(false)

  const prevLockedRef = useRef(false)
  /** Zuletzt von GET /api/status gemeldet — für Entsperr-Dialog beim Wechsel auf „locked“ ohne veraltetes apiSnapshot. */
  const vaultHasLocalRef = useRef(false)

  useEffect(() => {
    const prev = prevLockedRef.current
    prevLockedRef.current = locked
    if (locked && !prev) {
      setUnlockError('')
      setSignerImport('')
      setSignerImportConfirm('')
      setPassword('')
      setPasswordConfirm('')
      setShowSignerImportOpen(false)
      setUnlockFlow(vaultHasLocalRef.current ? 'open' : 'create')
    }
  }, [locked])

  useEffect(() => {
    setShowAllTiles(readShowAllTilesPref())
    setWorkspaceTileSet(readWorkspaceTileSet())
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(FIRST_STEPS_DISMISS_KEY) === '1') {
        setHideFirstStepsCard(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const dismissFirstStepsCard = () => {
    try {
      window.localStorage.setItem(FIRST_STEPS_DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setHideFirstStepsCard(true)
  }

  /** GET /api/status: `uiVariant` spiegelt `UI_VARIANT` im Backend – Messenger-Bundle/Lite. */
  const liteMessengerFromApi = apiSnapshot?.backendRunning !== false && apiSnapshot?.uiVariant === 'messenger'
  const isBossRole = (role || '').toLowerCase() === 'boss'
  /** Lite-Messenger: nur Boss darf Volldashboard + alle Kacheln; alle anderen nur Nachrichten + Tresor/Notfall. */
  const liteMessengerLocksTiles = liteMessengerFromApi && !isBossRole
  const effectiveWorkspaceTileSet: WorkspaceTileSet = liteMessengerLocksTiles ? 'messenger' : workspaceTileSet

  useEffect(() => {
    if (apiSnapshot?.uiVariant !== 'messenger') return
    if ((apiSnapshot?.role || '').toLowerCase() === 'boss') return
    setWorkspaceTileSet('messenger')
    writeWorkspaceTileSet('messenger')
  }, [apiSnapshot?.uiVariant, apiSnapshot?.role])

  const setShowAllTilesPersist = (value: boolean) => {
    setShowAllTiles(value)
    writeShowAllTilesPref(value)
  }

  const checkStatus = async () => {
    const res = await fetchStatus()
    if ('pollClockHint' in res) {
      const { pollClockHint: _hint, ...snap } = res
      setApiSnapshot(snap)
    } else {
      setApiSnapshot(res)
    }
    if ('pollClockHint' in res && res.backendRunning) {
      setBackendReachable(true)
      setConnected(!!res.connected)
      setNetworkInfo(res.rpcUrlLabel || res.network || 'IOTA Rebased')
      setLocked(!!res.locked)
      vaultHasLocalRef.current = res.vaultStatus?.hasLocal === true
      setRole(res.role || '')
      setMyAddress((res.myAddressFull || res.myAddress || '').trim())
    } else {
      setBackendReachable(false)
      setConnected(false)
      setLocked(false)
      vaultHasLocalRef.current = false
    }
  }

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  /** Pending `initialProfile` aus Einstellungen anwenden, sobald API läuft (Paket 4 / Roadmap H.3g). */
  useEffect(() => {
    if (backendReachable !== true) return
    if (apiSnapshot?.backendRunning === false) return
    let cancelled = false
    void (async () => {
      const r = await tryApplyPendingInitialProfileFromStorage()
      if (cancelled) return
      if (r.ok && !r.skipped && r.message) {
        setInitialProfileBanner(r.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [backendReachable, apiSnapshot?.backendRunning])

  const handleUnlock = async () => {
    setUnlockError('')
    const signer = apiSnapshot?.signer

    if (unlockFlow === 'create') {
      if (!password.trim() || password !== passwordConfirm) {
        setUnlockError('Tresor-/Wallet-Passwort und Wiederholung müssen übereinstimmen.')
        return
      }
      if (signer === 'sdk') {
        const sa = signerImport.trim()
        const sb = signerImportConfirm.trim()
        if (!sa || normalizeSignerWords(sa) !== normalizeSignerWords(sb)) {
          setUnlockError('Mnemonic / Secret und Wiederholung müssen übereinstimmen.')
          return
        }
        if (!isPlausibleSdkImport(sa)) {
          setUnlockError(
            'Mnemonic: mindestens 12 Wörter — oder gültiges Bech32-/64-Hex-Secret (siehe Hilfe).'
          )
          return
        }
      }
    } else if (signer === 'sdk' && showSignerImportOpen) {
      const t = signerImport.trim()
      if (t && !isPlausibleSdkImport(t)) {
        setUnlockError(
          'Mnemonic / Secret scheint ungültig (mindestens 12 Wörter oder Bech32/Hex wie in der Hilfe).'
        )
        return
      }
    }

    let sdkExtra: string | undefined
    if (signer === 'sdk') {
      if (unlockFlow === 'create') {
        sdkExtra = signerImport.trim()
      } else {
        sdkExtra = showSignerImportOpen ? signerImport.trim() || undefined : undefined
      }
    }

    setUnlocking(true)
    const res = await unlockBackend(password, { sdkSignerImport: sdkExtra })
    setUnlocking(false)
    if (res.ok) {
      setPassword('')
      setPasswordConfirm('')
      setSignerImport('')
      setSignerImportConfirm('')
      setShowSignerImportOpen(false)
      setLocked(false)
      await checkStatus()
      // Backend braucht ggf. etwas Zeit für Wallet – mehrfach Status holen
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const s = await fetchStatus()
        if (!('pollClockHint' in s)) continue
        if (s.connected) {
          setConnected(true)
          setLocked(!!s.locked)
          break
        }
        if (s.locked) break
        setConnected(!!s.connected)
      }
    } else {
      setUnlockError(res.error || 'Entsperren fehlgeschlagen')
      if (res.code === SIGNER_IMPORT_REQUIRED_CODE && apiSnapshot?.signer === 'sdk' && unlockFlow === 'open') {
        setShowSignerImportOpen(true)
      }
    }
  }

  const handleSelectFeature = (feature: Feature, variant: ProjectVariant) => {
    setActiveView({ type: feature.id, variant })
  }

  const setWorkspaceTileSetPersist = (v: WorkspaceTileSet) => {
    if (liteMessengerFromApi && v === 'full' && !isBossRole) return
    setWorkspaceTileSet(v)
    writeWorkspaceTileSet(v)
  }

  const messengerPackIds = new Set<ProjectType>(['chat', 'vault'])
  const visibleFeatures =
    effectiveWorkspaceTileSet === 'messenger' ? features.filter((f) => messengerPackIds.has(f.id)) : features

  const handleBack = () => {
    setActiveView(null)
  }

  const openHelp = async () => {
    setHelpOpen(true)
    setHelpLoading(true)
    const res = await fetchHelp()
    setHelpText(res.ok && res.helpText ? res.helpText : res.error || 'Keine Hilfe verfügbar.')
    setHelpLoading(false)
  }

  const meshPathMode: MeshPathMode =
    backendReachable === false
      ? 'offline'
      : rpcProxyActive || process.env.NEXT_PUBLIC_PRIVACY_TOR === '1'
        ? 'tor'
        : 'internet'

  const signerKind = apiSnapshot?.signer
  const unlockButtonDisabled =
    unlocking ||
    !password.trim() ||
    (unlockFlow === 'create' &&
      (!passwordConfirm.trim() || password !== passwordConfirm)) ||
    (unlockFlow === 'create' &&
      signerKind === 'sdk' &&
      (!signerImport.trim() ||
        !signerImportConfirm.trim() ||
        normalizeSignerWords(signerImport) !== normalizeSignerWords(signerImportConfirm)))

  const sharedDialogs = (
    <>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Hilfe
            </DialogTitle>
            <DialogDescription>
              Oben Kurzüberblick (Next-Messenger), darunter vollständige Befehlsliste — vom Backend
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap font-mono">
            {helpLoading ? (
              <span className="text-muted-foreground">Lade…</span>
            ) : (
              helpText
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={locked} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md z-[200]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => locked && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Wallet entsperren</DialogTitle>
            <DialogDescription asChild className="text-left space-y-2">
              <div className="space-y-2">
                <p>
                  Entsperrt die <strong>Backend-Sitzung</strong> zum Signieren. Das Passwort entschlüsselt den lokalen oder
                  On-Chain-Vault, falls vorhanden — kein separates Web-Login.
                </p>
                {signerKind === 'cli' ? (
                  <p>
                    Bei <span className="font-mono text-xs">SIGNER=cli</span>: Passwort des <strong>IOTA-CLI-Keystores</strong>{' '}
                    zur konfigurierten Adresse — kein Mnemonic in dieser App.
                  </p>
                ) : signerKind === 'sdk' ? (
                  <p>
                    Bei <span className="font-mono text-xs">SIGNER=sdk</span>: Nach dem ersten erfolgreichen Speichern mit
                    „Signer-Import mit speichern“ im Tresor reicht meist <strong>nur noch das Passwort</strong>. Der Mnemonic-Bereich
                    erscheint nur bei Bedarf (Schaltfläche unten) oder wenn der Server danach fragt.
                  </p>
                ) : signerKind === 'remote' ? (
                  <p>
                    Bei <span className="font-mono text-xs">SIGNER=remote</span>: Vault-Passwort; Signatur extern.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    <span className="font-mono text-xs">SIGNER</span> steht in der Server-Konfiguration (
                    <span className="font-mono text-xs">GET /api/status</span>).
                  </p>
                )}
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  <strong className="text-foreground">Passwort vergessen?</strong> Ohne das bisherige Vault-Passwort ist der
                  Inhalt der Datei kryptographisch nicht wiederherzustellen. Ein Seed beweist nur die IOTA-Wallet — die
                  verschlüsselten Messaging-Keys liegen <strong>getrennt</strong> in der Vault. Mit dem Seed kannst du höchstens ein{' '}
                  <strong>neues</strong> Profil aufsetzen (neuer Tresor); die alte Datei bleibt ohne altes Passwort unlesbar.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto py-4 pr-1">
            <RadioGroup
              value={unlockFlow}
              onValueChange={(v) => {
                setUnlockFlow(v as 'open' | 'create')
                setShowSignerImportOpen(false)
                setUnlockError('')
                setPasswordConfirm('')
                if (v === 'open') {
                  setSignerImportConfirm('')
                }
              }}
              className="gap-3"
            >
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="open" id="uf-open" className="mt-1" />
                <div className="min-w-0">
                  <Label htmlFor="uf-open" className="cursor-pointer font-medium text-foreground">
                    Tresor öffnen
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Bestehende Vault-Datei oder On-Chain-Vault — zuerst nur Passwort; Mnemonic nur falls nötig.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="create" id="uf-create" className="mt-1" />
                <div className="min-w-0">
                  <Label htmlFor="uf-create" className="cursor-pointer font-medium text-foreground">
                    Neu anlegen
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Erstes Setup ohne lokale <span className="font-mono">.morgendrot-vault</span>. Bei{' '}
                    <span className="font-mono text-xs">SIGNER=sdk</span>: Seed und Passwort jeweils zweimal bestätigen.
                  </p>
                </div>
              </div>
            </RadioGroup>
            {apiSnapshot?.vaultStatus?.hasLocal && unlockFlow === 'create' ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                Es existiert bereits eine lokale Vault-Datei. In der Regel <strong>Tresor öffnen</strong> wählen — „Neu anlegen“
                nur bei zweitem Profil (eigene Datei / Server-Konfiguration).
              </p>
            ) : null}
            {!apiSnapshot?.vaultStatus?.hasLocal && unlockFlow === 'open' && signerKind === 'sdk' ? (
              <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                Keine lokale Vault-Datei. Mit <strong>Tresor öffnen</strong> und nur Passwort entsperrt{' '}
                <span className="font-mono text-xs">SIGNER=sdk</span> nicht — bitte <strong>Neu anlegen</strong> oder Mnemonic
                über die Schaltfläche unten ergänzen.
              </p>
            ) : null}

            {unlockFlow === 'open' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="wallet-password">Passwort (Wallet / Vault)</Label>
                  <Input
                    id="wallet-password"
                    type="password"
                    placeholder="Passwort eingeben"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !unlockButtonDisabled && handleUnlock()}
                    autoComplete="current-password"
                  />
                </div>
                {signerKind === 'sdk' ? (
                  showSignerImportOpen ? (
                    <div className="space-y-2">
                      <Label htmlFor="wallet-signer-import">Mnemonic / Bech32-Secret</Label>
                      <Textarea
                        id="wallet-signer-import"
                        placeholder="12–24 Wörter oder IOTA-Bech32-Secret …"
                        value={signerImport}
                        onChange={(e) => setSignerImport(e.target.value)}
                        className="min-h-[88px] font-mono text-xs"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                        onClick={() => {
                          setShowSignerImportOpen(false)
                          setSignerImport('')
                          setUnlockError('')
                        }}
                      >
                        Mnemonic-Eingabe ausblenden
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/60"
                      onClick={() => setShowSignerImportOpen(true)}
                    >
                      Mnemonic oder Secret eingeben (nur wenn im Tresor noch kein Signer-Import gespeichert ist)
                    </button>
                  )
                ) : null}
              </>
            ) : (
              <>
                {signerKind === 'sdk' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="create-signer-a">Mnemonic / Bech32-Secret</Label>
                      <Textarea
                        id="create-signer-a"
                        placeholder="12–24 Wörter oder Secret …"
                        value={signerImport}
                        onChange={(e) => setSignerImport(e.target.value)}
                        className="min-h-[80px] font-mono text-xs"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-signer-b">Mnemonic / Secret wiederholen</Label>
                      <Textarea
                        id="create-signer-b"
                        placeholder="Zur Bestätigung erneut eingeben"
                        value={signerImportConfirm}
                        onChange={(e) => setSignerImportConfirm(e.target.value)}
                        className="min-h-[80px] font-mono text-xs"
                        autoComplete="off"
                      />
                    </div>
                  </>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="wallet-password-create">Passwort (Vault / Wallet der Sitzung)</Label>
                  <Input
                    id="wallet-password-create"
                    type="password"
                    placeholder="Passwort wählen"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet-password-create-2">Passwort wiederholen</Label>
                  <Input
                    id="wallet-password-create-2"
                    type="password"
                    placeholder="Passwort wiederholen"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !unlockButtonDisabled && handleUnlock()}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            {unlockError ? <p className="text-sm text-destructive">{unlockError}</p> : null}
            <Button onClick={() => void handleUnlock()} disabled={unlockButtonDisabled} className="w-full">
              {unlocking ? 'Wird entsperrt…' : 'Entsperren'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  return (
    <>
      {sharedDialogs}
      {activeView ? (
      <div className="min-h-screen bg-background">
        {/* Slim Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center gap-4 px-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Zurück</span>
            </button>
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-semibold text-foreground">
              {activeView.type === 'settings'
                ? 'Einstellungen'
                : activeView.type === 'config'
                  ? '.env anpassen'
                  : features.find((f) => f.id === activeView.type)?.title}
            </span>
          </div>
        </header>

        {/* View Content */}
        <main className="mx-auto max-w-5xl p-4">
          {initialProfileBanner ? (
            <div
              className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
              role="status"
            >
              <span>{initialProfileBanner}</span>
              <button
                type="button"
                className="shrink-0 rounded px-2 py-0.5 text-emerald-300/90 hover:bg-emerald-500/20 hover:text-emerald-50"
                onClick={() => setInitialProfileBanner(null)}
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
          ) : null}
          {activeView.type === 'settings' && (
            <SettingsView
              onOpenConfig={() => setActiveView({ type: 'config' })}
              showAllTiles={showAllTiles}
              onShowAllTilesChange={setShowAllTilesPersist}
              canToggleFullTiles={role === 'arbeiter' || role === 'lock'}
            />
          )}
          {activeView.type === 'config' && <ConfigView />}
          {activeView.type === 'chat' && activeView.variant && (
            <ChatView variant={activeView.variant as 'private-chat' | 'pinnwand'} role={role} myAddress={myAddress} />
          )}
          {activeView.type === 'lock' && activeView.variant && (
            <LockView variant={activeView.variant as 'smart-lock' | 'access-key-ticket' | 'payment-trigger'} />
          )}
          {activeView.type === 'monitor' && activeView.variant && (
            <MonitorView variant={activeView.variant as 'sensor-central' | 'device-monitor' | 'heartbeat-sender'} />
          )}
          {activeView.type === 'boss' && activeView.variant && (
            <BossView
              variant={activeView.variant as 'boss-signer' | 'pinnwand-admin'}
              apiSnapshot={apiSnapshot && !('error' in apiSnapshot && apiSnapshot.error) ? apiSnapshot : null}
            />
          )}
          {activeView.type === 'vault' && activeView.variant && (
            <VaultView variant={activeView.variant as 'local-vault' | 'emergency-purge'} />
          )}
        </main>
      </div>
      ) : (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
              M
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Morgendrot</h1>
              <p className="text-xs text-muted-foreground">
                {networkInfo || 'IOTA Rebased'}
                {role ? (
                  <span className="ml-1 font-mono text-[10px] text-foreground/80" title="Kommt aus Backend .env ROLE">
                    · Rolle: {role}
                  </span>
                ) : null}
                {apiSnapshot?.apiListenPort != null && (
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground/90">
                    · API:{apiSnapshot.apiListenPort}
                    {apiSnapshot.uiVariant === 'messenger' ? ' · Lite messenger' : ''}
                  </span>
                )}
              </p>
              <div className="mt-1">
                <MeshStatus
                  mode={meshPathMode}
                  subtitle={
                    rpcProxyActive
                      ? 'IOTA-RPC geht über Backend-Proxy (SOCKS5 oder HTTP) – siehe Einstellungen → .env anpassen (RPC_SOCKS_PROXY).'
                      : 'Tor/VPN: RPC_SOCKS_PROXY in Einstellungen setzen; LoRa/BLE im Chat (Meshtastic) koppeln.'
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',
                backendReachable === null || (backendReachable && connected === null && !locked)
                  ? 'bg-muted text-muted-foreground'
                  : locked
                    ? 'bg-amber-500/10 text-amber-400'
                    : connected
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : backendReachable
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
              )}
            >
              {backendReachable === null ? (
                <>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-current" />
                  Verbinde...
                </>
              ) : locked ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Passwort?
                </>
              ) : connected ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  Chat verbunden
                </>
              ) : backendReachable ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500/80" />
                  <span title="API läuft und Wallet ist frei. „Chat verbunden“ erst nach /connect mit Partner.">
                    Bereit
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  Offline
                </>
              )}
            </div>
            {/* Setup (Package-ID, RPC, .env) */}
            <SetupOverlay onOpenConfig={() => setActiveView({ type: 'config' })} />
            {/* Hilfe: HELP_UI_INTRO + Befehle (GET /api/help) — Roadmap H.0 */}
            <button
              type="button"
              onClick={() => void openHelp()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Hilfe — Kurzüberblick und Befehle"
              aria-label="Hilfe öffnen"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            {/* Handbuch (PWA, /handbook) */}
            <Link
              href="/handbook"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Handbuch — nach erstem Laden oft offline"
            >
              <BookOpen className="h-5 w-5" />
            </Link>
            {/* Settings */}
            <button
              onClick={() => setActiveView({ type: 'settings' })}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        {initialProfileBanner ? (
          <div
            className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
            role="status"
          >
            <span>{initialProfileBanner}</span>
            <button
              type="button"
              className="shrink-0 rounded px-2 py-0.5 text-emerald-300/90 hover:bg-emerald-500/20 hover:text-emerald-50"
              onClick={() => setInitialProfileBanner(null)}
              aria-label="Schließen"
            >
              ×
            </button>
          </div>
        ) : null}
        {!locked && !hideFirstStepsCard && (
          <div
            className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4 text-sm shadow-sm"
            role="region"
            aria-label="Erste Schritte"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <BookOpen className="h-4 w-4 shrink-0 text-emerald-400" />
                  Erste Schritte
                </h3>
                <p className="text-muted-foreground">
                  <strong className="text-foreground/90">Deine Adresse</strong>, Package-ID und RPC kommen typischerweise aus dem{' '}
                  <strong className="text-foreground/90">Bundle der Basis</strong> (Server-<span className="font-mono text-xs">.env</span>) — nicht
                  alles lässt sich hier in der App ändern. Das <strong className="text-foreground/90">Handbuch</strong> beschreibt Einrichtung und
                  Lieferwege (Boss → Helfer); nach dem ersten Laden oft auch ohne Netz lesbar.
                </p>
                {liteMessengerFromApi ? (
                  <p className="text-muted-foreground">
                    <strong className="text-foreground/90">Lite messenger</strong> (<span className="font-mono text-xs">UI_VARIANT=messenger</span>
                    ):{' '}
                    {isBossRole ? (
                      <>
                        Als <strong className="text-foreground/90">Boss</strong> kannst du unter „Arbeitsbereich &amp; Projekte“{' '}
                        <strong className="text-foreground/90">Volldashboard</strong> wählen (alle Kacheln, Geräte-Radar). Standard ist
                        schlank wie beim Helfer, wenn du auf <strong className="text-foreground/90">Messenger-Projekt</strong> stellst.
                      </>
                    ) : (
                      <>
                        Für deine Rolle nur <strong className="text-foreground/90">Nachrichten</strong> und{' '}
                        <strong className="text-foreground/90">Tresor</strong> (inkl. Notfall) — keine weiteren Kacheln, Einsatz schlank.
                      </>
                    )}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void openHelp()}
                    className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-500/20"
                  >
                    Hilfe (Kurz + Befehle)
                  </button>
                  <Link
                    href="/handbook"
                    className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-500/20"
                  >
                    Handbuch öffnen
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActiveView({ type: 'settings' })}
                    className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Einstellungen (Wallet, Einsatz-Profil)
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissFirstStepsCard}
                className="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Erste Schritte ausblenden"
              >
                Ausblenden
              </button>
            </div>
          </div>
        )}
        {/* Arbeiter/Lock: Action Center statt Kacheln */}
        {(role === 'arbeiter' || role === 'lock') && !showAllTiles && (
          <>
            <div className="mb-6">
              <WorkerActionCenterView />
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllTilesPersist(true)}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                {liteMessengerLocksTiles
                  ? 'Nachrichten & Tresor anzeigen'
                  : 'Alle Funktionen (Kacheln) anzeigen'}
              </button>
            </div>
          </>
        )}

        {/* Boss/Kommandant: Geräte-Radar (nur Volldashboard – Messenger-Projekt wie Standalone schlanker) */}
        {(role === 'boss' || role === 'kommandant') && effectiveWorkspaceTileSet === 'full' && (
          <div className="mb-8">
            <DeviceRadarView />
          </div>
        )}

        <WorkspaceProjectsPanel
          className="mb-8"
          apiStatus={apiSnapshot}
          tileSet={effectiveWorkspaceTileSet}
          onTileSetChange={setWorkspaceTileSetPersist}
          dashboardRole={role}
          liteUiEnforcedByBackend={liteMessengerLocksTiles}
        />

        {/* Kacheln: immer für Boss/Kommandant; für Arbeiter/Lock nur wenn showAllTiles */}
        {((role !== 'arbeiter' && role !== 'lock') || showAllTiles) && (
          <>
            {showAllTiles && (role === 'arbeiter' || role === 'lock') && (
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllTilesPersist(false)}
                  className="text-sm text-muted-foreground underline hover:text-foreground"
                >
                  Zurück zum Action Center
                </button>
              </div>
            )}
            {/* Welcome */}
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-foreground">Was möchtest du tun?</h2>
              <p className="mt-1 text-muted-foreground">Wähle eine Funktion, um loszulegen</p>
            </div>

            {/* Feature Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFeatures.map((feature) => (
            <div
              key={feature.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/50"
              onMouseEnter={() => setHoveredFeature(feature.id)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border p-4">
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-xl border transition-colors',
                    feature.color
                  )}
                >
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.subtitle}</p>
                </div>
              </div>

              {/* Variants */}
              <div className="p-2">
                {feature.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => handleSelectFeature(feature, variant.id)}
                    className="flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div>
                      <span className="block font-medium text-foreground">{variant.title}</span>
                      <span className="block text-sm text-muted-foreground">{variant.hint}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          ))}
            </div>
          </>
        )}

        {/* Quick Hint: nur wenn Backend wirklich nicht erreichbar */}
        {backendReachable === false && (
          <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
            <p className="text-sm text-amber-400">
              Keine Verbindung zum Backend. Starte <code className="rounded bg-amber-500/20 px-1">npm run dev</code> (Backend 127.0.0.1:3342 + UI 127.0.0.1:3341). Wenn das Backend mit Fehlercode beendet: <code className="rounded bg-amber-500/20 px-1">npm run start:secrets</code> einzeln in einem Terminal ausführen, um die Fehlermeldung zu sehen.
            </p>
          </div>
        )}
      </main>
    </div>
      )}
    </>
  )
}
