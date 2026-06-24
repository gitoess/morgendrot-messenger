'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Lock,
  Eye,
  Crown,
  ArrowRight,
  Wifi,
  WifiOff,
  Settings,
  ChevronLeft,
  HelpCircle,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectType } from '@/frontend/lib/types'
import { ChatView } from './views/chat-view'
import { LockView } from './views/lock-view'
import { MonitorView } from './views/monitor-view'
import { BossView } from './views/boss-view'
import { EinsatzleitungView } from './views/einsatzleitung-view'
import { SettingsView } from './views/settings-view'
import { ConfigView } from './views/config-view'
import { WorkerActionCenterView } from './views/worker-action-center-view'
import { DeviceRadarView } from './views/device-radar-view'
import { DashboardPwaInstallCard } from '@/frontend/components/dashboard-pwa-install-card'
import { DashboardSharedDialogs } from '@/frontend/components/dashboard-shared-dialogs'
import { WorkspaceProjectsPanel } from './workspace-projects-panel'
import { shouldShowDashboardPwaInstallCard } from '@/frontend/lib/should-show-pwa-install'
import { DashboardIotaTransferCard } from '@/frontend/components/dashboard-iota-transfer-card'
import { DashboardMyAddressPicker } from '@/frontend/components/dashboard-my-address-picker'
import { MeshStatus } from './mesh-status'
import { ActiveProfileBadge } from '@/frontend/components/active-profile-badge'
import { DeploymentProfileBackdrop } from '@/frontend/components/deployment-profile-backdrop'
import {
  filterFeaturesByMessengerWorkspaceTileSet,
  shouldShowWorkerActionCenter,
} from '@/frontend/lib/dashboard-workspace-tile-visibility'
import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'
import { OfflineStatusCard } from '@/frontend/components/offline-status-card'
import { enableOfflineMailboxQueue } from '@/frontend/lib/api/offline-queue'
import { useDashboardSession } from '@/frontend/hooks/use-dashboard-session'
import { projektFeatures, featureTitle } from '@/frontend/components/dashboard-features-projekt'


export function ProjektDashboard() {
  const [hoveredFeature, setHoveredFeature] = useState<ProjectType | null>(null)
  const s = useDashboardSession({ restoreFeatures: projektFeatures })

  const visibleFeatures = filterFeaturesByMessengerWorkspaceTileSet(projektFeatures, {
    workspaceTileSet: 'full',
    liteMessengerFromApi: false,
    isBossRole: s.isBossRole,
    role: s.role,
  })

  const showWorkerActionCenter = shouldShowWorkerActionCenter({
    role: s.role || '',
    showAllTiles: s.showAllTiles,
    liteMessengerFromApi: false,
  })

  const showDeviceRadar =
    s.isBossRole || (s.role || '').toLowerCase() === 'kommandant'

  return (
    <>
      <DashboardSharedDialogs
        locked={s.locked}
        helpOpen={s.helpOpen}
        onHelpOpenChange={s.setHelpOpen}
        helpLoading={s.helpLoading}
        helpText={s.helpText}
        unlock={{ ...s.unlock, apiSnapshot: s.apiSnapshot }}
      />
      {s.activeView ? (
      <div className="min-h-screen bg-background">
        {/* Slim Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center gap-4 px-4">
            <button
              onClick={s.handleBack}
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Zurück</span>
            </button>
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-semibold text-foreground">
              {s.activeView.type === 'settings'
                ? 'Einstellungen'
                : s.activeView.type === 'config'
                  ? '.env anpassen'
                  : s.activeView.type === 'einsatzleitung'
                    ? 'Einsatzleitung'
                    : featureTitle(s.activeView.type, projektFeatures)}
            </span>
          </div>
        </header>

        {/* View Content */}
        <main className="mx-auto max-w-5xl p-4">
          {s.initialProfileBanner ? (
            <div
              className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
              role="status"
            >
              <span>{s.initialProfileBanner}</span>
              <button
                type="button"
                className="shrink-0 rounded px-2 py-0.5 text-emerald-300/90 hover:bg-emerald-500/20 hover:text-emerald-50"
                onClick={() => s.setInitialProfileBanner(null)}
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
          ) : null}
          {s.activeView.type === 'settings' && (
            <SettingsView
              onOpenConfig={s.openConfigView}
              showAllTiles={s.showAllTiles}
              onShowAllTilesChange={s.setShowAllTilesPersist}
              canToggleFullTiles={s.role === 'arbeiter' || s.role === 'lock'}
              vaultLocked={!!(s.locked || s.apiSnapshot?.locked)}
              onRequestVaultUnlock={s.requestMainnetSessionSignerSync}
            />
          )}
          {s.activeView.type === 'config' && <ConfigView />}
          {s.activeView.type === 'chat' && s.activeView.variant && (
            <ChatView
              variant={s.activeView.variant as 'private-chat' | 'pinnwand'}
              role={s.role}
              myAddress={s.myAddress}
              vaultBannerActions={s.chatVaultBannerActions}
              pendingHandshakes={s.pendingHandshakes}
              onOpenEinsatzleitung={canAccessEinsatzleitung(s.role) ? s.openEinsatzleitungView : undefined}
              phonebookNavRequest={s.phonebookNavRequest}
            />
          )}
          {s.activeView.type === 'einsatzleitung' && (
            <EinsatzleitungView
              apiSnapshot={s.apiSnapshot && !('error' in s.apiSnapshot && s.apiSnapshot.error) ? s.apiSnapshot : null}
              contactDirectory={s.contactDirectory}
              refreshContactDirectory={s.refreshContactDirectory}
              onRefreshStatus={s.checkStatus}
              onOpenSettings={s.openSettingsView}
            />
          )}
          {s.activeView.type === 'lock' && s.activeView.variant && (
            <LockView variant={s.activeView.variant as 'smart-lock' | 'access-key-ticket' | 'payment-trigger'} />
          )}
          {s.activeView.type === 'monitor' && s.activeView.variant && (
            <MonitorView variant={s.activeView.variant as 'sensor-central' | 'device-monitor' | 'heartbeat-sender'} />
          )}
          {s.activeView.type === 'boss' && s.activeView.variant && (
            <BossView
              variant={s.activeView.variant as 'boss-signer' | 'pinnwand-admin'}
              apiSnapshot={s.apiSnapshot && !('error' in s.apiSnapshot && s.apiSnapshot.error) ? s.apiSnapshot : null}
            />
          )}
        </main>
      </div>
      ) : (
    <DeploymentProfileBackdrop status={s.apiSnapshot}>
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
                <ActiveProfileBadge status={s.apiSnapshot} compact />
              </div>
              <p className="text-xs text-muted-foreground">
                Morgendrot Projekt
                {s.networkInfo ? (
                  <span className="ml-1">· {s.networkInfo}</span>
                ) : (
                  <span className="ml-1">· IOTA Rebased</span>
                )}
                {s.role ? (
                  <span className="ml-1 font-mono text-[10px] text-foreground/80" title="Kommt aus Backend .env ROLE">
                    · Rolle: {s.role}
                  </span>
                ) : null}
                {s.apiSnapshot?.apiListenPort != null && (
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground/90">
                    · API:{s.apiSnapshot.apiListenPort}
                  </span>
                )}
              </p>
              <div className="mt-1">
                <MeshStatus
                  mode={s.meshPathMode}
                  subtitle={
                    s.rpcProxyActive
                      ? 'IOTA-RPC geht über Backend-Proxy (SOCKS5 oder HTTP) – siehe Einstellungen → .env anpassen (RPC_SOCKS_PROXY).'
                      : 'Tor/VPN: RPC_SOCKS_PROXY in Einstellungen setzen; LoRa/BLE im Chat (Meshtastic) koppeln.'
                  }
                />
              </div>
              {!s.locked && s.backendReachable ? (
                <div className="mt-2">
                  <DashboardMyAddressPicker apiSnapshot={s.apiSnapshot} onAfterSet={s.checkStatus} />
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',
                s.backendReachable === null || (s.backendReachable && s.connected === null && !s.locked)
                  ? 'bg-muted text-muted-foreground'
                  : s.locked
                    ? 'bg-amber-500/10 text-amber-400'
                    : s.connected
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : s.backendReachable
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
              )}
            >
              {s.backendReachable === null ? (
                <>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-current" />
                  Verbinde...
                </>
              ) : s.locked ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span
                    title="Tresor gesperrt: Backend-Sitzung ohne Keys im RAM. Passwort im Dialog eingeben — kein separater Web-Login."
                  >
                    Tresor gesperrt
                  </span>
                </>
              ) : s.connected ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  <span title="Tresor entsperrt. Chat: Verbindung zu Partner (/connect) aktiv.">Chat verbunden</span>
                </>
              ) : s.backendReachable ? (
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
            {/* Hilfe: HELP_UI_INTRO + Befehle (GET /api/help) — Roadmap H.0 */}
            <button
              type="button"
              onClick={() => void s.openHelp()}
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
              onClick={s.openSettingsView}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        {s.initialProfileBanner ? (
          <div
            className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
            role="status"
          >
            <span>{s.initialProfileBanner}</span>
            <button
              type="button"
              className="shrink-0 rounded px-2 py-0.5 text-emerald-300/90 hover:bg-emerald-500/20 hover:text-emerald-50"
              onClick={() => s.setInitialProfileBanner(null)}
              aria-label="Schließen"
            >
              ×
            </button>
          </div>
        ) : null}
        <OfflineStatusCard
          variant="full"
          status={s.offlineStatus}
          onTestConnection={s.checkStatus}
          onResync={() => {
            void s.checkStatus()
          }}
          onEnableQueueOptIn={() => enableOfflineMailboxQueue()}
          onOpenHandoffImport={s.openSettingsView}
        />
        {!s.locked ? (
          <div
            className={cn(
              'mb-6 grid gap-4',
              shouldShowDashboardPwaInstallCard() ? 'sm:grid-cols-2' : 'grid-cols-1'
            )}
          >
            {shouldShowDashboardPwaInstallCard() ? <DashboardPwaInstallCard /> : null}
            <DashboardIotaTransferCard
              walletNativeIotaBalance={s.apiSnapshot?.walletNativeIotaBalance ?? undefined}
              walletNativeIotaBalanceFetchFailed={s.apiSnapshot?.walletNativeIotaBalanceFetchFailed}
              hasValidMyAddressForBalance={s.hasValidMyAddressForBalance}
              onRefreshStatus={s.checkStatus}
              addressSuggestions={s.dashboardTransferAddressSuggestions}
            />
          </div>
        ) : null}
        {!s.locked && s.firstStepsVisible && (
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
                onClick={() => void s.openHelp()}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/20"
              >
                Hilfe
              </button>
              <button
                type="button"
                onClick={s.openSettingsView}
                className="rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                Einstellungen
              </button>
              <button
                type="button"
                onClick={s.dismissFirstStepsBar}
                className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Einrichtungszeile ausblenden"
              >
                Ausblenden
              </button>
            </div>
          </div>
        )}
        {/* Arbeiter/Lock im Morgendrot Projekt: Action Center. Messenger-Produkt: direkt Kacheln. */}
        {showWorkerActionCenter ? (
          <>
            <div className="mb-6">
              <WorkerActionCenterView />
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => s.setShowAllTilesPersist(true)}
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

        <WorkspaceProjectsPanel className="mb-8" />

        {((s.role !== 'arbeiter' && s.role !== 'lock') || s.showAllTiles) && (
          <>
            {showWorkerActionCenter && s.showAllTiles && (s.role === 'arbeiter' || s.role === 'lock') && (
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => s.setShowAllTilesPersist(false)}
                  className="text-sm text-muted-foreground underline hover:text-foreground"
                >
                  Zurück zum Action Center
                </button>
              </div>
            )}
            {/* Welcome */}
            {canAccessEinsatzleitung(s.role) ? (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={s.openEinsatzleitungView}
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
                    {feature.id === 'chat' && s.pendingHandshakeCount > 0 ? (
                      <span
                        className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                        title={`${s.pendingHandshakeCount} Handshake-Anfrage(n) — in Nachrichten → Posteingang`}
                      >
                        {s.pendingHandshakeCount}
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
                    onClick={() => s.handleSelectFeature(feature.id, variant.id)}
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
        {s.backendReachable === false && (
          <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
            <p className="text-sm text-amber-400">
              Keine Verbindung zum Backend. Starte <code className="rounded bg-amber-500/20 px-1">npm run dev</code> (Backend 127.0.0.1:3342 + UI 127.0.0.1:3341). Bei Port-Kollision zuerst{' '}
              <code className="rounded bg-amber-500/20 px-1">npm run dev:stop</code>, dann erneut <code className="rounded bg-amber-500/20 px-1">npm run dev</code>. Wenn das Backend mit Fehlercode beendet:{' '}
              <code className="rounded bg-amber-500/20 px-1">npm run start:secrets</code> einzeln in einem Terminal ausführen, um die Fehlermeldung zu sehen.
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
