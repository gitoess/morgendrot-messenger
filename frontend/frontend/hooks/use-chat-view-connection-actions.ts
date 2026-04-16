'use client'

/**
 * Handshake, Wallet-Connect, LoRa→Online-Fallback schließen, Setup-Panel togglen.
 * Aus use-chat-view-core ausgelagert (Phase A).
 */

import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { startHandshake, connect } from '@/frontend/lib/api'

const PARTNER_SETUP_ANCHOR_ID = 'chat-partner-setup-panel'

function scrollPartnerSetupIntoView(): void {
  requestAnimationFrame(() => {
    window.setTimeout(() => {
      document.getElementById(PARTNER_SETUP_ANCHOR_ID)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 120)
  })
}

export type LoraOnlineFallbackState = { reasonLabel: string } | null

export type UseChatViewConnectionActionsParams = {
  partner: string
  setSending: (v: boolean) => void
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
  setShowSetup: Dispatch<SetStateAction<boolean>>
  setLoraOnlineFallbackOffer: Dispatch<SetStateAction<LoraOnlineFallbackState>>
  loraOnlineOfferPayloadRef: MutableRefObject<{ lumaText: string; chromaText: string } | null>
}

export function useChatViewConnectionActions(p: UseChatViewConnectionActionsParams) {
  const {
    partner,
    setSending,
    setStatus,
    setStatusMsg,
    setShowSetup,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
  } = p

  const handleHandshake = useCallback(async () => {
    if (!partner.trim()) return
    setSending(true)
    const res = await startHandshake(partner)
    if (res.ok) {
      setStatus('success')
      setStatusMsg('Handshake gestartet!')
      setShowSetup(false)
    } else {
      setStatus('error')
      setStatusMsg(res.error || 'Fehler')
    }
    setSending(false)
    setTimeout(() => setStatus('idle'), 3000)
  }, [partner, setSending, setShowSetup, setStatus, setStatusMsg])

  const handleConnect = useCallback(async () => {
    setSending(true)
    const res = await connect()
    if (res.ok) {
      setStatus('success')
      setStatusMsg('Verbunden!')
    } else {
      setStatus('error')
      setStatusMsg(res.error || 'Fehler')
    }
    setSending(false)
    setTimeout(() => setStatus('idle'), 3000)
  }, [setSending, setStatus, setStatusMsg])

  const dismissLoraOnlineFallback = useCallback(() => {
    setLoraOnlineFallbackOffer(null)
    loraOnlineOfferPayloadRef.current = null
    setStatus('idle')
  }, [loraOnlineOfferPayloadRef, setLoraOnlineFallbackOffer, setStatus])

  const toggleShowSetup = useCallback(() => {
    setShowSetup((s) => {
      const opening = !s
      if (opening) scrollPartnerSetupIntoView()
      return opening
    })
  }, [setShowSetup])

  const openPartnerSetupPanel = useCallback(() => {
    setShowSetup(true)
    scrollPartnerSetupIntoView()
    toast.info('Partner-Setup geöffnet — Funk: „Heltec (Web Bluetooth) verbinden“ im Abschnitt Mesh.')
  }, [setShowSetup])

  return {
    handleHandshake,
    handleConnect,
    dismissLoraOnlineFallback,
    toggleShowSetup,
    openPartnerSetupPanel,
  }
}
