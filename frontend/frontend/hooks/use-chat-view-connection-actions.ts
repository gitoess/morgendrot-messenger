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

const ADDR_64_HEX = /^0x[a-fA-F0-9]{64}$/

export type UseChatViewConnectionActionsParams = {
  partner: string
  /** Nach /connect den API-Status neu laden (peerMap wird erst asynchron gefüllt). */
  refreshApiStatus?: () => void | Promise<void>
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
    refreshApiStatus,
    setSending,
    setStatus,
    setStatusMsg,
    setShowSetup,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
  } = p

  const scheduleStatusRefresh = useCallback(() => {
    const run = () => void refreshApiStatus?.()
    run()
    setTimeout(run, 2500)
    setTimeout(run, 8000)
    setTimeout(run, 20000)
  }, [refreshApiStatus])

  const handleHandshake = useCallback(async () => {
    if (!partner.trim()) {
      toast.error('Partner-Adresse fehlt — im Setup-Panel „Partner (0x…)“ eintragen (nicht nur „An:“ im Composer).')
      return
    }
    setSending(true)
    const res = await startHandshake(partner)
    if (res.ok) {
      setStatus('success')
      const base =
        typeof (res as { message?: unknown }).message === 'string'
          ? (res as { message: string }).message
          : 'Handshake gesendet.'
      setStatusMsg(
        `${base} Anschließend „Schnell verbinden“ — erst danach ist der Wallet-Chat (verschlüsselt über Online/IOTA; Funk bleibt Klartext/Pfad 4) bereit.`
      )
      setShowSetup(false)
    } else {
      setStatus('error')
      setStatusMsg(res.error || 'Fehler')
    }
    setSending(false)
    setTimeout(() => setStatus('idle'), 5000)
  }, [partner, setSending, setShowSetup, setStatus, setStatusMsg])

  const handleConnect = useCallback(async () => {
    setSending(true)
    const raw = partner.trim()
    const explicitAddr = ADDR_64_HEX.test(raw) ? raw.toLowerCase() : undefined
    const res = await connect(explicitAddr)
    if (res.ok) {
      setStatus('success')
      const backendMsg =
        typeof (res as { message?: unknown }).message === 'string'
          ? (res as { message: string }).message
          : 'Connect gestartet.'
      setStatusMsg(
        `${backendMsg} Die eigentliche Verbindung (Schlüssel/peerMap) braucht oft einige Sekunden — Status im Header prüfen; verschlüsselt senden erst wenn dort „verbunden“.`
      )
      scheduleStatusRefresh()
    } else {
      setStatus('error')
      setStatusMsg(res.error || 'Fehler')
    }
    setSending(false)
    setTimeout(() => setStatus('idle'), 6000)
  }, [partner, scheduleStatusRefresh, setSending, setStatus, setStatusMsg])

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
