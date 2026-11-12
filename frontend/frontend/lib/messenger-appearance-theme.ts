/**
 * Nutzer-wählbares Erscheinungsbild — Presets: Standard + Hell; optional eigene Farben.
 * Getrennt von deployment-profile-theme (THW/POL Badge).
 */

export type MessengerAppearanceId = 'standard' | 'light'

export const MESSENGER_APPEARANCE_STORAGE_KEY = 'morgendrot.appearanceTheme'
export const MESSENGER_APPEARANCE_CUSTOM_KEY = 'morgendrot.appearanceCustom.v1'

export const DEFAULT_MESSENGER_APPEARANCE: MessengerAppearanceId = 'standard'

export type CustomAppearanceColors = {
  background: string
  primary: string
  accent: string
  border: string
  pathOnline: string
  pathMesh: string
  pathTelegram: string
  borderWidth: 'thin' | 'default' | 'thick'
}

/** Standard-Preset-Werte — Grundlage für Custom-Defaults. */
export const DEFAULT_CUSTOM_APPEARANCE: CustomAppearanceColors = {
  background: '#1c2333',
  primary: '#22c55e',
  accent: '#334155',
  border: '#475569',
  pathOnline: '#22b8e8',
  pathMesh: '#2dd4a0',
  pathTelegram: '#f59e0b',
  borderWidth: 'default',
}

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
    description: 'Zivil / Dienst — Blau-Grau mit Morgendrot-Grün.',
    swatches: ['#1c2333', '#22c55e', '#64748b'],
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
  iota: '#3B82F6',
  sos: '#EF4444',
} as const

export type SendPathSemanticKey = keyof typeof MESSENGER_PATH_SEMANTICS

/** Tailwind-freie CSS-Klassen (siehe messenger-appearance.css). */
export const SEND_PATH_ACTIVE_CLASS: Record<SendPathSemanticKey | 'default', string> = {
  online: 'send-path-active send-path-active--online',
  mesh: 'send-path-active send-path-active--mesh',
  telegram: 'send-path-active send-path-active--telegram',
  adhoc: 'send-path-active send-path-active--adhoc',
  iota: 'send-path-active send-path-active--iota',
  sos: 'send-path-active send-path-active--sos',
  default: 'send-path-active send-path-active--online',
}

export function isMessengerAppearanceId(v: string): v is MessengerAppearanceId {
  return v === 'standard' || v === 'light'
}

/** Alte Presets (Taktisch / Hoher Kontrast) → Standard. */
export function normalizeMessengerAppearanceId(raw: string | null | undefined): MessengerAppearanceId {
  if (!raw) return DEFAULT_MESSENGER_APPEARANCE
  if (isMessengerAppearanceId(raw)) return raw
  if (raw === 'tactical' || raw === 'high-contrast') return DEFAULT_MESSENGER_APPEARANCE
  return DEFAULT_MESSENGER_APPEARANCE
}

export function readCustomAppearanceEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(MESSENGER_APPEARANCE_CUSTOM_KEY + '.enabled') === '1'
  } catch {
    return false
  }
}

export function readCustomAppearanceColors(): CustomAppearanceColors {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_APPEARANCE
  try {
    const raw = localStorage.getItem(MESSENGER_APPEARANCE_CUSTOM_KEY)
    if (!raw) return DEFAULT_CUSTOM_APPEARANCE
    const o = JSON.parse(raw) as Partial<CustomAppearanceColors>
    return { ...DEFAULT_CUSTOM_APPEARANCE, ...o }
  } catch {
    return DEFAULT_CUSTOM_APPEARANCE
  }
}

export function persistCustomAppearance(enabled: boolean, colors?: CustomAppearanceColors): void {
  try {
    if (enabled) {
      localStorage.setItem(MESSENGER_APPEARANCE_CUSTOM_KEY + '.enabled', '1')
      if (colors) localStorage.setItem(MESSENGER_APPEARANCE_CUSTOM_KEY, JSON.stringify(colors))
    } else {
      localStorage.removeItem(MESSENGER_APPEARANCE_CUSTOM_KEY + '.enabled')
    }
  } catch {
    /* ignore */
  }
  applyMessengerAppearance(readMessengerAppearanceId())
}

function applyCustomAppearanceCss(colors: CustomAppearanceColors): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-appearance', 'custom')
  root.style.setProperty('--background', colors.background)
  root.style.setProperty('--foreground', '#f1f5f9')
  root.style.setProperty('--card', colors.background)
  root.style.setProperty('--card-foreground', '#f1f5f9')
  root.style.setProperty('--primary', colors.primary)
  root.style.setProperty('--primary-foreground', '#0f172a')
  root.style.setProperty('--accent', colors.accent)
  root.style.setProperty('--accent-foreground', '#f1f5f9')
  root.style.setProperty('--border', colors.border)
  root.style.setProperty('--input', colors.accent)
  root.style.setProperty('--ring', colors.primary)
  root.style.setProperty('--muted', colors.accent)
  root.style.setProperty('--muted-foreground', '#94a3b8')
  root.style.setProperty('--path-online', colors.pathOnline)
  root.style.setProperty('--path-mesh', colors.pathMesh)
  root.style.setProperty('--path-telegram', colors.pathTelegram)
  const bw = colors.borderWidth === 'thin' ? '1px' : colors.borderWidth === 'thick' ? '3px' : '2px'
  root.style.setProperty('--settings-border-width', bw)
  root.style.colorScheme = 'dark'
}

export function clearCustomAppearanceCss(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const vars = [
    '--background',
    '--foreground',
    '--card',
    '--card-foreground',
    '--primary',
    '--primary-foreground',
    '--accent',
    '--accent-foreground',
    '--border',
    '--input',
    '--ring',
    '--muted',
    '--muted-foreground',
    '--path-online',
    '--path-mesh',
    '--path-telegram',
    '--settings-border-width',
  ]
  for (const v of vars) root.style.removeProperty(v)
}

export function readMessengerAppearanceId(): MessengerAppearanceId {
  if (typeof window === 'undefined') return DEFAULT_MESSENGER_APPEARANCE
  try {
    const raw = localStorage.getItem(MESSENGER_APPEARANCE_STORAGE_KEY)
    const id = normalizeMessengerAppearanceId(raw)
    if (raw && raw !== id) {
      try {
        if (id === DEFAULT_MESSENGER_APPEARANCE) localStorage.removeItem(MESSENGER_APPEARANCE_STORAGE_KEY)
        else localStorage.setItem(MESSENGER_APPEARANCE_STORAGE_KEY, id)
      } catch {
        /* ignore */
      }
    }
    return id
  } catch {
    return DEFAULT_MESSENGER_APPEARANCE
  }
}

export function applyMessengerAppearance(id: MessengerAppearanceId): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (readCustomAppearanceEnabled()) {
    applyCustomAppearanceCss(readCustomAppearanceColors())
    return
  }
  clearCustomAppearanceCss()
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
