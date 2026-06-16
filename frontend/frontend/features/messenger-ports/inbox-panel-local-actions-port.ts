/** Posteingang-Aktionen aus Shell-Orchestration (P7). */
export type InboxPanelLocalActionsPort = {
  readonly onAddSenderToContactBook: (address: string) => void
  readonly onSarqNakWire: (wire: string) => void | Promise<void>
}

export function asInboxPanelLocalActions(
  actions: InboxPanelLocalActionsPort
): InboxPanelLocalActionsPort {
  return actions
}
