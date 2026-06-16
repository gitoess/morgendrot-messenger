import { describe, expect, it, vi } from 'vitest'
import { buildComposeReplyTargets } from '@/frontend/hooks/build-compose-reply-targets'

describe('buildComposeReplyTargets', () => {
  it('mappt Port-Callbacks auf Reply-Targets (setComposerMailboxObjectId)', () => {
    const onMailbox = vi.fn()
    const targets = buildComposeReplyTargets({
      setForcedTransport: vi.fn(),
      setComposerDelivery: vi.fn(),
      setPartner: vi.fn(),
      setRecipient: vi.fn(),
      setEncrypted: vi.fn(),
      onComposerMailboxObjectIdChange: onMailbox,
      setMeshtasticChannelIndex: vi.fn(),
      setMeshPlaintextNodeId: vi.fn(),
      setMeshPlaintextToNodeEnabled: vi.fn(),
      selectInboxPartnerForSend: vi.fn(),
      setMessage: vi.fn(),
      refreshMessengerGroups: vi.fn(),
    })
    targets.setComposerMailboxObjectId('0xabc')
    expect(onMailbox).toHaveBeenCalledWith('0xabc')
  })
})
