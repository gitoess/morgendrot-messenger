import { describe, expect, it } from 'vitest'
import {
  needsComposerIotaAddress,
  needsComposerMailboxUi,
  needsComposerTelegramId,
  showComposerRecipientRow,
  showTelegramDeliveryInHeader,
} from '@/frontend/lib/composer-delivery-channel'

const ADDR = `0x${'a'.repeat(64)}`

describe('composer-delivery-channel (§ H.1a)', () => {
  it('needsComposerTelegramId nur bei private + telegram', () => {
    expect(needsComposerTelegramId({ deliveryChannel: 'telegram', isPrivate: true })).toBe(true)
    expect(needsComposerTelegramId({ deliveryChannel: 'telegram', isPrivate: false })).toBe(false)
    expect(needsComposerTelegramId({ deliveryChannel: 'chain', isPrivate: true })).toBe(false)
  })

  it('needsComposerIotaAddress: telegram und Funk-Knoten ohne 0x', () => {
    expect(
      needsComposerIotaAddress({
        deliveryChannel: 'telegram',
        encrypted: true,
        forcedTransport: 'internet',
        meshPlaintextToNodeEnabled: false,
      })
    ).toBe(false)
    expect(
      needsComposerIotaAddress({
        deliveryChannel: 'chain',
        encrypted: false,
        forcedTransport: 'mesh',
        meshPlaintextToNodeEnabled: true,
      })
    ).toBe(false)
    expect(
      needsComposerIotaAddress({
        deliveryChannel: 'chain',
        encrypted: true,
        forcedTransport: 'internet',
        meshPlaintextToNodeEnabled: false,
      })
    ).toBe(true)
    expect(
      needsComposerIotaAddress({
        deliveryChannel: 'chain',
        encrypted: false,
        forcedTransport: 'internet',
        meshPlaintextToNodeEnabled: false,
      })
    ).toBe(true)
  })

  it('needsComposerMailboxUi nur bei chain + internet + gültiger 0x', () => {
    expect(
      needsComposerMailboxUi({
        deliveryChannel: 'telegram',
        forcedTransport: 'internet',
        recipient: ADDR,
        encrypted: false,
      })
    ).toBe(false)
    expect(
      needsComposerMailboxUi({
        deliveryChannel: 'chain',
        forcedTransport: 'mesh',
        recipient: ADDR,
        encrypted: false,
      })
    ).toBe(false)
    expect(
      needsComposerMailboxUi({
        deliveryChannel: 'chain',
        forcedTransport: 'internet',
        recipient: '',
        partner: ADDR,
        encrypted: true,
      })
    ).toBe(true)
    expect(
      needsComposerMailboxUi({
        deliveryChannel: 'chain',
        forcedTransport: 'internet',
        recipient: '',
        partner: '',
        encrypted: false,
      })
    ).toBe(false)
  })

  it('showTelegramDeliveryInHeader nur im Kanal 1:1', () => {
    expect(showTelegramDeliveryInHeader({ channelMode: 'private' })).toBe(true)
    expect(showTelegramDeliveryInHeader({ channelMode: 'group' })).toBe(false)
    expect(showTelegramDeliveryInHeader({ channelMode: 'pinnwand' })).toBe(false)
  })

  it('showComposerRecipientRow: Gruppe Klartext ohne Zeile', () => {
    expect(
      showComposerRecipientRow({
        isPrivate: false,
        deliveryChannel: 'chain',
        encrypted: false,
        forcedTransport: 'internet',
        meshPlaintextToNodeEnabled: false,
      })
    ).toBe(true)
    expect(
      showComposerRecipientRow({
        isPrivate: false,
        deliveryChannel: 'chain',
        encrypted: true,
        forcedTransport: 'internet',
        meshPlaintextToNodeEnabled: false,
      })
    ).toBe(false)
  })

  it('showComposerRecipientRow: private telegram zeigt Empfängerzeile', () => {
    expect(
      showComposerRecipientRow({
        isPrivate: true,
        deliveryChannel: 'telegram',
        encrypted: false,
        forcedTransport: 'internet',
        meshPlaintextToNodeEnabled: false,
      })
    ).toBe(true)
  })
})
