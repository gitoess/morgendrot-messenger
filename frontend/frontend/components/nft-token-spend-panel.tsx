'use client'

/**
 * Token-Spend: wählbar Bearer (nur NFT) vs Guarded (NFT + Wallet).
 * Orthogonal zu P4b Seal (Leserecht).
 */

import { useEffect, useState } from 'react'
import { NftBearerTreasuryPanel } from '@/frontend/components/nft-bearer-treasury-panel'
import { NftGuardedPursePanel } from '@/frontend/components/nft-guarded-purse-panel'
import {
  NFT_TOKEN_SPEND_MODE_CHANGED,
  nftTokenSpendModeLabel,
  readNftTokenSpendMode,
  writeNftTokenSpendMode,
  type NftTokenSpendMode,
} from '@/frontend/lib/nft-token-spend-mode'

export function NftTokenSpendPanel(p: { nftObjectId: string; disabled?: boolean }) {
  const [mode, setMode] = useState<NftTokenSpendMode>('guarded')

  useEffect(() => {
    const sync = () => setMode(readNftTokenSpendMode())
    sync()
    window.addEventListener(NFT_TOKEN_SPEND_MODE_CHANGED, sync)
    return () => window.removeEventListener(NFT_TOKEN_SPEND_MODE_CHANGED, sync)
  }, [])

  return (
    <div className="mt-2 space-y-2 rounded border border-border/70 bg-muted/10 px-2.5 py-2 text-[11px] text-muted-foreground">
      <p className="font-medium text-foreground">Token-Spend (optional)</p>
      <p>
        Nur Coins in Purse/Treasury sind geschützt — lose Wallet-Coins bleiben ungeschützt. NFT enthält keine Coins.
        Getrennt vom Klartext-Seal (P4b).
      </p>
      <fieldset className="space-y-1.5" disabled={p.disabled}>
        <legend className="sr-only">Spend-Modus</legend>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            className="mt-0.5"
            name={`nft-spend-${p.nftObjectId}`}
            checked={mode === 'bearer'}
            onChange={() => {
              setMode('bearer')
              writeNftTokenSpendMode('bearer')
            }}
          />
          <span>
            <span className="font-medium text-foreground">Nur NFT (Bearer)</span>
            {' — '}
            Shared Treasury: wer die Schlüsselkarte besitzt, darf abheben.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            className="mt-0.5"
            name={`nft-spend-${p.nftObjectId}`}
            checked={mode === 'guarded'}
            onChange={() => {
              setMode('guarded')
              writeNftTokenSpendMode('guarded')
            }}
          />
          <span>
            <span className="font-medium text-foreground">NFT + Wallet (Guarded)</span>
            {' — '}
            2FA: Signer = festes Wallet X <em>und</em> gebundenes NFT bei X.
          </span>
        </label>
      </fieldset>
      <p className="rounded border border-border/50 bg-background/40 px-2 py-1 text-[10px] text-foreground/90">
        Aktiv: {nftTokenSpendModeLabel(mode)}
      </p>
      {mode === 'bearer' ? (
        <NftBearerTreasuryPanel nftObjectId={p.nftObjectId} disabled={p.disabled} />
      ) : (
        <NftGuardedPursePanel nftObjectId={p.nftObjectId} disabled={p.disabled} />
      )}
    </div>
  )
}
