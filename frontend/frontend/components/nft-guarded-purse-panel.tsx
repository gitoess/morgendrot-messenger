'use client'

/**
 * B2-S2 — Guarded Purse UI: create / deposit / spend / destroy + Pflichttext lose Coins.
 * Spec: docs/NFT-GUARDED-SPEND-SPEC.md
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import {
  createNftGuardedPurse,
  depositNftGuardedPurse,
  destroyEmptyNftGuardedPurse,
  spendNftGuardedPurse,
} from '@/frontend/lib/nft-guarded-purse-actions'
import {
  findNftGuardedPurseByNft,
  iotaDecimalToMist,
  listNftGuardedPursesLocal,
  NFT_GUARDED_PURSE_CHANGED,
  nftGuardedPurseBadgeText,
  upsertNftGuardedPurseLocal,
  type NftGuardedPurseLocalEntry,
} from '@/frontend/lib/nft-guarded-purse-local-store'

const LS_MSG_PKG = 'morgendrot.nftGuardedPurse.messagingPackageId.v1'

export const NFT_GUARDED_PURSE_PACKAGE_ID_TESTNET = MESSAGING_MODULES_PACKAGE_ID

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
    window.localStorage.setItem(LS_MSG_PKG, v.trim())
  } catch {
    /* ignore */
  }
}

export function NftGuardedPursePanel(p: { nftObjectId: string; disabled?: boolean }) {
  const [msgPkg, setMsgPkg] = useState('')
  const [amountIota, setAmountIota] = useState('0.01')
  const [recipient, setRecipient] = useState('')
  const [purseIdManual, setPurseIdManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [purse, setPurse] = useState<NftGuardedPurseLocalEntry | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const stored = readMsgPkg()
    if (stored) setMsgPkg(stored)
    else {
      setMsgPkg(NFT_GUARDED_PURSE_PACKAGE_ID_TESTNET)
      writeMsgPkg(NFT_GUARDED_PURSE_PACKAGE_ID_TESTNET)
    }
    const sync = () => {
      setPurse(findNftGuardedPurseByNft(p.nftObjectId))
      setTick((n) => n + 1)
    }
    sync()
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
    return () => window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
  }, [p.nftObjectId])

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string; digest?: string; purseObjectId?: string }>
  ) => {
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
          r.purseObjectId ? ` · Purse ${r.purseObjectId.slice(0, 12)}…` : ''
        }`
      )
      setPurse(findNftGuardedPurseByNft(p.nftObjectId))
    } finally {
      setBusy(false)
    }
  }

  const parseMist = (): bigint | null => {
    try {
      return iotaDecimalToMist(amountIota)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ungültiger Betrag')
      return null
    }
  }

  const activePurseId = purse?.purseObjectId || purseIdManual.trim()

  return (
    <div className="mt-2 space-y-2 rounded border border-border/70 bg-muted/15 px-2.5 py-2 text-[11px] text-muted-foreground">
      <p className="font-medium text-foreground">2FA-Schlüsselkarte für Token (Guarded Purse)</p>
      <p>
        Nur Guthaben <span className="text-foreground">in der Purse</span> ist NFT-gesichert (Signer = du{' '}
        <span className="text-foreground">und</span> gebundenes NFT bei dir). NFT enthält keine Coins.
      </p>
      <p className="rounded border border-amber-800/30 bg-amber-950/15 px-2 py-1 text-amber-100/90">
        Lose / freie Coins außerhalb der Purse bleiben ungeschützt — normales Wallet-Senden ist weiter möglich.
      </p>

      <label className="flex flex-col gap-0.5">
        <span>Messaging PACKAGE_ID (Module)</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={msgPkg}
          disabled={p.disabled || busy}
          onChange={(e) => {
            setMsgPkg(e.target.value)
            writeMsgPkg(e.target.value)
          }}
          placeholder="0x…"
        />
      </label>

      {purse ? (
        <p className="rounded border border-emerald-800/30 bg-emerald-950/15 px-2 py-1 text-emerald-100/90" key={tick}>
          {nftGuardedPurseBadgeText(purse)}
        </p>
      ) : null}

      <label className="flex flex-col gap-0.5">
        <span>Betrag (IOTA)</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={amountIota}
          disabled={p.disabled || busy}
          onChange={(e) => setAmountIota(e.target.value)}
          placeholder="0.01"
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span>Empfänger (nur Spend)</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={recipient}
          disabled={p.disabled || busy}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x…"
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 text-[10px]"
          disabled={p.disabled || busy || !msgPkg}
          onClick={() => {
            const mist = parseMist()
            if (mist == null) return
            void run(() =>
              createNftGuardedPurse({
                messagingPackageId: msgPkg,
                nftObjectId: p.nftObjectId,
                amountMist: mist,
              })
            )
          }}
        >
          Purse anlegen (create)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          disabled={p.disabled || busy || !msgPkg || !activePurseId}
          onClick={() => {
            const mist = parseMist()
            if (mist == null) return
            void run(() =>
              depositNftGuardedPurse({
                messagingPackageId: msgPkg,
                purseObjectId: activePurseId,
                amountMist: mist,
              })
            )
          }}
        >
          Einzahlen
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-[10px]"
          disabled={p.disabled || busy || !msgPkg || !activePurseId || !recipient}
          onClick={() => {
            const mist = parseMist()
            if (mist == null) return
            void run(() =>
              spendNftGuardedPurse({
                messagingPackageId: msgPkg,
                purseObjectId: activePurseId,
                nftObjectId: p.nftObjectId,
                amountMist: mist,
                recipientAddress: recipient,
              })
            )
          }}
        >
          Spend (X ∧ NFT)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[10px]"
          disabled={p.disabled || busy || !msgPkg || !activePurseId}
          onClick={() =>
            void run(() =>
              destroyEmptyNftGuardedPurse({
                messagingPackageId: msgPkg,
                purseObjectId: activePurseId,
              })
            )
          }
        >
          Leere Purse löschen
        </Button>
      </div>

      <label className="flex flex-col gap-0.5">
        <span>Purse Object-ID (falls nicht auto / manuell)</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={purseIdManual}
          disabled={p.disabled || busy}
          onChange={(e) => setPurseIdManual(e.target.value)}
          placeholder="0x…"
        />
      </label>
      {purseIdManual.trim() ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[10px]"
          disabled={busy}
          onClick={() => {
            upsertNftGuardedPurseLocal({
              purseObjectId: purseIdManual,
              nftObjectId: p.nftObjectId,
              owner: '0x' + '00'.repeat(32),
              balanceMistHint: '?',
              status: 'active',
            })
            setPurse(findNftGuardedPurseByNft(p.nftObjectId))
            setInfo('Lokaler Purse-Index gesetzt (Chain prüfen).')
          }}
        >
          Lokal merken
        </Button>
      ) : null}

      {listNftGuardedPursesLocal().length > 1 ? (
        <p className="text-[10px]">{listNftGuardedPursesLocal().length} Purses lokal gemerkt.</p>
      ) : null}
      {err ? <p className="text-destructive">{err}</p> : null}
      {info ? <p className="text-foreground">{info}</p> : null}
    </div>
  )
}
