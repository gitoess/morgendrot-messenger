'use client'

/**
 * Handshake, Wallet-Connect, LoRa→Online-Fallback schließen, Setup-Panel togglen.
 * Aus use-chat-view-core ausgelagert (Phase A).
 */

import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { startHandshake, connect, findPeerHandshake } from '@/frontend/lib/api'
import { notifyHandshakeOffersRefresh } from '@/frontend/hooks/use-chat-view-pending-handshakes'
import { setDirectChatEcdhPeerPubBase64 } from '@/frontend/lib/direct-chat-ecdh-session'

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

  const runHandshakeForAddress = useCallback(
    async (rawAddress: string, opts?: { closeSetup?: boolean }) => {
      const addr = rawAddress.trim()
      if (!addr) {
        toast.error('Partner-Adresse fehlt — 0x-Wallet eintragen.')
        return
      }
      if (!ADDR_64_HEX.test(addr)) {
        toast.error('Gültige Empfänger-Wallet: 0x + 64 Hex.')
        return
      }
      setSending(true)
      const res = await startHandshake(addr)
      if (res.ok) {
        setStatus('success')
        const base =
          typeof (res as { message?: unknown }).message === 'string'
            ? (res as { message: string }).message
            : 'Handshake gesendet.'
        let extra = ''
        const p = addr.toLowerCase()
        try {
          const hs = await findPeerHandshake(p)
          if (hs.ok && hs.found && hs.peerPubRawBase64) {
            const saved = setDirectChatEcdhPeerPubBase64(p, hs.peerPubRawBase64)
            if (saved.ok) extra = ' Peer-Pub automatisch aus Handshake übernommen.'
          }
        } catch {
          /* optional */
        }
        setStatusMsg(
          `${base} Handshake bleibt on-chain (§ H.23: Double Ratchet später). Nach Entsperren: Partner aus Vault-Cache — einmalig Connect nur wenn Status nicht „verbunden“. Siehe docs/HANDSHAKE-PERSISTENZ-UND-H23.md.${extra}`
        )
        if (opts?.closeSetup !== false) setShowSetup(false)
        notifyHandshakeOffersRefresh()
        window.setTimeout(() => notifyHandshakeOffersRefresh(), 4000)
      } else {
        setStatus('error')
        setStatusMsg(res.error || 'Fehler')
      }
      setSending(false)
      setTimeout(() => setStatus('idle'), 5000)
    },
    [setSending, setShowSetup, setStatus, setStatusMsg]
  )

  const handleHandshake = useCallback(async () => {
    if (!partner.trim()) {
      toast.error('Partner-Adresse fehlt — im Setup-Panel „Partner (0x…)“ eintragen (nicht nur „An:“ im Composer).')
      return
    }
    await runHandshakeForAddress(partner)
  }, [partner, runHandshakeForAddress])

  const handleHandshakeForAddress = useCallback(
    async (address: string) => {
      await runHandshakeForAddress(address, { closeSetup: false })
    },
    [runHandshakeForAddress]
  )

  const runConnect = useCallback(
    async (mode: 'partner' | 'deployment', explicitAddress?: string) => {
      if (mode === 'partner') {
        const addr = (explicitAddress ?? partner).trim()
        if (!ADDR_64_HEX.test(addr)) {
          toast.error('Gültige Partner-Wallet (0x + 64 Hex) eintragen — nur für „Handshake annehmen“.')
          return
        }
      }
      setSending(true)
      const res =
        mode === 'partner'
          ? await connect((explicitAddress ?? partner).trim().toLowerCase())
          : await connect()
      if (res.ok) {
        setStatus('success')
        const backendMsg =
          typeof (res as { message?: unknown }).message === 'string'
            ? (res as { message: string }).message
            : 'Connect gestartet.'
        const modeHint =
          mode === 'partner'
            ? 'Wartet auf Handshake der 0x-Adresse (Server-Mailbox oder Event), antwortet automatisch.'
            : 'Nutzt PARTNER_ADDRESS / PARTNER_ADDRESSES aus der Server-.env (Einsatzleiter/Boss).'
        setStatusMsg(
          `${backendMsg} ${modeHint} Nach erneutem API-Neustart: einmal Connect — danach bleibt der Handshake im Tresor-Cache (wird beim Entsperren wiederhergestellt).`
        )
        scheduleStatusRefresh()
      } else {
        setStatus('error')
        setStatusMsg(res.error || 'Fehler')
      }
      setSending(false)
      setTimeout(() => setStatus('idle'), 6000)
    },
    [partner, scheduleStatusRefresh, setSending, setStatus, setStatusMsg]
  )

  const handleConnectAcceptPartner = useCallback(async () => {
    await runConnect('partner')
  }, [runConnect])

  const handleConnectAcceptForAddress = useCallback(
    async (address: string) => {
      await runConnect('partner', address)
    },
    [runConnect]
  )

  const handleConnectDeployment = useCallback(async () => {
    await runConnect('deployment')
  }, [runConnect])

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
    handleHandshakeForAddress,
    handleConnectAcceptPartner,
    handleConnectAcceptForAddress,
    handleConnectDeployment,
    dismissLoraOnlineFallback,
    toggleShowSetup,
    openPartnerSetupPanel,
  }
}
