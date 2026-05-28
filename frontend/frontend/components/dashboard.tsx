'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
import { fetchStatus, unlockBackend, fetchHelp, vaultLockCommand, type ApiStatus } from '@/frontend/lib/api'
import type { ProjectType, ProjectVariant } from '../lib/types'
import {
  WorkspaceProjectsPanel,
  readWorkspaceTileSet,
  writeWorkspaceTileSet,
  type WorkspaceTileSet,
} from './workspace-projects-panel'

// Views
import { ChatView } from './views/chat-view'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import { LockView } from './views/lock-view'
import { MonitorView } from './views/monitor-view'
import { BossView } from './views/boss-view'
import { EinsatzleitungView } from './views/einsatzleitung-view'
import { VaultView } from './views/vault-view'
import { MessengerBottomNav, type MessengerBottomNavTab } from '@/frontend/components/messenger-bottom-nav'
import { SettingsView } from './views/settings-view'
import { ConfigView } from './views/config-view'
import { WorkerActionCenterView } from './views/worker-action-center-view'
import { DeviceRadarView } from './views/device-radar-view'
import { SetupOverlay } from '@/components/setup-overlay'
import { DashboardPwaInstallCard } from '@/frontend/components/dashboard-pwa-install-card'
import { DashboardIotaTransferCard } from '@/frontend/components/dashboard-iota-transfer-card'
import { DashboardMyAddressPicker } from '@/frontend/components/dashboard-my-address-picker'
import {
  notifyFirstStepsPrefChanged,
  readFirstStepsVisible,
  writeFirstStepsVisible,
} from '@/frontend/lib/dashboard-first-steps-pref'
import { recordSeenMyAddress } from '@/frontend/lib/my-address-local-history'
import { MeshStatus, type MeshPathMode } from './mesh-status'
import { tryApplyPendingInitialProfileFromStorage } from '../lib/initial-profile-import'
import { ActiveProfileBadge } from '@/frontend/components/active-profile-badge'
import { DeploymentProfileBackdrop } from '@/frontend/components/deployment-profile-backdrop'
import {
  filterFeaturesByMessengerWorkspaceTileSet,
  shouldShowWorkerActionCenter,
} from '@/frontend/lib/dashboard-workspace-tile-visibility'
import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'
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
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { useChatViewPendingHandshakes } from '@/frontend/hooks/use-chat-view-pending-handshakes'
import { useOfflineStatus } from '@/frontend/hooks/use-offline-status'
import { OfflineStatusCard } from '@/frontend/components/offline-status-card'

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
      {
        id: 'private-chat',
        title: 'Nachrichten',
        hint: '1:1 Privat & Pinnwand — Gruppenchat geplant (M2, Fahrplan § H.22)',
      },
    ],
  },
  {
    id: 'einsatzleitung',
    title: 'Einsatzleitung',
    subtitle: 'Team, Kontakte, Export',
    icon: <Crown className="h-6 w-6" />,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    variants: [
      {
        id: 'einsatzleitung-hub',
        title: 'Einsatzleitung',
        hint: 'Team-Mailbox, Import/Export, Forensik',
      },
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

const ACTIVE_VIEW_SESSION_KEY = 'morgendrot.dashboard.activeView'
const EMPTY_CONNECTED_ADDRESSES: string[] = []

function isPwaStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
  } catch {
    /* ignore */
  }
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function parseStoredActiveView(raw: string | null): ActiveView | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return null
    const o = v as Record<string, unknown>
    if (o.type === 'settings' || o.type === 'config') {
      return { type: o.type }
    }
    if (typeof o.type !== 'string' || typeof o.variant !== 'string') return null
    const feat = features.find((f) => f.id === o.type)
    if (!feat) return null
    if (!feat.variants.some((vv) => vv.id === o.variant)) return null
    return { type: o.type as ProjectType, variant: o.variant as ProjectVariant }
  } catch {
    return null
  }
}

const FULL_TILES_STORAGE_KEY = 'morgendrot_show_all_tiles'

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

/** Entsperr-Dialog: Tresor | Seed importieren (nur sdk) | Neu anlegen. */
type UnlockMode = 'vault' | 'import' | 'create'

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
  // Bech32-Secret (z. B. iotaprivkey...): HRP bewusst großzügig akzeptieren, final validiert Backend.
  if (!/\s/.test(t) && t.length >= 60 && /^[a-z]{2,30}1[02-9ac-hj-np-z]+$/i.test(t)) return true
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
  /** Tresor (nur PW, Mnemonic optional) | Seed importieren | Neu anlegen (PW+Seed je 2× bei sdk). */
  const [unlockMode, setUnlockMode] = useState<UnlockMode>('vault')
  /** Bei „vault“ + sdk: Mnemonic-Feld erst nach Bedarf oder Klick anzeigen. */
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
  /** Schlanker Einrichtungs-Hinweis (localStorage, in Einstellungen wieder einblendbar). */
  const [firstStepsVisible, setFirstStepsVisible] = useState(true)
  const [phonebookNavRequest, setPhonebookNavRequest] = useState(0)
  const [einsatzKontakteScrollRequest, setEinsatzKontakteScrollRequest] = useState(0)
  const [messengerNavHighlight, setMessengerNavHighlight] = useState<MessengerBottomNavTab>('messages')

  const prevLockedRef = useRef(false)
  /** Zuletzt von GET /api/status gemeldet — für Entsperr-Dialog beim Wechsel auf „locked“ ohne veraltetes apiSnapshot. */
  const vaultHasLocalRef = useRef(false)
  const signerIsSdkRef = useRef(false)
  /** Nach erneutem Sperren (z. B. PWA-Hintergrund) wieder eine Wiederherstellung der Kachel-Ansicht erlauben. */
  const restoredDashboardViewRef = useRef(false)

  useEffect(() => {
    const prev = prevLockedRef.current
    prevLockedRef.current = locked
    if (locked && !prev) {
      restoredDashboardViewRef.current = false
      setUnlockError('')
      setSignerImport('')
      setSignerImportConfirm('')
      setPassword('')
      setPasswordConfirm('')
      setShowSignerImportOpen(false)
      const hasVault = vaultHasLocalRef.current
      const sdk = signerIsSdkRef.current
      setUnlockMode(hasVault ? 'vault' : sdk ? 'create' : 'vault')
    }
  }, [locked])

  useEffect(() => {
    if (!locked) return
    const s = apiSnapshot?.signer
    if (s != null && s !== 'sdk' && unlockMode === 'import') {
      setUnlockMode('vault')
      setShowSignerImportOpen(false)
    }
  }, [apiSnapshot?.signer, unlockMode, locked])

  useEffect(() => {
    setShowAllTiles(readShowAllTilesPref())
    setWorkspaceTileSet(readWorkspaceTileSet())
    setFirstStepsVisible(readFirstStepsVisible())
  }, [])

  useEffect(() => {
    const sync = () => setFirstStepsVisible(readFirstStepsVisible())
    window.addEventListener('storage', sync)
    window.addEventListener('morgendrot-dashboard-first-steps-changed', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('morgendrot-dashboard-first-steps-changed', sync)
    }
  }, [])

  const dismissFirstStepsBar = () => {
    writeFirstStepsVisible(false)
    notifyFirstStepsPrefChanged()
    setFirstStepsVisible(false)
  }

  /** GET /api/status: `uiVariant` spiegelt `UI_VARIANT` im Backend – Messenger-Bundle/Lite. */
  const liteMessengerFromApi = apiSnapshot?.backendRunning !== false && apiSnapshot?.uiVariant === 'messenger'
  const isBossRole = (role || '').toLowerCase() === 'boss'
  /** Volle eigene Adresse vom Backend — für Wallet-Saldo u. ä. (maskierte `myAddress` zählt nicht). */
  const hasValidMyAddressForBalance =
    /^0x[a-fA-F0-9]{64}$/i.test((apiSnapshot?.myAddressFull ?? '').trim()) === true

  const dashboardTransferAddressSuggestions = useMemo(() => {
    const set = new Set<string>()
    const add = (v?: string) => {
      const t = (v || '').trim()
      if (/^0x[a-fA-F0-9]{64}$/.test(t)) set.add(t)
    }
    add(apiSnapshot?.myAddress)
    add(apiSnapshot?.myAddressFull)
    const conn = apiSnapshot?.connectedAddresses
    if (Array.isArray(conn)) {
      for (const a of conn) add(a)
    }
    return Array.from(set)
  }, [apiSnapshot?.myAddress, apiSnapshot?.myAddressFull, apiSnapshot?.connectedAddresses])

  /** Lite-Messenger: nur Boss darf Arbeitsbereich „full“ + alle Kacheln; alle anderen nur Nachrichten + Tresor/Notfall. */
  const liteMessengerLocksTiles = liteMessengerFromApi && !isBossRole
  const effectiveWorkspaceTileSet: WorkspaceTileSet = liteMessengerLocksTiles ? 'messenger' : workspaceTileSet
  /** Geräte-Radar: eigene Sektion bei workspace `full`; im Messenger-Bundle nur Boss (Hauptprojekt: Kommandant + full weiter möglich). */
  const showDeviceRadar =
    effectiveWorkspaceTileSet === 'full' &&
    (isBossRole || (!liteMessengerFromApi && (role || '').toLowerCase() === 'kommandant'))

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

  const checkStatus = useCallback(async () => {
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
      signerIsSdkRef.current = res.signer === 'sdk'
      setRole(res.role || '')
      const addrLine = (res.myAddressFull || res.myAddress || '').trim()
      setMyAddress(addrLine)
      if (res.myAddressFull && /^0x[a-fA-F0-9]{64}$/i.test(res.myAddressFull.trim())) {
        recordSeenMyAddress(res.myAddressFull.trim())
      }
    } else {
      setBackendReachable(false)
      setConnected(false)
      // locked nicht zurücksetzen — nach kurzer Basis-Störung soll der Entsperr-Dialog wieder erscheinen
    }
  }, [])

  useEffect(() => {
    void checkStatus()
    const ms = backendReachable === false ? 3_000 : 10_000
    const interval = window.setInterval(() => void checkStatus(), ms)
    return () => window.clearInterval(interval)
  }, [checkStatus, backendReachable])

  const { directory: contactDirectory, refresh: refreshContactDirectory } = useContactDirectory()

  const connectedAddressesForHandshake = useMemo(() => {
    const conn = apiSnapshot?.connectedAddresses
    return Array.isArray(conn) ? conn : EMPTY_CONNECTED_ADDRESSES
  }, [apiSnapshot?.connectedAddresses])

  const pendingHandshakeRefreshKey = `${connectedAddressesForHandshake.join('|')}|${locked ? 'locked' : 'open'}`

  const pendingHandshakes = useChatViewPendingHandshakes({
    enabled: !locked && backendReachable === true && hasValidMyAddressForBalance,
    connectedAddresses: connectedAddressesForHandshake,
    refreshToken: pendingHandshakeRefreshKey,
    contactDirectory,
    vaultLocked: locked || apiSnapshot?.locked === true,
  })

  const pendingHandshakeCount =
    pendingHandshakes.offers.length + pendingHandshakes.outgoingOffers.length

  const offlineStatus = useOfflineStatus({
    apiSnapshot,
    backendReachable,
  })

  /**
   * Installierte PWA: nach **längerem** Hintergrund Tresor sperren (`/vault-lock`) — Passwort beim erneuten Öffnen.
   * **Nicht** sofort bei `hidden`: Android/WebView feuert das oft kurz bei **Tastatur**, Overlays oder Tab-UI → sonst
   * `/vault-lock` auf der **gemeinsamen** API-Sitzung (PC + Handy gleicher Dev-Server) und spürbarer UI-Sprung.
   * Opt-out: `localStorage` **`morgendrot.pwaBackgroundVaultLock`** = **`0`**.
   */
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null
    const PWA_BG_LOCK_MS = 45_000
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (hideTimer != null) {
          clearTimeout(hideTimer)
          hideTimer = null
        }
        return
      }
      if (document.visibilityState !== 'hidden') return
      if (!isPwaStandaloneDisplay()) return
      try {
        if (typeof window !== 'undefined' && window.localStorage.getItem('morgendrot.pwaBackgroundVaultLock') === '0') {
          return
        }
      } catch {
        /* ignore */
      }
      if (hideTimer != null) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => {
        hideTimer = null
        void (async () => {
          const r = await vaultLockCommand()
          if (r.ok) await checkStatus()
        })()
      }, PWA_BG_LOCK_MS)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (hideTimer != null) clearTimeout(hideTimer)
    }
  }, [checkStatus])

  const persistDashboardView = (v: ActiveView | null) => {
    try {
      if (v == null) window.sessionStorage.removeItem(ACTIVE_VIEW_SESSION_KEY)
      else window.sessionStorage.setItem(ACTIVE_VIEW_SESSION_KEY, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  }

  const openSettingsView = () => {
    const v: ActiveView = { type: 'settings' }
    setActiveView(v)
    persistDashboardView(v)
  }

  const openConfigView = () => {
    const v: ActiveView = { type: 'config' }
    setActiveView(v)
    persistDashboardView(v)
  }

  const openEinsatzleitungView = () => {
    const v: ActiveView = { type: 'einsatzleitung', variant: 'einsatzleitung-hub' }
    setActiveView(v)
    persistDashboardView(v)
    setMessengerNavHighlight('einsatzleitung')
  }

  const openMessengerChatView = () => {
    const v: ActiveView = { type: 'chat', variant: 'private-chat' }
    setActiveView(v)
    persistDashboardView(v)
    setMessengerNavHighlight('messages')
  }

  const openBossModeView = () => {
    const v: ActiveView = { type: 'boss', variant: 'boss-signer' }
    setActiveView(v)
    persistDashboardView(v)
  }

  /** Nach App-Neustart: letzte Kachel-Ansicht wiederherstellen (React-State geht verloren; Session bleibt). */
  useEffect(() => {
    if (locked || backendReachable !== true) return
    if (restoredDashboardViewRef.current) return
    try {
      const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(ACTIVE_VIEW_SESSION_KEY) : null
      const parsed = parseStoredActiveView(raw)
      if (parsed) {
        setActiveView(parsed)
        persistDashboardView(parsed)
        restoredDashboardViewRef.current = true
      }
    } catch {
      /* ignore */
    }
  }, [locked, backendReachable])

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
    /** Nach Lock kann `signer` im Status kurz fehlen — „Seed importieren“ ist immer SDK-Pfad. */
    const sdkLike = signer === 'sdk' || (signer == null && unlockMode === 'import')

    if (unlockMode === 'create') {
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
    } else if (sdkLike && unlockMode === 'import') {
      const t = signerImport.trim()
      if (!t || !isPlausibleSdkImport(t)) {
        setUnlockError(
          'Mnemonic / Secret erforderlich (mindestens 12 Wörter oder Bech32/Hex wie in der Hilfe).'
        )
        return
      }
    } else if (sdkLike && unlockMode === 'vault' && showSignerImportOpen) {
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
      if (unlockMode === 'create' || unlockMode === 'import') {
        sdkExtra = signerImport.trim()
      } else {
        sdkExtra = showSignerImportOpen ? signerImport.trim() || undefined : undefined
      }
    } else if (signer == null && unlockMode === 'import') {
      sdkExtra = signerImport.trim()
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
      if (res.code === SIGNER_IMPORT_REQUIRED_CODE) {
        setUnlockMode('import')
        setShowSignerImportOpen(true)
        setUnlockError(
          `${res.error || 'Signatur-Material fehlt.'}\n\n` +
            '→ Es wurde auf „Seed importieren“ umgeschaltet: dort Passwort und Mnemonic/Secret eintragen, dann erneut „Tresor entsperren“.\n' +
            'Alternativ: „Tresor öffnen“ und unten „Mnemonic oder Secret eingeben“.'
        )
      } else {
        setUnlockError(res.error || 'Entsperren fehlgeschlagen')
      }
    }
  }

  const handleSelectFeature = (feature: Feature, variant: ProjectVariant) => {
    const next: ActiveView = { type: feature.id, variant }
    setActiveView(next)
    persistDashboardView(next)
    if (feature.id === 'chat') setMessengerNavHighlight('messages')
    if (feature.id === 'einsatzleitung') setMessengerNavHighlight('einsatzleitung')
  }

  const showMessengerBottomNav =
    activeView != null && (activeView.type === 'chat' || activeView.type === 'einsatzleitung')

  const messengerBottomNavActive: MessengerBottomNavTab =
    messengerNavHighlight === 'phonebook'
      ? 'phonebook'
      : activeView?.type === 'einsatzleitung'
        ? 'einsatzleitung'
        : 'messages'

  const setWorkspaceTileSetPersist = (v: WorkspaceTileSet) => {
    if (liteMessengerFromApi && v === 'full' && !isBossRole) return
    setWorkspaceTileSet(v)
    writeWorkspaceTileSet(v)
  }

  const visibleFeatures = filterFeaturesByMessengerWorkspaceTileSet(features, {
    workspaceTileSet: effectiveWorkspaceTileSet,
    liteMessengerFromApi,
    isBossRole,
    role,
  })

  const showWorkerActionCenter = shouldShowWorkerActionCenter({
    role: role || '',
    showAllTiles,
    liteMessengerFromApi,
  })

  /** Messenger-Arbeiter: Kachel-Start statt verstecktem Link (localStorage konnte Action Center erzwingen). */
  useEffect(() => {
    if (!liteMessengerFromApi) return
    const r = (role || '').trim().toLowerCase()
    if (r !== 'arbeiter' && r !== 'lock') return
    if (showAllTiles) return
    setShowAllTiles(true)
    writeShowAllTilesPref(true)
  }, [liteMessengerFromApi, role, showAllTiles])

  const handleBack = () => {
    setActiveView(null)
    persistDashboardView(null)
  }

  const chatVaultBannerActions: ChatViewVaultBannerActions = {
    onLockSession: async () => {
      if (
        !window.confirm(
          'API-Sitzung sperren? Schlüssel werden aus dem Arbeitsspeicher der Basis entfernt — danach den Tresor erneut mit Passwort entsperren.'
        )
      ) {
        return
      }
      const r = await vaultLockCommand()
      if (r.ok) {
        await checkStatus()
        setActiveView(null)
        persistDashboardView(null)
      }
    },
    onNavigateHomeWhenLocked: () => {
      setActiveView(null)
      persistDashboardView(null)
    },
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
  const importMnemonicRequired =
    unlockMode === 'import' && (signerKind === 'sdk' || signerKind == null)
  const unlockButtonDisabled =
    unlocking ||
    !password.trim() ||
    (unlockMode === 'create' &&
      (!passwordConfirm.trim() || password !== passwordConfirm)) ||
    (unlockMode === 'create' &&
      signerKind === 'sdk' &&
      (!signerImport.trim() ||
        !signerImportConfirm.trim() ||
        normalizeSignerWords(signerImport) !== normalizeSignerWords(signerImportConfirm))) ||
    (importMnemonicRequired && (!signerImport.trim() || !isPlausibleSdkImport(signerImport.trim()))) ||
    (unlockMode === 'vault' &&
      signerKind === 'sdk' &&
      showSignerImportOpen &&
      !!signerImport.trim() &&
      !isPlausibleSdkImport(signerImport.trim()))

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
            <DialogTitle>Tresor entsperren</DialogTitle>
            <DialogDescription asChild className="text-left space-y-2">
              <div className="space-y-2">
                <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
                  <strong className="font-semibold">Gesperrt</strong> = dieser Dialog blockiert die App. Die{' '}
                  <strong>Morgendrot-API-Sitzung</strong> (Basis/Node) hat <strong>keine</strong> entschlüsselten Keys im RAM —
                  kein Signieren, kein vollständiger Messenger-Schlüsselbund. Nach erfolgreichem Passwort: Dialog schließt, oben
                  im Header steht <strong>„Tresor: entsperrt“</strong> (oder <strong>„Chat verbunden“</strong>, sobald ein
                  Partner per /connect verbunden ist) — bis du „Tresor sperren“ wählst, die PWA lange im Hintergrund war
                  oder die Sitzung sonst beendet wird.
                </p>
                <p>
                  Entsperrt die <strong>Backend-Sitzung</strong> zum Signieren. Das Passwort entschlüsselt den lokalen oder
                  On-Chain-Tresor (Vault-Datei), falls vorhanden — <strong>kein</strong> separates Web-Login nur für die Oberfläche.
                </p>
                {signerKind === 'cli' ? (
                  <p>
                    Bei <span className="font-mono text-xs">SIGNER=cli</span>: Passwort des <strong>IOTA-CLI-Keystores</strong>{' '}
                    zur konfigurierten Adresse — kein Mnemonic in dieser App.
                  </p>
                ) : signerKind === 'sdk' ? (
                  <p>
                    Bei <span className="font-mono text-xs">SIGNER=sdk</span> wählst du unten:{' '}
                    <strong>Tresor öffnen</strong> (Passwort, Mnemonic nur falls nötig),{' '}
                    <strong>Seed importieren</strong> (bestehende Wallet + Passwort) oder{' '}
                    <strong>Neu anlegen</strong> (neues Profil: Passwort und Seed je zweimal). Nach „Signer-Import mit speichern“
                    im Tresor reicht oft nur noch <strong>Tresor öffnen</strong> mit Passwort.
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
              value={unlockMode}
              onValueChange={(v) => {
                const m = v as UnlockMode
                setUnlockMode(m)
                setUnlockError('')
                setPasswordConfirm('')
                if (m === 'vault') {
                  setShowSignerImportOpen(false)
                  setSignerImportConfirm('')
                } else if (m === 'import') {
                  setShowSignerImportOpen(true)
                  setSignerImportConfirm('')
                } else {
                  setShowSignerImportOpen(false)
                }
              }}
              className="gap-3"
            >
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="vault" id="uf-vault" className="mt-1" />
                <div className="min-w-0">
                  <Label htmlFor="uf-vault" className="cursor-pointer font-medium text-foreground">
                    Tresor öffnen
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Bestehende Vault — zuerst Passwort; Mnemonic nur falls der Tresor noch keinen Signer enthält (Schaltfläche
                    unten) oder der Server danach fragt.
                  </p>
                </div>
              </div>
              {signerKind === 'sdk' ? (
                <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <RadioGroupItem value="import" id="uf-import" className="mt-1" />
                  <div className="min-w-0">
                    <Label htmlFor="uf-import" className="cursor-pointer font-medium text-foreground">
                      Seed importieren
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Bereits vorhandenen Mnemonic / Bech32-Secret mitgeben — z. B. bestehende IOTA-Wallet oder Wiederherstellung.
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem value="create" id="uf-create" className="mt-1" />
                <div className="min-w-0">
                  <Label htmlFor="uf-create" className="cursor-pointer font-medium text-foreground">
                    Neu anlegen
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Neues Profil ohne passende lokale Vault. Bei <span className="font-mono text-xs">SIGNER=sdk</span>: Seed
                    (oder extern erzeugt) und Passwort jeweils zweimal bestätigen.
                  </p>
                </div>
              </div>
            </RadioGroup>
            {apiSnapshot?.vaultStatus?.hasLocal && unlockMode === 'create' ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                Es existiert bereits eine lokale Vault-Datei. In der Regel <strong>Tresor öffnen</strong> wählen — „Neu anlegen“
                nur bei zweitem Profil (eigene Datei / Server-Konfiguration).
              </p>
            ) : null}
            {!apiSnapshot?.vaultStatus?.hasLocal && unlockMode === 'vault' && signerKind === 'sdk' ? (
              <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                Keine lokale Vault-Datei: Mit nur Passwort entsperrt <span className="font-mono text-xs">SIGNER=sdk</span> nicht
                — bitte <strong>Seed importieren</strong> oder <strong>Neu anlegen</strong> wählen (oder Mnemonic unten
                ergänzen).
              </p>
            ) : null}

            {unlockMode === 'vault' ? (
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
                  <>
                    {apiSnapshot?.vaultStatus?.hasLocal ? (
                      <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] leading-relaxed text-sky-950 dark:text-sky-50/95">
                        Ohne zuvor im Tresor <strong className="text-foreground">„Signer-Import mit speichern“</strong> reicht
                        das Passwort allein nicht: zusätzlich Mnemonic/Secret nötig — unten aufklappen oder Tab{' '}
                        <strong className="text-foreground">Seed importieren</strong>.
                      </p>
                    ) : null}
                    {showSignerImportOpen ? (
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
                    )}
                  </>
                ) : null}
              </>
            ) : null}

            {unlockMode === 'import' && importMnemonicRequired ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="wallet-password-import">Passwort (Wallet / Vault)</Label>
                  <Input
                    id="wallet-password-import"
                    type="password"
                    placeholder="Passwort eingeben"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !unlockButtonDisabled && handleUnlock()}
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-signer">Mnemonic / Bech32-Secret</Label>
                  <Textarea
                    id="import-signer"
                    placeholder="12–24 Wörter oder IOTA-Bech32-Secret …"
                    value={signerImport}
                    onChange={(e) => setSignerImport(e.target.value)}
                    className="min-h-[88px] font-mono text-xs"
                    autoComplete="off"
                  />
                </div>
              </>
            ) : null}

            {unlockMode === 'create' ? (
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
            ) : null}

            {unlockError ? (
              <p className="whitespace-pre-wrap text-sm text-destructive">{unlockError}</p>
            ) : null}
            <Button onClick={() => void handleUnlock()} disabled={unlockButtonDisabled} className="w-full">
              {unlocking ? 'Tresor wird geöffnet…' : 'Tresor entsperren'}
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
                  : activeView.type === 'einsatzleitung'
                    ? 'Einsatzleitung'
                    : features.find((f) => f.id === activeView.type)?.title}
            </span>
          </div>
        </header>

        {/* View Content */}
        <main className={cn('mx-auto max-w-5xl p-4', showMessengerBottomNav && 'pb-24')}>
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
              onOpenConfig={openConfigView}
              showAllTiles={showAllTiles}
              onShowAllTilesChange={setShowAllTilesPersist}
              canToggleFullTiles={role === 'arbeiter' || role === 'lock'}
            />
          )}
          {activeView.type === 'config' && <ConfigView />}
          {activeView.type === 'chat' && activeView.variant && (
            <ChatView
              variant={activeView.variant as 'private-chat' | 'pinnwand'}
              role={role}
              myAddress={myAddress}
              vaultBannerActions={chatVaultBannerActions}
              pendingHandshakes={pendingHandshakes}
              onOpenEinsatzleitung={canAccessEinsatzleitung(role) ? openEinsatzleitungView : undefined}
              phonebookNavRequest={phonebookNavRequest}
            />
          )}
          {activeView.type === 'einsatzleitung' && (
            <EinsatzleitungView
              apiSnapshot={apiSnapshot && !('error' in apiSnapshot && apiSnapshot.error) ? apiSnapshot : null}
              contactDirectory={contactDirectory}
              refreshContactDirectory={refreshContactDirectory}
              scrollToKontakteRequest={einsatzKontakteScrollRequest}
            />
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
        {showMessengerBottomNav ? (
          <MessengerBottomNav
            active={messengerBottomNavActive}
            showEinsatzleitung={canAccessEinsatzleitung(role)}
            onMessages={openMessengerChatView}
            onEinsatzleitung={canAccessEinsatzleitung(role) ? openEinsatzleitungView : undefined}
            onPhonebook={() => {
              setMessengerNavHighlight('phonebook')
              if (activeView?.type === 'einsatzleitung') {
                setEinsatzKontakteScrollRequest((n) => n + 1)
                return
              }
              if (activeView?.type !== 'chat') openMessengerChatView()
              setPhonebookNavRequest((n) => n + 1)
            }}
          />
        ) : null}
      </div>
      ) : (
    <DeploymentProfileBackdrop status={apiSnapshot}>
    <div className="min-h-screen bg-background/80">
      {/* Header */}
      <header className="border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
              M
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">Morgendrot</h1>
                <ActiveProfileBadge status={apiSnapshot} compact />
              </div>
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
              {!locked && backendReachable ? (
                <div className="mt-2">
                  <DashboardMyAddressPicker apiSnapshot={apiSnapshot} onAfterSet={checkStatus} />
                </div>
              ) : null}
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
                  <span
                    title="Tresor gesperrt: Backend-Sitzung ohne Keys im RAM. Passwort im Dialog eingeben — kein separater Web-Login."
                  >
                    Tresor gesperrt
                  </span>
                </>
              ) : connected ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  <span title="Tresor entsperrt. Chat: Verbindung zu Partner (/connect) aktiv.">Chat verbunden</span>
                </>
              ) : backendReachable ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500/80" />
                  <span title="Tresor entsperrt · API erreichbar. „Chat verbunden“ erst nach Handshake/Connect mit Partner.">
                    Tresor: entsperrt
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
            <SetupOverlay onOpenConfig={openConfigView} />
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
              onClick={openSettingsView}
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
        <OfflineStatusCard
          status={offlineStatus}
          onTestConnection={checkStatus}
          onResync={() => {
            void checkStatus()
          }}
        />
        {!locked && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <DashboardPwaInstallCard />
            <DashboardIotaTransferCard
              walletNativeIotaBalance={apiSnapshot?.walletNativeIotaBalance ?? undefined}
              walletNativeIotaBalanceFetchFailed={apiSnapshot?.walletNativeIotaBalanceFetchFailed}
              hasValidMyAddressForBalance={hasValidMyAddressForBalance}
              onRefreshStatus={checkStatus}
              addressSuggestions={dashboardTransferAddressSuggestions}
            />
          </div>
        )}
        {!locked && firstStepsVisible && (
          <div
            className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-xs text-muted-foreground"
            role="region"
            aria-label="Einrichtung"
          >
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              Einrichtung
            </span>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
            <span className="max-w-prose">
              Kurzüberblick &amp; Rollen:{' '}
              <Link
                href="/handbook?file=DASHBOARD-ERSTE-SCHRITTE.md"
                className="font-medium text-emerald-200 underline-offset-2 hover:underline"
              >
                Handbuch „Erste Schritte“
              </Link>
              {' · '}
              <Link
                href="/handbook?file=DASHBOARD-PORT-UND-OBERFLAECHE.md"
                className="font-medium text-emerald-200 underline-offset-2 hover:underline"
              >
                Ports &amp; Oberflächen
              </Link>
              . Wieder einblenden: <strong className="text-foreground/90">Einstellungen</strong>.
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void openHelp()}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/20"
              >
                Hilfe
              </button>
              <button
                type="button"
                onClick={openSettingsView}
                className="rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                Einstellungen
              </button>
              <button
                type="button"
                onClick={dismissFirstStepsBar}
                className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Einrichtungszeile ausblenden"
              >
                Ausblenden
              </button>
            </div>
          </div>
        )}
        {/* Arbeiter/Lock Volldashboard: Action Center. Messenger (`UI_VARIANT=messenger`): direkt Kacheln. */}
        {showWorkerActionCenter ? (
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
                Alle Funktionen (Kacheln) anzeigen
              </button>
            </div>
          </>
        ) : null}

        {/* Geräte-Radar: nur bei Arbeitsbereich full — siehe showDeviceRadar (Messenger: nur Boss). */}
        {showDeviceRadar ? (
          <div className="mb-8">
            <DeviceRadarView />
          </div>
        ) : null}

        <WorkspaceProjectsPanel
          className="mb-8"
          tileSet={effectiveWorkspaceTileSet}
          onTileSetChange={setWorkspaceTileSetPersist}
          liteUiEnforcedByBackend={liteMessengerLocksTiles}
        />

        {/* Kacheln: immer für Boss/Kommandant; für Arbeiter/Lock nur wenn showAllTiles */}
        {((role !== 'arbeiter' && role !== 'lock') || showAllTiles || liteMessengerFromApi) && (
          <>
            {showWorkerActionCenter && showAllTiles && (role === 'arbeiter' || role === 'lock') && (
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
            {canAccessEinsatzleitung(role) ? (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={openEinsatzleitungView}
                  className="flex w-full items-center gap-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-amber-600/5 p-4 text-left transition-colors hover:border-amber-500/60 hover:from-amber-500/20"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-600">
                    <Crown className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">Einsatzleitung</p>
                    <p className="text-sm text-muted-foreground">
                      Team-Mailbox, Kontakte, Helfer-Handoff (Boss), Forensik
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </div>
            ) : null}
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
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    {feature.title}
                    {feature.id === 'chat' && pendingHandshakeCount > 0 ? (
                      <span
                        className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                        title={`${pendingHandshakeCount} Handshake-Anfrage(n) — in Nachrichten → Posteingang`}
                      >
                        {pendingHandshakeCount}
                      </span>
                    ) : null}
                  </h3>
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
    </DeploymentProfileBackdrop>
      )}
    </>
  )
}
