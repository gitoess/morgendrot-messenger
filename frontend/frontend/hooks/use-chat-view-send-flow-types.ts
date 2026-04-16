'use client'

import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ApiStatus } from '@/frontend/lib/api'
import type { Message } from '@/frontend/lib/types'
import type { ForcedTransport, MeshtasticBleSendApi } from '@/frontend/lib/chat-view-messenger-transport'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import type { ComposerDraftSendFlowPort } from '@/frontend/features/messenger-ports'

export type UseChatViewSendFlowParams = ComposerDraftSendFlowPort & {
  isPrivate: boolean
  encrypted: boolean
  forcedTransport: ForcedTransport
  partner: string
  myAddress: string
  apiStatus: ApiStatus | null
  attachedLora: ChatAttachedLora | null
  attachedBlobBase64: string | null
  attachedTxtFile: { name: string; text: string } | null
  attachedAudioBase64: string | null
  clearCompactAttachment: () => void
  meshtastic: MeshtasticBleSendApi
  loadMessages: () => void | Promise<void>
  setMessages: Dispatch<SetStateAction<Message[]>>
  setSending: (v: boolean) => void
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  setMorgPkgDeviceBusy: (v: boolean) => void
  setLoraOnlineFallbackOffer: (v: { reasonLabel: string } | null) => void
  loraOnlineOfferPayloadRef: MutableRefObject<{ lumaText: string; chromaText: string } | null>
  /** § H.6c: gleiche Quelle wie Export-Gate — `true` = Gerätezeit nicht „high“-vertrauenswürdig. */
  deviceTimeTrustWarn: boolean
  /** Mesh-Text: vor Versand Marker für Delayed Upload (Empfänger spiegelt per IOTA). */
  delayMirrorToIota: boolean
  /** Optional: nach erfolgreichem Mesh-SOS auf `MORG_SOS_ACK_V1` mit gleichem SHA-256 warten (`morgendrot.sosWaitMeshAckMs`). */
  waitForMeshSosAckDigest?: (digestHex: string, timeoutMs: number) => Promise<boolean>
  /** Nur MF1/LoRa: kurze Fortschrittszeile z. B. „Luma 2/5 – Chroma 0/3“ (ohne „Funk:“-Präfix). */
  setMeshProgress?: (line: string | null) => void
  /** Nach Enqueue in die Mailbox-Offline-Warteschlange (§ H.3g 7a): UI-Zähler aktualisieren. */
  onOfflineMailboxQueueChanged?: () => void
  /** Klartext-Funk: an feste Node-ID (!hex) statt Mesh-Broadcast. */
  meshPlaintextToNodeEnabled: boolean
  meshPlaintextNodeId: string
}
