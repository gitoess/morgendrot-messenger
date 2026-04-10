import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

/** Transport-Card: Verschlüsselung + Sendepfad mit Setter. */
export type SendTransportChoicePort = {
  readonly encrypted: boolean
  readonly onEncryptedChange: (encrypted: boolean) => void
  readonly forcedTransport: ForcedTransport
  readonly onForcedTransportChange: (t: ForcedTransport) => void
}

/** Send-Panel: nur Lesen von Verschlüsselung und Transport (Umschalter in der Card). */
export type SendTransportReadPort = Pick<SendTransportChoicePort, 'encrypted' | 'forcedTransport'>

/** Delayed-Upload-Marker (Mesh-Klartext → später IOTA). */
export type SendMeshMirrorDelayPort = {
  readonly delayMirrorToIota: boolean
  readonly onDelayMirrorToIotaChange: (v: boolean) => void
}

export function asSendTransportChoice(
  encrypted: boolean,
  onEncryptedChange: (encrypted: boolean) => void,
  forcedTransport: ForcedTransport,
  onForcedTransportChange: (t: ForcedTransport) => void
): SendTransportChoicePort {
  return { encrypted, onEncryptedChange, forcedTransport, onForcedTransportChange }
}

export function asSendTransportRead(
  encrypted: boolean,
  forcedTransport: ForcedTransport
): SendTransportReadPort {
  return { encrypted, forcedTransport }
}

export function asSendMeshMirrorDelay(
  delayMirrorToIota: boolean,
  onDelayMirrorToIotaChange: (v: boolean) => void
): SendMeshMirrorDelayPort {
  return { delayMirrorToIota, onDelayMirrorToIotaChange }
}
