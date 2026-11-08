'use client'

/**
 * @deprecated UI liegt in `NftTokenSpendPanel` (vereinfachter Flow).
 * Behalten für Imports/Tests die den alten Namen erwarten.
 */

import { NftTokenSpendPanel } from '@/frontend/components/nft-token-spend-panel'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import { writeNftTokenSpendMode } from '@/frontend/lib/nft-token-spend-mode'
import { useEffect } from 'react'

export const NFT_BEARER_TREASURY_PACKAGE_ID_TESTNET = MESSAGING_MODULES_PACKAGE_ID

/** @deprecated → NftTokenSpendPanel */
export function NftBearerTreasuryPanel(p: { nftObjectId: string; disabled?: boolean }) {
  useEffect(() => {
    writeNftTokenSpendMode('bearer')
  }, [])
  return <NftTokenSpendPanel nftObjectId={p.nftObjectId} disabled={p.disabled} />
}
