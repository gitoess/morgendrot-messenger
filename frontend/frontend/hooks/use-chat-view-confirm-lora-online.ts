'use client'

import { useCallback } from 'react'
import { sendEncryptedMessageWithTimeout } from '@/frontend/lib/api'
import type { UseChatViewSendFlowParams } from '@/frontend/hooks/use-chat-view-send-flow-types'

/** Bestätigter Online-Versand von LUMA+CHROMA nach fehlgeschlagenem oder unmöglichem Funk. */
export function useChatViewConfirmLoraOnline(p: UseChatViewSendFlowParams) {
  const {
    loraOnlineOfferPayloadRef,
    setLoraOnlineFallbackOffer,
    setSending,
    setStatus,
    setStatusMsg,
    clearCompactAttachment,
    loadMessages,
    setMessage,
  } = p

  return useCallback(async () => {
    const payload = loraOnlineOfferPayloadRef.current
    if (!payload) return
    setLoraOnlineFallbackOffer(null)
    loraOnlineOfferPayloadRef.current = null
    setSending(true)
    setStatus('idle')
    try {
      const r1 = await sendEncryptedMessageWithTimeout(payload.lumaText)
      if (!r1.ok) {
        throw new Error(r1.error || (r1 as { message?: string }).message || 'LUMA über Online fehlgeschlagen.')
      }
      const r2 = await sendEncryptedMessageWithTimeout(payload.chromaText)
      if (!r2.ok) {
        throw new Error(r2.error || (r2 as { message?: string }).message || 'CHROMA über Online fehlgeschlagen.')
      }
      setStatus('success')
      setStatusMsg(
        'Bewusst über Online (IOTA/Mailbox): LUMA und CHROMA als zwei Nachrichten gesendet – nicht über Funk.'
      )
      setMessage('')
      setTimeout(() => void loadMessages(), 500)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
    } finally {
      clearCompactAttachment()
      setSending(false)
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [
    clearCompactAttachment,
    loadMessages,
    loraOnlineOfferPayloadRef,
    setLoraOnlineFallbackOffer,
    setMessage,
    setSending,
    setStatus,
    setStatusMsg,
  ])
}
