/**
 * Welche Dashboard-Kachel-IDs (`ProjectType`) bei gegebenem Arbeitsbereich sichtbar sind — **§ H.17**,
 * **`docs/UI-ROLLEN-WORKSPACES.md`** §6. Reine Logik (kein React), für Tests und **`dashboard.tsx`**.
 */

import type { ProjectType } from '@/frontend/lib/types'

/** Entspricht `WorkspaceTileSet` in `workspace-projects-panel.tsx` (`morgendrot_workspace_tile_set`). */
export type DashboardWorkspaceTileSet = 'full' | 'messenger'

const MESSENGER_SLIM_TILE_IDS = new Set<ProjectType>(['chat', 'vault'])
const MESSENGER_BOSS_FULL_TILE_IDS = new Set<ProjectType>(['chat', 'vault', 'boss'])

export function projectTypeVisibleInMessengerWorkspace(
  id: ProjectType,
  p: {
    workspaceTileSet: DashboardWorkspaceTileSet
    liteMessengerFromApi: boolean
    isBossRole: boolean
  }
): boolean {
  if (p.workspaceTileSet === 'messenger') return MESSENGER_SLIM_TILE_IDS.has(id)
  if (p.liteMessengerFromApi && p.isBossRole) return MESSENGER_BOSS_FULL_TILE_IDS.has(id)
  return true
}

export function filterFeaturesByMessengerWorkspaceTileSet<T extends { id: ProjectType }>(
  items: readonly T[],
  p: { workspaceTileSet: DashboardWorkspaceTileSet; liteMessengerFromApi: boolean; isBossRole: boolean }
): T[] {
  return items.filter((row) => projectTypeVisibleInMessengerWorkspace(row.id, p))
}
