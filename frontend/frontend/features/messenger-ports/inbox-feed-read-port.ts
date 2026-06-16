import type { Message } from '@/frontend/lib/types'

/**
 * Phase-2 read seam: Posteingang-Filter und Partner-Chips (readonly).
 */
export type InboxFeedReadPort = {
  readonly messages: readonly Message[]
  readonly myAddress: string
}

/** Explizites Objekt für Panel/Toolbar-Spreads (eine Quelle für die Leseschnittstelle). */
export function asInboxFeedRead(messages: readonly Message[], myAddress: string): InboxFeedReadPort {
  return { messages, myAddress }
}
