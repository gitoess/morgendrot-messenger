'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Crown,
  ArrowRight,
  Wifi,
  WifiOff,
  Settings,
  ChevronLeft,
  BookOpen,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectType } from '@/frontend/lib/types'
import { ChatView } from './views/chat-view'
import { BossView } from './views/boss-view'
import { EinsatzleitungView } from './views/einsatzleitung-view'
import { VaultView } from './views/vault-view'
import { MessengerBottomNav } from '@/frontend/components/messenger-bottom-nav'
import { SettingsView } from './views/settings-view'
import { ConfigView } from './views/config-view'
import { DashboardMessengerBossHeader } from '@/frontend/components/dashboard-messenger-boss-header'
import { DashboardMessengerBossHome } from '@/frontend/components/dashboard-messenger-boss-home'
import { DashboardSharedDialogs } from '@/frontend/components/dashboard-shared-dialogs'
import { messengerFeatures, featureTitle } from '@/frontend/components/dashboard-features-messenger'
import { DashboardMyAddressPicker } from '@/frontend/components/dashboard-my-address-picker'
import { DashboardPwaInstallCard } from '@/frontend/components/dashboard-pwa-install-card'
import { DashboardIotaTransferCard } from '@/frontend/components/dashboard-iota-transfer-card'
import { shouldShowDashboardPwaInstallCard } from '@/frontend/lib/should-show-pwa-install'
import { MeshStatus } from './mesh-status'
import { DeploymentProfileBackdrop } from '@/frontend/components/deployment-profile-backdrop'
import {
  filterFeaturesByMessengerWorkspaceTileSet,
} from '@/frontend/lib/dashboard-workspace-tile-visibility'
import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'
import { OfflineStatusCard } from '@/frontend/components/offline-status-card'
import { enableOfflineMailboxQueue } from '@/frontend/lib/api/offline-queue'
import { writeShowAllTilesPref } from '@/frontend/lib/dashboard-prefs'
import { useDashboardSession } from '@/frontend/hooks/use-dashboard-session'
import { CapacitorForegroundSyncBootstrap } from '@/frontend/components/capacitor-foreground-sync-bootstrap'
import { CapacitorStandaloneBootstrap } from '@/frontend/components/capacitor-standalone-bootstrap'
import { getMessengerDashboardOfflineHint } from '@/frontend/lib/dashboard-basis-offline-hint'

/** Morgendrot Messenger — schlanke Einsatz-App (eigenes Build). */
export function MessengerDashboard() {
  const [hoveredFeature, setHoveredFeature] = useState<ProjectType | null>(null)
  const s = useDashboardSession({ restoreFeatures: messengerFeatures })

  return (
    <>
      <CapacitorStandaloneBootstrap />
      <CapacitorForegroundSyncBootstrap />
      <MessengerDashboardBody
        hoveredFeature={hoveredFeature}
        setHoveredFeature={setHoveredFeature}
        s={s}
        visibleFeatures={filterFeaturesByMessengerWorkspaceTileSet(messengerFeatures, {
          workspaceTileSet: 'messenger',
          liteMessengerFromApi: true,
          isBossRole: s.isBossRole,
          role: s.role,
        })}
      />
    </>
  )
}

function MessengerDashboardBody({
  hoveredFeature,
  setHoveredFeature,
  s,
  visibleFeatures,
}: {
  hoveredFeature: ProjectType | null
  setHoveredFeature: (v: ProjectType | null) => void
  s: ReturnType<typeof useDashboardSession>
  visibleFeatures: ReturnType<typeof filterFeaturesByMessengerWorkspaceTileSet>
}) {
  const liteMessengerFromApi = true
  const isEinsatzLeadHome = canAccessEinsatzleitung(s.role)

  useEffect(() => {
    if (!liteMessengerFromApi) return
    const r = (s.role || '').trim().toLowerCase()
    if (r !== 'arbeiter' && r !== 'lock') return
    if (s.showAllTiles) return
    s.setShowAllTilesPersist(true)
    writeShowAllTilesPref(true)
  }, [liteMessengerFromApi, s.role, s.showAllTiles, s.setShowAllTilesPersist])

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
                    : featureTitle(s.activeView.type, messengerFeatures)}
            </span>
          </div>
        </header>

        {/* View Content */}
        <main className={cn('mx-auto max-w-5xl p-4', s.showMessengerBottomNav && 'pb-24')}>
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
              slimMessengerEinsatz={isEinsatzLeadHome}
            />
          )}
          {s.activeView.type === 'config' && <ConfigView messengerMode />}
          {s.activeView.type === 'chat' && s.activeView.variant && (
            <ChatView
              variant={s.activeView.variant as 'private-chat' | 'pinnwand'}
              role={s.role}
              myAddress={s.myAddress}
              vaultBannerActions={s.chatVaultBannerActions}
              pendingHandshakes={s.pendingHandshakes}
              onOpenEinsatzleitung={canAccessEinsatzleitung(s.role) ? s.openEinsatzleitungView : undefined}
              phonebookNavRequest={s.phonebookNavRequest}
              onOpenSettings={s.openSettingsView}
            />
          )}
          {s.activeView.type === 'einsatzleitung' && (
            <EinsatzleitungView
              apiSnapshot={s.apiSnapshot && !('error' in s.apiSnapshot && s.apiSnapshot.error) ? s.apiSnapshot : null}
              contactDirectory={s.contactDirectory}
              refreshContactDirectory={s.refreshContactDirectory}
            />
          )}
          {s.activeView.type === 'boss' && s.activeView.variant && (
            <BossView
              variant={s.activeView.variant as 'boss-signer' | 'pinnwand-admin'}
              apiSnapshot={s.apiSnapshot && !('error' in s.apiSnapshot && s.apiSnapshot.error) ? s.apiSnapshot : null}
            />
          )}
          {s.activeView.type === 'vault' && s.activeView.variant && (
            <VaultView variant={s.activeView.variant as 'local-vault' | 'emergency-purge'} />
          )}
        </main>
        {s.showMessengerBottomNav ? (
          <MessengerBottomNav
            active={s.messengerBottomNavActive}
            showEinsatzleitung={canAccessEinsatzleitung(s.role)}
            onMessages={s.openMessengerChatView}
            onEinsatzleitung={canAccessEinsatzleitung(s.role) ? s.openEinsatzleitungView : undefined}
            onPhonebook={() => {
              s.setMessengerNavHighlight('phonebook')
              if (s.activeView?.type !== 'chat') s.openMessengerChatView()
              s.setPhonebookNavRequest((n) => n + 1)
            }}
          />
        ) : null}
      </div>
      ) : (
    <DeploymentProfileBackdrop status={s.apiSnapshot} hideWatermark={isEinsatzLeadHome}>
    <div className="min-h-screen bg-background/80">
      {isEinsatzLeadHome ? (
        <DashboardMessengerBossHeader
          role={s.role}
          myAddressFull={s.apiSnapshot?.myAddressFull}
          onOpenSettings={s.openSettingsView}
        />
      ) : (
      <header className="border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
              M
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">Morgendrot Messenger</h1>
              </div>
              <p className="text-xs text-muted-foreground">
                {s.networkInfo || 'IOTA Rebased'}
                {s.role ? (
                  <span className="ml-1 font-mono text-[10px] text-foreground/80" title="Kommt aus Backend .env ROLE">
                    · Rolle: {s.role}
                  </span>
                ) : null}
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
                  <span title="Tresor gesperrt">Tresor gesperrt</span>
                </>
              ) : s.connected ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  <span>Chat verbunden</span>
                </>
              ) : s.backendReachable ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500/80" />
                  <span>Tresor: entsperrt</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  Offline
                </>
              )}
            </div>
            <Link
              href="/handbook"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Handbuch"
              aria-label="Handbuch"
            >
              <BookOpen className="h-5 w-5" />
            </Link>
            <button
              onClick={s.openSettingsView}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Einstellungen"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      )}

      <main className={cn('mx-auto max-w-5xl px-4', isEinsatzLeadHome ? 'py-6' : 'py-8')}>
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
        {isEinsatzLeadHome && s.locked ? (
          <OfflineStatusCard
            variant="compact"
            className="mb-4"
            status={s.offlineStatus}
            onTestConnection={s.checkStatus}
            onResync={() => {
              void s.checkStatus()
            }}
            onEnableQueueOptIn={() => enableOfflineMailboxQueue()}
            onOpenHandoffImport={s.isBossRole ? undefined : s.openSettingsView}
          />
        ) : null}
        {!isEinsatzLeadHome ? (
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
        ) : null}
        {!s.locked && isEinsatzLeadHome ? (
          <DashboardMessengerBossHome
            apiSnapshot={s.apiSnapshot}
            offlineStatus={s.offlineStatus}
            hasValidMyAddressForBalance={s.hasValidMyAddressForBalance}
            onRefreshStatus={s.checkStatus}
            addressSuggestions={s.dashboardTransferAddressSuggestions}
            onOpenMessages={s.openMessengerChatView}
            onOpenEinsatzleitung={s.openEinsatzleitungView}
            onOpenVault={s.openVaultView}
            onOpenSettings={s.openSettingsView}
            onEnableQueueOptIn={() => enableOfflineMailboxQueue()}
          />
        ) : null}
        {!s.locked && !isEinsatzLeadHome ? (
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
        {((s.role !== 'arbeiter' && s.role !== 'lock') || s.showAllTiles || liteMessengerFromApi) &&
          !isEinsatzLeadHome && (
          <>
            {/* Welcome */}
            {canAccessEinsatzleitung(s.role) && !isEinsatzLeadHome ? (
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
                    onClick={() => s.handleSelectFeature(feature, variant.id)}
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
            <p className="text-sm leading-relaxed text-amber-400">{getMessengerDashboardOfflineHint()}</p>
          </div>
        )}
      </main>
    </div>
    </DeploymentProfileBackdrop>
      )}
    </>
  )
}
