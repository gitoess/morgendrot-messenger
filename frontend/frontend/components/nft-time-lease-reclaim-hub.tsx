'use client'

/**
 * Offene Escrow-Leihen — Zurückholen (Verleiher) / vorzeitig zurückgeben (Entleiher).
 * Auswahl = Zeile in der Liste (NFT ist weg aus der Galerie). Chain-Scan nachziehen.
 * Notfall-Lease-ID nur wenn ID fehlt nach TX-Parse.
 */

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  importNftTimeLeaseFromChain,
  reclaimNftTimeLease,
  returnEarlyNftTimeLease,
} from '@/frontend/lib/nft-time-lease-actions'
import { syncDiscoveredNftTimeLeasesIntoLocalIndex } from '@/frontend/lib/nft-time-lease-discover-onchain'
import {
  isPendingNftTimeLeaseId,
  listNftTimeLeasesLocal,
  NFT_TIME_LEASE_CHANGED,
  type NftTimeLeaseLocalEntry,
} from '@/frontend/lib/nft-time-lease-local-store'
import {
  MESSAGING_MODULES_PACKAGE_ID,
  MESSAGING_MODULES_PACKAGE_ID_P5,
} from '@/frontend/lib/messaging-modules-package'
import { explorerObjectUrlFromId } from '@/frontend/lib/iota-tx-explorer-hint'
import { copyTextSafe } from '@/frontend/lib/copy-text-safe'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { getNftKeycard } from '@/frontend/lib/nft-keycard-local-store'

const LS_MSG_PKG = 'morgendrot.nftTimeLease.messagingPackageId.v1'
/** Liste → Notfall-Feld (wenn Notfall unter „Leihe starten“ liegt). */
export const NFT_TIME_LEASE_NOTFALL_ID_EVENT = 'morgendrot:nft-time-lease-notfall-id'

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

function nftLabel(nftObjectId: string): string {
  const card = getNftKeycard(nftObjectId)
  const name = (card?.label || '').trim()
  return name || shortId(nftObjectId)
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
  /**
   * `list` = nur offene Leihen (oben).
   * `notfall` = nur Lease-ID-Import (unten unter Leihe starten).
   * `all` = beides (Default).
   */
  sections?: 'all' | 'list' | 'notfall'
}) {
  const sections = p.sections ?? 'all'
  const showList = sections === 'all' || sections === 'list'
  const showNotfall = sections === 'all' || sections === 'notfall'
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [q, setQ] = useState('')
  const [manualLeaseId, setManualLeaseId] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [tick, setTick] = useState(0)

  const me = (getDirectIotaSessionSignerAddress() || '').trim().toLowerCase()

  const refreshFromChain = async (silent?: boolean) => {
    setScanBusy(true)
    if (!silent) {
      setErr('')
      setInfo('')
    }
    try {
      const r = await syncDiscoveredNftTimeLeasesIntoLocalIndex()
      if (!r.ok) {
        if (!silent) setErr(r.error)
        return
      }
      setTick((n) => n + 1)
      if (!silent) {
        setInfo(
          r.found === 0
            ? 'Keine offenen Leihen für diese Wallet auf der Chain gefunden.'
            : `Aktualisiert: ${r.active} offen / ${r.found} Event(s).`
        )
      }
    } finally {
      setScanBusy(false)
    }
  }

  useEffect(() => {
    const sync = () => {
      setTick((n) => n + 1)
      setNowMs(Date.now())
    }
    sync()
    window.addEventListener(NFT_TIME_LEASE_CHANGED, sync)
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    if (sections !== 'notfall') void refreshFromChain(true)
    const onNotfallId = (ev: Event) => {
      const id = String((ev as CustomEvent<string>).detail || '').trim()
      if (!id) return
      setManualLeaseId(id)
      setInfo('Lease-ID übernommen — ggf. laden / zurückholen.')
    }
    if (showNotfall) {
      window.addEventListener(NFT_TIME_LEASE_NOTFALL_ID_EVENT, onNotfallId as EventListener)
    }
    return () => {
      window.removeEventListener(NFT_TIME_LEASE_CHANGED, sync)
      window.clearInterval(t)
      window.removeEventListener(NFT_TIME_LEASE_NOTFALL_ID_EVENT, onNotfallId as EventListener)
    }
  }, [sections, showNotfall])

  const pkgForLease = (e: NftTimeLeaseLocalEntry) =>
    (e.messagingPackageId || '').trim() || readMsgPkg() || MESSAGING_MODULES_PACKAGE_ID_P5

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
        e.lender.includes(needle) ||
        nftLabel(e.nftObjectId).toLowerCase().includes(needle)
    )
  }, [nowMs, q, tick])

  const readyCount = rows.filter((r) => r.ready && me && r.lender === me).length
  const hasPendingId = rows.some((e) => isPendingNftTimeLeaseId(e.leaseObjectId))

  const onImport = async () => {
    setImportBusy(true)
    setErr('')
    setInfo('')
    try {
      const r = await importNftTimeLeaseFromChain(manualLeaseId)
      if (!r.ok) {
        setErr(r.error)
        return
      }
      setInfo(
        `Lease geladen · NFT ${shortId(r.nftObjectId)} · unlock ${new Date(r.unlockMs).toLocaleString()}`
      )
      setManualLeaseId('')
      setTick((n) => n + 1)
    } finally {
      setImportBusy(false)
    }
  }

  const onReclaim = async (leaseObjectId: string) => {
    setBusyId(leaseObjectId)
    setErr('')
    setInfo('')
    try {
      const row = listNftTimeLeasesLocal().find(
        (e) => e.leaseObjectId.toLowerCase() === leaseObjectId.toLowerCase()
      )
      const r = await reclaimNftTimeLease({
        messagingPackageId: row ? pkgForLease(row) : readMsgPkg(),
        leaseObjectId,
      })
      if (!r.ok) {
        setErr(r.error || 'Zurückholen fehlgeschlagen')
        return
      }
      setInfo(`Zurückgeholt · ${r.digest?.slice(0, 12) ?? ''}… · NFT wieder bei dir`)
      setTick((n) => n + 1)
    } finally {
      setBusyId(null)
    }
  }

  const onReturnEarly = async (leaseObjectId: string) => {
    setBusyId(leaseObjectId)
    setErr('')
    setInfo('')
    try {
      const row = listNftTimeLeasesLocal().find(
        (e) => e.leaseObjectId.toLowerCase() === leaseObjectId.toLowerCase()
      )
      const r = await returnEarlyNftTimeLease({
        messagingPackageId: row ? pkgForLease(row) : readMsgPkg(),
        leaseObjectId,
      })
      if (!r.ok) {
        setErr(r.error || 'Vorzeitig zurückgeben fehlgeschlagen')
        return
      }
      setInfo(`Zurückgegeben · ${r.digest?.slice(0, 12) ?? ''}…`)
      setTick((n) => n + 1)
    } finally {
      setBusyId(null)
    }
  }

  const onImportAndReclaim = async () => {
    setImportBusy(true)
    setErr('')
    setInfo('')
    try {
      const imp = await importNftTimeLeaseFromChain(manualLeaseId)
      if (!imp.ok) {
        setErr(imp.error)
        return
      }
      setTick((n) => n + 1)
      const row = listNftTimeLeasesLocal().find(
        (e) => e.leaseObjectId.toLowerCase() === imp.leaseObjectId.toLowerCase()
      )
      const r = await reclaimNftTimeLease({
        messagingPackageId: row ? pkgForLease(row) : readMsgPkg(),
        leaseObjectId: imp.leaseObjectId,
      })
      if (!r.ok) {
        setErr(
          `Import ok, Zurückholen: ${r.error || 'fehlgeschlagen'} (Frist? Verleiher-Wallet? Gas?)`
        )
        return
      }
      setInfo(`Zurückgeholt · ${r.digest?.slice(0, 12) ?? ''}…`)
      setManualLeaseId('')
      setTick((n) => n + 1)
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <div className={`space-y-2 ${p.className || ''}`}>
      {showList ? (
        <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Zurückholen</p>
          <p className="text-[10px] text-muted-foreground">
            Offene Escrow-Leihen — Zeile tippen, kein Galerie-NFT nötig
            {rows.length > 0
              ? ` · ${rows.length} offen${readyCount > 0 ? ` · ${readyCount} bereit` : ''}`
              : ''}
            {scanBusy ? ' · lädt…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={p.disabled || scanBusy}
            title="Scannt LeaseCreated-Events dieser Wallet (auch automatisch beim Öffnen)."
            onClick={() => void refreshFromChain(false)}
          >
            {scanBusy ? '…' : 'Liste aktualisieren'}
          </Button>
          {rows.length > 6 || q ? (
            <Input
              className="h-7 w-full max-w-[14rem] font-mono text-[10px]"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter Name/NFT/0x…"
              disabled={p.disabled}
            />
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Keine offene Leihe. Nach „Leihe starten“ erscheint sie hier. Sonst „Liste aktualisieren“.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul
          className={`space-y-1.5 overflow-y-auto ${
            p.compact ? 'max-h-40' : 'max-h-[min(50vh,22rem)]'
          }`}
        >
          {rows.map((e) => {
            const pending = isPendingNftTimeLeaseId(e.leaseObjectId)
            const asLender = Boolean(me && e.lender === me)
            const asBorrower = Boolean(me && e.borrower === me)
            const canReclaim = asLender && e.ready && !pending
            const canReturnEarly = asBorrower && !pending
            const label = nftLabel(e.nftObjectId)
            return (
              <li
                key={e.leaseObjectId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/10 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[11px] text-foreground">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground"> · NFT </span>
                    <button
                      type="button"
                      className="font-mono text-primary hover:underline"
                      title={`${e.nftObjectId} — kopieren`}
                      onClick={() => void copyTextSafe(e.nftObjectId)}
                    >
                      {shortId(e.nftObjectId)}
                    </button>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {asLender ? 'du verliehen an ' : asBorrower ? 'du entliehen von ' : 'an '}
                    {shortId(asLender ? e.borrower : e.lender)}
                    {' · '}
                    {pending ? (
                      <span className="text-amber-800 dark:text-amber-200">ID fehlt</span>
                    ) : e.ready && asLender ? (
                      <span className="text-emerald-700 dark:text-emerald-300">bereit</span>
                    ) : e.ready ? (
                      <span>Frist vorbei</span>
                    ) : (
                      <span>noch {formatRemain(e.remainMs)}</span>
                    )}
                  </p>
                  {!pending ? (
                    <p className="text-[10px] text-muted-foreground">
                      Lease{' '}
                      <button
                        type="button"
                        className="font-mono text-primary hover:underline"
                        title="In Notfall-Feld übernehmen"
                        onClick={() => {
                          void copyTextSafe(e.leaseObjectId)
                          window.dispatchEvent(
                            new CustomEvent(NFT_TIME_LEASE_NOTFALL_ID_EVENT, {
                              detail: e.leaseObjectId,
                            })
                          )
                          setInfo('Lease-ID → Notfall unten (auch Zwischenablage).')
                        }}
                      >
                        {shortId(e.leaseObjectId)}
                      </button>
                      <span className="text-muted-foreground"> — tippen → Notfall unten</span>
                    </p>
                  ) : null}
                  <p className="flex flex-wrap gap-2 text-[10px]">
                    {!pending ? (
                      <a
                        href={explorerObjectUrlFromId(e.leaseObjectId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Lease Explorer
                      </a>
                    ) : null}
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
                        void copyTextSafe(
                          pending ? e.nftObjectId : `${e.leaseObjectId}\n${e.nftObjectId}`
                        )
                      }
                    >
                      IDs kopieren
                    </button>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {asLender ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-[11px]"
                      variant={canReclaim ? 'default' : 'outline'}
                      disabled={p.disabled || busyId === e.leaseObjectId || !canReclaim}
                      title={
                        pending
                          ? 'Zuerst „Liste aktualisieren“ oder Notfall-Lease-ID'
                          : canReclaim
                            ? 'NFT aus Escrow zurückholen'
                            : `Warten bis ${new Date(e.unlockMs).toLocaleString()}`
                      }
                      onClick={() => void onReclaim(e.leaseObjectId)}
                    >
                      {busyId === e.leaseObjectId
                        ? '…'
                        : canReclaim
                          ? 'Zurückholen'
                          : pending
                            ? 'ID fehlt'
                            : formatRemain(e.remainMs)}
                    </Button>
                  ) : null}
                  {asBorrower ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      disabled={p.disabled || busyId === e.leaseObjectId || !canReturnEarly}
                      title="NFT sofort an den Verleiher zurückgeben"
                      onClick={() => void onReturnEarly(e.leaseObjectId)}
                    >
                      {busyId === e.leaseObjectId ? '…' : 'Vorzeitig zurückgeben'}
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {rows.length === 0 && q.trim() ? (
        <p className="text-[10px] text-muted-foreground">Kein Treffer für „{q.trim()}“.</p>
      ) : null}
        </>
      ) : null}

      {showNotfall ? (
      <details className="rounded-md border border-border/70 bg-muted/15 p-2.5" open={hasPendingId}>
        <summary className="cursor-pointer text-[10px] font-medium text-foreground">
          Notfall: Lease-ID (selten)
        </summary>
        <div className="mt-2 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">
            Nur wenn „ID fehlt“ oder der Chain-Scan die Leihe nicht findet. Object-ID der{' '}
            <em>NftTimeLease</em> aus Explorer/TX — nicht die NFT-ID. Normale Nutzung: Liste
            aktualisieren reicht. Aus der Liste oben: Lease tippen → landet hier.
          </p>
          <Input
            className="h-8 font-mono text-[11px]"
            value={manualLeaseId}
            onChange={(e) => setManualLeaseId(e.target.value)}
            placeholder="0x… Lease-Object-ID"
            disabled={p.disabled || importBusy}
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={p.disabled || importBusy || !manualLeaseId.trim()}
              onClick={() => void onImport()}
            >
              {importBusy ? '…' : 'Nur laden'}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-[11px]"
              disabled={p.disabled || importBusy || !manualLeaseId.trim()}
              onClick={() => void onImportAndReclaim()}
            >
              Laden + zurückholen
            </Button>
          </div>
        </div>
      </details>
      ) : null}

      {err ? <p className="text-[11px] text-destructive whitespace-pre-wrap">{err}</p> : null}
      {info ? <p className="text-[11px] text-foreground">{info}</p> : null}
    </div>
  )
}
