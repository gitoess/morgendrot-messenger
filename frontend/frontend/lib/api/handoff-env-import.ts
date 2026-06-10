import { getApiBase } from '@/frontend/lib/api/api-base'
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

async function postHandoffEnv(body: {
  envText: string
  runtimeConfigJson?: string
  dryRun: boolean
}): Promise<HandoffImportResponse & { ok: boolean }> {
  const apiBase = getApiBase().trim()
  if (!apiBase) {
    return {
      ok: false,
      error:
        'Keine Basis-URL — auf der Standalone-APK „Lokal vormerken (ohne Basis)“ nutzen, nicht „Import bestätigen“.',
    }
  }
  const fr = await fetchApiText(apiBase, '/api/apply-handoff-env', {
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

export async function applyHandoffEnvImport(envText: string, runtimeConfigJson?: string) {
  return postHandoffEnv({
    envText,
    runtimeConfigJson: runtimeConfigJson?.trim() || undefined,
    dryRun: false,
  })
}
