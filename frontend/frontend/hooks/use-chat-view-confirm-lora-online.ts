'use client'

import { useCallback } from 'react'
import { sendEncryptedMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'
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
    recipient,
  } = p

  return useCallback(async () => {
    const payload = loraOnlineOfferPayloadRef.current
    if (!payload) return
    setLoraOnlineFallbackOffer(null)
    loraOnlineOfferPayloadRef.current = null
    setSending(true)
    setStatus('idle')
    try {
      const r1 = await sendEncryptedMailboxHybrid(recipient.trim(), payload.lumaText)
      if (!r1.ok) {
        throw new Error(r1.error || r1.message || 'LUMA über Online fehlgeschlagen.')
      }
      const r2 = await sendEncryptedMailboxHybrid(recipient.trim(), payload.chromaText)
      if (!r2.ok) {
        throw new Error(r2.error || r2.message || 'CHROMA über Online fehlgeschlagen.')
      }
      setStatus('success')
      setStatusMsg(
        'Bewusst über Online (IOTA/Mailbox): LUMA und CHROMA als zwei Nachrichten gesendet – nicht über Funk.'
      )
      setMessage('')
      setTimeout(() => void loadMessages('poll', undefined, { silent: true }), 500)
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
    recipient,
    setLoraOnlineFallbackOffer,
    setMessage,
    setSending,
    setStatus,
    setStatusMsg,
  ])
}
