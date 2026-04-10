import type { Message } from '@/frontend/lib/types'

/**
 * Phase-2 read seam: Posteingang-Filter und Partner-Chips brauchen nur diese Daten,
 * nicht die gesamte Hook-Rückgabe (vgl. MESSENGER-UI-MODULARITY-STRATEGY § Phase 2).
 */
export type InboxFeedReadPort = {
  readonly messages: readonly Message[]
  readonly myAddress: string
}

/** Explizites Objekt für Panel/Toolbar-Spreads (eine Quelle für die Leseschnittstelle). */
export function asInboxFeedRead(messages: readonly Message[], myAddress: string): InboxFeedReadPort {
  return { messages, myAddress }
}
