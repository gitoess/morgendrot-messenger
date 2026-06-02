'use client'

import {
  getAutarkyChecklistItems,
  getIotaSubmitMode,
  listDirectIotaSetupGaps,
} from '@/frontend/lib/direct-iota-plain-submit'

const LS_AUTARKY_MODE = 'morgendrot.autarkyMode'

export function isAutarkyModeEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_AUTARKY_MODE) === '1'
  } catch {
    return false
  }
}

/** Kurzzeile für Offline-Karte / Dashboard, wenn Autarkie-Modus an ist. */
export function getAutarkyStatusLine(): string | null {
  if (!isAutarkyModeEnabled()) return null
  const open = getAutarkyChecklistItems().filter((i) => !i.ok)
  if (open.length === 0) {
    return 'Autarkie: Checkliste vollständig — Direkt-RPC ohne Basis nutzbar (RPC + IDs + Signer).'
  }
  return `Autarkie: noch offen — ${open[0]!.label}`
}

/** Alle offenen Direkt-Schritte (Puls-Checkliste). */
export function getDirectIotaSetupGapLabels(): string[] {
  if (typeof window === 'undefined') return []
  if (getIotaSubmitMode() === 'relay') return []
  return listDirectIotaSetupGaps()
}

/** Chat-Kopf / Offline-Karte: Autarkie-Checkliste oder kompakte Direkt-Lücken. */
export function getDirectIotaHeaderStatusLine(): string | null {
  const autarky = getAutarkyStatusLine()
  if (autarky) return autarky
  const gaps = getDirectIotaSetupGapLabels()
  if (gaps.length === 0) return null
  if (gaps.length === 1) return `Direkt: ${gaps[0]} — Puls`
  const first = gaps[0]!
  const short = first.length > 52 ? `${first.slice(0, 49)}…` : first
  return `Direkt: ${gaps.length} offen — z. B. ${short} — Puls`
}
