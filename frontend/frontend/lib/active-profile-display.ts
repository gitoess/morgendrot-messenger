import type { ApiStatus } from '@/frontend/lib/api/status'
import { roleDisplayDe } from '@/frontend/lib/deployment-profile-theme'

export type ActiveProfileView = {
  titleLine: string
  subtitleLine: string
  roleLabel: string
  handoffLabel?: string
  transportProfile?: string
  deploymentProfile?: string
  simpleMode?: boolean
}

/** Eine Zeile für Badge/Kopfzeile: „THW Einsatz Süd – Arbeiter“. */
export function formatActiveProfileTitle(status: Pick<
  ApiStatus,
  'handoffLabel' | 'role' | 'deploymentProfile'
> | null | undefined): string {
  if (!status) return 'Profil wird geladen…'
  const role = roleDisplayDe(status.role)
  const label = status.handoffLabel?.trim()
  if (label) return `${label} – ${role}`
  if (status.deploymentProfile === 'consumer') return `Privat – ${role}`
  return role
}

export function buildActiveProfileView(
  status: Pick<
    ApiStatus,
    'handoffLabel' | 'role' | 'deploymentProfile' | 'transportProfile' | 'simpleMode'
  > | null | undefined
): ActiveProfileView {
  const roleLabel = roleDisplayDe(status?.role)
  const handoffLabel = status?.handoffLabel?.trim() || undefined
  const transportProfile = status?.transportProfile
  const deploymentProfile = status?.deploymentProfile
  const simpleMode = status?.simpleMode

  let subtitleLine = ''
  if (transportProfile) {
    subtitleLine = transportProfile.replace(/-/g, ' ')
    if (simpleMode != null) subtitleLine += ` · Simple ${simpleMode ? 'an' : 'aus'}`
  }

  return {
    titleLine: formatActiveProfileTitle(status),
    subtitleLine,
    roleLabel,
    handoffLabel,
    transportProfile,
    deploymentProfile,
    simpleMode,
  }
}
