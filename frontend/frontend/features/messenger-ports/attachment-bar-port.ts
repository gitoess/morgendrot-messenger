import type { ChangeEvent, RefObject } from 'react'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

/** Anhang-Leiste (Datei-Pick, Vorschau, LoRa-Dual, .txt, Opus) — Phase-2 Leseschnittstelle fürs Send-Panel. */
export type AttachmentBarPort = {
  compactFileRef: RefObject<HTMLInputElement | null>
  compactBusy: boolean
  /** z. B. während Blob→LoRa auf dem Server: kurzer Text + Balken (kein Polling). */
  attachmentPipelineHint?: string | null
  sending: boolean
  /** Nur für Shell/Panel-Orchestrierung (z. B. Handshake-Purge). */
  setSending?: (v: boolean) => void
  /** z. B. während Sprachaufnahme / Kodierung */
  pickDisabled?: boolean
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  /** Gleiche Pipeline wie Datei-Import (Bild → Kompakt/LoRa). */
  ingestChatAttachmentFile: (file: File, opts?: { transportOverride?: ForcedTransport }) => Promise<void>
  compactMeta: {
    total: number
    luma: number
    chroma: number
    q: number
    mode?: 'iota' | 'lora'
  } | null
  attachedBlobBase64: string | null
  attachedLora: ChatAttachedLora | null
  attachedTxtFile: { name: string; text: string } | null
  attachedAudioBase64: string | null
  clearCompactAttachment: () => void
  compactPreviewUrl: string | null
  loraPreviewUrl: string | null
  /** Optional: Fortschritt beim LoRa-Bild (z. B. Retries / „Luma … · Chroma …“) — nicht an Mesh-v2-Versand gebunden. */
  loraMeshProgressLine?: string | null
}

export function asAttachmentBar(port: AttachmentBarPort): AttachmentBarPort {
  return port
}
