/**
 * Build-Zeit-Produkt (Next `NEXT_PUBLIC_MORG_PRODUCT`).
 * Zwei getrennte Client-Bundles — siehe `docs/PRODUCT-MESSENGER-VS-PROJEKT.md`.
 */
export type MorgProduct = 'messenger' | 'projekt'

export const MORG_PRODUCT: MorgProduct =
  process.env.NEXT_PUBLIC_MORG_PRODUCT === 'messenger' ? 'messenger' : 'projekt'

export function isMessengerProductBuild(): boolean {
  return MORG_PRODUCT === 'messenger'
}

export function isProjektProductBuild(): boolean {
  return MORG_PRODUCT === 'projekt'
}
