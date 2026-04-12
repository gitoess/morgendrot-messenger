'use client'

/** Optionen für `handleSend` (Messenger-Composer → `useChatViewHandleSend`). */
export type ChatSendHandleOptions = {
  /** SOS: Klartext mit `MORG_EMERGENCY_V1`-Marker (vor Verschlüsselung / Mesh v2). */
  emergencyWire?: 'text' | 'voice'
}
