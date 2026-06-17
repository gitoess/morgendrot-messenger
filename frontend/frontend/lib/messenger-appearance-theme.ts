/**
 * Nutzer-wählbares Erscheinungsbild (Presets) — getrennt von deployment-profile-theme (THW/POL Badge).
 */

export type MessengerAppearanceId = 'standard' | 'tactical' | 'high-contrast' | 'light'

export const MESSENGER_APPEARANCE_STORAGE_KEY = 'morgendrot.appearanceTheme'

export const DEFAULT_MESSENGER_APPEARANCE: MessengerAppearanceId = 'standard'

export type MessengerAppearancePreset = {
  id: MessengerAppearanceId
  label: string
  description: string
  /** Mini-Vorschau für Einstellungen */
  swatches: [string, string, string]
}

export const MESSENGER_APPEARANCE_PRESETS: readonly MessengerAppearancePreset[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'Zivil / Dienst — Blau-Grau mit Morgendrot-Grün (Büro & Feld).',
    swatches: ['#1c2333', '#22c55e', '#64748b'],
  },
  {
    id: 'tactical',
    label: 'Taktisch',
    description: 'NATO/NVG-Nacht — Oliv-Schwarz, Amber-Akzente, kein Blau-Leuchten.',
    swatches: ['#070a04', '#e8a317', '#3d4a28'],
  },
  {
    id: 'high-contrast',
    label: 'Hoher Kontrast',
    description: 'MIL-STD-1472 — Schwarz/Weiß/Gelb für Sonne, Handschuhe, Blendung.',
    swatches: ['#000000', '#ffffff', '#ffff00'],
  },
  {
    id: 'light',
    label: 'Hell',
    description: 'Innenräume und Einsatzleitung am PC.',
    swatches: ['#f4f6fa', '#0e7490', '#059669'],
  },
] as const

/** Semantische Sendepfad-Farben — Preset-übergreifend (light passt in CSS an). */
export const MESSENGER_PATH_SEMANTICS = {
  online: '#22B8E8',
  mesh: '#2DD4A0',
  telegram: '#F59E0B',
  adhoc: '#D97706',
  sos: '#EF4444',
} as const

export type SendPathSemanticKey = keyof typeof MESSENGER_PATH_SEMANTICS

/** Tailwind-freie CSS-Klassen (siehe messenger-appearance.css). */
export const SEND_PATH_ACTIVE_CLASS: Record<SendPathSemanticKey | 'default', string> = {
  online: 'send-path-active send-path-active--online',
  mesh: 'send-path-active send-path-active--mesh',
  telegram: 'send-path-active send-path-active--telegram',
  adhoc: 'send-path-active send-path-active--adhoc',
  sos: 'send-path-active send-path-active--sos',
  default: 'send-path-active send-path-active--online',
}

export function isMessengerAppearanceId(v: string): v is MessengerAppearanceId {
  return (
    v === 'standard' ||
    v === 'tactical' ||
    v === 'high-contrast' ||
    v === 'light'
  )
}

export function readMessengerAppearanceId(): MessengerAppearanceId {
  if (typeof window === 'undefined') return DEFAULT_MESSENGER_APPEARANCE
  try {
    const raw = localStorage.getItem(MESSENGER_APPEARANCE_STORAGE_KEY)
    if (raw && isMessengerAppearanceId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_MESSENGER_APPEARANCE
}

export function applyMessengerAppearance(id: MessengerAppearanceId): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (id === DEFAULT_MESSENGER_APPEARANCE) {
    root.removeAttribute('data-appearance')
  } else {
    root.setAttribute('data-appearance', id)
  }
  root.style.colorScheme = id === 'light' ? 'light' : 'dark'
}

export function persistMessengerAppearance(id: MessengerAppearanceId): void {
  try {
    if (id === DEFAULT_MESSENGER_APPEARANCE) {
      localStorage.removeItem(MESSENGER_APPEARANCE_STORAGE_KEY)
    } else {
      localStorage.setItem(MESSENGER_APPEARANCE_STORAGE_KEY, id)
    }
  } catch {
    /* ignore */
  }
  applyMessengerAppearance(id)
}

export function messengerAppearancePreset(id: MessengerAppearanceId): MessengerAppearancePreset {
  return MESSENGER_APPEARANCE_PRESETS.find((p) => p.id === id) ?? MESSENGER_APPEARANCE_PRESETS[0]
}
