'use client'

import { useEffect, useState } from 'react'
import { reconstructCompactImageToDataUrl } from '@/frontend/lib/compact-image-canvas'
import {
  parseLoraProgressiveMessage,
  revokeObjectUrlSafe,
  uint8ToObjectUrl,
} from '@/frontend/lib/lora-progressive-image-client'
import type { ChatAttachedLora } from '@/frontend/lib/chat-view-attached-types'

/**
 * Object-URLs / Data-URLs für Kompakt-Bild und LoRa-LUMA-Vorschau (Cleanup bei Unmount/Wechsel).
 */
export function useChatViewAttachmentPreviews(
  attachedBlobBase64: string | null,
  attachedLora: ChatAttachedLora | null
) {
  const [compactPreviewUrl, setCompactPreviewUrl] = useState<string | null>(null)
  const [loraPreviewUrl, setLoraPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!attachedBlobBase64) {
      setCompactPreviewUrl(null)
      return
    }
    let alive = true
    setCompactPreviewUrl(null)
    void reconstructCompactImageToDataUrl(attachedBlobBase64)
      .then((url) => {
        if (alive) setCompactPreviewUrl(url)
      })
      .catch(() => {
        if (alive) setCompactPreviewUrl(null)
      })
    return () => {
      alive = false
    }
  }, [attachedBlobBase64])

  useEffect(() => {
    if (!attachedLora) {
      setLoraPreviewUrl(null)
      return
    }
    const pr = parseLoraProgressiveMessage(attachedLora.lumaWire)
    if (!pr || pr.kind !== 'luma') {
      setLoraPreviewUrl(null)
      return
    }
    const u = uint8ToObjectUrl(pr.jpeg)
    setLoraPreviewUrl(u)
    return () => revokeObjectUrlSafe(u)
  }, [attachedLora])

  return { compactPreviewUrl, loraPreviewUrl }
}
