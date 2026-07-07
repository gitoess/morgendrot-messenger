'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { flushSync } from 'react-dom'
import { scheduleReleaseStuckModalPointerEvents, clearStuckRadixBodyLock } from '@/frontend/lib/release-modal-pointer-events'
import { forceReleaseNativeBodyLock } from '@/frontend/components/native-modal-shell'
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
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'
import type { ProjectType } from '@/frontend/lib/types'
const LazyChatView = dynamic(
  () => import('./views/chat-view').then((m) => m.ChatView),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground" role="status">
        Nachrichten werden geladen…
      </div>
    ),
  }
)
import { LazyBossView, LazyConfigView } from '@/frontend/components/lazy/messenger-scope-b'
import { EinsatzleitungView } from './views/einsatzleitung-view'
import { SettingsView } from './views/settings-view'
import { DashboardMessengerBossHeader } from '@/frontend/components/dashboard-messenger-boss-header'
import { TresorSessionBadge } from '@/frontend/components/chat-view-chat-header'
import { DashboardMessengerBossHome } from '@/frontend/components/dashboard-messenger-boss-home'
import { DashboardSharedDialogs } from '@/frontend/components/dashboard-shared-dialogs'
import { messengerFeatures, featureTitle } from '@/frontend/components/dashboard-features-messenger'
import { useMessengerFeatures } from '@/frontend/hooks/use-messenger-features'
import { DashboardMyAddressPicker } from '@/frontend/components/dashboard-my-address-picker'
import { DashboardPwaInstallCard } from '@/frontend/components/dashboard-pwa-install-card'
import { DashboardIotaTransferCard } from '@/frontend/components/dashboard-iota-transfer-card'
import { shouldShowDashboardPwaInstallCard } from '@/frontend/lib/should-show-pwa-install'
import { MeshStatus } from './mesh-status'
import { DeploymentProfileBackdrop } from '@/frontend/components/deployment-profile-backdrop'
import {
  filterFeaturesByMessengerWorkspaceTileSet,
} from '@/frontend/lib/dashboard-workspace-tile-visibility'
import type { DashboardFeature } from '@/frontend/components/dashboard-features-messenger'
import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'
import { HelperSeedSetupDialog } from '@/frontend/components/helper-seed-setup-dialog'
import { StandaloneHandoffActivateCard } from '@/frontend/components/standalone-handoff-activate-card'
import { StandaloneFirstStartCard } from '@/frontend/components/standalone-first-start-card'
import { StandaloneSoloWizardCard } from '@/frontend/components/standalone-solo-wizard-card'
import { OnboardingResumeCard } from '@/frontend/components/onboarding/onboarding-resume-card'
import { OnboardingWizardHost } from '@/frontend/components/onboarding/onboarding-wizard-host'
import { drainTeamSyncOfflineQueue } from '@/frontend/lib/team-sync-wire'
import {
  clearOnboardingDismissed,
  prepareOnboardingWizardOpen,
  resolveMessengerSetupOnboardingPath,
  shouldOfferMessengerSetupFromVault,
} from '@/frontend/lib/onboarding-progress-store'
import { isBrowserSessionSignerReady } from '@/frontend/lib/messenger-session-keys-ready'
import {
  bossWizardVaultContextHint,
  enrichBossWizardApiSnapshot,
} from '@/frontend/lib/onboarding-boss-runtime'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'
import {
  getStandaloneHelperReadiness,
  HELPER_SEED_SETUP_REQUEST_EVENT,
  maybeRequestHelperSeedSetup,
  STANDALONE_WALLET_UNLOCKED_EVENT,
} from '@/frontend/lib/handoff-standalone-ready'
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import { writeShowAllTilesPref } from '@/frontend/lib/dashboard-prefs'
import { useDashboardSession } from '@/frontend/hooks/use-dashboard-session'
import { CapacitorForegroundSyncBootstrap } from '@/frontend/components/capacitor-foreground-sync-bootstrap'
import { CapacitorStandaloneBootstrap } from '@/frontend/components/capacitor-standalone-bootstrap'
import { InstallQrLandingBootstrap } from '@/frontend/components/install-qr-landing-bootstrap'
import { MessengerDashboardOfflineHint } from '@/frontend/components/messenger-dashboard-offline-hint'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'

/** Morgendrot Messenger — schlanke Einsatz-App (eigenes Build). */
export function MessengerDashboard() {
  const [hoveredFeature, setHoveredFeature] = useState<ProjectType | null>(null)
  const messengerFeaturesI18n = useMessengerFeatures()
  const s = useDashboardSession({ restoreFeatures: messengerFeatures })

  return (
    <>
      <InstallQrLandingBootstrap />
      <CapacitorStandaloneBootstrap />
      <CapacitorForegroundSyncBootstrap />
      <MessengerDashboardBody
        hoveredFeature={hoveredFeature}
        setHoveredFeature={setHoveredFeature}
        s={s}
        messengerFeaturesI18n={messengerFeaturesI18n}
        visibleFeatures={filterFeaturesByMessengerWorkspaceTileSet(messengerFeaturesI18n, {
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
  messengerFeaturesI18n,
  visibleFeatures,
}: {
  hoveredFeature: ProjectType | null
  setHoveredFeature: (v: ProjectType | null) => void
  s: ReturnType<typeof useDashboardSession>
  messengerFeaturesI18n: ReturnType<typeof useMessengerFeatures>
  visibleFeatures: DashboardFeature[]
}) {
  const [helperSeedSetupOpen, setHelperSeedSetupOpen] = useState(false)
  const [onboardingWizardOpen, setOnboardingWizardOpen] = useState(false)
  const [vaultOverWizard, setVaultOverWizard] = useState(false)
  const vaultFromWizardFlowRef = useRef(false)
  const liteMessengerFromApi = true
  const effectiveRole = s.role || s.apiSnapshot?.role
  const isEinsatzLeadHome = canAccessEinsatzleitung(effectiveRole)
  const offerMessengerSetupInVault = shouldOfferMessengerSetupFromVault(effectiveRole)
  const { t } = useAppTranslation('dashboard')
  const { t: tc } = useAppTranslation('common')
  const { t: tv } = useAppTranslation('vault')

  const onLockSession = async () => {
    if (!window.confirm(t('lock.confirm'))) return
    await s.lockSession()
  }

  const vaultSessionLocked = !!(s.locked || s.apiSnapshot?.locked)
  const browserSignerReady = isBrowserSessionSignerReady(s.locked)
  const vaultKeysReady = browserSignerReady
  const standaloneApkWithoutBasis = isStandaloneMessengerWithoutBasis()
  const standaloneWalletActive = standaloneApkWithoutBasis && !vaultSessionLocked && vaultKeysReady
  const showHomeVaultBadge = s.backendReachable === true
  const backendVaultUnlocked =
    s.apiSnapshot?.hasKeys === true && s.apiSnapshot?.locked !== true

  const promptBrowserWalletUnlock = useCallback(() => {
    if (backendVaultUnlocked && !isBrowserSessionSignerReady(false)) {
      s.requestMainnetSessionSignerSync()
      return
    }
    s.requestVaultUnlock()
  }, [backendVaultUnlocked, s.requestMainnetSessionSignerSync, s.requestVaultUnlock])

  const openVaultFromUi = useCallback(() => {
    flushSync(() => {
      setVaultOverWizard(false)
      setOnboardingWizardOpen(false)
    })
    clearOnboardingDismissed()
    promptBrowserWalletUnlock()
  }, [promptBrowserWalletUnlock])

  const returnToWizardFromVault = useCallback(() => {
    vaultFromWizardFlowRef.current = true
    setVaultOverWizard(false)
    clearOnboardingDismissed()
    s.sessionSignerSync.close()
    scheduleReleaseStuckModalPointerEvents()
    setOnboardingWizardOpen(true)
  }, [s.sessionSignerSync.close])

  const handleWizardActivateWallet = useCallback(() => {
    vaultFromWizardFlowRef.current = true
    flushSync(() => {
      setOnboardingWizardOpen(false)
      setVaultOverWizard(true)
    })
    scheduleReleaseStuckModalPointerEvents()
    if (backendVaultUnlocked && !isBrowserSessionSignerReady(s.locked)) {
      s.requestMainnetSessionSignerSync()
      return
    }
    s.requestVaultUnlock({ navigateHome: false })
  }, [backendVaultUnlocked, s.locked, s.requestMainnetSessionSignerSync, s.requestVaultUnlock])

  const openMessengerSetupFromVault = useCallback(() => {
    const path = resolveMessengerSetupOnboardingPath(effectiveRole)
    if (!path) return
    setVaultOverWizard(false)
    prepareOnboardingWizardOpen(path)
    setOnboardingWizardOpen(true)
  }, [effectiveRole])

  const messengerSetupVaultLabel =
    resolveMessengerSetupOnboardingPath(effectiveRole) === 'boss'
      ? tv('messengerSetup.linkBoss')
      : tv('messengerSetup.link')
  const messengerSetupVaultHint =
    resolveMessengerSetupOnboardingPath(effectiveRole) === 'boss'
      ? tv('messengerSetup.hintBoss')
      : tv('messengerSetup.hint')

  const wizardApiSnapshot = useMemo(
    () => enrichBossWizardApiSnapshot(s.apiSnapshot, s.myAddress),
    [s.apiSnapshot, s.myAddress]
  )
  const wizardVaultContextHint = useMemo(
    () => (vaultOverWizard ? bossWizardVaultContextHint(s.apiSnapshot) : undefined),
    [s.apiSnapshot, vaultOverWizard]
  )

  const handleWizardOpenChange = useCallback((open: boolean) => {
    setOnboardingWizardOpen(open)
    if (!open) {
      setVaultOverWizard(false)
      scheduleReleaseStuckModalPointerEvents()
    }
  }, [])

  const homeVaultActions = useMemo(
    () => ({
      ...s.chatVaultBannerActions,
      onNavigateHomeWhenLocked: () => {
        openVaultFromUi()
      },
    }),
    [openVaultFromUi, s.chatVaultBannerActions]
  )

  useEffect(() => {
    if (!liteMessengerFromApi) return
    if (browserSignerReady) setVaultOverWizard(false)
  }, [liteMessengerFromApi, vaultOverWizard, browserSignerReady])

  useEffect(() => {
    const onWalletUnlocked = () => {
      forceReleaseNativeBodyLock()
      clearStuckRadixBodyLock()
      scheduleReleaseStuckModalPointerEvents()
      const resumeWizard = vaultFromWizardFlowRef.current && !isCapacitorNativePlatform()
      vaultFromWizardFlowRef.current = false
      setVaultOverWizard(false)
      if (resumeWizard) {
        queueMicrotask(() => setOnboardingWizardOpen(true))
      } else {
        setOnboardingWizardOpen(false)
      }
    }
    window.addEventListener(STANDALONE_WALLET_UNLOCKED_EVENT, onWalletUnlocked)
    return () => window.removeEventListener(STANDALONE_WALLET_UNLOCKED_EVENT, onWalletUnlocked)
  }, [])

  const prevVaultOverWizardRef = useRef(false)
  useEffect(() => {
    if (prevVaultOverWizardRef.current && !vaultOverWizard && onboardingWizardOpen) {
      void s.checkStatus()
    }
    prevVaultOverWizardRef.current = vaultOverWizard
  }, [vaultOverWizard, onboardingWizardOpen, s.checkStatus])

  useEffect(() => {
    if (!liteMessengerFromApi) return
    const r = (s.role || '').trim().toLowerCase()
    if (r !== 'arbeiter' && r !== 'lock') return
    if (s.showAllTiles) return
    s.setShowAllTilesPersist(true)
    writeShowAllTilesPref(true)
  }, [liteMessengerFromApi, s.role, s.showAllTiles, s.setShowAllTilesPersist])

  useEffect(() => {
    const onSeedSetup = () => {
      if (getStandaloneHelperReadiness().needsMnemonic) setHelperSeedSetupOpen(true)
    }
    window.addEventListener(HELPER_SEED_SETUP_REQUEST_EVENT, onSeedSetup)
    const boot = window.setTimeout(() => maybeRequestHelperSeedSetup(), 400)
    return () => {
      window.removeEventListener(HELPER_SEED_SETUP_REQUEST_EVENT, onSeedSetup)
      window.clearTimeout(boot)
    }
  }, [])

  useEffect(() => {
    if (!s.backendReachable) return
    const role = (s.role || '').trim().toLowerCase()
    if (role !== 'boss') return
    void drainTeamSyncOfflineQueue()
  }, [s.backendReachable, s.role])

  return (
    <>
      <DashboardSharedDialogs
        locked={s.locked}
        suppressVaultUnlockForHelperSeed={s.unlock.suppressVaultUnlockForHelperSeed}
        suppressVaultUnlockForOnboardingWizard={!vaultOverWizard && onboardingWizardOpen}
        showMessengerSetupInVault={offerMessengerSetupInVault}
        onOpenMessengerSetupFromVault={openMessengerSetupFromVault}
        messengerSetupVaultLabel={messengerSetupVaultLabel}
        messengerSetupVaultHint={messengerSetupVaultHint}
        vaultOpenedFromWizard={vaultOverWizard}
        onBackToWizardFromVault={returnToWizardFromVault}
        backToWizardVaultLabel={tv('backToWizard.link')}
        backToWizardVaultHint={tv('backToWizard.hint')}
        vaultContextHint={wizardVaultContextHint}
        helpOpen={s.helpOpen}
        onHelpOpenChange={s.setHelpOpen}
        helpLoading={s.helpLoading}
        helpText={s.helpText}
        sessionSignerSync={{
          open: s.sessionSignerSync.open,
          busy: s.sessionSignerSync.busy,
          error: s.sessionSignerSync.error,
          password: s.unlock.password,
          onPasswordChange: s.unlock.setPassword,
          onClose: vaultOverWizard ? returnToWizardFromVault : s.sessionSignerSync.close,
          onSync: s.sessionSignerSync.handleSync,
        }}
        unlock={{ ...s.unlock, apiSnapshot: s.apiSnapshot }}
      />
      <HelperSeedSetupDialog
        open={helperSeedSetupOpen}
        onOpenChange={setHelperSeedSetupOpen}
        onActivated={() => {
          setHelperSeedSetupOpen(false)
          void s.checkStatus()
        }}
      />
      <OnboardingWizardHost
        open={onboardingWizardOpen}
        onOpenChange={handleWizardOpenChange}
        apiSnapshot={wizardApiSnapshot}
        backendOnline={s.apiSnapshot?.backendOnline === true || s.apiSnapshot?.backendRunning === true}
        sessionLocked={s.locked}
        contactDirectory={s.contactDirectory}
        fallbackMyAddress={s.myAddress}
        onActivateWallet={handleWizardActivateWallet}
        onOpenHandoffImport={() => s.openSettingsCategory('general')}
        onReloadStatus={() => void s.checkStatus()}
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
              <span className="text-sm font-medium">{t('nav.back')}</span>
            </button>
            <div className="h-4 w-px bg-border" />
            <span className="text-sm font-semibold text-foreground">
              {s.activeView.type === 'settings'
                ? t('views.settings')
                : s.activeView.type === 'config'
                  ? t('views.config')
                  : s.activeView.type === 'einsatzleitung'
                    ? t('views.einsatzleitung')
                    : featureTitle(s.activeView.type, messengerFeaturesI18n)}
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
                aria-label={tc('actions.close')}
              >
                ×
              </button>
            </div>
          ) : null}
          {s.mainnetSignerHint ? (
            <div
              className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
              role="status"
            >
              <span>{s.mainnetSignerHint}</span>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs font-medium text-amber-900 underline hover:no-underline dark:text-amber-100"
                  onClick={() => s.requestMainnetSessionSignerSync()}
                >
                  Signer laden
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-0.5 text-amber-800/80 hover:bg-amber-500/20 dark:text-amber-200/80"
                  onClick={() => s.setMainnetSignerHint(null)}
                  aria-label={tc('actions.close')}
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}
          {s.activeView.type === 'settings' && (
            <SettingsView
              onOpenConfig={s.openConfigView}
              showAllTiles={s.showAllTiles}
              onShowAllTilesChange={s.setShowAllTilesPersist}
              canToggleFullTiles={s.role === 'arbeiter' || s.role === 'lock'}
              slimMessengerEinsatz={isEinsatzLeadHome}
              vaultLocked={vaultSessionLocked}
              onRequestVaultUnlock={s.requestMainnetSessionSignerSync}
            />
          )}
          {s.activeView.type === 'config' && <LazyConfigView messengerMode />}
          {s.activeView.type === 'chat' && s.activeView.variant && (
            <LazyChatView
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
              onRefreshStatus={s.checkStatus}
              onOpenSettings={() => s.openSettingsCategory('iota')}
            />
          )}
          {s.activeView.type === 'boss' && s.activeView.variant && (
            <LazyBossView
              variant={s.activeView.variant as 'boss-signer' | 'pinnwand-admin'}
              apiSnapshot={s.apiSnapshot && !('error' in s.apiSnapshot && s.apiSnapshot.error) ? s.apiSnapshot : null}
            />
          )}
        </main>
      </div>
      ) : (
    <DeploymentProfileBackdrop status={s.apiSnapshot} hideWatermark={isEinsatzLeadHome}>
    <div className="min-h-screen bg-background/80">
      {isEinsatzLeadHome ? (
        <DashboardMessengerBossHeader
          role={s.role}
          myAddressFull={s.apiSnapshot?.myAddressFull}
          onOpenSettings={s.openSettingsView}
          onLockSession={!s.locked ? onLockSession : undefined}
          vaultBannerActions={showHomeVaultBadge ? homeVaultActions : undefined}
          sessionLocked={vaultSessionLocked}
          hasKeys={browserSignerReady}
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
                <h1 className="text-lg font-bold text-foreground">{t('brand.messenger')}</h1>
              </div>
              <p className="text-xs text-muted-foreground">
                {s.networkInfo || t('network.defaultLabel')}
                {s.role ? (
                  <span
                    className="ml-1 font-mono text-[10px] text-foreground/80"
                    title={t('network.roleTitle')}
                  >
                    · {t('network.role', { role: s.role })}
                  </span>
                ) : null}
              </p>
              <div className="mt-1">
                <MeshStatus
                  mode={s.meshPathMode}
                  subtitle={
                    s.rpcProxyActive
                      ? t('network.meshProxySubtitle')
                      : t('network.meshDefaultSubtitle')
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
            {showHomeVaultBadge ? (
              <TresorSessionBadge
                sessionLocked={vaultSessionLocked}
                hasKeys={browserSignerReady}
                actions={homeVaultActions}
              />
            ) : null}
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',
                s.backendReachable === null || (s.backendReachable && s.connected === null && !s.locked)
                  ? 'bg-muted text-muted-foreground'
                  : s.locked
                    ? 'bg-amber-500/10 text-amber-400'
                    : !vaultKeysReady && s.backendReachable
                      ? 'bg-orange-500/10 text-orange-400'
                    : s.connected
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : s.backendReachable
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : standaloneWalletActive
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
              )}
            >
              {s.backendReachable === null ? (
                <>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-current" />
                  {t('connection.connecting')}
                </>
              ) : s.locked ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span title={t('connection.vaultLockedTitle')}>{t('connection.vaultLocked')}</span>
                </>
              ) : !vaultKeysReady && s.backendReachable ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span title={t('connection.vaultKeysMissingTitle')}>{t('connection.vaultKeysMissing')}</span>
                </>
              ) : s.connected ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  <span>{t('connection.chatConnected')}</span>
                </>
              ) : s.backendReachable ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500/80" />
                  <span>{t('connection.vaultUnlocked')}</span>
                </>
              ) : (
                <>
                  {standaloneWalletActive ? (
                    <Wifi className="h-3.5 w-3.5 text-emerald-500/80" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5" />
                  )}
                  {standaloneWalletActive ? t('connection.standaloneActive') : t('connection.offline')}
                </>
              )}
            </div>
            {!s.locked ? (
              <button
                type="button"
                onClick={() => void onLockSession()}
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
                title={t('lock.buttonTitle')}
                aria-label={t('lock.button')}
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden text-xs font-medium sm:inline">{t('lock.button')}</span>
              </button>
            ) : null}
            <Link
              href="/handbook"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t('nav.handbook')}
              aria-label={t('nav.handbook')}
            >
              <BookOpen className="h-5 w-5" />
            </Link>
            <button
              onClick={s.openSettingsView}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={t('nav.settings')}
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
              aria-label={tc('actions.close')}
            >
              ×
            </button>
          </div>
        ) : null}
        <StandaloneFirstStartCard apiRole={s.role} />
        <OnboardingResumeCard apiSnapshot={s.apiSnapshot} />
        <StandaloneHandoffActivateCard
          apiRole={s.role}
          onOpenHandoffImport={() => s.openSettingsCategory('general')}
          onActivateWallet={() => {
            setOnboardingWizardOpen(false)
            setVaultOverWizard(false)
            s.requestStandaloneWalletUnlock()
          }}
        />
        <StandaloneSoloWizardCard apiSnapshot={s.apiSnapshot} />
        {!s.locked && isEinsatzLeadHome ? (
          <DashboardMessengerBossHome
            apiSnapshot={s.apiSnapshot}
            hasValidMyAddressForBalance={s.hasValidMyAddressForBalance}
            onRefreshStatus={s.checkStatus}
            addressSuggestions={s.dashboardTransferAddressSuggestions}
            onOpenMessages={s.openMessengerChatView}
            onOpenEinsatzleitung={s.openEinsatzleitungView}
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
                    <p className="font-semibold text-foreground">{t('welcomeEinsatz.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('welcomeEinsatz.subtitle')}</p>
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
            <MessengerDashboardOfflineHint />
          </div>
        )}
      </main>
    </div>
    </DeploymentProfileBackdrop>
      )}
    </>
  )
}
