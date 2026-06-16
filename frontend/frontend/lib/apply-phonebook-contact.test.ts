import { describe, expect, it, vi } from 'vitest'
import { applyPhonebookContactToComposer } from '@/frontend/lib/apply-phonebook-contact'

describe('applyPhonebookContactToComposer', () => {
  const alice = '0x' + '2'.repeat(64)
  const noopTargets = {
    setPartner: vi.fn(),
    setRecipient: vi.fn(),
    setMeshPlaintextNodeId: vi.fn(),
    setMeshPlaintextToNodeEnabled: vi.fn(),
    setContactBleUuid: vi.fn(),
  }

  it('behält Telegram-Sendepfad bei Kontakt mit IOTA + Telegram', () => {
    const setPartner = vi.fn()
    const setRecipient = vi.fn()
    const setComposerDelivery = vi.fn()
    const setForcedTransport = vi.fn()

    applyPhonebookContactToComposer(
      alice,
      { label: 'Alice', telegramChatId: '99317902' },
      { ...noopTargets, setPartner, setRecipient, setComposerDelivery, setForcedTransport },
      { activeSendPath: 'telegram' }
    )

    expect(setRecipient).toHaveBeenCalledWith('tg:99317902')
    expect(setPartner).toHaveBeenCalledWith('')
    expect(setComposerDelivery).not.toHaveBeenCalled()
    expect(setForcedTransport).not.toHaveBeenCalled()
  })

  it('setzt IOTA-Felder nur auf online-Pfad', () => {
    const setPartner = vi.fn()
    const setRecipient = vi.fn()
    const setComposerDelivery = vi.fn()
    const setForcedTransport = vi.fn()

    applyPhonebookContactToComposer(
      alice,
      { label: 'Alice', telegramChatId: '99317902' },
      { ...noopTargets, setPartner, setRecipient, setComposerDelivery, setForcedTransport },
      { activeSendPath: 'internet', handshakeReady: true }
    )

    expect(setPartner).toHaveBeenCalledWith(alice)
    expect(setRecipient).toHaveBeenCalledWith(alice)
    expect(setComposerDelivery).not.toHaveBeenCalled()
    expect(setForcedTransport).not.toHaveBeenCalled()
  })

  it('setzt Funk-Node auf mesh-Pfad ohne Online-Umschalt', () => {
    const setMeshPlaintextNodeId = vi.fn()
    const setMeshPlaintextToNodeEnabled = vi.fn()
    const setForcedTransport = vi.fn()

    applyPhonebookContactToComposer(
      alice,
      { label: 'Alice', meshNodeId: '!abc123' },
      {
        ...noopTargets,
        setMeshPlaintextNodeId,
        setMeshPlaintextToNodeEnabled,
        setForcedTransport,
      },
      { activeSendPath: 'mesh' }
    )

    expect(setMeshPlaintextNodeId).toHaveBeenCalledWith('!abc123')
    expect(setMeshPlaintextToNodeEnabled).toHaveBeenCalledWith(true)
    expect(setForcedTransport).not.toHaveBeenCalled()
  })
})
