'use client'

/**
 * Wallet: Summe „Gesichert“ + skalierbare Positions-Liste (50+ Vaults).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  listNftBearerTreasuriesLocal,
  NFT_BEARER_TREASURY_CHANGED,
  type NftBearerTreasuryLocalEntry,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import { adminReclaimNftBearerTreasuryToSelf } from '@/frontend/lib/nft-bearer-treasury-actions'
import {
  listNftGuardedPursesLocal,
  NFT_GUARDED_PURSE_CHANGED,
  type NftGuardedPurseLocalEntry,
} from '@/frontend/lib/nft-guarded-purse-local-store'
import { spendNftGuardedPurse } from '@/frontend/lib/nft-guarded-purse-actions'
import {
  createDirectIotaClient,
} from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import {
  dedupeVaultIndexedActivity,
  listIotaActivity,
  recordNftVaultActivity,
} from '@/frontend/lib/iota-activity-local-log'
import { listNftOwnedSnapshot } from '@/frontend/lib/nft-activity-local-log'
import {
  fetchNftVaultBalance,
  formatLocalMistHintAsIota,
  formatMistAsWalletUiIota,
} from '@/frontend/lib/nft-vault-balance'
import { restoreParkedVaultsForOwnedNfts } from '@/frontend/lib/nft-vault-local-clear'
import { autoDestroyEmptyNftVault } from '@/frontend/lib/nft-vault-auto-destroy-empty'
import { NFT_VAULT_PARKED_CHANGED } from '@/frontend/lib/nft-vault-parked-store'
import { NFT_VAULT_INDEX_CHANGED } from '@/frontend/lib/nft-vault-index-vault'
import {
  MESSAGING_MODULES_PACKAGE_ID,
  MESSAGING_MODULES_PACKAGE_ID_P5,
} from '@/frontend/lib/messaging-modules-package'
import { nftVaultSessionHint } from '@/frontend/lib/nft-vault-session-gate'
import {
  explorerObjectUrlFromId,
  explorerTxUrlFromDigest,
} from '@/frontend/lib/iota-tx-explorer-hint'
import { TechnicalIdRow } from '@/frontend/components/technical-id-row'
import { copyTextSafe } from '@/frontend/lib/copy-text-safe'

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '')) || ''

async function fetchMyWalletAddress(): Promise<string> {
  const fromSession = (getDirectIotaSessionSignerAddress() || '').trim()
  if (/^0x[a-fA-F0-9]{64}$/i.test(fromSession)) return fromSession
  try {
    const r = await fetch(`${API_BASE}/api/status`, { cache: 'no-store' })
    if (!r.ok) return ''
    const j = (await r.json()) as { myAddressFull?: string; myAddress?: string }
    return (j.myAddressFull || j.myAddress || '').trim()
  } catch {
    return ''
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type NftOwnerCheck =
  | { ok: true }
  | { ok: false; error: string; parentId?: string }

async function readNftOwner(nftObjectId: string, me: string): Promise<NftOwnerCheck> {
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL gesetzt.' }
  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const res = await client.getObject({ id: nftObjectId, options: { showOwner: true } })
    const owner = res.data?.owner
    if (!owner) return { ok: false, error: 'NFT-Objekt nicht gefunden.' }
    if (typeof owner === 'object' && owner && 'AddressOwner' in owner) {
      const addr = String((owner as { AddressOwner: string }).AddressOwner || '').toLowerCase()
      if (addr === me.toLowerCase()) return { ok: true }
      return { ok: false, error: 'NFT liegt in einer anderen Wallet — Anfordern braucht das NFT hier.' }
    }
    if (typeof owner === 'object' && owner && 'ObjectOwner' in owner) {
      const parentId = String((owner as { ObjectOwner: string }).ObjectOwner || '').toLowerCase()
      return {
        ok: false,
        error: `NFT steckt unter Objekt ${parentId.slice(0, 12)}…`,
        parentId,
      }
    }
    if (owner === 'Immutable' || (typeof owner === 'object' && owner && 'Shared' in owner)) {
      return { ok: false, error: 'NFT-Ownership ungeeignet für Auszahlung.' }
    }
    return { ok: false, error: 'NFT-Ownership unklar.' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function ownerParentId(owner: unknown): string | null {
  if (typeof owner === 'object' && owner && 'ObjectOwner' in owner) {
    const id = String((owner as { ObjectOwner: string }).ObjectOwner || '').toLowerCase()
    return /^0x[a-f0-9]{64}$/.test(id) ? id : null
  }
  return null
}

function moveTypeString(data: {
  type?: string
  content?: { type?: string; dataType?: string }
} | null | undefined): string {
  if (!data) return ''
  if (data.content && typeof data.content === 'object' && data.content.type) {
    return String(data.content.type)
  }
  return String(data.type || '')
}

/**
 * NFT in DOF zeigt oft Owner = Field-Objekt, nicht das Lease.
 * Owner-Kette hochlaufen bis NftTimeLease (oder lokal per NFT finden).
 */
async function resolveNftTimeLeaseObjectId(
  nftObjectId: string,
  startParentId: string
): Promise<{ leaseObjectId: string; packageId: string } | { error: string }> {
  const { findNftTimeLeaseByNft } = await import('@/frontend/lib/nft-time-lease-local-store')
  const local = findNftTimeLeaseByNft(nftObjectId)
  if (local?.leaseObjectId && !local.leaseObjectId.startsWith('pending:')) {
    return {
      leaseObjectId: local.leaseObjectId.toLowerCase(),
      packageId: MESSAGING_MODULES_PACKAGE_ID_P5,
    }
  }

  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { error: 'Keine Direkt-RPC-URL gesetzt.' }
  const client = createDirectIotaClient({ rpcUrl: rpc })
  const { importNftTimeLeaseFromChain } = await import('@/frontend/lib/nft-time-lease-actions')

  let cur = startParentId.toLowerCase()
  for (let hop = 0; hop < 6; hop++) {
    const tryImport = await importNftTimeLeaseFromChain(cur)
    if (tryImport.ok) {
      const res = await client.getObject({ id: cur, options: { showType: true } })
      const typeStr = moveTypeString(res.data as { type?: string; content?: { type?: string } })
      const pkg = typeStr.split('::')[0]?.toLowerCase() || ''
      return {
        leaseObjectId: cur,
        packageId: /^0x[a-f0-9]{64}$/.test(pkg) ? pkg : MESSAGING_MODULES_PACKAGE_ID_P5,
      }
    }
    const res = await client.getObject({
      id: cur,
      options: { showOwner: true, showType: true },
    })
    const typeStr = moveTypeString(res.data as { type?: string; content?: { type?: string } })
    if (typeStr.includes('nft_time_lease::NftTimeLease')) {
      const pkg = typeStr.split('::')[0]?.toLowerCase() || ''
      return {
        leaseObjectId: cur,
        packageId: /^0x[a-f0-9]{64}$/.test(pkg) ? pkg : MESSAGING_MODULES_PACKAGE_ID_P5,
      }
    }
    const next = ownerParentId(res.data?.owner)
    if (!next || next === cur) break
    cur = next
  }
  return {
    error:
      `NFT liegt unter Escrow/Field ${startParentId.slice(0, 12)}… — Zeitkapsel-Objekt nicht gefunden. ` +
      'Unter NFT → Zeitkapsel Lease-ID laden oder Reclaim.',
  }
}

/** Guarded-Anfordern: NFT ggf. aus Zeitkapsel zurückholen, dann in Wallet erwarten. */
async function ensureNftInWalletForGuardedClaim(
  nftObjectId: string,
  me: string
): Promise<string | null> {
  const first = await readNftOwner(nftObjectId, me)
  if (first.ok) return null
  if (!first.parentId) return first.error

  const resolved = await resolveNftTimeLeaseObjectId(nftObjectId, first.parentId)
  if ('error' in resolved) {
    return `${first.error} — ${resolved.error}`
  }
  const { leaseObjectId, packageId: leasePkg } = resolved

  const { importNftTimeLeaseFromChain, reclaimNftTimeLease, returnEarlyNftTimeLease } =
    await import('@/frontend/lib/nft-time-lease-actions')
  const imported = await importNftTimeLeaseFromChain(leaseObjectId)
  if (!imported.ok) {
    return `Zeitkapsel ${leaseObjectId.slice(0, 12)}… nicht lesbar: ${imported.error}`
  }

  const { listNftTimeLeasesLocal } = await import('@/frontend/lib/nft-time-lease-local-store')
  const leaseRow = listNftTimeLeasesLocal().find(
    (l) => l.leaseObjectId.toLowerCase() === leaseObjectId.toLowerCase()
  )
  const lender = (leaseRow?.lender || '').toLowerCase()
  const borrower = (leaseRow?.borrower || '').toLowerCase()
  const unlockMs = leaseRow?.unlockMs ?? imported.unlockMs
  const reclaimCancelled = Boolean(leaseRow?.reclaimCancelled)
  const meLc = me.toLowerCase()

  toast.message('NFT in Zeitkapsel — hole zurück…')

  if (meLc === lender) {
    if (reclaimCancelled) {
      return 'Zeitkapsel: Reclaim widerrufen — Borrower muss „früh zurückgeben“.'
    }
    if (Date.now() < unlockMs) {
      return `Zeitkapsel noch gesperrt bis ${new Date(unlockMs).toLocaleString()} — danach Anfordern erneut.`
    }
    const rec = await reclaimNftTimeLease({
      messagingPackageId: leasePkg,
      leaseObjectId,
    })
    if (!rec.ok) return rec.error || 'Zeitkapsel-Reclaim fehlgeschlagen.'
  } else if (meLc === borrower) {
    const ret = await returnEarlyNftTimeLease({
      messagingPackageId: leasePkg,
      leaseObjectId,
    })
    if (!ret.ok) return ret.error || 'Zeitkapsel früh zurückgeben fehlgeschlagen.'
    if (lender !== meLc) {
      return 'NFT an Lender zurückgegeben — Guarded-Anfordern nur mit NFT in dieser Wallet.'
    }
  } else {
    return `NFT in Zeitkapsel ${leaseObjectId.slice(0, 12)}… — weder Lender noch Borrower.`
  }

  await sleep(900)
  const again = await readNftOwner(nftObjectId, me)
  if (again.ok) return null
  return again.error || 'NFT nach Zeitkapsel-Rückholung noch nicht in der Wallet.'
}

export const NFT_VAULT_BALANCE_REFRESH = 'morgendrot:nft-vault-balance-refresh'

const BACKFILL_LS = 'morgendrot.nftVault.activityBackfill.v1'
/** In-flight: verhindert parallele rebuild()-Races (15× „lokal erkannt“). */
const backfillClaimed = new Set<string>()

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
  const key = id.toLowerCase()
  backfillClaimed.add(key)
  try {
    const s = readBackfillIds()
    s.add(key)
    window.localStorage.setItem(BACKFILL_LS, JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

/** Sofort claimen (vor await), sonst loggen N parallele Refreshs denselben Vault. */
function tryClaimBackfill(id: string): boolean {
  const key = id.toLowerCase()
  if (backfillClaimed.has(key) || readBackfillIds().has(key)) return false
  backfillClaimed.add(key)
  return true
}

type Row = {
  kind: 'guarded' | 'bearer'
  vaultId: string
  nftObjectId: string
  label: string
  liveIota: string | null
  liveMist: bigint | null
  fallback: string | null
  createDigest?: string
}

function shortOid(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 8)}…${t.slice(-4)}`
}

export function requestNftVaultBalanceRefresh(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(NFT_VAULT_BALANCE_REFRESH))
  } catch {
    /* ignore */
  }
}

export function DashboardNftSecuredBalances({
  summaryOnly = false,
}: {
  compact?: boolean
  summaryOnly?: boolean
  /** @deprecated Auszahlen liegt unter Send. */
  onOpenSpend?: () => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [sumIota, setSumIota] = useState<string | null>(null)
  const [sumTitle, setSumTitle] = useState('Nicht in der freien Wallet-Balance')
  const [busy, setBusy] = useState(false)
  const [claimingVaultId, setClaimingVaultId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const rowClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openVaultExplorer = useCallback((vaultId: string) => {
    const url = explorerObjectUrlFromId(vaultId)
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const onRowPrimaryClick = useCallback(
    (vaultId: string) => {
      if (rowClickTimer.current) clearTimeout(rowClickTimer.current)
      rowClickTimer.current = setTimeout(() => {
        rowClickTimer.current = null
        openVaultExplorer(vaultId)
      }, 220)
    },
    [openVaultExplorer]
  )

  const onRowDoubleClick = useCallback((vaultId: string) => {
    if (rowClickTimer.current) {
      clearTimeout(rowClickTimer.current)
      rowClickTimer.current = null
    }
    setExpandedId((cur) => (cur === vaultId ? null : vaultId))
  }, [])

  useEffect(
    () => () => {
      if (rowClickTimer.current) clearTimeout(rowClickTimer.current)
    },
    []
  )

  const claimToFreeWallet = useCallback(async (row: Row) => {
    if (claimingVaultId) return
    const sessionHint = nftVaultSessionHint()
    if (sessionHint) {
      toast.error(sessionHint)
      return
    }
    setClaimingVaultId(row.vaultId)
    try {
      const me = await fetchMyWalletAddress()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(me)) {
        toast.error('Eigene Wallet-Adresse nicht geladen.')
        return
      }
      restoreParkedVaultsForOwnedNfts([row.nftObjectId])
      let mist = row.liveMist
      if (mist == null || mist <= 0n) {
        const bal = await fetchNftVaultBalance(row.vaultId)
        if (!bal.ok || bal.mist <= 0n) {
          toast.error('Kein auszahlbarer Betrag auf dieser Position.')
          return
        }
        mist = bal.mist
      }
      const purse = listNftGuardedPursesLocal().find(
        (p) => p.purseObjectId.toLowerCase() === row.vaultId.toLowerCase()
      )
      const treasury = listNftBearerTreasuriesLocal().find(
        (t) => t.treasuryObjectId.toLowerCase() === row.vaultId.toLowerCase()
      )
      const pkg =
        (row.kind === 'guarded'
          ? purse?.messagingPackageId
          : treasury?.messagingPackageId) || MESSAGING_MODULES_PACKAGE_ID

      if (row.kind === 'bearer') {
        // Eine PTB: Freeze → Reclaim → Thaw (kein Stale zwischen 3 Einzel-TXs).
        const rec = await adminReclaimNftBearerTreasuryToSelf({
          messagingPackageId: pkg,
          treasuryObjectId: row.vaultId,
        })
        if (!rec.ok) {
          toast.error(rec.error || 'Anfordern fehlgeschlagen.')
          return
        }
        toast.success(
          `${formatMistAsWalletUiIota(mist, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
          })} IOTA auf freie Wallet`
        )
        requestNftVaultBalanceRefresh()
        return
      }

      const ownErr = await ensureNftInWalletForGuardedClaim(row.nftObjectId, me)
      if (ownErr) {
        toast.error(ownErr)
        return
      }
      const r = await spendNftGuardedPurse({
        messagingPackageId: pkg,
        purseObjectId: row.vaultId,
        nftObjectId: row.nftObjectId,
        amountMist: mist,
        recipientAddress: me,
      })
      if (!r.ok) {
        toast.error(r.error || 'Anfordern fehlgeschlagen.')
        return
      }
      toast.success(
        `${formatMistAsWalletUiIota(mist, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 6,
        })} IOTA auf freie Wallet`
      )
      requestNftVaultBalanceRefresh()
    } finally {
      setClaimingVaultId(null)
    }
  }, [claimingVaultId])

  const rebuild = useCallback(async () => {
    try {
      dedupeVaultIndexedActivity()
    } catch {
      /* ignore */
    }
    try {
      restoreParkedVaultsForOwnedNfts(listNftOwnedSnapshot())
    } catch {
      /* ignore */
    }
    const purses = listNftGuardedPursesLocal().filter((p) => p.status === 'active')
    const treasuries = listNftBearerTreasuriesLocal().filter((t) => t.status === 'active')
    const base: Row[] = [
      ...purses.map((p: NftGuardedPurseLocalEntry) => ({
        kind: 'guarded' as const,
        vaultId: p.purseObjectId,
        nftObjectId: p.nftObjectId,
        label: p.displayLabel || 'Guarded',
        liveIota: null,
        liveMist: null,
        fallback: formatLocalMistHintAsIota(p.balanceMistHint),
        createDigest: p.createDigest,
      })),
      ...treasuries.map((t: NftBearerTreasuryLocalEntry) => ({
        kind: 'bearer' as const,
        vaultId: t.treasuryObjectId,
        nftObjectId: t.nftObjectId,
        label: t.displayLabel || 'Bearer',
        liveIota: null,
        liveMist: null,
        fallback: formatLocalMistHintAsIota(t.balanceMistHint),
        createDigest: t.createDigest,
      })),
    ]
    if (base.length === 0) {
      setRows([])
      setSumIota(null)
      setSumTitle('Nicht in der freien Wallet-Balance')
      return
    }
    setBusy(true)
    try {
      let mistSum = 0n
      let anyLive = false
      const next: Row[] = []
      const recent = listIotaActivity(80)
      for (const r of base) {
        const vid = r.vaultId.toLowerCase()
        const alreadyLogged =
          backfillClaimed.has(vid) ||
          readBackfillIds().has(vid) ||
          recent.some((a) => a.objectId === vid || (a.summary || '').includes(vid.slice(0, 10)))
        const claimFresh = !alreadyLogged && tryClaimBackfill(vid)
        const bal = await fetchNftVaultBalance(r.vaultId)
        if (bal.ok && bal.mist === 0n) {
          await autoDestroyEmptyNftVault({
            vaultObjectId: r.vaultId,
            mist: 0n,
            fallbackPackageId: MESSAGING_MODULES_PACKAGE_ID,
          })
          continue
        }
        if (!bal.ok || bal.mist <= 0n) continue
        anyLive = true
        mistSum += bal.mist
        next.push({
          ...r,
          liveIota: bal.iotaLabel,
          liveMist: bal.mist,
        })
        if (claimFresh) {
          recordNftVaultActivity({
            op: 'vault_indexed',
            vaultObjectId: r.vaultId,
            nftObjectId: r.nftObjectId,
            amountMist: bal.mist,
            nftLabel: r.label,
          })
          markBackfill(vid)
        }
      }
      next.sort((a, b) => {
        const am = a.liveMist ?? -1n
        const bm = b.liveMist ?? -1n
        if (am === bm) return a.label.localeCompare(b.label)
        return am > bm ? -1 : 1
      })
      setRows(next)
      setSumIota(
        anyLive
          ? formatMistAsWalletUiIota(mistSum, {
              minimumFractionDigits: 6,
              maximumFractionDigits: 6,
            })
          : null
      )
      const n = next.length
      setSumTitle(
        n <= 1
          ? 'Nicht in der freien Wallet-Balance'
          : `Summe aus ${n} Vaults (nicht frei) — Liste aufklappen`
      )
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void rebuild()
    const sync = () => void rebuild()
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
    window.addEventListener(NFT_VAULT_BALANCE_REFRESH, sync)
    window.addEventListener(NFT_VAULT_PARKED_CHANGED, sync)
    window.addEventListener(NFT_VAULT_INDEX_CHANGED, sync)
    return () => {
      window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
      window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
      window.removeEventListener(NFT_VAULT_BALANCE_REFRESH, sync)
      window.removeEventListener(NFT_VAULT_PARKED_CHANGED, sync)
      window.removeEventListener(NFT_VAULT_INDEX_CHANGED, sync)
    }
  }, [rebuild])

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(
      (r) =>
        r.label.toLowerCase().includes(needle) ||
        r.vaultId.includes(needle) ||
        r.nftObjectId.includes(needle) ||
        r.kind.includes(needle)
    )
  }, [rows, filter])

  const sumDisplay = busy && sumIota == null ? '…' : sumIota != null ? sumIota : rows.length ? '—' : '0'
  const n = rows.length

  if (summaryOnly) {
    return (
      <div className="inline-flex max-w-[min(100%,28rem)] flex-col gap-1" title={sumTitle}>
        <span className="text-xs text-muted-foreground">
          <strong className="text-foreground">{sumDisplay}</strong> IOTA
        </span>
        {n > 0 ? (
          <details
            className="text-[10px] text-muted-foreground"
            open={listOpen || n <= 3}
            onToggle={(e) => setListOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer select-none text-foreground/80 hover:underline">
              {n <= 3 ? `Positionen (${n})` : `Positionen anzeigen (${n})`}
            </summary>
            {n > 8 ? (
              <input
                className="mt-1 h-7 w-full rounded border border-border bg-background px-2 font-mono text-[10px] text-foreground"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter Label/NFT/Vault…"
                aria-label="Purse-Positionen filtern"
              />
            ) : null}
            <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto pr-0.5">
              {filtered.map((r) => {
                const open = expandedId === r.vaultId
                return (
                  <li
                    key={r.vaultId}
                    className="rounded border border-border/40 bg-muted/15 px-1.5 py-1"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left hover:underline"
                        title="Klick öffnet den Vault im Explorer. IDs über den Knopf „IDs“."
                        onClick={() => onRowPrimaryClick(r.vaultId)}
                        onDoubleClick={() => onRowDoubleClick(r.vaultId)}
                      >
                        <span className="text-foreground/90">{r.label}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          · {r.kind === 'guarded' ? 'G' : 'B'} · NFT {shortOid(r.nftObjectId)}
                        </span>
                      </button>
                      <span className="flex shrink-0 items-baseline gap-2">
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline"
                          title="IDs und Create-TX anzeigen und kopieren"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedId((cur) => (cur === r.vaultId ? null : r.vaultId))
                          }}
                        >
                          {open ? 'IDs zu' : 'IDs'}
                        </button>
                        <a
                          href={explorerObjectUrlFromId(r.vaultId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline"
                          title="Vault im Explorer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Explorer
                        </a>
                        <span className="font-medium tabular-nums text-foreground">
                          {r.liveIota ?? r.fallback ?? '—'}
                        </span>
                        <button
                          type="button"
                          className="text-[10px] font-medium text-primary hover:underline disabled:opacity-50"
                          title="Sofort auf freie Messenger-Wallet auszahlen"
                          disabled={claimingVaultId != null || busy}
                          onClick={(e) => {
                            e.stopPropagation()
                            void claimToFreeWallet(r)
                          }}
                        >
                          {claimingVaultId === r.vaultId ? '…' : 'Anfordern'}
                        </button>
                      </span>
                    </div>
                    {open ? (
                      <div
                        className="mt-1.5 space-y-1.5 border-t border-border/40 pt-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <TechnicalIdRow
                          label="Vault Object-ID"
                          value={r.vaultId}
                          href={explorerObjectUrlFromId(r.vaultId)}
                        />
                        <TechnicalIdRow
                          label="NFT Object-ID"
                          value={r.nftObjectId}
                          href={explorerObjectUrlFromId(r.nftObjectId)}
                        />
                        {r.createDigest ? (
                          <TechnicalIdRow
                            label="Create-TX"
                            value={r.createDigest}
                            href={explorerTxUrlFromDigest(r.createDigest)}
                          />
                        ) : (
                          <p className="text-[10px] text-muted-foreground">
                            Kein Create-Digest lokal — nur Object-IDs.
                          </p>
                        )}
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline"
                          onClick={() => {
                            void copyTextSafe(
                              [
                                `vault=${r.vaultId}`,
                                `nft=${r.nftObjectId}`,
                                r.createDigest ? `tx=${r.createDigest}` : '',
                              ]
                                .filter(Boolean)
                                .join('\n')
                            )
                          }}
                        >
                          Alle IDs kopieren
                        </button>
                      </div>
                    ) : null}
                  </li>
                )
              })}
              {filtered.length === 0 ? (
                <li className="text-muted-foreground">Kein Treffer.</li>
              ) : null}
            </ul>
            <p className="mt-1 text-[9px] text-muted-foreground">
              Klick → Explorer · Doppelklick / „IDs“ → kopieren · Anfordern → sofort frei
            </p>
          </details>
        ) : null}
      </div>
    )
  }

  return (
    <span className="text-xs text-muted-foreground" title={sumTitle}>
      <strong className="text-foreground">{sumDisplay}</strong> IOTA
    </span>
  )
}

/** Summenzeile für Wallet-Header (gleicher Stil wie Frei). */
export function DashboardNftSecuredBalanceAmount({
  compact: _c,
}: {
  compact?: boolean
}) {
  return <DashboardNftSecuredBalances summaryOnly />
}

/** Distinct NFT-Object-IDs mit aktivem Vault — für Wallet-Spalte „NFT:“. */
export function countSecuredNftObjects(): number {
  const ids = new Set<string>()
  for (const p of listNftGuardedPursesLocal().filter((x) => x.status === 'active')) {
    const id = p.nftObjectId.trim().toLowerCase()
    if (id) ids.add(id)
  }
  for (const t of listNftBearerTreasuriesLocal().filter((x) => x.status === 'active')) {
    const id = t.nftObjectId.trim().toLowerCase()
    if (id) ids.add(id)
  }
  return ids.size
}
