'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'

const WALLET_RE = /^0x[a-f0-9]{64}$/i

function normWallet(raw: string | undefined | null): string {
  const a = (raw ?? '').trim().toLowerCase()
  return WALLET_RE.test(a) ? a : ''
}

/**
 * Organisatorische Einsatzleitung (Roster, Ausschluss) — nicht für Posteingang-Absender.
 * Posteingang zeigt immer `msg.from` von der Chain.
 */
export function resolveEinsatzleitungBossAddress(apiStatus?: ApiStatus | null): string {
  for (const raw of [
    apiStatus?.bossAddress,
    readLocalHandoffAppliedSnapshot()?.bossAddress,
    apiStatus?.myAddressFull,
    apiStatus?.myAddress,
  ]) {
    const a = normWallet(raw)
    if (a) return a
  }
  return ''
}

/** Wallet, die Team-Wire on-chain signiert — muss mit `msg.from` übereinstimmen. */
export function resolveTeamSyncSigningAddress(apiStatus?: ApiStatus | null): string {
  for (const raw of [apiStatus?.myAddressFull, apiStatus?.myAddress]) {
    const a = normWallet(raw)
    if (a) return a
  }
  return ''
}
