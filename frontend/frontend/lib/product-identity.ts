/**
 * Produkt-Identität / UI-Caps.
 * Morgendrot-Default: alles sichtbar.
 * IOTA-Messenger: `NEXT_PUBLIC_PRODUCT_ID=iota-messenger` (oder Bootstrap überschreibt diese Datei).
 * @see tools/iota-messenger/overlays/product-identity.ts
 */

export const PRODUCT_ID =
  process.env.NEXT_PUBLIC_PRODUCT_ID === 'iota-messenger' ? 'iota-messenger' : 'morgendrot'

export const PRODUCT_DISPLAY_NAME =
  PRODUCT_ID === 'iota-messenger' ? 'IOTA Messenger' : 'Morgendrot'

export function isIotaMessengerProduct(): boolean {
  return PRODUCT_ID === 'iota-messenger'
}

const MORGENDROT_UI = {
  hideBossHandoff: false,
  hideEinsatzleitung: false,
  hideEinsatzEnd: false,
  hideFunk: false,
  hideTelegram: false,
  hideSos: false,
  hideShadowSweep: false,
  hideActiveProfile: false,
  hideMeshStatus: false,
  hideBossOnboardingChoices: false,
} as const

/** Schlanker Messenger — Align mit tools/iota-messenger/overlays/product-identity.ts */
const IOTA_MESSENGER_UI_CAPS = {
  hideBossHandoff: true,
  hideEinsatzleitung: true,
  hideEinsatzEnd: true,
  hideFunk: true,
  hideTelegram: true,
  hideSos: true,
  hideShadowSweep: true,
  hideActiveProfile: true,
  hideMeshStatus: true,
  hideBossOnboardingChoices: true,
} as const

export const IOTA_MESSENGER_UI = isIotaMessengerProduct()
  ? IOTA_MESSENGER_UI_CAPS
  : MORGENDROT_UI
