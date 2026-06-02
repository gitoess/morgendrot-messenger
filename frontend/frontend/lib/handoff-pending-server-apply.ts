'use client'

import { HANDOFF_DRAFT_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'

export const HANDOFF_IMPORT_DRAFT_KEY = 'morgendrot.handoffImportDraft.v1'

export type HandoffImportDraft = {
  savedAtMs: number
  envText: string
  runtimeConfigText: string | null
}

export function readHandoffImportDraft(): HandoffImportDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(HANDOFF_IMPORT_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<HandoffImportDraft>
    const savedAtMs = Number(parsed.savedAtMs ?? 0)
    const envText = typeof parsed.envText === 'string' ? parsed.envText : ''
    const runtimeConfigText = typeof parsed.runtimeConfigText === 'string' ? parsed.runtimeConfigText : null
    const ageMs = Date.now() - savedAtMs
    if (
      !Number.isFinite(savedAtMs) ||
      savedAtMs <= 0 ||
      !Number.isFinite(ageMs) ||
      ageMs < 0 ||
      ageMs > HANDOFF_DRAFT_TTL_MS ||
      !envText.trim()
    ) {
      return null
    }
    return { savedAtMs, envText, runtimeConfigText }
  } catch {
    return null
  }
}

/** Lokales Vormerken aktiv — endgültiges Apply über Basis steht noch aus. */
export function hasLocalHandoffPendingServerApply(): boolean {
  return readLocalHandoffAppliedSnapshot() != null
}
