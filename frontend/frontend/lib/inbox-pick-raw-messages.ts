/**
 * Inbox: Rohzeilen aus API-Antwort wählen (`data` vs. `messages`).
 * Reine Logik — unabhängig von Message-Mapping (siehe `features/inbox/inbox-map-messages`).
 */

/** API liefert oft `data` und `messages` identisch; niemals leeres `data` gegen volles `messages` tauschen. */
export function pickInboxHasMore(res: { hasMore?: unknown }): boolean {
  return res.hasMore === true
}

export function pickInboxRawMessages(res: { data?: unknown; messages?: unknown }): unknown[] | undefined {
  const d = res.data
  const m = res.messages
  const arrD = Array.isArray(d) ? d : null
  const arrM = Array.isArray(m) ? m : null
  if (arrD && arrD.length > 0) return arrD
  if (arrM && arrM.length > 0) return arrM
  if (arrD) return arrD
  if (arrM) return arrM
  return undefined
}
