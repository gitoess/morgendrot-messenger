/**
 * Live-Balance für Guarded Purse / Bearer Treasury (Chain = Wahrheit).
 */

import { createDirectIotaClient } from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'

const MIST_PER_IOTA = 1_000_000_000n

export function mistToIotaDecimal(mist: bigint): string {
  const neg = mist < 0n
  const abs = neg ? -mist : mist
  const whole = abs / MIST_PER_IOTA
  const frac = abs % MIST_PER_IOTA
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '')
  const body = fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
  return neg ? `-${body}` : body
}

/**
 * Wallet-UI wie Frei (`formatWalletNativeIotaForStatusUi`): de-DE, bis 6 Nachkommastellen.
 * Purse-Summe: `minimumFractionDigits: 6` → z. B. `0,700000`.
 */
export function formatMistAsWalletUiIota(
  mist: bigint,
  opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const min = opts?.minimumFractionDigits ?? 0
  const max = opts?.maximumFractionDigits ?? 6
  const asNum = Number(mist)
  if (!Number.isFinite(asNum) || asNum < 0) {
    return min > 0 ? (0).toLocaleString('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max }) : '0'
  }
  const iota = asNum / 1_000_000_000
  if (iota === 0 && min === 0) return '0'
  return iota.toLocaleString('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max })
}

/** Extrahiert Balance-Wert (MIST) aus Move-Object-Content (Purse/Treasury). */
export function parseMistBalanceFromMoveContent(content: unknown): bigint | null {
  if (!content || typeof content !== 'object') return null
  const c = content as Record<string, unknown>
  const fields =
    c.fields && typeof c.fields === 'object' && !Array.isArray(c.fields)
      ? (c.fields as Record<string, unknown>)
      : c
  const bal = fields.balance
  if (bal == null) return null
  if (typeof bal === 'string' || typeof bal === 'number') {
    try {
      return BigInt(bal)
    } catch {
      return null
    }
  }
  if (typeof bal === 'object') {
    const bf = bal as Record<string, unknown>
    const inner =
      bf.fields && typeof bf.fields === 'object'
        ? (bf.fields as Record<string, unknown>).value
        : bf.value
    if (inner != null && (typeof inner === 'string' || typeof inner === 'number')) {
      try {
        return BigInt(inner)
      } catch {
        return null
      }
    }
  }
  return null
}

export type NftVaultBalanceResult =
  | { ok: true; mist: bigint; iotaLabel: string; objectId: string }
  | { ok: false; error: string; objectId: string }

/** Direkt-RPC: Balance eines Purse-/Treasury-Objekts. */
export async function fetchNftVaultBalance(objectIdRaw: string): Promise<NftVaultBalanceResult> {
  const objectId = objectIdRaw.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(objectId)) {
    return { ok: false, error: 'Vault-ID: 0x + 64 Hex.', objectId }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return { ok: false, error: 'Keine Direkt-RPC-URL gesetzt.', objectId }
  }
  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const res = await client.getObject({
      id: objectId,
      options: { showContent: true },
    })
    const mist = parseMistBalanceFromMoveContent(res.data?.content)
    if (mist == null) {
      return { ok: false, error: 'Kein Balance-Feld am Objekt (falsche ID?).', objectId }
    }
    return {
      ok: true,
      mist,
      iotaLabel: formatMistAsWalletUiIota(mist, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      }),
      objectId,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      objectId,
    }
  }
}

/** Lokalen Mist-Hint grob als IOTA formatieren (Fallback ohne RPC). */
export function formatLocalMistHintAsIota(hint: string | undefined | null): string | null {
  if (!hint) return null
  const t = hint.trim()
  if (!t || t === '?') return null
  const m = t.match(/^[+\-]?(\d+)/)
  if (!m) return null
  try {
    const label = formatMistAsWalletUiIota(BigInt(m[1]!), {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    })
    return `~${label} IOTA (lokal)`
  } catch {
    return null
  }
}
