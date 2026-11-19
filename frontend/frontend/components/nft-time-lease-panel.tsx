'use client'

/**
 * Verleihen: Leihe anlegen + Entleiher „vorzeitig zurückgeben“.
 * Verleiher-Zurückholen = Liste oben (NftTimeLeaseReclaimHub) — hier nicht doppelt.
 */

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createNftTimeLease, returnEarlyNftTimeLease } from '@/frontend/lib/nft-time-lease-actions'
import {
  findNftTimeLeaseByNft,
  isPendingNftTimeLeaseId,
  NFT_TIME_LEASE_CHANGED,
  nftTimeLeaseBadgeText,
  type NftTimeLeaseLocalEntry,
} from '@/frontend/lib/nft-time-lease-local-store'

import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import { syncDiscoveredNftTimeLeasesIntoLocalIndex } from '@/frontend/lib/nft-time-lease-discover-onchain'
import { TechnicalIdRow } from '@/frontend/components/technical-id-row'
import { explorerObjectUrlFromId } from '@/frontend/lib/iota-tx-explorer-hint'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { readContactFavorites } from '@/frontend/lib/contact-phonebook-meta-store'

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
  const { directory: contactDirectory } = useContactDirectory()
  const [msgPkg, setMsgPkg] = useState(MESSAGING_MODULES_PACKAGE_ID)
  const [borrower, setBorrower] = useState('')
  /** Relativ: Betrag + Einheit → durationMs; optional absolutes Datum überschreibt. */
  const [durationAmount, setDurationAmount] = useState('1')
  const [durationUnit, setDurationUnit] = useState<'min' | 'h' | 'd'>('min')
  const [unlockAtLocal, setUnlockAtLocal] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [lease, setLease] = useState<NftTimeLeaseLocalEntry | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const phonebookOptions = useMemo(() => {
    const fav = readContactFavorites()
    const byAddr = new Map<string, { address: string; label: string; favorite: boolean }>()
    for (const [addr, entry] of Object.entries(contactDirectory)) {
      const a = (addr || '').trim()
      if (!/^0x[a-fA-F0-9]{64}$/i.test(a)) continue
      const key = a.toLowerCase()
      byAddr.set(key, {
        address: a,
        label: (entry?.label || '').trim() || `${a.slice(0, 10)}…`,
        favorite: fav.has(key),
      })
    }
    return Array.from(byAddr.values()).sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      return a.label.localeCompare(b.label, 'de')
    })
  }, [contactDirectory])

  useEffect(() => {
    setMsgPkg(readMsgPkg())
    setBorrower((prev) => prev || readLastBorrower())
    const sync = () => {
      const row = findNftTimeLeaseByNft(p.nftObjectId)
      setLease(row)
      if (row?.messagingPackageId) setMsgPkg(row.messagingPackageId)
      setNowMs(Date.now())
    }
    sync()
    window.addEventListener(NFT_TIME_LEASE_CHANGED, sync)
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    void (async () => {
      if (findNftTimeLeaseByNft(p.nftObjectId)) return
      const r = await syncDiscoveredNftTimeLeasesIntoLocalIndex()
      if (r.ok) sync()
    })()
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
      const pending =
        Boolean(r.leaseObjectId && isPendingNftTimeLeaseId(r.leaseObjectId)) ||
        (!r.leaseObjectId && !findNftTimeLeaseByNft(p.nftObjectId))
      setInfo(
        `OK${r.digest ? ` · TX ${r.digest.slice(0, 12)}…` : ''}${
          r.leaseObjectId && !isPendingNftTimeLeaseId(r.leaseObjectId)
            ? ` · Lease ${r.leaseObjectId.slice(0, 12)}…`
            : ''
        }${
          pending
            ? ' — Liste oben „Liste aktualisieren“ tippen (Lease-ID wird von Chain nachgezogen).'
            : ''
        }`
      )
      setLease(findNftTimeLeaseByNft(p.nftObjectId))
    } finally {
      setBusy(false)
    }
  }

  const durationMs = useMemo(() => {
    const abs = unlockAtLocal.trim()
    if (abs) {
      const t = new Date(abs).getTime()
      if (Number.isFinite(t) && t > Date.now() + 3_000) return Math.floor(t - Date.now())
    }
    const n = Math.max(0.05, Number(durationAmount) || 1)
    if (durationUnit === 'h') return Math.floor(n * 3_600_000)
    if (durationUnit === 'd') return Math.floor(n * 86_400_000)
    return Math.floor(n * 60_000)
  }, [durationAmount, durationUnit, unlockAtLocal, nowMs])
  const unlockPreviewMs = Date.now() + durationMs
  const activeLeaseId = (lease?.leaseObjectId || '').trim()
  const leaseIdUsable = Boolean(activeLeaseId) && !isPendingNftTimeLeaseId(activeLeaseId)
  const me = (getDirectIotaSessionSignerAddress() || '').trim().toLowerCase()
  const borrowerNorm = borrower.trim().toLowerCase()
  const borrowerIsSelf = Boolean(me && borrowerNorm && me === borrowerNorm)
  const unlockMs = lease?.unlockMs ?? 0
  const remainMs = unlockMs > 0 ? unlockMs - nowMs : 0
  const iAmBorrower = Boolean(me && lease?.borrower && me === lease.borrower)
  const iAmLender = Boolean(me && lease?.lender && me === lease.lender)
  const badge = useMemo(
    () => (lease ? nftTimeLeaseBadgeText(lease, nowMs) : ''),
    [lease, nowMs]
  )
  const absUnlockInvalid =
    Boolean(unlockAtLocal.trim()) &&
    !(Number.isFinite(new Date(unlockAtLocal).getTime()) && new Date(unlockAtLocal).getTime() > Date.now() + 3_000)
  const phoneHit = phonebookOptions.find((o) => o.address.toLowerCase() === borrowerNorm)

  const leaseActive = Boolean(lease && lease.status === 'active' && !lease.reclaimCancelled)

  return (
    <div className="space-y-2 text-[11px] text-muted-foreground">
      {lease ? (
        <div className="space-y-1.5 rounded border border-amber-800/30 bg-amber-950/15 px-2.5 py-2">
          <p className="text-amber-100/90">{badge}</p>
          {unlockMs > 0 && leaseActive ? (
            <p className="text-[10px] text-foreground/90">
              {remainMs <= 0
                ? iAmLender
                  ? 'Frist vorbei — Zurückholen in der Liste oben.'
                  : 'Frist vorbei — Verleiher holt zurück (Liste oben).'
                : `Noch ${formatRemain(remainMs)}.`}
            </p>
          ) : null}
          <TechnicalIdRow
            label="Lease Object-ID"
            value={lease.leaseObjectId}
            href={
              isPendingNftTimeLeaseId(lease.leaseObjectId)
                ? undefined
                : explorerObjectUrlFromId(lease.leaseObjectId)
            }
          />
          <TechnicalIdRow
            label="NFT Object-ID"
            value={p.nftObjectId}
            href={explorerObjectUrlFromId(p.nftObjectId)}
          />
          {lease.borrower ? <TechnicalIdRow label="Entleiher" value={lease.borrower} /> : null}
        </div>
      ) : null}

      {!leaseActive ? (
        <>
          <label className="flex flex-col gap-0.5">
            <span>Empfänger-Wallet (nicht du)</span>
            {phonebookOptions.length > 0 ? (
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-[11px] text-foreground"
                value={
                  phonebookOptions.find((o) => o.address.toLowerCase() === borrowerNorm)?.address ?? ''
                }
                disabled={p.disabled || busy}
                aria-label="Empfänger aus Telefonbuch"
                onChange={(e) => {
                  setBorrower(e.target.value)
                  writeLastBorrower(e.target.value)
                }}
              >
                <option value="">Telefonbuch wählen…</option>
                {phonebookOptions.map((o) => (
                  <option key={o.address} value={o.address}>
                    {o.favorite ? `★ ${o.label}` : o.label}
                  </option>
                ))}
              </select>
            ) : null}
            <Input
              className="h-8 font-mono text-[11px]"
              value={borrower}
              disabled={p.disabled || busy}
              onChange={(e) => {
                setBorrower(e.target.value)
                writeLastBorrower(e.target.value)
              }}
              placeholder="0x… oder Telefonbuch oben"
            />
            {phoneHit ? (
              <span className="text-[10px] text-muted-foreground">Kontakt: {phoneHit.label}</span>
            ) : null}
            {borrowerIsSelf ? (
              <span className="text-[10px] text-amber-200/90">
                Das ist deine eigene Adresse — Move lehnt ab (Abort 6). Andere Wallet eintragen.
              </span>
            ) : null}
          </label>
          <div className="space-y-1.5">
            <span className="text-[11px] text-foreground">Leihdauer</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                className="h-8 w-20 font-mono text-[11px]"
                value={durationAmount}
                disabled={p.disabled || busy || Boolean(unlockAtLocal.trim())}
                onChange={(e) => setDurationAmount(e.target.value)}
                inputMode="decimal"
                aria-label="Dauer-Betrag"
              />
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-[11px] text-foreground"
                value={durationUnit}
                disabled={p.disabled || busy || Boolean(unlockAtLocal.trim())}
                onChange={(e) => setDurationUnit(e.target.value as 'min' | 'h' | 'd')}
                aria-label="Dauer-Einheit"
              >
                <option value="min">Minuten</option>
                <option value="h">Stunden</option>
                <option value="d">Tage</option>
              </select>
            </div>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">
                Oder Zeitpunkt (lokal) — überschreibt Dauer oben
              </span>
              <Input
                type="datetime-local"
                className="h-8 font-mono text-[11px]"
                value={unlockAtLocal}
                disabled={p.disabled || busy}
                onChange={(e) => setUnlockAtLocal(e.target.value)}
              />
            </label>
            {absUnlockInvalid ? (
              <p className="text-[10px] text-amber-200/90">Zeitpunkt muss in der Zukunft liegen.</p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Zurückholen ab ca. {new Date(unlockPreviewMs).toLocaleString('de-DE')} (
                {formatRemain(durationMs)})
              </p>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            className="h-8 text-[11px]"
            disabled={
              p.disabled ||
              busy ||
              !msgPkg ||
              !borrower ||
              borrowerIsSelf ||
              absUnlockInvalid ||
              durationMs < 3_000
            }
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
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {iAmBorrower ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={p.disabled || busy || !msgPkg || !leaseIdUsable}
              title={
                !leaseIdUsable
                  ? 'Lease-ID fehlt — Liste oben aktualisieren'
                  : 'Gibt NFT sofort an den Verleiher zurück'
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
              Vorzeitig zurückgeben
            </Button>
          ) : null}
          {iAmLender ? (
            <p className="text-[10px] text-muted-foreground">
              Du bist Verleiher — NFT zurück in der Liste oben (Zurückholen).
            </p>
          ) : null}
          {!iAmBorrower && !iAmLender ? (
            <p className="text-[10px] text-muted-foreground">
              Aktive Leihe — Aktionen in der Liste oben.
            </p>
          ) : null}
        </div>
      )}

      {err ? <p className="text-destructive whitespace-pre-wrap">{err}</p> : null}
      {info ? <p className="text-foreground whitespace-pre-wrap">{info}</p> : null}
    </div>
  )
}
