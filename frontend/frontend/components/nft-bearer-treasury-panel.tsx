'use client'

/**
 * B2-S3 — Bearer Treasury UI: create / deposit / withdraw / freeze / reclaim.
 * „Wer NFT hat, darf senden“ — nicht dasselbe wie Guarded Purse (X∧NFT).
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import {
  adminReclaimNftBearerTreasury,
  adminSetFrozenNftBearerTreasury,
  createNftBearerTreasury,
  depositNftBearerTreasury,
  withdrawNftBearerTreasury,
} from '@/frontend/lib/nft-bearer-treasury-actions'
import {
  findNftBearerTreasuryByNft,
  NFT_BEARER_TREASURY_CHANGED,
  nftBearerTreasuryBadgeText,
  upsertNftBearerTreasuryLocal,
  type NftBearerTreasuryLocalEntry,
} from '@/frontend/lib/nft-bearer-treasury-local-store'
import { iotaDecimalToMist } from '@/frontend/lib/nft-guarded-purse-local-store'

const LS_MSG_PKG = 'morgendrot.nftBearerTreasury.messagingPackageId.v1'

export const NFT_BEARER_TREASURY_PACKAGE_ID_TESTNET = MESSAGING_MODULES_PACKAGE_ID

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

export function NftBearerTreasuryPanel(p: { nftObjectId: string; disabled?: boolean }) {
  const [msgPkg, setMsgPkg] = useState('')
  const [amountIota, setAmountIota] = useState('0.01')
  const [recipient, setRecipient] = useState('')
  const [treasuryManual, setTreasuryManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [err, setErr] = useState('')
  const [entry, setEntry] = useState<NftBearerTreasuryLocalEntry | null>(null)

  useEffect(() => {
    const stored = readMsgPkg()
    if (stored) setMsgPkg(stored)
    else {
      setMsgPkg(NFT_BEARER_TREASURY_PACKAGE_ID_TESTNET)
      writeMsgPkg(NFT_BEARER_TREASURY_PACKAGE_ID_TESTNET)
    }
    const sync = () => setEntry(findNftBearerTreasuryByNft(p.nftObjectId))
    sync()
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
    return () => window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
  }, [p.nftObjectId])

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string; digest?: string; treasuryObjectId?: string }>
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
          r.treasuryObjectId ? ` · Treasury ${r.treasuryObjectId.slice(0, 12)}…` : ''
        }`
      )
      setEntry(findNftBearerTreasuryByNft(p.nftObjectId))
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

  const treasuryId = entry?.treasuryObjectId || treasuryManual.trim()

  return (
    <div className="mt-2 space-y-2 rounded border border-border/70 bg-muted/15 px-2.5 py-2 text-[11px] text-muted-foreground">
      <p className="font-medium text-foreground">Bearer Treasury (Modus B)</p>
      <p>
        Shared Vault: <span className="text-foreground">wer das NFT besitzt</span>, darf abheben —
        unabhängig vom Admin. NFT enthält keine Coins. Nicht dasselbe wie Guarded Purse (X∧NFT).
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
        />
      </label>

      {entry ? (
        <p className="rounded border border-violet-800/30 bg-violet-950/15 px-2 py-1 text-violet-100/90">
          {nftBearerTreasuryBadgeText(entry)}
        </p>
      ) : null}

      <label className="flex flex-col gap-0.5">
        <span>Betrag (IOTA)</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={amountIota}
          disabled={p.disabled || busy}
          onChange={(e) => setAmountIota(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span>Empfänger (Withdraw)</span>
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
              createNftBearerTreasury({
                messagingPackageId: msgPkg,
                nftObjectId: p.nftObjectId,
                amountMist: mist,
              })
            )
          }}
        >
          Treasury anlegen
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          disabled={p.disabled || busy || !msgPkg || !treasuryId}
          onClick={() => {
            const mist = parseMist()
            if (mist == null) return
            void run(() =>
              depositNftBearerTreasury({
                messagingPackageId: msgPkg,
                treasuryObjectId: treasuryId,
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
          disabled={p.disabled || busy || !msgPkg || !treasuryId || !recipient}
          onClick={() => {
            const mist = parseMist()
            if (mist == null) return
            void run(() =>
              withdrawNftBearerTreasury({
                messagingPackageId: msgPkg,
                treasuryObjectId: treasuryId,
                nftObjectId: p.nftObjectId,
                amountMist: mist,
                recipientAddress: recipient,
              })
            )
          }}
        >
          Withdraw (NFT-Bearer)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[10px]"
          disabled={p.disabled || busy || !msgPkg || !treasuryId}
          onClick={() =>
            void run(() =>
              adminSetFrozenNftBearerTreasury({
                messagingPackageId: msgPkg,
                treasuryObjectId: treasuryId,
                frozen: !entry?.frozen,
              })
            )
          }
        >
          {entry?.frozen ? 'Auftauen' : 'Einfrieren'} (Admin)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[10px]"
          disabled={p.disabled || busy || !msgPkg || !treasuryId}
          onClick={() =>
            void run(() =>
              adminReclaimNftBearerTreasury({
                messagingPackageId: msgPkg,
                treasuryObjectId: treasuryId,
              })
            )
          }
        >
          Admin-Reclaim
        </Button>
      </div>

      <label className="flex flex-col gap-0.5">
        <span>Treasury Object-ID (manuell)</span>
        <Input
          className="h-7 font-mono text-[10px]"
          value={treasuryManual}
          disabled={p.disabled || busy}
          onChange={(e) => setTreasuryManual(e.target.value)}
          placeholder="0x…"
        />
      </label>
      {treasuryManual.trim() ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[10px]"
          disabled={busy}
          onClick={() => {
            upsertNftBearerTreasuryLocal({
              treasuryObjectId: treasuryManual,
              nftObjectId: p.nftObjectId,
              admin: '0x' + '00'.repeat(32),
              balanceMistHint: '?',
              frozen: false,
              status: 'active',
            })
            setEntry(findNftBearerTreasuryByNft(p.nftObjectId))
            setInfo('Lokaler Treasury-Index gesetzt.')
          }}
        >
          Lokal merken
        </Button>
      ) : null}

      {err ? <p className="text-destructive">{err}</p> : null}
      {info ? <p className="text-foreground">{info}</p> : null}
    </div>
  )
}
