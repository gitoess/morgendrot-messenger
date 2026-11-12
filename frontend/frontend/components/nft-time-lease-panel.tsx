'use client'

/**
 * B2-P5b — Zeitkapsel-UI: Leihe anlegen / cancel / return / reclaim.
 * Package-ID unter Erweitert, benannt (Messaging-Module, nicht Chat-Stamm).
 */

import { useEffect, useMemo, useState } from 'react'
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

import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import { TechnicalIdRow } from '@/frontend/components/technical-id-row'
import {
  explorerObjectUrlFromId,
  explorerTxUrlFromDigest,
} from '@/frontend/lib/iota-tx-explorer-hint'

const LS_MSG_PKG = 'morgendrot.nftTimeLease.messagingPackageId.v1'
const LS_LAST_BORROWER = 'morgendrot.nftTimeLease.lastBorrower.v1'
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

function readLastBorrower(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(LS_LAST_BORROWER)?.trim() || ''
  } catch {
    return ''
  }
}

function writeLastBorrower(v: string): void {
  if (typeof window === 'undefined') return
  try {
    const t = v.trim().toLowerCase()
    if (!t) window.localStorage.removeItem(LS_LAST_BORROWER)
    else window.localStorage.setItem(LS_LAST_BORROWER, t)
  } catch {
    /* ignore */
  }
}

function shortId(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 10)}…${t.slice(-4)}`
}

function formatRemain(ms: number): string {
  if (ms <= 0) return 'jetzt'
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`
  const h = Math.floor(m / 60)
  const hm = m % 60
  return hm ? `${h}h ${hm}m` : `${h}h`
}

export function NftTimeLeasePanel(p: {
  nftObjectId: string
  disabled?: boolean
}) {
  const [msgPkg, setMsgPkg] = useState(MESSAGING_MODULES_PACKAGE_ID)
  const [editPkg, setEditPkg] = useState(false)
  const [borrower, setBorrower] = useState('')
  /** Primär Minuten (Tests); intern → durationMs. */
  const [durationMinutes, setDurationMinutes] = useState('1')
  const [leaseIdManual, setLeaseIdManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [lease, setLease] = useState<NftTimeLeaseLocalEntry | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    setMsgPkg(readMsgPkg())
    setBorrower((prev) => prev || readLastBorrower())
    const sync = () => {
      setLease(findNftTimeLeaseByNft(p.nftObjectId))
      setNowMs(Date.now())
    }
    sync()
    window.addEventListener(NFT_TIME_LEASE_CHANGED, sync)
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => {
      window.removeEventListener(NFT_TIME_LEASE_CHANGED, sync)
      window.clearInterval(t)
    }
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
      if (r.leaseObjectId) setLeaseIdManual(r.leaseObjectId)
      const missingLease = !r.leaseObjectId && !findNftTimeLeaseByNft(p.nftObjectId)
      setInfo(
        `OK${r.digest ? ` · TX ${r.digest.slice(0, 12)}…` : ''}${
          r.leaseObjectId ? ` · Lease ${r.leaseObjectId.slice(0, 12)}…` : ''
        }${
          missingLease
            ? ' — Lease-ID fehlt lokal: unter Erweitert aus Explorer einfügen, sonst sind Zurückholen-Buttons tot.'
            : ''
        }`
      )
      setLease(findNftTimeLeaseByNft(p.nftObjectId))
    } finally {
      setBusy(false)
    }
  }

  const minutes = Math.max(0.05, Number(durationMinutes) || 1)
  const durationMs = Math.floor(minutes * 60_000)
  const activeLeaseId = (lease?.leaseObjectId || leaseIdManual).trim()
  const me = (getDirectIotaSessionSignerAddress() || '').trim().toLowerCase()
  const borrowerNorm = borrower.trim().toLowerCase()
  const borrowerIsSelf = Boolean(me && borrowerNorm && me === borrowerNorm)
  const unlockMs = lease?.unlockMs ?? 0
  const remainMs = unlockMs > 0 ? unlockMs - nowMs : 0
  const reclaimReady = Boolean(activeLeaseId) && (!unlockMs || nowMs >= unlockMs)
  const badge = useMemo(
    () => (lease ? nftTimeLeaseBadgeText(lease, nowMs) : ''),
    [lease, nowMs]
  )

  return (
    <div className="space-y-2 text-[11px] text-muted-foreground">
      <p className="text-foreground">
        NFT verleihen → nach Ablauf zurückholen. Kurz: Adresse + Dauer → Leihe starten.
      </p>

      {lease ? (
        <div className="space-y-1.5 rounded border border-amber-800/30 bg-amber-950/15 px-2.5 py-2">
          <p className="text-amber-100/90">{badge}</p>
          {unlockMs > 0 && lease.status === 'active' && !lease.reclaimCancelled ? (
            <p className="text-[10px] text-foreground/90">
              {reclaimReady
                ? 'Bereit — „Zurückholen“ tippen.'
                : `Noch ${formatRemain(remainMs)}.`}
            </p>
          ) : null}
          <TechnicalIdRow
            label="Lease Object-ID"
            value={lease.leaseObjectId}
            href={explorerObjectUrlFromId(lease.leaseObjectId)}
          />
          <TechnicalIdRow
            label="NFT Object-ID"
            value={p.nftObjectId}
            href={explorerObjectUrlFromId(p.nftObjectId)}
          />
          {lease.borrower ? (
            <TechnicalIdRow label="Borrower" value={lease.borrower} />
          ) : null}
        </div>
      ) : (
        <p className="rounded border border-border/50 bg-muted/20 px-2 py-1.5 text-[10px]">
          Noch keine Leihe — unten starten. ID fehlt danach? Unter Erweitert einfügen.
        </p>
      )}

      <label className="flex flex-col gap-0.5">
        <span>Empfänger-Wallet (nicht du)</span>
        <Input
          className="h-8 font-mono text-[11px]"
          value={borrower}
          disabled={p.disabled || busy}
          onChange={(e) => {
            setBorrower(e.target.value)
            writeLastBorrower(e.target.value)
          }}
          placeholder="0x… (nicht deine eigene)"
        />
        {borrowerIsSelf ? (
          <span className="text-[10px] text-amber-200/90">
            Das ist deine eigene Adresse — Move lehnt ab (Abort 6). Andere Wallet eintragen.
          </span>
        ) : null}
      </label>
      <label className="flex flex-col gap-0.5">
        <span>Dauer (Minuten)</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={durationMinutes}
          disabled={p.disabled || busy}
          onChange={(e) => setDurationMinutes(e.target.value)}
          inputMode="decimal"
        />
        <span className="text-[10px] text-muted-foreground">Test: 1 Min ≈ {Math.round(durationMs / 1000)}s</span>
      </label>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-8 text-[11px]"
          disabled={p.disabled || busy || !msgPkg || !borrower || borrowerIsSelf}
          onClick={() => {
            writeLastBorrower(borrower)
            void run(() =>
              createNftTimeLease({
                messagingPackageId: msgPkg,
                nftObjectId: p.nftObjectId,
                borrowerAddress: borrower,
                durationMs,
              })
            )
          }}
        >
          Leihe starten
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-[11px]"
          disabled={p.disabled || busy || !msgPkg || !activeLeaseId}
          title={
            !activeLeaseId
              ? 'Lease-ID fehlt'
              : 'Nur Borrower-Signer — gibt NFT sofort an dich (Lender) zurück'
          }
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
          title={
            !activeLeaseId
              ? 'Lease-ID fehlt — unter Erweitert einfügen'
              : !reclaimReady
                ? `Noch ${formatRemain(remainMs)} — danach klicken`
                : 'NFT aus Escrow an dich (Lender) zurück'
          }
          onClick={() => {
            if (!activeLeaseId) {
              setErr('Keine Lease-ID — unter Erweitert die Object-ID der NftTimeLease einfügen.')
              return
            }
            if (!reclaimReady && unlockMs > 0) {
              setErr(
                `Noch zu früh (lokal ${formatRemain(remainMs)}). Warte den Countdown ab und klicke erneut — oder Borrower „Früh zurück“.`
              )
              return
            }
            void run(() =>
              reclaimNftTimeLease({
                messagingPackageId: msgPkg,
                leaseObjectId: activeLeaseId,
              })
            )
          }}
        >
          {reclaimReady || !unlockMs
            ? 'Zurückholen'
            : `Zurückholen (${formatRemain(remainMs)})`}
        </Button>
      </div>

      <details className="rounded border border-border/40 px-2 py-1" open={!lease?.leaseObjectId}>
        <summary className="cursor-pointer text-[10px] text-muted-foreground">
          Erweitert (Lease-ID / Package)
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Normalfall: „Leihe starten“ speichert die Lease-ID lokal. Manuelle ID nur wenn Auto-Erkennung fehlt.
          </p>
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
            <span>Notfall · Lease-Object-ID manuell</span>
            <Input
              className="h-7 font-mono text-[10px]"
              value={leaseIdManual}
              disabled={p.disabled || busy}
              onChange={(e) => setLeaseIdManual(e.target.value)}
              placeholder="0x… (NftTimeLease aus Explorer/TX)"
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
                  lender: me || '0x' + '00'.repeat(32),
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
      {err ? <p className="text-destructive whitespace-pre-wrap">{err}</p> : null}
      {info ? <p className="text-foreground whitespace-pre-wrap">{info}</p> : null}
    </div>
  )
}
