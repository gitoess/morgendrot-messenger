'use client'

import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ApiStatus } from '@/frontend/lib/api'
import type { Message } from '@/frontend/lib/types'
import type { ForcedTransport, MeshtasticBleSendApi } from '@/frontend/lib/chat-view-messenger-transport'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import type { ComposerDraftSendFlowPort } from '@/frontend/features/messenger-ports'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import type { AppendMeshMessageFn } from '@/frontend/lib/append-mesh-message-fn'

export type { AppendMeshMessageFn } from '@/frontend/lib/append-mesh-message-fn'

export type UseChatViewSendFlowParams = ComposerDraftSendFlowPort & {
  isPrivate: boolean
  encrypted: boolean
  forcedTransport: ForcedTransport
  messagingPersistenceMode: MessagingPersistenceMode
  partner: string
  myAddress: string
  apiStatus: ApiStatus | null
  /** Nach Auto-/connect: connectedAddresses aktualisieren. */
  refreshApiStatus?: () => void | Promise<void>
  attachedLora: ChatAttachedLora | null
  attachedBlobBase64: string | null
  attachedTxtFile: { name: string; text: string } | null
  attachedAudioBase64: string | null
  clearCompactAttachment: () => void
  meshtastic: MeshtasticBleSendApi
  loadMessages: (
    mode?: 'reset' | 'append' | 'poll',
    overridePackageId?: unknown,
    opts?: { silent?: boolean }
  ) => void | Promise<void>
  setMessages: Dispatch<SetStateAction<Message[]>>
  appendMeshMessage: AppendMeshMessageFn
  setSending: (v: boolean) => void
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  setMorgPkgDeviceBusy: (v: boolean) => void
  morgPkgDeviceBusy: boolean
  morgPkgDeviceFilesRef: MutableRefObject<HTMLInputElement | null>
  setLoraOnlineFallbackOffer: (v: { reasonLabel: string } | null) => void
  loraOnlineOfferPayloadRef: MutableRefObject<{ lumaText: string; chromaText: string } | null>
  /** § H.6c: gleiche Quelle wie Export-Gate — `true` = Gerätezeit nicht „high“-vertrauenswürdig. */
  deviceTimeTrustWarn: boolean
  /** Funk: LUMA+CHROMA über Mesh (MORG_SEG_V1). */
  meshLoRaImagesEnabled: boolean
  /** Optional nach Funk: Klartext-Mailbox an eigene Adresse + Attestation. */
  meshSelfArchiveAfterLoRa: boolean
  /** Nur MF1/LoRa: kurze Fortschrittszeile z. B. „Luma 2/5 – Chroma 0/3“ (ohne „Funk:“-Präfix). */
  setMeshProgress?: (line: string | null) => void
  /** Nach Enqueue in die Mailbox-Offline-Warteschlange (§ H.3g 7a): UI-Zähler aktualisieren. */
  onOfflineMailboxQueueChanged?: () => void
  /** Klartext-Funk: an feste Node-ID (!hex) statt Mesh-Broadcast. */
  meshPlaintextToNodeEnabled: boolean
  meshPlaintextNodeId: string
  /** H.3o Schritt 2: optionaler Meshtastic-Kanalindex (0..7), sonst Default-Kanal. */
  meshtasticChannelIndex?: number
  /** § H.25a: Mesh-Klartext für Sender-NAK während Flüchtig-Bild. */
  clearMeshInboundText?: () => void
  drainMeshInboundText?: () => string[]
  contactDirectory: Record<string, ContactMeshEntryClient>
  activeGroup: MessengerGroupDefinition | null
  isGroupChannel: boolean
  /** Kanal-Tab Pinnwand — Klartext erhält `[[MORG_PINNWAND_V1]]`-Marker. */
  isPinnwandChannel?: boolean
  /** Leer = Event; gültige Mailbox-0x = persistent. */
  composerMailboxObjectId?: string
}
