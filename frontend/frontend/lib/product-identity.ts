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
  hideHandoffImport: false,
  hideEinsatzleitung: false,
  hideEinsatzEnd: false,
  hideFunk: false,
  hideTelegram: false,
  /** Monitor-Sensor-Alarme + Relay (Kanal A) — Morgendrot-Ops. */
  hideTelegramMonitor: false,
  /** Einsatz-Alarmgruppe / Helfer-Join (B4b) — SOS-Team. */
  hideTelegramEinsatzAlarm: false,
  hideSos: false,
  hideShadowSweep: false,
  hideActiveProfile: false,
  hideMeshStatus: false,
  hideBossOnboardingChoices: false,
  /** Header Role-Pill „Boss“ — Morgendrot behält echte Rolle. */
  hideBossRolePill: false,
} as const

/** Schlanker Messenger — Align mit tools/iota-messenger/overlays/product-identity.ts */
const IOTA_MESSENGER_UI_CAPS = {
  hideBossHandoff: true,
  /** Kein Helfer-Handoff — Import-Panel unter Allgemein aus. */
  hideHandoffImport: true,
  hideEinsatzleitung: true,
  hideEinsatzEnd: true,
  /** Kanäle gibt es — Settings-Tabs Funk/Telegram bleiben. */
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
  /** Edition: Pill „Messenger“ statt Boss (weg-Liste §2.2 #1). */
  hideBossRolePill: true,
} as const

export const IOTA_MESSENGER_UI = isIotaMessengerProduct()
  ? IOTA_MESSENGER_UI_CAPS
  : MORGENDROT_UI
