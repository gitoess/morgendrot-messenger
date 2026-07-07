'use client'

import {
  buildIotaTestnetFaucetUrl,
  isHttpUrl,
  normalizeIotaTestnetFaucetBase,
} from '@morgendrot/shared/iota-testnet-faucet-url'

const LS_CUSTOM_OPEN_URL = 'morgendrot.bossTestnetFaucetCustomOpenUrl.v1'
const LS_FAUCET_BASE = 'morgendrot.bossTestnetFaucetBase.v1'
const LS_RECIPIENT_OVERRIDE = 'morgendrot.bossTestnetFaucetRecipientOverride.v1'

const ADDR_RE = /^0x[a-fA-F0-9]{64}$/i

export type BossTestnetFaucetPrefs = {
  customOpenUrl: string
  faucetBase: string
  recipientOverride: string
}

function readLs(key: string): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(key)?.trim() ?? ''
  } catch {
    return ''
  }
}

function writeLs(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    const v = value.trim()
    if (v) window.localStorage.setItem(key, v)
    else window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function readBossTestnetFaucetPrefs(): BossTestnetFaucetPrefs {
  return {
    customOpenUrl: readLs(LS_CUSTOM_OPEN_URL),
    faucetBase: readLs(LS_FAUCET_BASE),
    recipientOverride: readLs(LS_RECIPIENT_OVERRIDE),
  }
}

export function writeBossTestnetFaucetPrefs(patch: Partial<BossTestnetFaucetPrefs>): BossTestnetFaucetPrefs {
  if (patch.customOpenUrl !== undefined) writeLs(LS_CUSTOM_OPEN_URL, patch.customOpenUrl)
  if (patch.faucetBase !== undefined) writeLs(LS_FAUCET_BASE, patch.faucetBase)
  if (patch.recipientOverride !== undefined) writeLs(LS_RECIPIENT_OVERRIDE, patch.recipientOverride)
  return readBossTestnetFaucetPrefs()
}

export function clearBossTestnetFaucetPrefs(): void {
  writeBossTestnetFaucetPrefs({ customOpenUrl: '', faucetBase: '', recipientOverride: '' })
}

/** Empfänger für automatischen Link — Override oder aktuelle Wallet. */
export function resolveBossTestnetFaucetRecipient(
  walletAddress: string | undefined,
  prefs?: Pick<BossTestnetFaucetPrefs, 'recipientOverride'>
): string | undefined {
  const override = (prefs?.recipientOverride ?? readLs(LS_RECIPIENT_OVERRIDE)).trim()
  if (override && ADDR_RE.test(override)) return override
  const wallet = (walletAddress || '').trim()
  return ADDR_RE.test(wallet) ? wallet : undefined
}

export function resolveBossTestnetFaucetOpenUrl(
  walletAddress: string | undefined,
  prefs?: BossTestnetFaucetPrefs
): { url: string; mode: 'custom' | 'built' } {
  const p = prefs ?? readBossTestnetFaucetPrefs()
  const custom = p.customOpenUrl.trim()
  if (custom && isHttpUrl(custom)) {
    return { url: custom.includes('://') ? custom : `https://${custom}`, mode: 'custom' }
  }
  const recipient = resolveBossTestnetFaucetRecipient(walletAddress, p)
  const base = p.faucetBase.trim() ? normalizeIotaTestnetFaucetBase(p.faucetBase) : undefined
  return {
    url: buildIotaTestnetFaucetUrl(recipient, base ? { baseUrl: base } : undefined),
    mode: 'built',
  }
}
