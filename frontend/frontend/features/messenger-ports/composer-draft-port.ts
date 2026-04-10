/**
 * Phase-2: schmale Naht zwischen Core-State und Send-UI (Empfänger + Nachrichtentext).
 * Sendelogik bleibt in Hooks; das Panel konsumiert nur diese Schnittstelle.
 */
export type ComposerDraftPort = {
  readonly message: string
  readonly recipient: string
  readonly onMessageChange: (v: string) => void
  readonly onRecipientChange: (v: string) => void
}

export function asComposerDraft(
  message: string,
  recipient: string,
  onMessageChange: (v: string) => void,
  onRecipientChange: (v: string) => void
): ComposerDraftPort {
  return { message, recipient, onMessageChange, onRecipientChange }
}

/** Send-Hooks: Empfänger/Nachricht lesen + nur `setMessage` (Empfänger steuert die UI). */
export type ComposerDraftSendFlowPort = Pick<ComposerDraftPort, 'message' | 'recipient'> & {
  setMessage: ComposerDraftPort['onMessageChange']
}
