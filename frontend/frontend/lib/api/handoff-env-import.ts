import { API_BASE } from '@/frontend/lib/api/api-base'
import { fetchApiText } from '@/frontend/lib/api-fetch-text'

export type HandoffImportSummary = {
  handoffLabel?: string
  role?: string
  deploymentProfile?: string
  transportProfile?: string
  simpleMode?: string
  uiVariant?: string
  packageId?: string
  bossAddress?: string
  partnerPreview?: string
  teamMailboxIds?: string
  mailboxId?: string
  rpcUrl?: string
  keysInFile: number
  keysToApply: number
  skippedKeys: string[]
  pskHint: string
}

type HandoffImportResponse = {
  ok?: boolean
  error?: string
  errors?: string[]
  summary?: HandoffImportSummary
  applied?: string[]
  requiresRestart?: boolean
  requiresPageReload?: boolean
}

async function postHandoffEnv(body: { envText: string; dryRun: boolean }): Promise<HandoffImportResponse & { ok: boolean }> {
  const fr = await fetchApiText(API_BASE, '/api/apply-handoff-env', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!fr.ok) return { ok: false, error: fr.error }
  try {
    const j = JSON.parse(fr.text) as HandoffImportResponse
    return { ...j, ok: j.ok === true }
  } catch {
    return { ok: false, error: 'Ungültige API-Antwort' }
  }
}

export async function previewHandoffEnvImport(envText: string) {
  return postHandoffEnv({ envText, dryRun: true })
}

export async function applyHandoffEnvImport(envText: string) {
  return postHandoffEnv({ envText, dryRun: false })
}
