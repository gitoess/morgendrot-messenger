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
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { useChatViewPendingHandshakes } from '@/frontend/hooks/use-chat-view-pending-handshakes'
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
  const [locked, setLocked] = useState(false)
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

  const prevLockedRef = useRef(false)
  const vaultHasLocalRef = useRef(false)
  const signerIsSdkRef = useRef(false)
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
    }
  }, [])

  useEffect(() => {
    void checkStatus()
    const ms = backendReachable === false ? 3_000 : 10_000
    const interval = window.setInterval(() => void checkStatus(), ms)
    const onApiBase = () => void checkStatus()
    window.addEventListener('morgendrot.apiBaseChanged', onApiBase)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('morgendrot.apiBaseChanged', onApiBase)
    }
  }, [checkStatus, backendReachable])

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
    } else if (res.code === SIGNER_IMPORT_REQUIRED_CODE) {
      setUnlockMode('import')
      setShowSignerImportOpen(true)
      setUnlockError(
        `${res.error || 'Signatur-Material fehlt.'}\n\n` +
          '→ Karte „Seed importieren“ (grün markiert): Vault-Passwort **und** Mnemonic/Secret eintragen, dann **„Profil wiederherstellen“**.\n' +
          'Alternativ unter „Tresor öffnen“: „Mnemonic ergänzen (erweitert)“ öffnen, beides eintragen, **„Entsperren“**.'
      )
    } else {
      setUnlockError(res.error || 'Entsperren fehlgeschlagen')
    }
  }, [
    apiSnapshot?.signer,
    unlockMode,
    password,
    passwordConfirm,
    signerImport,
    signerImportConfirm,
    showSignerImportOpen,
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

  const chatVaultBannerActions: ChatViewVaultBannerActions = useMemo(
    () => ({
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
          navigateTo(null)
        }
      },
      onNavigateHomeWhenLocked: () => {
        navigateTo(null)
      },
    }),
    [checkStatus, navigateTo]
  )

  const openHelp = useCallback(async () => {
    setHelpOpen(true)
    setHelpLoading(true)
    const res = await fetchHelp()
    setHelpText(res.ok && res.helpText ? res.helpText : res.error || 'Keine Hilfe verfügbar.')
    setHelpLoading(false)
  }, [])

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
      handleUnlock,
    },
  }
}
