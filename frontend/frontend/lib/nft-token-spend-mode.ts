/**
 * Token-Spend-Modus (optional wählbar) — orthogonal zu P4b Seal (Leserecht).
 * Spec: docs/NFT-GUARDED-SPEND-SPEC.md
 *
 * Produkt-UI:
 *   bearer  = nur NFT reicht (Bearer Treasury)
 *   guarded = NFT und Wallet X müssen zusammenpassen (Guarded Purse)
 */

export type NftTokenSpendMode = 'bearer' | 'guarded'

export const NFT_TOKEN_SPEND_MODE_LS_KEY = 'morgendrot.nftTokenSpend.mode.v1'
export const NFT_TOKEN_SPEND_MODE_CHANGED = 'morgendrot:nft-token-spend-mode'

export function readNftTokenSpendMode(): NftTokenSpendMode {
  if (typeof window === 'undefined') return 'guarded'
  try {
    const v = window.localStorage.getItem(NFT_TOKEN_SPEND_MODE_LS_KEY)?.trim()
    if (v === 'bearer' || v === 'guarded') return v
  } catch {
    /* ignore */
  }
  return 'guarded'
}

export function writeNftTokenSpendMode(mode: NftTokenSpendMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NFT_TOKEN_SPEND_MODE_LS_KEY, mode)
    window.dispatchEvent(new Event(NFT_TOKEN_SPEND_MODE_CHANGED))
  } catch {
    /* ignore */
  }
}

export function nftTokenSpendModeLabel(mode: NftTokenSpendMode): string {
  return mode === 'bearer'
    ? 'Nur NFT (Bearer) — wer die Karte hat, darf aus der Treasury'
    : 'NFT + Wallet (Guarded) — nur Wallet X mit Karte aus der Purse'
}
