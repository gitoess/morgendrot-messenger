'use client'

import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { ingestCompactAttachmentPick } from '@/frontend/features/attachments/chat-view-attachment-ingest'
import type { CompactAttachmentMeta } from '@/frontend/features/attachments/chat-view-attachment-ingest'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'
import { useChatViewAttachmentPreviews } from '@/frontend/hooks/use-chat-view-attachment-previews'

export type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'

export type UseChatViewAttachmentsParams = {
  role: string
  forcedTransport: ForcedTransport
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  /** Vor jedem neuen Import (SOS-Banner o. Ä. zurücksetzen). */
  onCompactIngestStart?: () => void
}

export function useChatViewAttachments(p: UseChatViewAttachmentsParams) {
  const { role, forcedTransport, setStatus, setStatusMsg, onCompactIngestStart } = p

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
