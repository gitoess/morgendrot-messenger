import type { Message } from '@/frontend/lib/types'

/**
 * Phase-2 read seam: Posteingang-Filter und Partner-Chips brauchen nur diese Daten,
 * nicht die gesamte Hook-Rückgabe (vgl. MESSENGER-UI-MODULARITY-STRATEGY § Phase 2).
 */
export type InboxFeedReadPort = {
  readonly messages: readonly Message[]
  readonly myAddress: string
}
