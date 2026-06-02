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

/** Chat-Kopf / Offline-Karte: Autarkie-Checkliste oder kompakte Direkt-Lücken. */
export function getDirectIotaHeaderStatusLine(): string | null {
  const autarky = getAutarkyStatusLine()
  if (autarky) return autarky
  if (getIotaSubmitMode() === 'relay') return null
  const gaps = listDirectIotaSetupGaps()
  if (gaps.length === 0) return null
  const n = gaps.length
  return `Direkt: ${n} Schritt${n === 1 ? '' : 'e'} offen — Puls`
}
