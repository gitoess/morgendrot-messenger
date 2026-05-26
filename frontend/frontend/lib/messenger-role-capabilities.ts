import type { ApiStatus } from '@/frontend/lib/api/status'

/** Team-Mailbox on-chain erstellen — nur Einsatz + teamManage (Kommandant/Boss). */
export function canCreateTeamMailbox(status: ApiStatus | null | undefined): boolean {
  if (!status) return false
  if (status.deploymentProfile === 'consumer') return false
  return Boolean(status.permissions?.teamManage)
}

/** Einsatz-Rollen-Vorlagen in Einstellungen anzeigen (Lesen für Kommandant, Schreiben nur Boss). */
export function canViewEinsatzRoleTemplatesSection(status: ApiStatus | null | undefined): boolean {
  if (!status) return false
  if (status.backendOnline !== true && status.backendRunning !== true) return false
  if (status.deploymentProfile !== 'einsatz') return false
  const role = (status.role || '').trim().toLowerCase()
  return role === 'boss' || role === 'kommandant'
}

/** Vorlagen speichern — nur Boss mit configChange. */
export function canEditEinsatzRoleTemplates(status: ApiStatus | null | undefined): boolean {
  if (!canViewEinsatzRoleTemplatesSection(status)) return false
  return Boolean(status?.permissions?.configChange)
}
