/**
 * Welche Dashboard-Kachel-IDs (`ProjectType`) sichtbar sind — **§ H.17**,
 * **`docs/UI-ROLLEN-WORKSPACES.md`**, **`docs/PRODUCT-MESSENGER-VS-PROJEKT.md`**.
 */

import type { ProjectType } from '@/frontend/lib/types'
import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'

/** Entspricht `WorkspaceTileSet` in `workspace-projects-panel.tsx` (`morgendrot_workspace_tile_set`). */
export type DashboardWorkspaceTileSet = 'full' | 'messenger'

const MESSENGER_CORE_TILE_IDS = new Set<ProjectType>(['chat'])

export function projectTypeVisibleInMessengerWorkspace(
  id: ProjectType,
  p: {
    workspaceTileSet: DashboardWorkspaceTileSet
    liteMessengerFromApi: boolean
    isBossRole: boolean
    role?: string
  }
): boolean {
  if (id === 'einsatzleitung') {
    return canAccessEinsatzleitung(p.role)
  }

  /** Messenger-Produkt (`UI_VARIANT=messenger`): festes Set, kein Umschalten auf Projekt-Kacheln. */
  if (p.liteMessengerFromApi) {
    if (id === 'boss') return p.isBossRole
    return MESSENGER_CORE_TILE_IDS.has(id)
  }

  if (id === 'boss') {
    if ((p.role || '').trim().toLowerCase() !== 'boss') return false
    if (p.workspaceTileSet === 'messenger') return false
    return true
  }

  if (p.workspaceTileSet === 'messenger') {
    return MESSENGER_CORE_TILE_IDS.has(id)
  }

  return true
}

export function filterFeaturesByMessengerWorkspaceTileSet<T extends { id: ProjectType }>(
  items: readonly T[],
  p: { workspaceTileSet: DashboardWorkspaceTileSet; liteMessengerFromApi: boolean; isBossRole: boolean; role?: string }
): T[] {
  return items.filter((row) => projectTypeVisibleInMessengerWorkspace(row.id, p))
}

/**
 * Action Center nur im **Morgendrot Projekt** für Arbeiter/Lock — nicht im Messenger-Produkt.
 */
export function shouldShowWorkerActionCenter(p: {
  role: string
  showAllTiles: boolean
  liteMessengerFromApi: boolean
}): boolean {
  if (p.showAllTiles) return false
  if (p.liteMessengerFromApi) return false
  const r = (p.role || '').trim().toLowerCase()
  return r === 'arbeiter' || r === 'lock'
}
