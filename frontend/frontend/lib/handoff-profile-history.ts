/**
 * Letzte Handoff-Imports (nur öffentliche .env-Inhalte) — Profil-Wechsel P2 light.
 * Kein Ersatz für Vault/Seed; Wechsel = erneuter Merge + Seiten-Reload.
 */

import type { HandoffImportSummary } from '@/frontend/lib/api/handoff-env-import'

const LS_KEY = 'morgendrot.handoff.profileHistory'
const MAX = 5

export type HandoffProfileHistoryEntry = {
  id: string
  handoffLabel?: string
  role?: string
  deploymentProfile?: string
  transportProfile?: string
  simpleMode?: boolean
  packageId?: string
  envText: string
  importedAt: number
}

function readRaw(): HandoffProfileHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    return j.filter(
      (e): e is HandoffProfileHistoryEntry =>
        e != null &&
        typeof e === 'object' &&
        typeof (e as HandoffProfileHistoryEntry).id === 'string' &&
        typeof (e as HandoffProfileHistoryEntry).envText === 'string' &&
        typeof (e as HandoffProfileHistoryEntry).importedAt === 'number'
    )
  } catch {
    return []
  }
}

function writeRaw(entries: HandoffProfileHistoryEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, MAX)))
  } catch {
    /* quota */
  }
}

export function fingerprintHandoffEnv(envText: string): string {
  const pkg = /^\s*PACKAGE_ID=(.+)$/m.exec(envText)?.[1]?.trim().toLowerCase() || ''
  const role = /^\s*ROLE=(.+)$/m.exec(envText)?.[1]?.trim().toLowerCase() || ''
  const label =
    /^\s*HANDOFF_LABEL=(.+)$/m.exec(envText)?.[1]?.trim().toLowerCase() ||
    /#\s*Einsatz-Bezeichnung:\s*(.+)$/im.exec(envText)?.[1]?.trim().toLowerCase() ||
    ''
  return `${pkg}|${role}|${label}`.slice(0, 200)
}

export function readHandoffProfileHistory(): HandoffProfileHistoryEntry[] {
  return readRaw().sort((a, b) => b.importedAt - a.importedAt)
}

export function recordHandoffProfileImport(
  envText: string,
  summary?: HandoffImportSummary | null
): HandoffProfileHistoryEntry {
  const id = fingerprintHandoffEnv(envText)
  const packageIdFull = /^\s*PACKAGE_ID=(.+)$/m.exec(envText)?.[1]?.trim()
  const entry: HandoffProfileHistoryEntry = {
    id,
    handoffLabel: summary?.handoffLabel,
    role: summary?.role,
    deploymentProfile: summary?.deploymentProfile,
    transportProfile: summary?.transportProfile,
    simpleMode:
      summary?.simpleMode === 'true' ||
      /^\s*SIMPLE_MODE=true\s*$/im.test(envText),
    packageId: packageIdFull || summary?.packageId,
    envText,
    importedAt: Date.now(),
  }
  const rest = readRaw().filter((e) => e.id !== id)
  writeRaw([entry, ...rest])
  return entry
}

export function findActiveHistoryEntry(
  status: { handoffLabel?: string; role?: string; packageId?: string } | null | undefined
): HandoffProfileHistoryEntry | undefined {
  if (!status) return undefined
  const pkg = (status.packageId || '').trim().toLowerCase()
  const role = (status.role || '').trim().toLowerCase()
  const label = (status.handoffLabel || '').trim().toLowerCase()
  return readRaw().find((e) => {
    const ePkg = (e.packageId || '').trim().toLowerCase()
    const eRole = (e.role || '').trim().toLowerCase()
    const eLabel = (e.handoffLabel || '').trim().toLowerCase()
    if (pkg && ePkg && (pkg === ePkg || pkg.startsWith(ePkg.slice(0, 10)))) return role === eRole
    if (label && eLabel === label && role === eRole) return true
    return false
  })
}
