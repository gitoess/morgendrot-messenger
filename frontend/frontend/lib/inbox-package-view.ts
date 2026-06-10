/**
 * Posteingang ↔ Package-ID: Anzeige-Modus (Experten-UI + spätere Multi-Package-Erweiterung).
 *
 * @see docs/INBOX-PACKAGE-EXPERT-MODE.md
 */

import { normalizePackageIdHex } from '@/frontend/lib/package-id-compare'

/** Wie die Package-ID den /inbox-Fetch steuert. */
export type InboxPackageViewMode =
  /** Backend-Default (.env / .morgendrot-package-id) — kein UI-Override. */
  | 'canonical'
  /** Nur diese Session/View: inboxPackageFilter, ohne /set-package-id. */
  | 'temporary'
  /**
   * Vorbereitet: mehrere IDs parallel (Backend-Event-Union oder Side-by-Side-Vergleich).
   * Noch kein UI — Fetch-Schicht akzeptiert künftig `packageIds: string[]`.
   */
  | 'multi_union'

export type InboxPackageViewState = {
  mode: InboxPackageViewMode
  /** Bei temporary: explizite 0x… für fetchInbox. */
  temporaryPackageId?: string | null
  /**
   * Vorbereitet für Vergleichsmodus / parallele Einsätze.
   * @future UI: zwei Spalten oder Union-Toggle pro ID.
   */
  comparePackageIds?: string[]
}

export function resolveInboxFetchPackageId(
  view: InboxPackageViewState,
  serverCanonicalId?: string | null
): string | undefined {
  if (view.mode === 'temporary') {
    const t = normalizePackageIdHex(view.temporaryPackageId ?? undefined)
    if (t) return t
  }
  if (view.mode === 'multi_union' && view.comparePackageIds?.length) {
    const first = normalizePackageIdHex(view.comparePackageIds[0])
    if (first) return first
  }
  const canon = normalizePackageIdHex(serverCanonicalId ?? undefined)
  return canon ?? undefined
}

export function inboxPackageViewFromFilter(
  inboxPackageFilterRaw: string,
  serverCanonicalId?: string | null
): InboxPackageViewState {
  const local = normalizePackageIdHex(inboxPackageFilterRaw)
  const server = normalizePackageIdHex(serverCanonicalId ?? undefined)
  if (local && server && local !== server) {
    return { mode: 'temporary', temporaryPackageId: local }
  }
  if (local && !server) {
    return { mode: 'temporary', temporaryPackageId: local }
  }
  return { mode: 'canonical' }
}

export function isTemporaryInboxPackageView(view: InboxPackageViewState): boolean {
  return view.mode === 'temporary' && Boolean(normalizePackageIdHex(view.temporaryPackageId ?? undefined))
}

/** Kurzlabel für Toolbar (12…8). */
export function maskPackageIdForUi(id: string): string {
  const t = id.trim()
  if (t.length < 22) return t || '—'
  return `${t.slice(0, 10)}…${t.slice(-6)}`
}
