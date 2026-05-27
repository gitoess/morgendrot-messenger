import type { MessengerCapabilitiesOverride } from '@morgendrot/shared/messenger-capabilities-matrix'

export type HandoffCapabilityPresetApply = {
  /** Optional ROLE_ID-Anpassung (zusätzlich zu Basis-Karte). */
  roleId?: number
  override: MessengerCapabilitiesOverride
}

export type HandoffCapabilityPreset = {
  id: string
  label: string
  hint: string
  apply: HandoffCapabilityPresetApply
}

/** Einsatz-Schnellprofile — Transport/Produkt (Runtime-JSON im Handoff). */
export const HANDOFF_CAPABILITY_PRESETS: HandoffCapabilityPreset[] = [
  {
    id: 'medic-funker',
    label: 'Medic-Funker',
    hint: 'LoRa senden · Telegram nur lesen · IOTA aus',
    apply: {
      roleId: 12,
      override: {
        transport: {
          lora: { read: true, write: true },
          telegram: { read: true, write: false },
          iota: { read: false, write: false },
        },
        security: { forceEncryptionOnly: true, allowPlaintextFallback: false },
      },
    },
  },
  {
    id: 'reporter-transport',
    label: 'Reporter (Transport)',
    hint: 'Nur lesen auf allen Kanälen',
    apply: {
      roleId: 12,
      override: {
        transport: {
          lora: { read: true, write: false },
          telegram: { read: true, write: false },
          iota: { read: false, write: false },
          ble: { read: true, write: false },
          streams: { read: true, write: false },
        },
      },
    },
  },
  {
    id: 'funk-only',
    label: 'Nur Funk',
    hint: 'LoRa/BLE schreiben · Telegram/IOTA aus',
    apply: {
      override: {
        transport: {
          lora: { read: true, write: true },
          telegram: { read: false, write: false },
          iota: { read: false, write: false },
          ble: { read: true, write: true },
          streams: { read: true, write: false },
        },
      },
    },
  },
]
