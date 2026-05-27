import type { HandoffEinsatzPresetId } from '@/frontend/lib/handoff-export-presets'

export type HandoffPresetVisual = {
  activeRing: string
  activeBg: string
  idleBorder: string
  chipHint: string
  emoji: string
}

export const HANDOFF_PRESET_VISUAL: Record<HandoffEinsatzPresetId, HandoffPresetVisual> = {
  helfer: {
    activeRing: 'ring-emerald-500/55',
    activeBg: 'bg-emerald-500/12 border-emerald-500/45',
    idleBorder: 'border-border hover:border-emerald-500/35',
    chipHint: 'Standard · Simple · Funk',
    emoji: '🟢',
  },
  fuehrer: {
    activeRing: 'ring-violet-500/55',
    activeBg: 'bg-violet-500/12 border-violet-500/45',
    idleBorder: 'border-border hover:border-violet-500/35',
    chipHint: 'Gruppenleitung · mehr Rechte',
    emoji: '🟣',
  },
  spezial: {
    activeRing: 'ring-amber-500/55',
    activeBg: 'bg-amber-500/12 border-amber-500/45',
    idleBorder: 'border-border hover:border-amber-500/35',
    chipHint: 'Reporter · ROLE_ID fein',
    emoji: '🟠',
  },
}

export function handoffPresetPanelBorder(presetId: HandoffEinsatzPresetId): string {
  return HANDOFF_PRESET_VISUAL[presetId].activeBg.split(' ').find((c) => c.startsWith('border-')) ?? 'border-border'
}
