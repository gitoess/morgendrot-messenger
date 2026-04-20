import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'

/** Transport-Card: Verschlüsselung + Sendepfad mit Setter. */
export type SendTransportChoicePort = {
  readonly encrypted: boolean
  readonly onEncryptedChange: (encrypted: boolean) => void
  readonly forcedTransport: ForcedTransport
  readonly onForcedTransportChange: (t: ForcedTransport) => void
  readonly messagingPersistenceMode: MessagingPersistenceMode
  readonly onMessagingPersistenceModeChange: (m: MessagingPersistenceMode) => void
}

/** Send-Panel: nur Lesen von Verschlüsselung und Transport (Umschalter in der Card). */
export type SendTransportReadPort = Pick<SendTransportChoicePort, 'encrypted' | 'forcedTransport'>

/** Delayed-Upload-Marker (Mesh v2 → Empfänger spiegelt) + Pfad-4 „LoRa + eigene Verankerung“ (Klartext-Funk → Mailbox an sich). */
export type SendMeshMirrorDelayPort = {
  readonly delayMirrorToIota: boolean
  readonly onDelayMirrorToIotaChange: (v: boolean) => void
  readonly meshSelfArchiveAfterLoRa: boolean
  readonly onMeshSelfArchiveAfterLoRaChange: (v: boolean) => void
}

export function asSendTransportChoice(
  encrypted: boolean,
  onEncryptedChange: (encrypted: boolean) => void,
  forcedTransport: ForcedTransport,
  onForcedTransportChange: (t: ForcedTransport) => void,
  messagingPersistenceMode: MessagingPersistenceMode,
  onMessagingPersistenceModeChange: (m: MessagingPersistenceMode) => void
): SendTransportChoicePort {
  return {
    encrypted,
    onEncryptedChange,
    forcedTransport,
    onForcedTransportChange,
    messagingPersistenceMode,
    onMessagingPersistenceModeChange,
  }
}

export function asSendTransportRead(
  encrypted: boolean,
  forcedTransport: ForcedTransport
): SendTransportReadPort {
  return { encrypted, forcedTransport }
}

export function asSendMeshMirrorDelay(
  delayMirrorToIota: boolean,
  onDelayMirrorToIotaChange: (v: boolean) => void,
  meshSelfArchiveAfterLoRa: boolean,
  onMeshSelfArchiveAfterLoRaChange: (v: boolean) => void
): SendMeshMirrorDelayPort {
  return {
    delayMirrorToIota,
    onDelayMirrorToIotaChange,
    meshSelfArchiveAfterLoRa,
    onMeshSelfArchiveAfterLoRaChange,
  }
}
