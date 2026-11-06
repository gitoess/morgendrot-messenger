'use client'

/**
 * B2-P5b — Zeitkapsel-UI: Leihe anlegen / cancel / return / reclaim + Badges.
 * Braucht Messaging-Package mit Modul `nft_time_lease` (nach Publish).
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
/** Testnet — nft_time_lease (Stamm-Chat weiter PACKAGE_ID 0x06e099…). */
export const NFT_TIME_LEASE_PACKAGE_ID_TESTNET = MESSAGING_MODULES_PACKAGE_ID

function readMsgPkg(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(LS_MSG_PKG)?.trim() || ''
  } catch {
    return ''
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

export function NftTimeLeasePanel(p: {
  nftObjectId: string
  disabled?: boolean
}) {
  const [msgPkg, setMsgPkg] = useState('')
  const [borrower, setBorrower] = useState('')
  const [durationHours, setDurationHours] = useState('24')
  const [leaseIdManual, setLeaseIdManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [lease, setLease] = useState<NftTimeLeaseLocalEntry | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const stored = readMsgPkg()
    if (stored) setMsgPkg(stored)
    else {
      setMsgPkg(NFT_TIME_LEASE_PACKAGE_ID_TESTNET)
      writeMsgPkg(NFT_TIME_LEASE_PACKAGE_ID_TESTNET)
    }
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
    <div className="mt-2 space-y-2 rounded border border-border/70 bg-muted/15 px-2.5 py-2 text-[11px] text-muted-foreground">
      <p className="font-medium text-foreground">Zeitkapsel / NFT-Leserecht (B2-P5)</p>
      <p>
        NFT = <span className="text-foreground">Leserecht</span>, nicht der Textspeicher. Ciphertexte liegen getrennt
        (Mailbox an Archiv / Enc-ImageNFT). Leihe: Escrow + Borrower; kein stiller Cron — nach Datum permissionless{' '}
        <code className="text-[10px]">reclaim</code>. Lease-Package vorausgefüllt (Testnet-Upgrade).
      </p>
      <p className="text-[10px]">
        Borrower liest so: unter <span className="text-foreground">On-Chain / NFT</span> Object-ID oder Besitzer =
        Archiv-Adresse laden, dann mit Gate entschlüsseln — NFT allein bringt keine Texte mit.
      </p>
      <label className="flex flex-col gap-0.5">
        <span>Messaging PACKAGE_ID</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={msgPkg}
          disabled={p.disabled || busy}
          onChange={(e) => {
            setMsgPkg(e.target.value)
            writeMsgPkg(e.target.value)
          }}
          placeholder="0x… (nach Publish)"
        />
      </label>

      {lease ? (
        <p className="rounded border border-amber-800/30 bg-amber-950/15 px-2 py-1 text-amber-100/90" key={tick}>
          {nftTimeLeaseBadgeText(lease)}
        </p>
      ) : null}

      <label className="flex flex-col gap-0.5">
        <span>Borrower (W2) Adresse</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={borrower}
          disabled={p.disabled || busy}
          onChange={(e) => setBorrower(e.target.value)}
          placeholder="0x…"
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span>Dauer (Stunden bis Reclaim erlaubt)</span>
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
          className="h-7 text-[10px]"
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
          Leihe starten (create_lease)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
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
          className="h-7 text-[10px]"
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
          Reclaim (nach Datum)
        </Button>
      </div>

      <label className="flex flex-col gap-0.5">
        <span>Lease Object-ID (falls nicht auto erkannt / manuell)</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={leaseIdManual}
          disabled={p.disabled || busy}
          onChange={(e) => setLeaseIdManual(e.target.value)}
          placeholder="0x…"
        />
      </label>
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
      {err ? <p className="text-destructive">{err}</p> : null}
      {info ? <p className="text-foreground">{info}</p> : null}
    </div>
  )
}
