'use client'

/**
 * Handshake, Wallet-Connect, LoRa→Online-Fallback schließen, Setup-Panel togglen.
 * Aus use-chat-view-core ausgelagert (Phase A).
 */

import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { findPeerHandshake } from '@/frontend/lib/api'
import { notifyHandshakeOffersRefresh } from '@/frontend/hooks/use-chat-view-pending-handshakes'
import { setDirectChatEcdhPeerPubBase64 } from '@/frontend/lib/direct-chat-ecdh-session'
import { connectDeploymentHybrid, connectPartnerHybrid } from '@/frontend/lib/connect-hybrid'
import { sendHandshakeHybrid } from '@/frontend/lib/handshake-send-hybrid'
import { offerLocalVaultSave } from '@/frontend/lib/offer-local-vault-save'

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
  /** GET /api/status erreichbar — Handshake/Connect laufen über die Basis. */
  backendReachable?: boolean
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
    backendReachable = true,
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
      const res = await sendHandshakeHybrid(addr, { backendReachable })
      if (res.ok) {
        setStatus('success')
        const base = res.message || 'Handshake gesendet.'
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
        const pathNote =
          res.path === 'direct'
            ? ' (Direkt-RPC — ohne Morgendrot-/handshake-API).'
            : res.path === 'api'
              ? ' (über Morgendrot-API).'
              : ''
        setStatusMsg(
          `${base}${pathNote} Handshake bleibt on-chain (§ H.23: Double Ratchet später). Nach Entsperren: Partner aus Vault-Cache — einmalig Connect nur wenn Status nicht „verbunden“. Siehe docs/HANDSHAKE-PERSISTENZ-UND-H23.md.${extra}`
        )
        if (opts?.closeSetup !== false) setShowSetup(false)
        notifyHandshakeOffersRefresh()
        window.setTimeout(() => notifyHandshakeOffersRefresh(), 4000)
        offerLocalVaultSave('handshake')
      } else {
        setStatus('error')
        setStatusMsg(res.error || 'Fehler')
      }
      setSending(false)
      setTimeout(() => setStatus('idle'), 5000)
    },
    [backendReachable, setSending, setShowSetup, setStatus, setStatusMsg]
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
      } else if (backendReachable === false) {
        toast.error('Einsatz-Partner-Connect braucht die Morgendrot-Basis', {
          description: 'PARTNER_ADDRESS aus der Server-.env ist nur mit erreichbarer API verfügbar.',
          duration: 12_000,
        })
        return
      }
      setSending(true)
      const res =
        mode === 'partner'
          ? await connectPartnerHybrid((explicitAddress ?? partner).trim(), { backendReachable })
          : await connectDeploymentHybrid({ backendReachable })
      if (res.ok) {
        setStatus('success')
        const base = res.message || 'Connect gestartet.'
        const pathNote =
          res.path === 'direct'
            ? ' (Direkt-RPC — Peer-Pub lokal, ohne Server-peerMap).'
            : res.path === 'api'
              ? ' (Morgendrot-API / Hintergrund-Connect).'
              : ''
        const modeHint =
          mode === 'partner'
            ? ' Partner-Handshake aus Chain übernommen; verschlüsselter Direkt-Versand nutzt lokales ECDH-Material.'
            : ' Nutzt PARTNER_ADDRESS aus der Server-.env.'
        setStatusMsg(`${base}${pathNote}${modeHint}`)
        scheduleStatusRefresh()
        notifyHandshakeOffersRefresh()
        offerLocalVaultSave('connect')
      } else {
        setStatus('error')
        setStatusMsg(res.error || 'Fehler')
      }
      setSending(false)
      setTimeout(() => setStatus('idle'), 6000)
    },
    [backendReachable, partner, scheduleStatusRefresh, setSending, setStatus, setStatusMsg]
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
