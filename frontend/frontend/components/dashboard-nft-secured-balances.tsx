'use client'

/**
 * Wallet-Karte: gesichertes Guthaben (Guarded Purse / Bearer Treasury) — nicht in der freien Balance.
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  listNftBearerTreasuriesLocal,
  NFT_BEARER_TREASURY_CHANGED,
  type NftBearerTreasuryLocalEntry,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  listNftGuardedPursesLocal,
  NFT_GUARDED_PURSE_CHANGED,
  type NftGuardedPurseLocalEntry,
} from '@/frontend/lib/nft-guarded-purse-local-store'
import { listIotaActivity, recordNftVaultActivity } from '@/frontend/lib/iota-activity-local-log'
import { getNftKeycard } from '@/frontend/lib/nft-keycard-local-store'
import {
  fetchNftVaultBalance,
  formatLocalMistHintAsIota,
  mistToIotaDecimal,
} from '@/frontend/lib/nft-vault-balance'
import { cn } from '@/lib/utils'

const BACKFILL_LS = 'morgendrot.nftVault.activityBackfill.v1'

function readBackfillIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(BACKFILL_LS)
    if (!raw) return new Set()
    const j = JSON.parse(raw) as unknown
    return new Set(Array.isArray(j) ? j.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function markBackfill(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const s = readBackfillIds()
    s.add(id.toLowerCase())
    window.localStorage.setItem(BACKFILL_LS, JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

type Row = {
  kind: 'guarded' | 'bearer'
  vaultId: string
  nftObjectId: string
  label: string
  frozen?: boolean
  liveIota: string | null
  fallback: string | null
}

function shortId(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 8)}…${t.slice(-4)}`
}

function labelFor(nftObjectId: string, displayLabel?: string): string {
  return (
    displayLabel?.trim() ||
    getNftKeycard(nftObjectId)?.label?.trim() ||
    `NFT ${shortId(nftObjectId)}`
  )
}

export function DashboardNftSecuredBalances({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [sumIota, setSumIota] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const rebuild = useCallback(async () => {
    const purses = listNftGuardedPursesLocal().filter((p) => p.status === 'active')
    const treasuries = listNftBearerTreasuriesLocal().filter((t) => t.status === 'active')
    const base: Row[] = [
      ...purses.map((p: NftGuardedPurseLocalEntry) => ({
        kind: 'guarded' as const,
        vaultId: p.purseObjectId,
        nftObjectId: p.nftObjectId,
        label: labelFor(p.nftObjectId, p.displayLabel),
        liveIota: null,
        fallback: formatLocalMistHintAsIota(p.balanceMistHint),
      })),
      ...treasuries.map((t: NftBearerTreasuryLocalEntry) => ({
        kind: 'bearer' as const,
        vaultId: t.treasuryObjectId,
        nftObjectId: t.nftObjectId,
        label: labelFor(t.nftObjectId, t.displayLabel),
        frozen: t.frozen,
        liveIota: null,
        fallback: formatLocalMistHintAsIota(t.balanceMistHint),
      })),
    ]
    if (base.length === 0) {
      setRows([])
      setSumIota(null)
      return
    }
    setBusy(true)
    try {
      let mistSum = 0n
      let anyLive = false
      const next: Row[] = []
      const backfilled = readBackfillIds()
      const recent = listIotaActivity(80)
      for (const r of base) {
        const bal = await fetchNftVaultBalance(r.vaultId)
        const live = bal.ok ? bal.iotaLabel : null
        if (bal.ok) {
          anyLive = true
          mistSum += bal.mist
        }
        next.push({ ...r, liveIota: live })
        const vid = r.vaultId.toLowerCase()
        const alreadyLogged =
          backfilled.has(vid) ||
          recent.some((a) => a.objectId === vid || (a.summary || '').includes(vid.slice(0, 10)))
        if (!alreadyLogged) {
          recordNftVaultActivity({
            op: 'vault_indexed',
            vaultObjectId: r.vaultId,
            nftObjectId: r.nftObjectId,
            amountMist: bal.ok ? bal.mist : undefined,
            nftLabel: r.label,
          })
          markBackfill(vid)
        }
      }
      setRows(next)
      setSumIota(anyLive ? mistToIotaDecimal(mistSum) : null)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void rebuild()
    const sync = () => void rebuild()
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
    return () => {
      window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
      window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
    }
  }, [rebuild])

  if (rows.length === 0) {
    return (
      <p className={cn('text-[10px] text-muted-foreground', compact ? 'mt-1' : 'mt-2')}>
        Kein gesichertes Purse-/Treasury-Guthaben auf diesem Gerät. Anlegen unter NFT → Tab Guthaben.
        (Freie Wallet-Balance enthält das nicht.)
      </p>
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-emerald-800/25 bg-emerald-950/10',
        compact ? 'mt-2 px-2 py-1.5' : 'mt-2 px-3 py-2'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[11px] font-medium text-foreground">
          Gesichert (Purse/Treasury)
          {sumIota != null ? (
            <>
              : <strong>{sumIota}</strong> IOTA
            </>
          ) : busy ? (
            ' …'
          ) : (
            ''
          )}
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px]"
          disabled={busy}
          onClick={() => void rebuild()}
        >
          Aktualisieren
        </Button>
      </div>
      <ul className={cn('mt-1 space-y-1', compact ? 'max-h-28 overflow-y-auto' : '')}>
        {rows.map((r) => (
          <li key={`${r.kind}-${r.vaultId}`} className="text-[10px] text-muted-foreground break-all">
            <span className="font-medium text-foreground">
              {r.kind === 'guarded' ? 'Guarded' : 'Bearer'}
              {r.frozen ? ' · freeze' : ''}
            </span>
            {' · '}
            {r.liveIota != null ? `${r.liveIota} IOTA` : r.fallback || 'Balance ?'}
            {' · an '}
            <span className="text-foreground">{r.label}</span>
            {' · Vault '}
            <span className="font-mono">{shortId(r.vaultId)}</span>
            {' · NFT '}
            <span className="font-mono">{shortId(r.nftObjectId)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
