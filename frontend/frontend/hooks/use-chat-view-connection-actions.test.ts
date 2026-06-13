import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRef, useState } from 'react'
import { useChatViewConnectionActions } from '@/frontend/hooks/use-chat-view-connection-actions'

const sendHandshakeHybridMock = vi.fn()
const connectMock = vi.fn()
const findPeerHandshakeMock = vi.fn()
const setPeerPubMock = vi.fn()

vi.mock('@/frontend/lib/handshake-send-hybrid', () => ({
  sendHandshakeHybrid: (...args: unknown[]) => sendHandshakeHybridMock(...args),
}))

vi.mock('@/frontend/lib/api', () => ({
  connect: (...args: unknown[]) => connectMock(...args),
  findPeerHandshake: (...args: unknown[]) => findPeerHandshakeMock(...args),
}))

vi.mock('@/frontend/lib/direct-chat-ecdh-session', () => ({
  setDirectChatEcdhPeerPubBase64: (...args: unknown[]) => setPeerPubMock(...args),
}))

function setup(partner: string, backendReachable = true) {
  return renderHook(() => {
    const [sending, setSending] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [statusMsg, setStatusMsg] = useState('')
    const [showSetup, setShowSetup] = useState(true)
    const [offer, setOffer] = useState<{ reasonLabel: string } | null>(null)
    const ref = useRef<{ lumaText: string; chromaText: string } | null>(null)
    const actions = useChatViewConnectionActions({
      partner,
      backendReachable,
      setSending,
      setStatus,
      setStatusMsg,
      setShowSetup,
      setLoraOnlineFallbackOffer: setOffer,
      loraOnlineOfferPayloadRef: ref,
    })
    return { sending, status, statusMsg, showSetup, offer, actions }
  })
}

describe('useChatViewConnectionActions / handshake autofill', () => {
  beforeEach(() => {
    sendHandshakeHybridMock.mockReset()
    connectMock.mockReset()
    findPeerHandshakeMock.mockReset()
    setPeerPubMock.mockReset()
  })

  it('stores peer pub automatically when handshake data exists', async () => {
    sendHandshakeHybridMock.mockResolvedValue({ ok: true, message: 'Handshake gesendet.', path: 'api' })
    findPeerHandshakeMock.mockResolvedValue({
      ok: true,
      found: true,
      peerPubRawBase64: 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    })
    setPeerPubMock.mockReturnValue({ ok: true })

    const h = setup('0x' + 'ab'.repeat(32))
    await act(async () => {
      await h.result.current.actions.handleHandshake()
    })

    expect(findPeerHandshakeMock).toHaveBeenCalledWith('0x' + 'ab'.repeat(32))
    expect(setPeerPubMock).toHaveBeenCalledTimes(1)
    expect(h.result.current.status).toBe('success')
    expect(h.result.current.statusMsg).toContain('Peer-Pub automatisch aus Handshake übernommen')
  })

  it('rejects handshake when partner is not a 0x wallet', async () => {
    const h = setup('alice')

    await act(async () => {
      await h.result.current.actions.handleHandshake()
    })

    expect(sendHandshakeHybridMock).not.toHaveBeenCalled()
    expect(findPeerHandshakeMock).not.toHaveBeenCalled()
    expect(setPeerPubMock).not.toHaveBeenCalled()
    expect(h.result.current.status).toBe('idle')
  })

  it('ruft Hybrid-Handshake auch bei Basis offline auf', async () => {
    sendHandshakeHybridMock.mockResolvedValue({
      ok: true,
      message: 'Handshake on-chain (Direkt-RPC).',
      path: 'direct',
    })
    const h = setup('0x' + 'ab'.repeat(32), false)
    await act(async () => {
      await h.result.current.actions.handleHandshake()
    })
    expect(sendHandshakeHybridMock).toHaveBeenCalledWith('0x' + 'ab'.repeat(32), { backendReachable: false })
    expect(h.result.current.status).toBe('success')
  })
})
