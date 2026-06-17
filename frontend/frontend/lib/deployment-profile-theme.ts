/** Visuelles Einsatz-Profil (P0/P1) — Keyword aus HANDOFF_LABEL + Rolle, kein Multi-Account. */

import type { ApiStatus } from '@/frontend/lib/api/status'

export type DeploymentThemeId =
  | 'thw'
  | 'polizei'
  | 'feuerwehr'
  | 'wanderer'
  | 'consumer'
  | 'boss'
  | 'einsatz'
  | 'default'

export type DeploymentProfileTheme = {
  id: DeploymentThemeId
  /** Kurz für Wasserzeichen (z. B. THW). */
  watermark: string
  label: string
  /** Tailwind-Klassen für Badge-Rand/Hintergrund. */
  badgeClass: string
  /** Dezenter Seitenhintergrund (Gradient). */
  backdropClass: string
  accentVar: string
}

const THEMES: Record<DeploymentThemeId, DeploymentProfileTheme> = {
  thw: {
    id: 'thw',
    watermark: 'THW',
    label: 'THW',
    badgeClass: 'border-orange-500/45 bg-orange-500/12 text-orange-950 dark:text-orange-100',
    backdropClass: 'from-orange-500/[0.07] via-background to-background',
    accentVar: 'orange',
  },
  polizei: {
    id: 'polizei',
    watermark: 'POL',
    label: 'Polizei',
    badgeClass: 'border-blue-600/45 bg-blue-600/12 text-blue-950 dark:text-blue-100',
    backdropClass: 'from-blue-600/[0.08] via-background to-background',
    accentVar: 'blue',
  },
  feuerwehr: {
    id: 'feuerwehr',
    watermark: 'FW',
    label: 'Feuerwehr',
    badgeClass: 'border-red-600/45 bg-red-600/12 text-red-950 dark:text-red-100',
    backdropClass: 'from-red-600/[0.07] via-background to-background',
    accentVar: 'red',
  },
  wanderer: {
    id: 'wanderer',
    watermark: 'WEG',
    label: 'Wanderer',
    badgeClass: 'border-emerald-600/45 bg-emerald-600/12 text-emerald-950 dark:text-emerald-100',
    backdropClass: 'from-emerald-600/[0.08] via-background to-background',
    accentVar: 'emerald',
  },
  consumer: {
    id: 'consumer',
    watermark: 'PRIVAT',
    label: 'Privat',
    badgeClass: 'border-teal-600/40 bg-teal-600/10 text-teal-950 dark:text-teal-100',
    backdropClass: 'from-teal-600/[0.06] via-background to-background',
    accentVar: 'teal',
  },
  boss: {
    id: 'boss',
    watermark: 'BOSS',
    label: 'Einsatzleitung',
    badgeClass:
      'border-violet-600/60 bg-violet-100 text-violet-950 dark:border-violet-400/55 dark:bg-violet-950/90 dark:text-violet-50',
    backdropClass: 'from-violet-600/[0.07] via-background to-background',
    accentVar: 'violet',
  },
  einsatz: {
    id: 'einsatz',
    watermark: 'EINSATZ',
    label: 'Einsatz',
    badgeClass: 'border-sky-600/40 bg-sky-600/10 text-sky-950 dark:text-sky-100',
    backdropClass: 'from-sky-600/[0.06] via-background to-background',
    accentVar: 'sky',
  },
  default: {
    id: 'default',
    watermark: 'MORG',
    label: 'Morgendrot',
    badgeClass: 'border-border bg-muted/40 text-foreground',
    backdropClass: 'from-muted/20 via-background to-background',
    accentVar: 'muted',
  },
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** Theme aus Bezeichnung (THW, Polizei BW, …) und Status ableiten. */
export function resolveDeploymentProfileTheme(status: Pick<
  ApiStatus,
  'handoffLabel' | 'role' | 'deploymentProfile' | 'transportProfile'
> | null | undefined): DeploymentProfileTheme {
  if (!status) return THEMES.default
  const label = norm(status.handoffLabel || '')
  const role = norm(status.role || '')

  if (/\bthw\b|technisches hilfswerk/.test(label)) return THEMES.thw
  if (/polizei|\bbw\b|landespolizei/.test(label)) return THEMES.polizei
  if (/feuerwehr|\bfw\b|brand/i.test(label)) return THEMES.feuerwehr
  if (/wanderer|trekking|berg/i.test(label)) return THEMES.wanderer

  if (role === 'boss') return THEMES.boss
  if (status.deploymentProfile === 'consumer') return THEMES.consumer
  if (role === 'arbeiter' || role === 'kommandant' || role === 'messenger') return THEMES.einsatz
  if (label) return THEMES.einsatz

  return THEMES.default
}

export function roleDisplayDe(role?: string): string {
  const r = norm(role || '')
  if (r === 'arbeiter') return 'Arbeiter'
  if (r === 'kommandant') return 'Kommandant'
  if (r === 'boss') return 'Boss'
  if (r === 'messenger') return 'Helfer'
  if (r === 'waerter') return 'Wächter'
  if (r === 'lock') return 'Schloss'
  if (r === 'monitor') return 'Monitor'
  return role?.trim() || '—'
}
