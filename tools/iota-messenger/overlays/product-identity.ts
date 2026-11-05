/**
 * IOTA Messenger — Produkt-Identität (unabhängiges Projekt, Phase 1).
 * Kein Boss / Helfer / Handoff — nur Wallet, Mailbox-Chat, Gruppen, IOTA-Transfer.
 */
export const PRODUCT_ID = 'iota-messenger' as const
export const PRODUCT_DISPLAY_NAME = 'IOTA Messenger'

/** Im iota-messenger-Repo immer true — separates Produkt, nicht Morgendrot-Edition. */
export function isIotaMessengerProduct(): boolean {
  return true
}

export const IOTA_MESSENGER_UI = {
  hideBossHandoff: true,
  hideEinsatzleitung: true,
  hideFunk: true,
  hideTelegram: true,
  hideSos: true,
  hideShadowSweep: true,
  hideActiveProfile: true,
  hideMeshStatus: true,
  hideBossOnboardingChoices: true,
} as const
