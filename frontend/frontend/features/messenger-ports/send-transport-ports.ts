import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'

/** Transport-Card: Verschlüsselung + Sendepfad mit Setter. */
export type SendTransportChoicePort = {
  readonly encrypted: boolean
  readonly onEncryptedChange: (encrypted: boolean) => void
  readonly forcedTransport: ForcedTransport
  readonly onForcedTransportChange: (t: ForcedTransport) => void
  readonly messagingPersistenceMode: MessagingPersistenceMode
  /** @deprecated Persistenz wird im Composer abgeleitet — optional für Abwärtskompatibilität. */
  readonly onMessagingPersistenceModeChange?: (m: MessagingPersistenceMode) => void
}

/** Send-Panel: nur Lesen von Verschlüsselung und Transport (Umschalter in der Card). */
export type SendTransportReadPort = Pick<SendTransportChoicePort, 'encrypted' | 'forcedTransport'>

/** Funk-Optionen: Bilder über Mesh und optionale Chain-Verankerung (unabhängig). */
export type SendMeshFunkOptionsPort = {
  readonly meshLoRaImagesEnabled: boolean
  readonly onMeshLoRaImagesEnabledChange: (v: boolean) => void
  readonly meshSelfArchiveAfterLoRa: boolean
  readonly onMeshSelfArchiveAfterLoRaChange: (v: boolean) => void
}

/** @deprecated Alias — bitte `SendMeshFunkOptionsPort` / `asSendMeshFunkOptions`. */
export type SendMeshMirrorDelayPort = SendMeshFunkOptionsPort

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

export function asSendMeshFunkOptions(
  meshLoRaImagesEnabled: boolean,
  onMeshLoRaImagesEnabledChange: (v: boolean) => void,
  meshSelfArchiveAfterLoRa: boolean,
  onMeshSelfArchiveAfterLoRaChange: (v: boolean) => void
): SendMeshFunkOptionsPort {
  return {
    meshLoRaImagesEnabled,
    onMeshLoRaImagesEnabledChange,
    meshSelfArchiveAfterLoRa,
    onMeshSelfArchiveAfterLoRaChange,
  }
}

/** @deprecated Alias — bitte `asSendMeshFunkOptions`. */
export function asSendMeshMirrorDelay(
  meshSelfArchiveAfterLoRa: boolean,
  onMeshSelfArchiveAfterLoRaChange: (v: boolean) => void
): SendMeshMirrorDelayPort {
  return asSendMeshFunkOptions(false, () => {}, meshSelfArchiveAfterLoRa, onMeshSelfArchiveAfterLoRaChange)
}
