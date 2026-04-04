'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchStatus, unlockBackend, fetchHelp, type ApiStatus } from '../lib/api'
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
    title: 'Tresor',
    subtitle: 'Daten sichern',
    icon: <Shield className="h-6 w-6" />,
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    variants: [
      { id: 'local-vault', title: 'Backup', hint: 'Daten speichern' },
      { id: 'emergency-purge', title: 'Notfall', hint: 'Alles löschen' },
    ],
  },
]

interface ActiveView {
  type: ProjectType | 'settings' | 'config'
  variant?: ProjectVariant
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

export function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [networkInfo, setNetworkInfo] = useState<string>('')
  const [hoveredFeature, setHoveredFeature] = useState<ProjectType | null>(null)
  const [locked, setLocked] = useState(false)
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
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

  useEffect(() => {
    setShowAllTiles(readShowAllTilesPref())
    setWorkspaceTileSet(readWorkspaceTileSet())
  }, [])

  const setShowAllTilesPersist = (value: boolean) => {
    setShowAllTiles(value)
    writeShowAllTilesPref(value)
  }

  const checkStatus = async () => {
    const res = await fetchStatus()
    setApiSnapshot(res)
    if (res.backendRunning) {
      setBackendReachable(true)
      setConnected(!!res.connected)
      setNetworkInfo(res.rpcUrlLabel || res.network || 'IOTA Rebased')
      setLocked(!!res.locked)
      setRole(res.role || '')
      setMyAddress(res.myAddress || '')
    } else {
      setBackendReachable(false)
      setConnected(false)
      setLocked(false)
    }
  }

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleUnlock = async () => {
    setUnlockError('')
    setUnlocking(true)
    const res = await unlockBackend(password)
    setUnlocking(false)
    if (res.ok) {
      setPassword('')
      setLocked(false)
      await checkStatus()
      // Backend braucht ggf. etwas Zeit für Wallet – mehrfach Status holen
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const s = await fetchStatus()
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
    }
  }

  const handleSelectFeature = (feature: Feature, variant: ProjectVariant) => {
    setActiveView({ type: feature.id, variant })
  }

  const setWorkspaceTileSetPersist = (v: WorkspaceTileSet) => {
    setWorkspaceTileSet(v)
    writeWorkspaceTileSet(v)
  }

  const messengerPackIds = new Set<ProjectType>(['chat', 'vault'])
  const visibleFeatures =
    workspaceTileSet === 'messenger' ? features.filter((f) => messengerPackIds.has(f.id)) : features

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

  // Render active view
  if (activeView) {
    return (
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
            <BossView variant={activeView.variant as 'boss-signer' | 'pinnwand-admin'} />
          )}
          {activeView.type === 'vault' && activeView.variant && (
            <VaultView variant={activeView.variant as 'local-vault' | 'emergency-purge'} />
          )}
        </main>
      </div>
    )
  }

  const meshPathMode: MeshPathMode =
    backendReachable === false
      ? 'offline'
      : rpcProxyActive || process.env.NEXT_PUBLIC_PRIVACY_TOR === '1'
        ? 'tor'
        : 'internet'

  // Main Dashboard
  return (
    <div className="min-h-screen bg-background">
      {/* Help-Dialog (?) */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Hilfe
            </DialogTitle>
            <DialogDescription>Befehle und Ablauf – vom Backend</DialogDescription>
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

      {/* Passwort-Dialog wenn Backend gesperrt */}
      <Dialog open={locked} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Wallet-Passwort</DialogTitle>
            <DialogDescription>
              Das Backend wartet auf das Wallet-Passwort (Vault/CLI-Signatur). Nur lokal, wird nicht übertragen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wallet-password">Passwort</Label>
              <Input
                id="wallet-password"
                type="password"
                placeholder="Passwort eingeben"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                autoComplete="current-password"
              />
            </div>
            {unlockError && (
              <p className="text-sm text-destructive">{unlockError}</p>
            )}
            <Button onClick={handleUnlock} disabled={unlocking || !password.trim()} className="w-full">
              {unlocking ? 'Wird entsperrt…' : 'Entsperren'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                Alle Funktionen (Kacheln) anzeigen
              </button>
            </div>
          </>
        )}

        {/* Boss/Kommandant: Geräte-Radar (nur Volldashboard – Messenger-Projekt wie Standalone schlanker) */}
        {(role === 'boss' || role === 'kommandant') && workspaceTileSet === 'full' && (
          <div className="mb-8">
            <DeviceRadarView />
          </div>
        )}

        <WorkspaceProjectsPanel
          className="mb-8"
          apiStatus={apiSnapshot}
          tileSet={workspaceTileSet}
          onTileSetChange={setWorkspaceTileSetPersist}
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
  )
}
