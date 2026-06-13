'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { fetchStatus, unlockBackend, fetchHelp, vaultLockCommand, type ApiStatus } from '@/frontend/lib/api'
import type { ProjectType, ProjectVariant } from '@/frontend/lib/types'
import {
  type DashboardActiveView,
  type DashboardFeatureDef,
  DASHBOARD_ACTIVE_VIEW_SESSION_KEY,
  parseDashboardActiveView,
  persistDashboardActiveView,
} from '@/frontend/lib/dashboard-active-view'
import {
  type DashboardUnlockMode,
  SIGNER_IMPORT_REQUIRED_CODE,
  isPlausibleSdkImport,
  normalizeSignerWords,
} from '@/frontend/lib/dashboard-unlock'
import { isPwaStandaloneDisplay, readShowAllTilesPref, writeShowAllTilesPref } from '@/frontend/lib/dashboard-prefs'
import {
  notifyFirstStepsPrefChanged,
  readFirstStepsVisible,
  writeFirstStepsVisible,
} from '@/frontend/lib/dashboard-first-steps-pref'
import { recordSeenMyAddress } from '@/frontend/lib/my-address-local-history'
import type { MeshPathMode } from '@/frontend/components/mesh-status'
import { tryApplyPendingInitialProfileFromStorage } from '@/frontend/lib/initial-profile-import'
import { resolveConnectedAddresses } from '@/frontend/lib/connected-peers-snapshot'
import { canFetchHandshakesViaDirectIota } from '@/frontend/lib/direct-iota-handshake-fetch'
import { hasCachedHandshakeOffers } from '@/frontend/lib/handshake-offers-cache'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'
import { resolveStandaloneDeviceLocked } from '@/frontend/lib/capacitor-standalone-bootstrap'
import {
  clearDirectIotaSessionSigner,
  clearDirectIotaSessionSignerOnLock,
  getDirectIotaSessionSigner,
  hasPersistedDirectIotaSessionSigner,
  restoreDirectIotaSessionSignerFromEncryptedStorage,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  activateStandaloneHelperWallet,
  getStandaloneHelperReadiness,
  HELPER_SEED_SETUP_REQUEST_EVENT,
  STANDALONE_HANDOFF_APPLIED_EVENT,
  shouldShowHelperSeedSetupDialog,
} from '@/frontend/lib/handoff-standalone-ready'
import {
  syncDirectIotaSessionSignerAfterVaultUnlock,
  tryAutoRestoreDirectIotaSessionSigner,
  tryAutoRestoreDirectIotaSessionSignerAsync,
  tryAutoRestoreDirectChatEcdhPrivateKey,
  shouldAutoRestoreSessionSignerForMainnet,
} from '@/frontend/lib/direct-iota-vault-unlock-sync'
import { syncMainnetKeysAfterBackendUnlock } from '@/frontend/lib/dashboard-vault-key-sync'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import {
  isStandaloneEinsatzPath,
  isStandaloneSoloPath,
  STANDALONE_ONBOARDING_CHANGED_EVENT,
  STANDALONE_SOLO_WALLET_SETUP_REQUEST_EVENT,
} from '@/frontend/lib/standalone-onboarding'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'
import { clearDirectChatEcdhKeyMaterial } from '@/frontend/lib/direct-chat-ecdh-session'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { useChatViewPendingHandshakes, OPEN_MESSENGER_INBOX_EVENT } from '@/frontend/hooks/use-chat-view-pending-handshakes'
import { useOfflineStatus } from '@/frontend/hooks/use-offline-status'
import type { ChatViewVaultBannerActions } from '@/frontend/components/chat-view-chat-header'
import type { MessengerBottomNavTab } from '@/frontend/components/messenger-bottom-nav'

const EMPTY_CONNECTED_ADDRESSES: string[] = []

export type UseDashboardSessionOptions = {
  /** Feature-Liste für Wiederherstellung der letzten Kachel-Ansicht aus sessionStorage. */
  restoreFeatures: readonly DashboardFeatureDef[]
}

export function useDashboardSession(options: UseDashboardSessionOptions) {
  const [activeView, setActiveView] = useState<DashboardActiveView | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [networkInfo, setNetworkInfo] = useState('')
  /** Bis zum ersten Status-Poll: Tresor als gesperrt annehmen (kein Dashboard ohne Entsperren). */
  const [locked, setLocked] = useState(true)
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [signerImport, setSignerImport] = useState('')
  const [signerImportConfirm, setSignerImportConfirm] = useState('')
  const [unlockMode, setUnlockMode] = useState<DashboardUnlockMode>('vault')
  const [showSignerImportOpen, setShowSignerImportOpen] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpText, setHelpText] = useState('')
  const [helpLoading, setHelpLoading] = useState(false)
  const [role, setRole] = useState('')
  const [myAddress, setMyAddress] = useState('')
  const [showAllTiles, setShowAllTiles] = useState(false)
  const [rpcProxyActive] = useState(false)
  const [apiSnapshot, setApiSnapshot] = useState<(ApiStatus & { error?: string }) | null>(null)
  const [initialProfileBanner, setInitialProfileBanner] = useState<string | null>(null)
  const [firstStepsVisible, setFirstStepsVisible] = useState(true)
  const [phonebookNavRequest, setPhonebookNavRequest] = useState(0)
  const [messengerNavHighlight, setMessengerNavHighlight] = useState<MessengerBottomNavTab>('messages')
  const [mainnetSignerHint, setMainnetSignerHint] = useState<string | null>(null)

  const prevLockedRef = useRef(false)
  const vaultHasLocalRef = useRef(false)
  const signerIsSdkRef = useRef(false)
  const restoredDashboardViewRef = useRef(false)
  /** Hält Entsperr-Dialog offen, bis Keys in der Sitzung sind (Poll setzt sonst locked=false). */
  const vaultUnlockRequestedRef = useRef(false)
  /** Entsperrt und stabil — verhindert kurzen Login-Dialog bei einem transienten locked-Poll. */
  const sessionUnlockedStableRef = useRef(false)
  const lockPollStreakRef = useRef(0)

  const applyLockedFromStatusPoll = useCallback(
    (defaultLocked: boolean, res: { locked?: boolean; hasKeys?: boolean }) => {
      if (vaultUnlockRequestedRef.current) {
        const keysReady =
          res.hasKeys === true && !res.locked
            ? true
            : isStandaloneMessengerWithoutBasis() && !!getDirectIotaSessionSigner()
        if (keysReady) {
          vaultUnlockRequestedRef.current = false
          sessionUnlockedStableRef.current = true
          lockPollStreakRef.current = 0
          setLocked(false)
        } else {
          setLocked(true)
        }
        return
      }
      if (!defaultLocked) {
        lockPollStreakRef.current = 0
        sessionUnlockedStableRef.current = true
        setLocked(false)
        return
      }
      lockPollStreakRef.current += 1
      if (!sessionUnlockedStableRef.current || lockPollStreakRef.current >= 2) {
        sessionUnlockedStableRef.current = false
        setLocked(true)
      }
    },
    []
  )

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
      if (isStandaloneMessengerWithoutBasis() && readLocalHandoffAppliedSnapshot()) {
        if (isStandaloneSoloPath()) {
          setUnlockMode(hasPersistedDirectIotaSessionSigner() ? 'vault' : 'create')
          setShowSignerImportOpen(false)
        } else {
          setUnlockMode('import')
          setShowSignerImportOpen(true)
        }
      } else if (isStandaloneMessengerWithoutBasis() && isStandaloneSoloPath()) {
        setUnlockMode(hasPersistedDirectIotaSessionSigner() ? 'vault' : 'create')
        setShowSignerImportOpen(false)
      } else {
        const hasVault = vaultHasLocalRef.current
        const sdk = signerIsSdkRef.current
        setUnlockMode(hasVault ? 'vault' : sdk ? 'create' : 'vault')
      }
    }
  }, [locked])

  useEffect(() => {
    if (!locked) return
    if (isStandaloneMessengerWithoutBasis() && readLocalHandoffAppliedSnapshot() && !isStandaloneSoloPath()) return
    const s = apiSnapshot?.signer
    if (s != null && s !== 'sdk' && unlockMode === 'import') {
      setUnlockMode('vault')
      setShowSignerImportOpen(false)
    }
  }, [apiSnapshot?.signer, unlockMode, locked])

  useEffect(() => {
    setShowAllTiles(readShowAllTilesPref())
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

  const isBossRole = (role || '').toLowerCase() === 'boss'

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

  const setShowAllTilesPersist = (value: boolean) => {
    setShowAllTiles(value)
    writeShowAllTilesPref(value)
  }

  const checkStatus = useCallback(async () => {
    let res: Awaited<ReturnType<typeof fetchStatus>>
    try {
      res = await fetchStatus()
    } catch (e) {
      console.warn('[status] Unerwarteter Fehler beim Status-Poll.', e)
      setBackendReachable(false)
      setConnected(false)
      return
    }
    if ('pollClockHint' in res) {
      const { pollClockHint: _hint, ...snap } = res
      setApiSnapshot(snap)
    } else {
      setApiSnapshot(res)
    }

    const liveBackend = 'pollClockHint' in res && res.backendRunning === true
    const standaloneWithoutBasis = isStandaloneMessengerWithoutBasis()
    const offlineSnapshot =
      'pollClockHint' in res &&
      !liveBackend &&
      (standaloneWithoutBasis || res.fromLocalHandoff === true || res.fromCache === true)

    if ('pollClockHint' in res && (liveBackend || offlineSnapshot)) {
      setBackendReachable(liveBackend)
      setConnected(liveBackend ? !!res.connected : false)
      setNetworkInfo(
        res.rpcUrlLabel ||
          res.network ||
          (liveBackend ? 'IOTA Rebased' : 'Standalone (Direkt-RPC)')
      )

      if (liveBackend) {
        applyLockedFromStatusPoll(!!res.locked, res)
        vaultHasLocalRef.current = res.vaultStatus?.hasLocal === true
        signerIsSdkRef.current = res.signer === 'sdk'
      } else if (standaloneWithoutBasis) {
        applyLockedFromStatusPoll(resolveStandaloneDeviceLocked(), res)
        vaultHasLocalRef.current = false
        signerIsSdkRef.current = true
      } else {
        applyLockedFromStatusPoll(!!res.locked, res)
        vaultHasLocalRef.current = res.vaultStatus?.hasLocal === true
        signerIsSdkRef.current = res.signer === 'sdk'
      }

      if (!res.locked && res.signer === 'sdk' && shouldAutoRestoreSessionSignerForMainnet()) {
        const restored = await tryAutoRestoreDirectIotaSessionSignerAsync()
        if (restored.ok) {
          setMainnetSignerHint(null)
        } else if (!getDirectIotaSessionSigner()) {
          setMainnetSignerHint(
            'Mainnet direct send: unlock vault — session signer loads automatically from the vault.'
          )
        }
      }

      if (!res.locked) {
        void tryAutoRestoreDirectChatEcdhPrivateKey()
      }

      setRole(res.role || '')
      const addrLine = (res.myAddressFull || res.myAddress || '').trim()
      setMyAddress(addrLine)
      if (res.myAddressFull && /^0x[a-fA-F0-9]{64}$/i.test(res.myAddressFull.trim())) {
        recordSeenMyAddress(res.myAddressFull.trim())
      }
    } else {
      setBackendReachable(false)
      setConnected(false)
      if (standaloneWithoutBasis) {
        setLocked(resolveStandaloneDeviceLocked())
        signerIsSdkRef.current = true
      }
    }
  }, [applyLockedFromStatusPoll])

  useEffect(() => {
    void checkStatus()
    const inChat = activeView?.type === 'chat'
    const ms = backendReachable === false ? 3_000 : inChat ? 20_000 : 12_000
    const interval = window.setInterval(() => void checkStatus(), ms)
    const onApiBase = () => void checkStatus()
    const onDirectIotaUi = () => void checkStatus()
    window.addEventListener('morgendrot.apiBaseChanged', onApiBase)
    window.addEventListener(DIRECT_IOTA_UI_CHANGED, onDirectIotaUi)
    const onHandoffApplied = () => {
      void checkStatus()
      if (shouldShowHelperSeedSetupDialog()) {
        window.dispatchEvent(new CustomEvent(HELPER_SEED_SETUP_REQUEST_EVENT))
      }
      sessionUnlockedStableRef.current = false
      lockPollStreakRef.current = 0
      setLocked(resolveStandaloneDeviceLocked())
    }
    window.addEventListener(STANDALONE_HANDOFF_APPLIED_EVENT, onHandoffApplied)
    const onOnboardingChanged = () => {
      void checkStatus()
      sessionUnlockedStableRef.current = false
      lockPollStreakRef.current = 0
      setLocked(resolveStandaloneDeviceLocked())
    }
    const onSoloWalletSetup = () => {
      setUnlockMode(hasPersistedDirectIotaSessionSigner() ? 'vault' : 'create')
      setShowSignerImportOpen(false)
      setUnlockError('')
      sessionUnlockedStableRef.current = false
      lockPollStreakRef.current = 0
      setLocked(true)
      void checkStatus()
    }
    window.addEventListener(STANDALONE_ONBOARDING_CHANGED_EVENT, onOnboardingChanged)
    window.addEventListener(STANDALONE_SOLO_WALLET_SETUP_REQUEST_EVENT, onSoloWalletSetup)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('morgendrot.apiBaseChanged', onApiBase)
      window.removeEventListener(DIRECT_IOTA_UI_CHANGED, onDirectIotaUi)
      window.removeEventListener(STANDALONE_HANDOFF_APPLIED_EVENT, onHandoffApplied)
      window.removeEventListener(STANDALONE_ONBOARDING_CHANGED_EVENT, onOnboardingChanged)
      window.removeEventListener(STANDALONE_SOLO_WALLET_SETUP_REQUEST_EVENT, onSoloWalletSetup)
    }
  }, [checkStatus, activeView?.type, backendReachable])

  const { directory: contactDirectory, refresh: refreshContactDirectory } = useContactDirectory()

  const connectedAddressesForHandshake = useMemo(() => {
    const resolved = resolveConnectedAddresses({
      fromStatus: apiSnapshot?.connectedAddresses,
      preferCacheWhenEmpty: backendReachable === false,
    })
    return resolved.addresses.length ? resolved.addresses : EMPTY_CONNECTED_ADDRESSES
  }, [apiSnapshot?.connectedAddresses, backendReachable])

  const pendingHandshakeRefreshKey = `${connectedAddressesForHandshake.join('|')}|${locked ? 'locked' : 'open'}`

  const pendingHandshakes = useChatViewPendingHandshakes({
    enabled:
      !locked &&
      hasValidMyAddressForBalance &&
      (backendReachable !== false || hasCachedHandshakeOffers() || canFetchHandshakesViaDirectIota()),
    connectedAddresses: connectedAddressesForHandshake,
    refreshToken: pendingHandshakeRefreshKey,
    contactDirectory,
    vaultLocked: locked || apiSnapshot?.locked === true,
    basisUnreachable: backendReachable === false,
  })

  const pendingHandshakeCount =
    pendingHandshakes.offers.length + pendingHandshakes.outgoingOffers.length

  const offlineStatus = useOfflineStatus({
    apiSnapshot,
    backendReachable,
  })

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

  const navigateTo = useCallback((v: DashboardActiveView | null) => {
    setActiveView(v)
    persistDashboardActiveView(v)
  }, [])

  const openSettingsView = useCallback(() => {
    navigateTo({ type: 'settings' })
  }, [navigateTo])

  const openConfigView = useCallback(() => {
    navigateTo({ type: 'config' })
  }, [navigateTo])

  const openEinsatzleitungView = useCallback(() => {
    navigateTo({ type: 'einsatzleitung', variant: 'einsatzleitung-hub' })
    setMessengerNavHighlight('einsatzleitung')
  }, [navigateTo])

  const openMessengerChatView = useCallback(() => {
    navigateTo({ type: 'chat', variant: 'private-chat' })
    setMessengerNavHighlight('messages')
  }, [navigateTo])

  useEffect(() => {
    const onOpenInbox = () => openMessengerChatView()
    window.addEventListener(OPEN_MESSENGER_INBOX_EVENT, onOpenInbox)
    return () => window.removeEventListener(OPEN_MESSENGER_INBOX_EVENT, onOpenInbox)
  }, [openMessengerChatView])

  const openVaultView = useCallback(() => {
    navigateTo({ type: 'vault', variant: 'local-vault' })
  }, [navigateTo])

  const openBossModeView = useCallback(() => {
    navigateTo({ type: 'boss', variant: 'boss-signer' })
  }, [navigateTo])

  useEffect(() => {
    if (locked || backendReachable !== true) return
    if (restoredDashboardViewRef.current) return
    try {
      const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(DASHBOARD_ACTIVE_VIEW_SESSION_KEY) : null
      const parsed = parseDashboardActiveView(raw, options.restoreFeatures)
      if (parsed) {
        setActiveView(parsed)
        persistDashboardActiveView(parsed)
        restoredDashboardViewRef.current = true
      }
    } catch {
      /* ignore */
    }
  }, [locked, backendReachable, options.restoreFeatures])

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

  const handleUnlock = useCallback(async () => {
    setUnlockError('')
    const signer = apiSnapshot?.signer
    const sdkLike = signer === 'sdk' || (signer == null && unlockMode === 'import')

    if (unlockMode === 'create') {
      if (!password.trim() || password !== passwordConfirm) {
        setUnlockError('Vault/wallet password and confirmation must match.')
        return
      }
      if (signer === 'sdk') {
        const sa = signerImport.trim()
        const sb = signerImportConfirm.trim()
        if (!sa || normalizeSignerWords(sa) !== normalizeSignerWords(sb)) {
          setUnlockError('Mnemonic / secret and confirmation must match.')
          return
        }
        if (!isPlausibleSdkImport(sa)) {
          setUnlockError(
            'Mnemonic: at least 12 words — or a valid Bech32/64-hex secret (see help).'
          )
          return
        }
      }
    } else if (sdkLike && unlockMode === 'import') {
      const t = signerImport.trim()
      if (!t || !isPlausibleSdkImport(t)) {
        setUnlockError(
          'Mnemonic / secret required (at least 12 words or Bech32/hex as in help).'
        )
        return
      }
    } else if (sdkLike && unlockMode === 'vault' && showSignerImportOpen) {
      const t = signerImport.trim()
      if (t && !isPlausibleSdkImport(t)) {
        setUnlockError(
          'Mnemonic / secret appears invalid (at least 12 words or Bech32/hex as in help).'
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
    if (isStandaloneMessengerWithoutBasis()) {
      const mnemonic = signerImport.trim()
      const vaultPassword = password.trim()
      let unlockResult: { ok: true; address: string } | { ok: false; error: string }
      if (hasPersistedDirectIotaSessionSigner() && !mnemonic) {
        const restored = await restoreDirectIotaSessionSignerFromEncryptedStorage({
          password: vaultPassword,
        })
        unlockResult = restored.ok
          ? { ok: true, address: restored.address }
          : { ok: false, error: restored.error }
      } else if (mnemonic) {
        if (unlockMode === 'create' && (!vaultPassword || vaultPassword !== passwordConfirm.trim())) {
          setUnlocking(false)
          setUnlockError('New profile: password and confirmation must match (min. 8 characters).')
          return
        }
        unlockResult = await activateStandaloneHelperWallet({
          mnemonic,
          password: vaultPassword.length >= 8 ? vaultPassword : undefined,
        })
      } else {
        setUnlocking(false)
        setUnlockError('Enter wallet key (mnemonic, Bech32, or 64 hex).')
        return
      }
      setUnlocking(false)
      if (unlockResult.ok) {
        vaultUnlockRequestedRef.current = false
        sessionUnlockedStableRef.current = true
        lockPollStreakRef.current = 0
        setPassword('')
        setPasswordConfirm('')
        setSignerImport('')
        setSignerImportConfirm('')
        setShowSignerImportOpen(false)
        setLocked(false)
        await checkStatus()
      } else {
        setUnlockError(unlockResult.error)
      }
      return
    }

    const res = await unlockBackend(password, { sdkSignerImport: sdkExtra })
    setUnlocking(false)
    if (res.ok) {
      const vaultPw = password
      await checkStatus()
      const { mainnetSignerHint } = await syncMainnetKeysAfterBackendUnlock({
        vaultPassword: vaultPw,
        signerImport: sdkExtra,
        apiSigner: signer,
        expectedAddress: myAddress.trim() || undefined,
      })
      setMainnetSignerHint(mainnetSignerHint)
      vaultUnlockRequestedRef.current = false
      sessionUnlockedStableRef.current = true
      lockPollStreakRef.current = 0
      setPassword('')
      setPasswordConfirm('')
      setSignerImport('')
      setSignerImportConfirm('')
      setShowSignerImportOpen(false)
      setLocked(false)
      await checkStatus()
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const s = await fetchStatus()
        if (!('pollClockHint' in s)) continue
        if (s.connected) {
          setConnected(true)
          applyLockedFromStatusPoll(!!s.locked, s)
          break
        }
        if (s.locked) break
        setConnected(!!s.connected)
      }
    } else if (res.code === SIGNER_IMPORT_REQUIRED_CODE) {
      setUnlockMode('import')
      setShowSignerImportOpen(true)
      setUnlockError(
        `${res.error || 'Signing material missing.'}\n\n` +
          '→ Card "Import seed" (highlighted green): enter vault password **and** mnemonic/secret, then **"Restore profile"**.\n' +
          'Alternatively under "Open vault": open "Add mnemonic (advanced)", enter both, **"Unlock"**.'
      )
    } else {
      setUnlockError(res.error || 'Unlock failed')
    }
  }, [
    apiSnapshot?.signer,
    unlockMode,
    password,
    passwordConfirm,
    signerImport,
    signerImportConfirm,
    showSignerImportOpen,
    applyLockedFromStatusPoll,
    checkStatus,
  ])

  const handleSelectFeature = useCallback(
    (featureId: ProjectType, variant: ProjectVariant) => {
      const next: DashboardActiveView = { type: featureId, variant }
      navigateTo(next)
      if (featureId === 'chat') setMessengerNavHighlight('messages')
      if (featureId === 'einsatzleitung') setMessengerNavHighlight('einsatzleitung')
    },
    [navigateTo]
  )

  const handleBack = useCallback(() => {
    navigateTo(null)
  }, [navigateTo])

  const lockSession = useCallback(async () => {
    vaultUnlockRequestedRef.current = false
    sessionUnlockedStableRef.current = false
    lockPollStreakRef.current = 0
    if (isStandaloneMessengerWithoutBasis()) {
      clearDirectIotaSessionSignerOnLock()
      clearDirectChatEcdhKeyMaterial()
      setLocked(resolveStandaloneDeviceLocked())
      navigateTo(null)
      window.dispatchEvent(new Event(DIRECT_IOTA_UI_CHANGED))
      return { ok: true as const }
    }
    const r = await vaultLockCommand()
    if (r.ok) {
      clearDirectIotaSessionSignerOnLock()
      clearDirectChatEcdhKeyMaterial()
      setMainnetSignerHint(null)
      await checkStatus()
      navigateTo(null)
      window.dispatchEvent(new Event(DIRECT_IOTA_UI_CHANGED))
    }
    return r
  }, [checkStatus, navigateTo])

  const requestVaultUnlock = useCallback(() => {
    vaultUnlockRequestedRef.current = true
    sessionUnlockedStableRef.current = false
    lockPollStreakRef.current = 0
    setUnlockError('')
    setLocked(true)
    navigateTo(null)
  }, [navigateTo])

  const requestStandaloneWalletUnlock = useCallback(() => {
    vaultUnlockRequestedRef.current = true
    const readiness = getStandaloneHelperReadiness()
    if (
      readiness.standaloneMode &&
      readiness.hasHandoff &&
      readiness.needsMnemonic &&
      isStandaloneEinsatzPath()
    ) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(HELPER_SEED_SETUP_REQUEST_EVENT))
      }
      return
    }
    if (isStandaloneSoloPath()) {
      setUnlockMode(hasPersistedDirectIotaSessionSigner() ? 'vault' : 'create')
      setShowSignerImportOpen(false)
    } else {
      setUnlockMode('import')
      setShowSignerImportOpen(true)
    }
    setUnlockError('')
    setLocked(true)
  }, [])

  const chatVaultBannerActions: ChatViewVaultBannerActions = useMemo(
    () => ({
      onLockSession: async () => {
        if (
          !window.confirm(
            'Lock API session? Keys are removed from the basis working memory — then unlock the vault again with your password.'
          )
        ) {
          return
        }
        await lockSession()
      },
      onNavigateHomeWhenLocked: () => {
        if (isStandaloneMessengerWithoutBasis()) {
          requestStandaloneWalletUnlock()
          return
        }
        requestVaultUnlock()
      },
    }),
    [lockSession, requestStandaloneWalletUnlock, requestVaultUnlock]
  )

  const openHelp = useCallback(async () => {
    setHelpOpen(true)
    setHelpLoading(true)
    const res = await fetchHelp()
    setHelpText(res.ok && res.helpText ? res.helpText : res.error || 'No help available.')
    setHelpLoading(false)
  }, [])

  const meshPathMode: MeshPathMode =
    backendReachable === false
      ? 'offline'
      : rpcProxyActive || process.env.NEXT_PUBLIC_PRIVACY_TOR === '1'
        ? 'tor'
        : 'internet'

  const signerKind = apiSnapshot?.signer
  const standaloneHelperUnlock =
    isStandaloneMessengerWithoutBasis() &&
    isStandaloneEinsatzPath() &&
    Boolean(readLocalHandoffAppliedSnapshot()) &&
    unlockMode === 'import'
  const suppressVaultUnlockForHelperSeed = shouldShowHelperSeedSetupDialog()
  const importMnemonicRequired =
    unlockMode === 'import' && (signerKind === 'sdk' || signerKind == null)
  const unlockButtonDisabled = standaloneHelperUnlock
    ? unlocking || !signerImport.trim() || !isPlausibleSdkImport(signerImport.trim())
    : isStandaloneMessengerWithoutBasis() && unlockMode === 'create'
      ? unlocking ||
        !signerImport.trim() ||
        !isPlausibleSdkImport(signerImport.trim()) ||
        !password.trim() ||
        password.length < 8 ||
        password !== passwordConfirm.trim()
      : unlocking ||
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

  const showMessengerBottomNav =
    activeView != null && (activeView.type === 'chat' || activeView.type === 'einsatzleitung')

  const messengerBottomNavActive: MessengerBottomNavTab =
    messengerNavHighlight === 'phonebook'
      ? 'phonebook'
      : activeView?.type === 'einsatzleitung'
        ? 'einsatzleitung'
        : 'messages'

  const onUnlockModeChange = useCallback((m: DashboardUnlockMode) => {
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
  }, [])

  return {
    activeView,
    connected,
    networkInfo,
    locked,
    backendReachable,
    role,
    myAddress,
    apiSnapshot,
    initialProfileBanner,
    setInitialProfileBanner,
    firstStepsVisible,
    dismissFirstStepsBar,
    showAllTiles,
    setShowAllTilesPersist,
    rpcProxyActive,
    offlineStatus,
    pendingHandshakes,
    pendingHandshakeCount,
    contactDirectory,
    refreshContactDirectory,
    hasValidMyAddressForBalance,
    dashboardTransferAddressSuggestions,
    meshPathMode,
    isBossRole,
    checkStatus,
    openSettingsView,
    openConfigView,
    openEinsatzleitungView,
    openMessengerChatView,
    openVaultView,
    openBossModeView,
    handleBack,
    handleSelectFeature,
    openHelp,
    requestStandaloneWalletUnlock,
    lockSession,
    requestVaultUnlock,
    mainnetSignerHint,
    setMainnetSignerHint,
    helpOpen,
    setHelpOpen,
    helpText,
    helpLoading,
    chatVaultBannerActions,
    showMessengerBottomNav,
    messengerBottomNavActive,
    phonebookNavRequest,
    setPhonebookNavRequest,
    setMessengerNavHighlight,
    unlock: {
      unlockMode,
      onUnlockModeChange,
      signerKind,
      password,
      setPassword,
      passwordConfirm,
      setPasswordConfirm,
      signerImport,
      setSignerImport,
      signerImportConfirm,
      setSignerImportConfirm,
      showSignerImportOpen,
      setShowSignerImportOpen,
      unlockError,
      unlocking,
      unlockButtonDisabled,
      importMnemonicRequired,
      standaloneHelperUnlock,
      suppressVaultUnlockForHelperSeed,
      handleUnlock,
    },
  }
}
