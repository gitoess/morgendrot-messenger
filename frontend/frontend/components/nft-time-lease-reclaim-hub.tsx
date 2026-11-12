'use client'

/**
 * Offene Zeitkapsel-Leases — einzeln reclaimen, ohne pro NFT zu suchen.
 */

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { reclaimNftTimeLease } from '@/frontend/lib/nft-time-lease-actions'
import {
  listNftTimeLeasesLocal,
  NFT_TIME_LEASE_CHANGED,
  type NftTimeLeaseLocalEntry,
} from '@/frontend/lib/nft-time-lease-local-store'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import { explorerObjectUrlFromId } from '@/frontend/lib/iota-tx-explorer-hint'
import { copyTextSafe } from '@/frontend/lib/copy-text-safe'

const LS_MSG_PKG = 'morgendrot.nftTimeLease.messagingPackageId.v1'

function readMsgPkg(): string {
  if (typeof window === 'undefined') return MESSAGING_MODULES_PACKAGE_ID
  try {
    return window.localStorage.getItem(LS_MSG_PKG)?.trim() || MESSAGING_MODULES_PACKAGE_ID
  } catch {
    return MESSAGING_MODULES_PACKAGE_ID
  }
}

function shortId(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 10)}…${t.slice(-4)}`
}

function formatRemain(ms: number): string {
  if (ms <= 0) return 'bereit'
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`
  const h = Math.floor(m / 60)
  const hm = m % 60
  return hm ? `${h}h ${hm}m` : `${h}h`
}

function openLeases(nowMs: number): Array<NftTimeLeaseLocalEntry & { ready: boolean; remainMs: number }> {
  return listNftTimeLeasesLocal()
    .filter((e) => e.status === 'active' && !e.reclaimCancelled)
    .map((e) => {
      const remainMs = Math.max(0, (e.unlockMs || 0) - nowMs)
      return { ...e, ready: !e.unlockMs || nowMs >= e.unlockMs, remainMs }
    })
    .sort((a, b) => a.remainMs - b.remainMs || b.updatedAtMs - a.updatedAtMs)
}

export function countOpenNftTimeLeases(nowMs = Date.now()): { open: number; ready: number } {
  const rows = openLeases(nowMs)
  return { open: rows.length, ready: rows.filter((r) => r.ready).length }
}

export function NftTimeLeaseReclaimHub(p: {
  disabled?: boolean
  /** Kompakt unter Wallet / Dialog-Kopf. */
  compact?: boolean
  className?: string
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const sync = () => {
      setTick((n) => n + 1)
      setNowMs(Date.now())
    }
    sync()
    window.addEventListener(NFT_TIME_LEASE_CHANGED, sync)
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => {
      window.removeEventListener(NFT_TIME_LEASE_CHANGED, sync)
      window.clearInterval(t)
    }
  }, [])

  const rows = useMemo(() => {
    void tick
    const all = openLeases(nowMs)
    const needle = q.trim().toLowerCase()
    if (!needle) return all
    return all.filter(
      (e) =>
        e.leaseObjectId.includes(needle) ||
        e.nftObjectId.includes(needle) ||
        e.borrower.includes(needle) ||
        e.lender.includes(needle)
    )
  }, [nowMs, q, tick])

  const readyCount = rows.filter((r) => r.ready).length

  const onReclaim = async (leaseObjectId: string) => {
    setBusyId(leaseObjectId)
    setErr('')
    setInfo('')
    try {
      const r = await reclaimNftTimeLease({
        messagingPackageId: readMsgPkg(),
        leaseObjectId,
      })
      if (!r.ok) {
        setErr(r.error || 'Reclaim fehlgeschlagen')
        return
      }
      setInfo(`Reclaim OK · ${r.digest?.slice(0, 12) ?? ''}… · NFT zurück an Lender`)
      setTick((n) => n + 1)
    } finally {
      setBusyId(null)
    }
  }

  if (rows.length === 0 && !q.trim()) {
    return (
      <div className={p.className}>
        <p className="text-[11px] text-muted-foreground">
          Keine offenen Zeitkapsel-Leases lokal. Nach „Leihe starten“ erscheinen sie hier zum Zurückholen.
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${p.className || ''}`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Offene Verleihungen</p>
          <p className="text-[10px] text-muted-foreground">
            {rows.length} offen
            {readyCount > 0 ? ` · ${readyCount} reclaim-bereit` : ''} — einzeln zurückholen (TX).
          </p>
        </div>
        {rows.length > 6 || q ? (
          <Input
            className="h-7 w-full max-w-[14rem] font-mono text-[10px]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter Lease/NFT…"
            disabled={p.disabled}
          />
        ) : null}
      </div>

      <ul
        className={`space-y-1.5 overflow-y-auto ${
          p.compact ? 'max-h-40' : 'max-h-[min(50vh,22rem)]'
        }`}
      >
        {rows.map((e) => (
          <li
            key={e.leaseObjectId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/10 px-2.5 py-2"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[11px] text-foreground">
                NFT{' '}
                <button
                  type="button"
                  className="font-mono text-primary hover:underline"
                  title={`${e.nftObjectId} — klicken zum Kopieren`}
                  onClick={() => void copyTextSafe(e.nftObjectId)}
                >
                  {shortId(e.nftObjectId)}
                </button>
                <span className="text-muted-foreground"> · Lease </span>
                <button
                  type="button"
                  className="font-mono text-primary hover:underline"
                  title={`${e.leaseObjectId} — klicken zum Kopieren`}
                  onClick={() => void copyTextSafe(e.leaseObjectId)}
                >
                  {shortId(e.leaseObjectId)}
                </button>
              </p>
              <p className="text-[10px] text-muted-foreground">
                an {shortId(e.borrower)} ·{' '}
                {e.ready ? (
                  <span className="text-emerald-700 dark:text-emerald-300">Reclaim möglich</span>
                ) : (
                  <span>noch {formatRemain(e.remainMs)}</span>
                )}
              </p>
              <p className="flex flex-wrap gap-2 text-[10px]">
                <a
                  href={explorerObjectUrlFromId(e.leaseObjectId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Lease Explorer
                </a>
                <a
                  href={explorerObjectUrlFromId(e.nftObjectId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  NFT Explorer
                </a>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() =>
                    void copyTextSafe(`${e.leaseObjectId}\n${e.nftObjectId}`)
                  }
                >
                  IDs kopieren
                </button>
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 text-[11px]"
              variant={e.ready ? 'default' : 'outline'}
              disabled={p.disabled || busyId === e.leaseObjectId || !e.ready}
              title={
                e.ready
                  ? 'NFT aus Escrow an dich (Lender) zurück'
                  : `Warten bis ${new Date(e.unlockMs).toLocaleString()}`
              }
              onClick={() => void onReclaim(e.leaseObjectId)}
            >
              {busyId === e.leaseObjectId ? '…' : e.ready ? 'Reclaim' : formatRemain(e.remainMs)}
            </Button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && q.trim() ? (
        <p className="text-[10px] text-muted-foreground">Kein Treffer für „{q.trim()}“.</p>
      ) : null}
      {err ? <p className="text-[11px] text-destructive whitespace-pre-wrap">{err}</p> : null}
      {info ? <p className="text-[11px] text-foreground">{info}</p> : null}
    </div>
  )
}
