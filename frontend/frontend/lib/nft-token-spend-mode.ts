/**
 * Token-Spend-Modus — orthogonal zu P4b Seal (Leserecht).
 * Spec: docs/NFT-GUARDED-SPEND-SPEC.md
 *
 *   guarded = NFT + Wallet (Guarded Purse)
 *   bearer  = nur NFT reicht (Bearer Treasury)
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

/** Hybrid-Label: Fachname + Alltagssprache. */
export function nftTokenSpendModeLabel(mode: NftTokenSpendMode): string {
  return mode === 'bearer'
    ? 'Bearer (nur NFT reicht) — wer die Karte hat, darf auszahlen'
    : 'Guarded (NFT + Wallet) — nur du, Karte muss bei dir liegen'
}

export function nftTokenSpendModeOptionLabel(mode: NftTokenSpendMode): string {
  return mode === 'bearer'
    ? 'Bearer (nur NFT reicht) — Recht wandert mit der Karte'
    : 'Guarded (NFT + Wallet) — nur du mit Karte bei dir'
}
