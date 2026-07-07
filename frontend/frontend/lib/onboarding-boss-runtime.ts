'use client'

import type { ApiStatus } from '@/frontend/lib/api/status'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { isBrowserSessionSignerReady } from '@/frontend/lib/messenger-session-keys-ready'

export type BossOnboardingRuntime = {
  browserWalletReady: boolean
  serverWalletUnlocked: boolean
  serverConfigured: boolean
  displayAddress: string
  addressFromServer: boolean
  addressFromBrowser: boolean
  needsVaultUnlock: boolean
  needsNewWallet: boolean
  vaultHasLocal: boolean
}

function normalizeAddr(v?: string | null): string {
  return (v || '').trim()
}

/** Volle 0x-Adresse für Wizard — nur wenn Server leer, Browser-Signer als Fallback. */
export function resolveBossWizardAddress(
  api?: ApiStatus | null,
  fallbackMyAddress?: string | null
): string {
  const fromApi = normalizeAddr(api?.myAddressFull) || normalizeAddr(api?.myAddress)
  if (/^0x[a-fA-F0-9]{64}$/i.test(fromApi)) return fromApi
  const fromSession = normalizeAddr(fallbackMyAddress)
  if (/^0x[a-fA-F0-9]{64}$/i.test(fromSession)) return fromSession
  const fromBrowser = normalizeAddr(getDirectIotaSessionSignerAddress())
  if (/^0x[a-fA-F0-9]{64}$/i.test(fromBrowser)) return fromBrowser
  return fromApi || fromSession || fromBrowser
}

/** Kein myAddressFull-Override — Server-Status bleibt maßgeblich für die UI. */
export function enrichBossWizardApiSnapshot(
  api?: ApiStatus | null,
  _fallbackMyAddress?: string | null
): ApiStatus | null | undefined {
  return api
}

export function buildBossOnboardingRuntime(
  api?: ApiStatus | null,
  sessionLocked = false,
  fallbackMyAddress?: string | null
): BossOnboardingRuntime {
  const browserWalletReady = isBrowserSessionSignerReady(sessionLocked)
  const serverWalletUnlocked = api?.hasKeys === true && api?.locked !== true
  const vaultHasLocal = api?.vaultStatus?.hasLocal === true
  const displayAddress = resolveBossWizardAddress(api, fallbackMyAddress)
  const addressFromServer = Boolean(
    normalizeAddr(api?.myAddressFull) || normalizeAddr(api?.myAddress)
  )
  const addressFromBrowser = Boolean(normalizeAddr(getDirectIotaSessionSignerAddress()))
  const serverConfigured = Boolean(
    displayAddress || vaultHasLocal || api?.packageId?.trim() || api?.mailboxId?.trim()
  )

  return {
    browserWalletReady,
    serverWalletUnlocked,
    serverConfigured,
    displayAddress,
    addressFromServer,
    addressFromBrowser,
    needsVaultUnlock: !browserWalletReady && (serverConfigured || api?.locked === true || vaultHasLocal),
    needsNewWallet: !browserWalletReady && !serverConfigured && !vaultHasLocal,
    vaultHasLocal,
  }
}

export function bossWizardVaultContextHint(api?: ApiStatus | null): string | undefined {
  if (api?.signer !== 'sdk') return undefined
  if (api.vaultStatus?.hasLocal) {
    return 'Server-Tresor (SIGNER=sdk): Wenn der Seed im Vault liegt, reicht das Passwort — sonst „Mnemonic ergänzen (erweitert)“ öffnen.'
  }
  return 'SIGNER=sdk: Passwort und einmalig Mnemonic oder Bech32-Secret — oder unter „Seed importieren“.'
}
