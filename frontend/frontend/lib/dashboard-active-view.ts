import type { ProjectType, ProjectVariant } from '@/frontend/lib/types'

export type DashboardActiveView = {
  type: ProjectType | 'settings' | 'config'
  variant?: ProjectVariant
}

export const DASHBOARD_ACTIVE_VIEW_SESSION_KEY = 'morgendrot.dashboard.activeView'

export type DashboardFeatureDef = {
  id: ProjectType
  variants: { id: ProjectVariant }[]
}

export function persistDashboardActiveView(v: DashboardActiveView | null) {
  try {
    if (v == null) window.sessionStorage.removeItem(DASHBOARD_ACTIVE_VIEW_SESSION_KEY)
    else window.sessionStorage.setItem(DASHBOARD_ACTIVE_VIEW_SESSION_KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

export function parseDashboardActiveView(
  raw: string | null,
  features: readonly DashboardFeatureDef[]
): DashboardActiveView | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return null
    const o = v as Record<string, unknown>
    if (o.type === 'settings' || o.type === 'config') {
      return { type: o.type }
    }
    /** Tresor-Kachel entfernt — Inhalt liegt unter Einstellungen. */
    if (o.type === 'vault') {
      return { type: 'settings' }
    }
    if (typeof o.type !== 'string' || typeof o.variant !== 'string') return null
    const feat = features.find((f) => f.id === o.type)
    if (!feat) return null
    if (!feat.variants.some((vv) => vv.id === o.variant)) return null
    return { type: o.type as ProjectType, variant: o.variant as ProjectVariant }
  } catch {
    return null
  }
}
