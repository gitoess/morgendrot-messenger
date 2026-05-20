/** sessionStorage-Keys für Posteingangs-Anzeige (Filter, ausgeblendete Zeilen). */

export const MESH_INBOX_ONLY_LS = 'morg.inbox.meshTransportOnly.v1'
export const INBOX_WIRE_FILTER_LS = 'morg.inbox.wireFilter.v1'
export const IOTA_INBOX_ONLY_LS = 'morg.inbox.iotaTransportOnly.v1'
export const INBOX_HIDDEN_IDS_LS = 'morg.inbox.hidden.ids'
export const INBOX_PARTNER_MEMORY_LS = 'morg.inbox.partnerMemory.v1'
export const INBOX_PARTNER_MEMORY_BLOCKED_LS = 'morg.inbox.partnerMemoryBlocked.v1'

export const INBOX_FILTERS_CLEARED_EVENT = 'morg:inbox-filters-cleared'

/** Setzt Browser-Filter zurück (nach „Cache leeren“ oder wenn der Posteingang leer wirkt). */
export function clearInboxBrowserViewFilters(): void {
  if (typeof window === 'undefined') return
  try {
    for (const k of [
      MESH_INBOX_ONLY_LS,
      INBOX_WIRE_FILTER_LS,
      IOTA_INBOX_ONLY_LS,
      INBOX_HIDDEN_IDS_LS,
      'morg.protokoll.marked.ids',
    ]) {
      sessionStorage.removeItem(k)
    }
    window.dispatchEvent(new CustomEvent(INBOX_FILTERS_CLEARED_EVENT))
  } catch {
    /* ignore */
  }
}
