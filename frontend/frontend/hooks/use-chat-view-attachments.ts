'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { isLoRaMeshTransport, type ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { ingestCompactAttachmentPick } from '@/frontend/features/attachments/chat-view-attachment-ingest'
import type { CompactAttachmentMeta } from '@/frontend/features/attachments/chat-view-attachment-ingest'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import { useChatViewAttachmentPreviews } from '@/frontend/hooks/use-chat-view-attachment-previews'
import { loraProgressiveFromCompactBlob } from '@/frontend/lib/api/media'

export type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'

export type UseChatViewAttachmentsParams = {
  role: string
  isPrivate: boolean
  encrypted: boolean
  forcedTransport: ForcedTransport
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  /** Vor jedem neuen Import (SOS-Banner o. Ä. zurücksetzen). */
  onCompactIngestStart?: () => void
}

export function useChatViewAttachments(p: UseChatViewAttachmentsParams) {
  const { role, isPrivate, encrypted, forcedTransport, setStatus, setStatusMsg, onCompactIngestStart } = p

  const [attachedBlobBase64, setAttachedBlobBase64] = useState<string | null>(null)
  const [attachedTxtFile, setAttachedTxtFile] = useState<{ name: string; text: string } | null>(null)
  const [attachedAudioBase64, setAttachedAudioBase64] = useState<string | null>(null)
  const [attachedLora, setAttachedLora] = useState<ChatAttachedLora | null>(null)
  const [compactMeta, setCompactMeta] = useState<CompactAttachmentMeta | null>(null)
  const [loraOnlineFallbackOffer, setLoraOnlineFallbackOffer] = useState<{ reasonLabel: string } | null>(
    null
  )
  const loraOnlineOfferPayloadRef = useRef<{ lumaText: string; chromaText: string } | null>(null)
  const [compactBusy, setCompactBusy] = useState(false)
  const compactFileRef = useRef<HTMLInputElement>(null)

  const { compactPreviewUrl, loraPreviewUrl } = useChatViewAttachmentPreviews(
    attachedBlobBase64,
    attachedLora
  )

  /** Privater Chat + verschlüsselt + „funk“: IOTA-Kompakt-Blob automatisch in LUMA+CHROMA (nach Online-Anhang oder Wechsel des Transports). */
  useEffect(() => {
    if (!isPrivate || !encrypted || !isLoRaMeshTransport(forcedTransport)) return
    if (!attachedBlobBase64 || attachedLora != null) return
    let cancelled = false
    setCompactBusy(true)
    setStatus('idle')
    setStatusMsg('Funk: IOTA-Bild wird für LoRa (LUMA+CHROMA) umgewandelt…')
    void (async () => {
      try {
        const enc = await loraProgressiveFromCompactBlob(attachedBlobBase64)
        if (cancelled) return
        if (!enc.ok || !enc.lumaWire || !enc.chromaWire) {
          setAttachedBlobBase64(null)
          setCompactMeta(null)
          setStatus('error')
          setStatusMsg(
            enc.error ||
              'LoRa-Umwandlung fehlgeschlagen (/api/compact-blob-to-lora-wires). Backend (Sharp) und Logs prüfen.'
          )
          setTimeout(() => setStatus('idle'), 9000)
          return
        }
        const lora: ChatAttachedLora = {
          lumaWire: enc.lumaWire,
          chromaWire: enc.chromaWire,
          messageId: enc.messageId ?? '',
          lumaJpegBytes: enc.lumaJpegBytes ?? 0,
          chromaJpegBytes: enc.chromaJpegBytes ?? 0,
        }
        setAttachedBlobBase64(null)
        setAttachedLora(lora)
        setCompactMeta({
          total: (enc.lumaJpegBytes ?? 0) + (enc.chromaJpegBytes ?? 0),
          luma: enc.lumaJpegBytes ?? 0,
          chroma: enc.chromaJpegBytes ?? 0,
          q: 0,
          mode: 'lora',
        })
        setStatus('success')
        setStatusMsg('LoRa-Zweiteiler bereit — jetzt senden.')
        setTimeout(() => setStatus('idle'), 5000)
      } catch (e) {
        if (cancelled) return
        setAttachedBlobBase64(null)
        setCompactMeta(null)
        setStatus('error')
        setStatusMsg(e instanceof Error ? e.message : String(e))
        setTimeout(() => setStatus('idle'), 8000)
      } finally {
        if (!cancelled) setCompactBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isPrivate, encrypted, forcedTransport, attachedBlobBase64, attachedLora, setStatus, setStatusMsg])

  const clearCompactAttachment = useCallback(() => {
    setAttachedBlobBase64(null)
    setAttachedTxtFile(null)
    setAttachedAudioBase64(null)
    setAttachedLora(null)
    setCompactMeta(null)
    setLoraOnlineFallbackOffer(null)
    loraOnlineOfferPayloadRef.current = null
  }, [])

  const ingestChatAttachmentFile = useCallback(
    async (file: File, opts?: { transportOverride?: ForcedTransport }) => {
      onCompactIngestStart?.()
      setLoraOnlineFallbackOffer(null)
      loraOnlineOfferPayloadRef.current = null
      setCompactBusy(true)
      setStatus('idle')
      try {
        const result = await ingestCompactAttachmentPick(file, {
          role,
          forcedTransport,
          transportOverride: opts?.transportOverride,
        })
        if (!result.ok) {
          setStatus('error')
          setStatusMsg(result.message)
          setTimeout(() => setStatus('idle'), result.idleMs ?? 6000)
          return
        }
        setAttachedBlobBase64(result.attachedBlobBase64)
        setAttachedTxtFile(result.attachedTxtFile)
        setAttachedAudioBase64(result.attachedAudioBase64)
        setAttachedLora(result.attachedLora)
        setCompactMeta(result.compactMeta)
        if (result.softWarning) {
          setStatus('success')
          setStatusMsg(result.softWarning)
          setTimeout(() => setStatus('idle'), 6000)
        }
      } catch (err) {
        setStatus('error')
        setStatusMsg(err instanceof Error ? err.message : String(err))
        setTimeout(() => setStatus('idle'), 4000)
      } finally {
        setCompactBusy(false)
      }
    },
    [role, forcedTransport, setStatus, setStatusMsg, onCompactIngestStart]
  )

  const handleCompactAttachmentPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await ingestChatAttachmentFile(file)
  }

  return {
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    attachedLora,
    compactMeta,
    compactPreviewUrl,
    loraPreviewUrl,
    loraOnlineFallbackOffer,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
    compactBusy,
    compactFileRef,
    clearCompactAttachment,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
  }
}
