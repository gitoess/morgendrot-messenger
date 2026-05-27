export const HANDOFF_PENDING_INBOX_EVENT = 'morgendrot:handoff-pending-inbox'

export type HandoffZipWireMeta = {
  label?: string
  protected: boolean
  exportedAt: string
  zipByteLength: number
}
