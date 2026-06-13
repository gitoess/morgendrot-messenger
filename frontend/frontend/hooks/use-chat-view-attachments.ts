'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  CHAT_LORA_DUAL_IMAGE_POLICY_MSG,
  isAttachedLoraDualComposerAllowed,
  isLoRaMeshTransport,
  type ForcedTransport,
} from '@/frontend/lib/chat-view-messenger-transport'
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
  /** „Bilder über Funk“ — LUMA/CHROMA für Klartext-Mesh (unabhängig von Chain-Verankerung). */
  meshLoRaImagesEnabled: boolean
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  /** Vor jedem neuen Import (SOS-Banner o. Ä. zurücksetzen). */
  onCompactIngestStart?: () => void
}

export function useChatViewAttachments(p: UseChatViewAttachmentsParams) {
  const {
    role,
    isPrivate,
    encrypted,
    forcedTransport,
    meshLoRaImagesEnabled,
    setStatus,
    setStatusMsg,
    onCompactIngestStart,
  } = p

  const [attachedBlobBase64, setAttachedBlobBase64] = useState<string | null>(null)
  const [attachedTxtFile, setAttachedTxtFile] = useState<{ name: string; text: string } | null>(null)
  const [attachedAudioBase64, setAttachedAudioBase64] = useState<string | null>(null)
  const [attachedLora, setAttachedLora] = useState<ChatAttachedLora | null>(null)
  const [compactMeta, setCompactMeta] = useState<CompactAttachmentMeta | null>(null)
  const [loraOnlineFallbackOffer, setLoraOnlineFallbackOffer] = useState<{ reasonLabel: string } | null>(
    null
  )
  const loraOnlineOfferPayloadRef = useRef<{ lumaText: string; chromaText: string } | null>(null)
  /** Gemeinsame Idle-Reset nach Policy-Hinweis (LUMA-Strip oder IOTA-Blob auf Funk). */
  const attachmentPolicyIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [compactBusy, setCompactBusy] = useState(false)
  const [attachmentPipelineHint, setAttachmentPipelineHint] = useState<string | null>(null)
  const compactFileRef = useRef<HTMLInputElement>(null)

  const { compactPreviewUrl, loraPreviewUrl } = useChatViewAttachmentPreviews(
    attachedBlobBase64,
    attachedLora
  )

  /** Privater Chat + „Bilder über Funk“: IOTA-Kompakt-Blob → LUMA+CHROMA. */
  useEffect(() => {
    if (!isPrivate || !meshLoRaImagesEnabled || !isLoRaMeshTransport(forcedTransport)) return
    if (!attachedBlobBase64 || attachedLora != null) return
    let cancelled = false
    setCompactBusy(true)
    setAttachmentPipelineHint('Funk: IOTA-Bild wird für LoRa (LUMA+CHROMA) umgewandelt …')
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
        if (!cancelled) {
          setCompactBusy(false)
          setAttachmentPipelineHint(null)
        }
      }
    })()
    return () => {
      cancelled = true
      setAttachmentPipelineHint(null)
    }
  }, [isPrivate, meshLoRaImagesEnabled, forcedTransport, attachedBlobBase64, attachedLora, setStatus, setStatusMsg])

  useEffect(() => {
    return () => {
      if (attachmentPolicyIdleTimerRef.current) {
        clearTimeout(attachmentPolicyIdleTimerRef.current)
        attachmentPolicyIdleTimerRef.current = null
      }
    }
  }, [])

  /** LUMA+CHROMA nur für erlaubte Transport-/Verschlüsselungskombination — sonst Anhang verwerfen. */
  useEffect(() => {
    if (attachedLora == null) return
    if (
      isAttachedLoraDualComposerAllowed({
        isPrivate,
        encrypted,
        forcedTransport,
        meshLoRaImagesEnabled,
      })
    ) {
      return
    }
    if (attachmentPolicyIdleTimerRef.current) {
      clearTimeout(attachmentPolicyIdleTimerRef.current)
      attachmentPolicyIdleTimerRef.current = null
    }
    setAttachedLora(null)
    setCompactMeta(null)
    setLoraOnlineFallbackOffer(null)
    loraOnlineOfferPayloadRef.current = null
    setStatus('error')
    setStatusMsg(CHAT_LORA_DUAL_IMAGE_POLICY_MSG)
    attachmentPolicyIdleTimerRef.current = setTimeout(() => {
      attachmentPolicyIdleTimerRef.current = null
      setStatus('idle')
    }, 8000)
  }, [
    attachedLora,
    isPrivate,
    encrypted,
    forcedTransport,
    meshLoRaImagesEnabled,
    setStatus,
    setStatusMsg,
  ])

  /** IOTA-Kompakt auf Funk nur mit „Bilder über Funk“. */
  useEffect(() => {
    if (!attachedBlobBase64 || !isPrivate || !isLoRaMeshTransport(forcedTransport)) return
    if (meshLoRaImagesEnabled) return
    if (attachmentPolicyIdleTimerRef.current) {
      clearTimeout(attachmentPolicyIdleTimerRef.current)
      attachmentPolicyIdleTimerRef.current = null
    }
    setAttachedBlobBase64(null)
    setCompactMeta(null)
    setStatus('error')
    setStatusMsg(CHAT_LORA_DUAL_IMAGE_POLICY_MSG)
    attachmentPolicyIdleTimerRef.current = setTimeout(() => {
      attachmentPolicyIdleTimerRef.current = null
      setStatus('idle')
    }, 8000)
  }, [
    attachedBlobBase64,
    isPrivate,
    encrypted,
    forcedTransport,
    meshLoRaImagesEnabled,
    setStatus,
    setStatusMsg,
  ])

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
          isPrivate,
          encrypted,
          meshLoRaImagesEnabled,
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
    [role, forcedTransport, isPrivate, encrypted, meshLoRaImagesEnabled, setStatus, setStatusMsg, onCompactIngestStart]
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
    setAttachedBlobBase64,
    setAttachedTxtFile,
    setAttachedAudioBase64,
    setCompactMeta,
    compactPreviewUrl,
    loraPreviewUrl,
    loraOnlineFallbackOffer,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
    compactBusy,
    attachmentPipelineHint,
    compactFileRef,
    clearCompactAttachment,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
  }
}
