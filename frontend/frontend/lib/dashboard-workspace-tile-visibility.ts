/**
 * Welche Dashboard-Kachel-IDs (`ProjectType`) bei gegebenem Arbeitsbereich sichtbar sind — **§ H.17**,
 * **`docs/UI-ROLLEN-WORKSPACES.md`** §6. Reine Logik (kein React), für Tests und **`dashboard.tsx`**.
 */

import type { ProjectType } from '@/frontend/lib/types'
import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'

/** Entspricht `WorkspaceTileSet` in `workspace-projects-panel.tsx` (`morgendrot_workspace_tile_set`). */
export type DashboardWorkspaceTileSet = 'full' | 'messenger'

const MESSENGER_CORE_TILE_IDS = new Set<ProjectType>(['chat', 'vault'])
const MESSENGER_BOSS_FULL_TILE_IDS = new Set<ProjectType>(['chat', 'vault', 'boss', 'einsatzleitung'])

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
  if (id === 'boss') {
    if ((p.role || '').trim().toLowerCase() !== 'boss') return false
    if (p.workspaceTileSet === 'messenger') return false
    if (p.liteMessengerFromApi) return p.isBossRole
    return true
  }
  if (p.workspaceTileSet === 'messenger') {
    return MESSENGER_CORE_TILE_IDS.has(id)
  }
  if (p.liteMessengerFromApi && p.isBossRole) return MESSENGER_BOSS_FULL_TILE_IDS.has(id)
  return true
}

export function filterFeaturesByMessengerWorkspaceTileSet<T extends { id: ProjectType }>(
  items: readonly T[],
  p: { workspaceTileSet: DashboardWorkspaceTileSet; liteMessengerFromApi: boolean; isBossRole: boolean; role?: string }
): T[] {
  return items.filter((row) => projectTypeVisibleInMessengerWorkspace(row.id, p))
}

/**
 * „Action Center“ (Heartbeat, Tickets, Keys) nur für Arbeiter/Lock im **Volldashboard** —
 * nicht bei `UI_VARIANT=messenger` (Helfer-Paket: Start = Nachrichten + Tresor).
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
