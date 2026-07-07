'use client'

import type { ApiStatus } from '@/frontend/lib/api/status'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { resolveBossWizardAddress } from '@/frontend/lib/onboarding-boss-runtime'
import { IOTA_TESTNET_FAUCET_BASE } from '@morgendrot/shared/iota-testnet-faucet-url'
import {
  readBossTestnetFaucetPrefs,
  resolveBossTestnetFaucetOpenUrl,
  resolveBossTestnetFaucetRecipient,
} from '@/frontend/lib/boss-wizard-testnet-faucet-prefs'
import { walletHasGasForNetwork } from '@/frontend/lib/wallet-balance-by-network'

export const IOTA_TESTNET_FAUCET_DOCS_URL = IOTA_TESTNET_FAUCET_BASE

const ADDR_RE = /^0x[a-fA-F0-9]{64}$/i

/** Nur volle 0x+64hex — für Faucet und Button-Freigabe. */
export function resolveBossWizardFullAddress(
  api?: ApiStatus | null,
  fallbackMyAddress?: string | null
): string | undefined {
  const candidates = [
    api?.myAddressFull,
    fallbackMyAddress,
    api?.myAddress,
    getDirectIotaSessionSignerAddress(),
  ]
  for (const raw of candidates) {
    const v = (raw || '').trim()
    if (ADDR_RE.test(v)) return v
  }
  const fromRuntime = resolveBossWizardAddress(api, fallbackMyAddress).trim()
  return ADDR_RE.test(fromRuntime) ? fromRuntime : undefined
}

/** @deprecated — nutze walletHasGasForNetwork(api, "testnet") */
export function bossWizardHasTestnetGas(api?: ApiStatus | null) {
  return walletHasGasForNetwork(api, 'testnet')
}

export type BossTestnetGasRequestResult = {
  ok: boolean
  message?: string
  error?: string
  openUrl?: string
}

export type BossTestnetGasRequestOptions = {
  serverWalletUnlocked?: boolean
  /** Optional — sonst aus localStorage (Wizard/Einstellungen). */
  faucetPrefs?: ReturnType<typeof readBossTestnetFaucetPrefs>
}

/** Faucet im Browser öffnen (Turnstile-Captcha). */
export function bossWizardCanRequestTestnetTokens(
  recipient: string | undefined,
  opts?: BossTestnetGasRequestOptions
): boolean {
  const prefs = opts?.faucetPrefs ?? readBossTestnetFaucetPrefs()
  if (prefs.customOpenUrl.trim() && resolveBossTestnetFaucetOpenUrl(recipient, prefs).mode === 'custom') {
    return true
  }
  const effective = resolveBossTestnetFaucetRecipient(recipient, prefs)
  if (effective && ADDR_RE.test(effective)) return true
  return Boolean(opts?.serverWalletUnlocked)
}

export function requestBossTestnetGas(
  recipient: string | undefined,
  opts?: BossTestnetGasRequestOptions
): BossTestnetGasRequestResult {
  const prefs = opts?.faucetPrefs ?? readBossTestnetFaucetPrefs()
  const effectiveRecipient = resolveBossTestnetFaucetRecipient(recipient, prefs)
  const canOpen =
    Boolean(effectiveRecipient) ||
    Boolean(opts?.serverWalletUnlocked) ||
    Boolean(prefs.customOpenUrl.trim() && resolveBossTestnetFaucetOpenUrl(recipient, prefs).mode === 'custom')

  if (!canOpen) {
    return {
      ok: false,
      error: 'Zuerst Wallet entsperren — dann Testnet-Token im Browser anfordern.',
    }
  }

  const { url: openUrl, mode } = resolveBossTestnetFaucetOpenUrl(recipient, prefs)
  if (typeof window !== 'undefined') {
    window.open(openUrl, '_blank', 'noopener,noreferrer')
  }

  return {
    ok: true,
    openUrl,
    message:
      mode === 'custom'
        ? 'Eigener Faucet-Link im Browser geöffnet — Captcha/Adresse prüfen, dann Saldo aktualisieren.'
        : effectiveRecipient
          ? 'Faucet im Browser geöffnet — Captcha bestätigen, dann hier Status aktualisieren.'
          : 'Faucet im Browser geöffnet — Adresse eintragen, Captcha bestätigen, dann Status aktualisieren.',
  }
}

/** Vorschau für UI — aktualisiert sich bei neuer Wallet-Adresse, solange kein eigener Voll-Link gesetzt ist. */
export function previewBossTestnetFaucetUrl(
  walletAddress: string | undefined,
  prefs?: ReturnType<typeof readBossTestnetFaucetPrefs>
): string {
  return resolveBossTestnetFaucetOpenUrl(walletAddress, prefs).url
}
