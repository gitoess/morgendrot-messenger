'use client'

/** Optionen für `handleSend` (Messenger-Composer → `useChatViewHandleSend`). */
export type ChatSendHandleOptions = {
  /** SOS: Klartext mit `MORG_EMERGENCY_V1`-Marker (vor Verschlüsselung / Mesh v2). */
  emergencyWire?: 'text' | 'voice'
  /** Composer-Text für diesen Sendevorgang (z. B. Dashboard-SOS). */
  composerOverride?: string
  /** Dashboard-SOS: Boss/Partner vor dem ersten Composer-Mount setzen. */
  emergencyPartnerOverride?: string
  /**
   * „Nochmals senden“: Toggle „Bilder über Funk“ sofort für diesen Send —
   * sonst Race (setState asynchron) → Fallthrough löscht `attachedLora`.
   */
  forceMeshLoRaImages?: boolean
}
