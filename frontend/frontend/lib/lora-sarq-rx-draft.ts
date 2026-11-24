/**
 * Persistenz unvollständiger LoRa-Bild-Empfang (S-ARQ).
 * Empfänger kann nach Reload per MORG_NAK „fehlende Segmente“ nachfordern —
 * kein neues Wire-Format.
 */

import type { MorgSegV1SessionSnapshot } from '@/frontend/lib/lora-sarq-reassembly'

export const LORA_SARQ_RX_DRAFT_LS = 'morgendrot.loraSarqRxDraft.v1'

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type StoredMap = {
  byPhase: Partial<Record<'luma' | 'chroma', { snap: MorgSegV1SessionSnapshot; savedAt: number }>>
}

export function saveLoraSarqRxDraft(
  snap: MorgSegV1SessionSnapshot | null,
  phase: 'luma' | 'chroma' = snap?.phase ?? 'luma'
): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LORA_SARQ_RX_DRAFT_LS)
    let map: StoredMap = { byPhase: {} }
    if (raw) {
      try {
        map = JSON.parse(raw) as StoredMap
        if (!map.byPhase) map = { byPhase: {} }
      } catch {
        map = { byPhase: {} }
      }
    }
    if (!snap) {
      delete map.byPhase[phase]
    } else {
      map.byPhase[phase] = { snap, savedAt: Date.now() }
    }
    if (Object.keys(map.byPhase).length === 0) {
      window.localStorage.removeItem(LORA_SARQ_RX_DRAFT_LS)
      return
    }
    window.localStorage.setItem(LORA_SARQ_RX_DRAFT_LS, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

export function clearLoraSarqRxDraft(phase?: 'luma' | 'chroma'): void {
  if (phase) saveLoraSarqRxDraft(null, phase)
  else if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LORA_SARQ_RX_DRAFT_LS)
    } catch {
      /* ignore */
    }
  }
}

export function loadLoraSarqRxDraft(phase: 'luma' | 'chroma'): MorgSegV1SessionSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LORA_SARQ_RX_DRAFT_LS)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredMap | { snap: MorgSegV1SessionSnapshot; savedAt: number }
    /** Legacy: einzelnes snap-Objekt */
    if ('snap' in parsed && parsed.snap && !('byPhase' in parsed)) {
      if (parsed.snap.phase !== phase) return null
      const age = Date.now() - (typeof parsed.savedAt === 'number' ? parsed.savedAt : 0)
      if (age > MAX_AGE_MS) {
        clearLoraSarqRxDraft()
        return null
      }
      return parsed.snap
    }
    const entry = (parsed as StoredMap).byPhase?.[phase]
    if (!entry?.snap) return null
    const age = Date.now() - (typeof entry.savedAt === 'number' ? entry.savedAt : 0)
    if (age > MAX_AGE_MS) {
      saveLoraSarqRxDraft(null, phase)
      return null
    }
    return entry.snap
  } catch {
    return null
  }
}
