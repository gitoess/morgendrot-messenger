/** Posteingang-Aktionen, die nur in main-content verdrahtet sind (P5b). */
export type InboxPanelLocalActionsPort = {
  readonly onAddSenderToContactBook: (address: string) => void
  readonly onSarqNakWire: (wire: string) => void | Promise<void>
}

export function asInboxPanelLocalActions(
  actions: InboxPanelLocalActionsPort
): InboxPanelLocalActionsPort {
  return actions
}
