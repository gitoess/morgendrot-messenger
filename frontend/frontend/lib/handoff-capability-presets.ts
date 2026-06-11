import type { MessengerCapabilitiesOverride } from '@morgendrot/shared/messenger-capabilities-matrix'
import type { HandoffEinsatzPresetId } from '@/frontend/lib/handoff-export-presets'
import { getHandoffPreset } from '@/frontend/lib/handoff-export-presets'
import type { HandoffExportTuning } from '@/frontend/lib/handoff-export-params'

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
    id: 'reporter-lora-only',
    label: 'Reporter nur Funk',
    hint: 'LoRa lesen · sonst aus',
    apply: {
      roleId: 12,
      override: {
        transport: {
          lora: { read: true, write: false },
          telegram: { read: false, write: false },
          iota: { read: false, write: false },
          ble: { read: false, write: false },
          streams: { read: false, write: false },
        },
      },
    },
  },
  {
    id: 'reporter-lora-telegram-read',
    label: 'Reporter Funk + Telegram lesen',
    hint: 'LoRa + Telegram lesen · IOTA aus',
    apply: {
      roleId: 12,
      override: {
        transport: {
          lora: { read: true, write: false },
          telegram: { read: true, write: false },
          iota: { read: false, write: false },
          ble: { read: false, write: false },
          streams: { read: false, write: false },
        },
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

/** Im kompakten „Helfer einrichten“ — häufigste Fälle (Rest: Matrix). */
export const WIZARD_CAPABILITY_PRESET_IDS = [
  'medic-funker',
  'reporter-lora-only',
  'reporter-lora-telegram-read',
  'reporter-transport',
] as const

export type WizardCapabilityPresetId = (typeof WIZARD_CAPABILITY_PRESET_IDS)[number]

export function getWizardCapabilityPresets(): HandoffCapabilityPreset[] {
  const allowed = new Set<string>(WIZARD_CAPABILITY_PRESET_IDS)
  return HANDOFF_CAPABILITY_PRESETS.filter((p) => allowed.has(p.id))
}

/** Capability-Schnellprofil auf Basis-Karte anwenden (Wizard + Export-Assistent). */
export function applyHandoffCapabilityPresetToTuning(
  presetId: HandoffEinsatzPresetId,
  currentTuning: HandoffExportTuning,
  cap: HandoffCapabilityPresetApply
): { tuning: HandoffExportTuning; override: MessengerCapabilitiesOverride } {
  const tuning = { ...currentTuning }
  if (cap.roleId != null) {
    const base = getHandoffPreset(presetId).roleId
    if (cap.roleId === base) delete tuning.roleId
    else tuning.roleId = cap.roleId
  }
  return { tuning, override: cap.override }
}
