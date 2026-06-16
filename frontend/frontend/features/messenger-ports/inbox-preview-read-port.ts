import type { Message } from '@/frontend/lib/types'

/** Pinnwand-Vorschau im Posteingang (max. 3 Nachrichten, P8). */
export type InboxPreviewReadPort = {
  readonly pinnwandStripMessages: readonly Message[]
}

export function asInboxPreviewRead(messages: readonly Message[]): InboxPreviewReadPort {
  return { pinnwandStripMessages: messages }
}
