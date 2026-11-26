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
  /** Kein Helfer-Handoff — Einstellungen → Allgemein → Import aus. */
  hideHandoffImport: true,
  hideEinsatzleitung: true,
  /** H.32b — Einsatz-Zyklus; gemerkt Split 2026-11-16 (noch verdrahten wenn Panel außerhalb Einsatzleitung). */
  hideEinsatzEnd: true,
  /** Kanäle Sendepfad Funk/Telegram — Settings-Tabs bleiben. */
  hideFunk: false,
  hideTelegram: false,
  /** Kein Sensor-Monitor / kein Team-SOS über TG-Gruppe. */
  hideTelegramMonitor: true,
  hideTelegramEinsatzAlarm: true,
  hideSos: true,
  hideShadowSweep: true,
  hideActiveProfile: true,
  hideMeshStatus: true,
  hideBossOnboardingChoices: true,
  /** Header: „Messenger“ statt Boss-Pill (Edition §2.2 #1). */
  hideBossRolePill: true,
} as const
