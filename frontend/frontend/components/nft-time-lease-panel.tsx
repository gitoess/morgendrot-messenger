'use client'

/**
 * B2-P5b — Zeitkapsel-UI: Leihe anlegen / cancel / return / reclaim.
 * Package-ID unter Erweitert, benannt (Messaging-Module, nicht Chat-Stamm).
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  cancelNftTimeLeaseReclaim,
  createNftTimeLease,
  reclaimNftTimeLease,
  returnEarlyNftTimeLease,
} from '@/frontend/lib/nft-time-lease-actions'
import {
  findNftTimeLeaseByNft,
  listNftTimeLeasesLocal,
  NFT_TIME_LEASE_CHANGED,
  nftTimeLeaseBadgeText,
  upsertNftTimeLeaseLocal,
  type NftTimeLeaseLocalEntry,
} from '@/frontend/lib/nft-time-lease-local-store'

import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'

const LS_MSG_PKG = 'morgendrot.nftTimeLease.messagingPackageId.v1'
export const NFT_TIME_LEASE_PACKAGE_ID_TESTNET = MESSAGING_MODULES_PACKAGE_ID

function readMsgPkg(): string {
  if (typeof window === 'undefined') return MESSAGING_MODULES_PACKAGE_ID
  try {
    return window.localStorage.getItem(LS_MSG_PKG)?.trim() || MESSAGING_MODULES_PACKAGE_ID
  } catch {
    return MESSAGING_MODULES_PACKAGE_ID
  }
}

function writeMsgPkg(v: string): void {
  if (typeof window === 'undefined') return
  try {
    if (!v.trim()) window.localStorage.removeItem(LS_MSG_PKG)
    else window.localStorage.setItem(LS_MSG_PKG, v.trim().toLowerCase())
  } catch {
    /* ignore */
  }
}

function shortId(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 10)}…${t.slice(-4)}`
}

export function NftTimeLeasePanel(p: {
  nftObjectId: string
  disabled?: boolean
}) {
  const [msgPkg, setMsgPkg] = useState(MESSAGING_MODULES_PACKAGE_ID)
  const [editPkg, setEditPkg] = useState(false)
  const [borrower, setBorrower] = useState('')
  const [durationHours, setDurationHours] = useState('24')
  const [leaseIdManual, setLeaseIdManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [lease, setLease] = useState<NftTimeLeaseLocalEntry | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setMsgPkg(readMsgPkg())
    const sync = () => {
      setLease(findNftTimeLeaseByNft(p.nftObjectId))
      setTick((n) => n + 1)
    }
    sync()
    window.addEventListener(NFT_TIME_LEASE_CHANGED, sync)
    return () => window.removeEventListener(NFT_TIME_LEASE_CHANGED, sync)
  }, [p.nftObjectId])

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; digest?: string; leaseObjectId?: string }>) => {
    setBusy(true)
    setErr('')
    setInfo('')
    try {
      const r = await fn()
      if (!r.ok) {
        setErr(r.error || 'Fehlgeschlagen')
        return
      }
      setInfo(
        `OK${r.digest ? ` · ${r.digest.slice(0, 12)}…` : ''}${
          r.leaseObjectId ? ` · Lease ${r.leaseObjectId.slice(0, 12)}…` : ''
        }`
      )
      setLease(findNftTimeLeaseByNft(p.nftObjectId))
    } finally {
      setBusy(false)
    }
  }

  const hours = Math.max(0.001, Number(durationHours) || 24)
  const durationMs = Math.floor(hours * 3_600_000)
  const activeLeaseId = lease?.leaseObjectId || leaseIdManual.trim()

  return (
    <div className="space-y-2 text-[11px] text-muted-foreground">
      <p>
        NFT = <span className="text-foreground">Leserecht auf Zeit</span>, nicht der Textspeicher. Leihe an eine
        andere Wallet; nach Ablauf zurückholbar. Texte liegen weiter getrennt (Chat/Mailbox).
      </p>

      {lease ? (
        <div
          className="space-y-1.5 rounded border border-amber-800/30 bg-amber-950/15 px-2.5 py-2"
          key={tick}
        >
          <p className="text-amber-100/90">{nftTimeLeaseBadgeText(lease)}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-foreground/90">
              Lease-Object-ID: <span className="font-mono">{shortId(lease.leaseObjectId)}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px]"
              disabled={busy}
              onClick={() => {
                void navigator.clipboard.writeText(lease.leaseObjectId)
                setInfo('Lease-ID kopiert.')
              }}
            >
              Kopieren
            </Button>
          </div>
        </div>
      ) : null}

      <label className="flex flex-col gap-0.5">
        <span>An wen verleihen? (Wallet-Adresse)</span>
        <Input
          className="h-8 font-mono text-[11px]"
          value={borrower}
          disabled={p.disabled || busy}
          onChange={(e) => setBorrower(e.target.value)}
          placeholder="0x…"
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span>Dauer (Stunden)</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={durationHours}
          disabled={p.disabled || busy}
          onChange={(e) => setDurationHours(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-8 text-[11px]"
          disabled={p.disabled || busy || !msgPkg || !borrower}
          onClick={() =>
            void run(() =>
              createNftTimeLease({
                messagingPackageId: msgPkg,
                nftObjectId: p.nftObjectId,
                borrowerAddress: borrower,
                durationMs,
              })
            )
          }
        >
          Leihe starten
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-[11px]"
          disabled={p.disabled || busy || !msgPkg || !activeLeaseId}
          onClick={() =>
            void run(() =>
              returnEarlyNftTimeLease({
                messagingPackageId: msgPkg,
                leaseObjectId: activeLeaseId,
              })
            )
          }
        >
          Früh zurück
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 text-[11px]"
          disabled={p.disabled || busy || !msgPkg || !activeLeaseId}
          onClick={() =>
            void run(() =>
              reclaimNftTimeLease({
                messagingPackageId: msgPkg,
                leaseObjectId: activeLeaseId,
              })
            )
          }
        >
          Nach Ablauf zurückholen
        </Button>
      </div>

      <details className="rounded border border-border/40 px-2 py-1">
        <summary className="cursor-pointer text-[10px] text-muted-foreground">Erweitert</summary>
        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            <p className="text-[10px] text-foreground/90">
              Messaging-Module-Package (Zeitkapsel / Guthaben / Seal) — nicht der Chat-Stamm
            </p>
            {!editPkg ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px]">bereits gesetzt · {shortId(msgPkg)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px]"
                  disabled={p.disabled || busy}
                  onClick={() => setEditPkg(true)}
                >
                  Ändern
                </Button>
              </div>
            ) : (
              <Input
                className="h-7 font-mono text-[10px]"
                value={msgPkg}
                disabled={p.disabled || busy}
                onChange={(e) => {
                  setMsgPkg(e.target.value)
                  writeMsgPkg(e.target.value)
                }}
                onBlur={() => setEditPkg(false)}
              />
            )}
          </div>
          <label className="flex flex-col gap-0.5">
            <span>Lease-Object-ID manuell (nur wenn Auto-Erkennung fehlt)</span>
            <Input
              className="h-7 font-mono text-[10px]"
              value={leaseIdManual}
              disabled={p.disabled || busy}
              onChange={(e) => setLeaseIdManual(e.target.value)}
              placeholder="0x…"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-[10px]"
            disabled={p.disabled || busy || !msgPkg || !activeLeaseId}
            onClick={() =>
              void run(() =>
                cancelNftTimeLeaseReclaim({
                  messagingPackageId: msgPkg,
                  leaseObjectId: activeLeaseId,
                })
              )
            }
          >
            Timelock widerrufen
          </Button>
          {leaseIdManual.trim() && borrower.trim() ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[10px]"
              disabled={busy}
              onClick={() => {
                upsertNftTimeLeaseLocal({
                  leaseObjectId: leaseIdManual,
                  nftObjectId: p.nftObjectId,
                  lender: '0x' + '00'.repeat(32),
                  borrower,
                  unlockMs: Date.now() + durationMs,
                  reclaimCancelled: false,
                  status: 'active',
                })
                setLease(findNftTimeLeaseByNft(p.nftObjectId))
                setInfo('Lokaler Lease-Index gesetzt (Chain prüfen).')
              }}
            >
              Lokal merken
            </Button>
          ) : null}
          {listNftTimeLeasesLocal().length > 1 ? (
            <p className="text-[10px]">{listNftTimeLeasesLocal().length} Leases lokal gemerkt.</p>
          ) : null}
        </div>
      </details>
      {err ? <p className="text-destructive">{err}</p> : null}
      {info ? <p className="text-foreground">{info}</p> : null}
    </div>
  )
}
