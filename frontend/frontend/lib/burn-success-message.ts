/**
 * Burn-Erfolgs-Toast: Rebate nur wenn die TX `storageRebate` liefert (kein Claim-Queue).
 */

import { formatMistAsWalletUiIota } from '@/frontend/lib/nft-vault-balance'

export function storageRebateMistFromGasSummary(gasSummary: unknown): string | undefined {
  if (!gasSummary || typeof gasSummary !== 'object') return undefined
  const raw = (gasSummary as { storageRebate?: unknown }).storageRebate
  if (raw == null) return undefined
  const s = String(raw).trim()
  if (!s) return undefined
  try {
    if (BigInt(s) <= 0n) return undefined
  } catch {
    return undefined
  }
  return s
}

export function formatBurnSuccessUserMessage(opts: {
  baseMessage?: string
  storageRebateMist?: string | null
}): string {
  const mistRaw = (opts.storageRebateMist ?? '').trim()
  let mist: bigint | null = null
  if (mistRaw) {
    try {
      const n = BigInt(mistRaw)
      if (n > 0n) mist = n
    } catch {
      mist = null
    }
  }
  if (mist == null) {
    return (opts.baseMessage?.trim() || 'Nachricht geburnt (Storage-Rebate).').trim()
  }
  const label = formatMistAsWalletUiIota(mist, { maximumFractionDigits: 6 })
  return `Burn ok · Rebate ${label} IOTA`
}
