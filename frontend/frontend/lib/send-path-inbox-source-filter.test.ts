import { describe, expect, it } from 'vitest'
import {
  contactSidebarSendPathFilter,
  conversationMenuChainToolsVisible,
  inboxSourceFilterForSendPath,
  inboxToolbarToolsForSendPath,
  showChainSidebarExtrasOnSendPath,
  showTelegramAlarmOnSendPath,
} from '@/frontend/lib/send-path-inbox-source-filter'
import { messageMatchesInboxSourceFilter } from '@/frontend/lib/inbox-source-filter'
import type { Message } from '@/frontend/lib/types'

function m(partial: Partial<Message>): Message {
  return {
    id: 'x',
    from: '0xs',
    content: 'hi',
    timestamp: 1,
    ...partial,
  }
}

describe('inboxSourceFilterForSendPath', () => {
  it('Online → all', () => {
    expect(
      inboxSourceFilterForSendPath({ activeSendPath: 'internet', iotaPathFocus: false })
    ).toBe('all')
  })

  it('IOTA → iota', () => {
    expect(
      inboxSourceFilterForSendPath({ activeSendPath: 'internet', iotaPathFocus: true })
    ).toBe('iota')
  })

  it('Funk → funk', () => {
    expect(inboxSourceFilterForSendPath({ activeSendPath: 'mesh' })).toBe('funk')
  })

  it('Telegram → telegram', () => {
    expect(inboxSourceFilterForSendPath({ activeSendPath: 'telegram' })).toBe('telegram')
  })
})

describe('contactSidebarSendPathFilter', () => {
  it('Online ohne Kontaktfilter', () => {
    expect(
      contactSidebarSendPathFilter({ activeSendPath: 'internet', iotaPathFocus: false })
    ).toBeUndefined()
  })

  it('IOTA filtert auf internet-Kontakte', () => {
    expect(
      contactSidebarSendPathFilter({ activeSendPath: 'internet', iotaPathFocus: true })
    ).toBe('internet')
  })

  it('Telegram/Funk behalten Pfad', () => {
    expect(contactSidebarSendPathFilter({ activeSendPath: 'telegram' })).toBe('telegram')
    expect(contactSidebarSendPathFilter({ activeSendPath: 'mesh' })).toBe('mesh')
  })
})

describe('showTelegramAlarmOnSendPath / showChainSidebarExtrasOnSendPath', () => {
  it('Online: Alarm + Chain-Extras', () => {
    const p = { activeSendPath: 'internet' as const, iotaPathFocus: false }
    expect(showTelegramAlarmOnSendPath(p)).toBe(true)
    expect(showChainSidebarExtrasOnSendPath(p)).toBe(true)
  })

  it('IOTA: keine Alarmgruppe, Chain-Extras ja', () => {
    const p = { activeSendPath: 'internet' as const, iotaPathFocus: true }
    expect(showTelegramAlarmOnSendPath(p)).toBe(false)
    expect(showChainSidebarExtrasOnSendPath(p)).toBe(true)
  })

  it('Funk: weder Alarm noch Chain-Extras', () => {
    const p = { activeSendPath: 'mesh' as const }
    expect(showTelegramAlarmOnSendPath(p)).toBe(false)
    expect(showChainSidebarExtrasOnSendPath(p)).toBe(false)
  })
})

describe('inboxToolbarToolsForSendPath / conversationMenuChainToolsVisible', () => {
  it('Online: Wire/Pakete/On-Chain/Kanal-Filter + Chat-Chain-Tools', () => {
    const t = inboxToolbarToolsForSendPath({ activeSendPath: 'internet', iotaPathFocus: false })
    expect(t.showWirePaste).toBe(true)
    expect(t.showPakete).toBe(true)
    expect(t.showOnChainNft).toBe(true)
    expect(t.showKanalFilterToggle).toBe(true)
    expect(t.showDecryptExport).toBe(true)
    expect(t.showNachrichtenverlauf).toBe(true)
    expect(conversationMenuChainToolsVisible({ activeSendPath: 'internet' })).toBe(true)
  })

  it('IOTA: Chain-Tools ohne Kanal-Filter', () => {
    const t = inboxToolbarToolsForSendPath({ activeSendPath: 'internet', iotaPathFocus: true })
    expect(t.showWirePaste).toBe(true)
    expect(t.showPakete).toBe(true)
    expect(t.showKanalFilterToggle).toBe(false)
    expect(conversationMenuChainToolsVisible({ activeSendPath: 'internet', iotaPathFocus: true })).toBe(
      true
    )
  })

  it('Funk/Telegram: Pakete+Verlauf, kein Wire/On-Chain/Burn', () => {
    for (const activeSendPath of ['mesh', 'telegram'] as const) {
      const t = inboxToolbarToolsForSendPath({ activeSendPath })
      expect(t.showWirePaste).toBe(false)
      expect(t.showPakete).toBe(true)
      expect(t.showOnChainNft).toBe(false)
      expect(t.showKanalFilterToggle).toBe(false)
      expect(t.showDecryptExport).toBe(true)
      expect(t.showNachrichtenverlauf).toBe(true)
      expect(conversationMenuChainToolsVisible({ activeSendPath })).toBe(false)
    }
  })
})

describe('Pfadfilter gegen Beispielnachrichten', () => {
  const mailbox = m({ source: 'mailbox', transports: ['internet'], chainPurgeable: true })
  const tg = m({ source: 'telegram', transports: ['telegram'] })
  const funk = m({ source: 'mesh', transports: ['mesh'] })

  it('Online/all lässt alles durch', () => {
    const f = inboxSourceFilterForSendPath({ activeSendPath: 'internet' })
    expect(messageMatchesInboxSourceFilter(mailbox, f)).toBe(true)
    expect(messageMatchesInboxSourceFilter(tg, f)).toBe(true)
    expect(messageMatchesInboxSourceFilter(funk, f)).toBe(true)
  })

  it('IOTA nur Chain', () => {
    const f = inboxSourceFilterForSendPath({ activeSendPath: 'internet', iotaPathFocus: true })
    expect(messageMatchesInboxSourceFilter(mailbox, f)).toBe(true)
    expect(messageMatchesInboxSourceFilter(tg, f)).toBe(false)
    expect(messageMatchesInboxSourceFilter(funk, f)).toBe(false)
  })

  it('Funk nur Mesh (sonst leer)', () => {
    const f = inboxSourceFilterForSendPath({ activeSendPath: 'mesh' })
    expect(messageMatchesInboxSourceFilter(mailbox, f)).toBe(false)
    expect(messageMatchesInboxSourceFilter(tg, f)).toBe(false)
    expect(messageMatchesInboxSourceFilter(funk, f)).toBe(true)
  })

  it('Telegram nur TG', () => {
    const f = inboxSourceFilterForSendPath({ activeSendPath: 'telegram' })
    expect(messageMatchesInboxSourceFilter(mailbox, f)).toBe(false)
    expect(messageMatchesInboxSourceFilter(tg, f)).toBe(true)
    expect(messageMatchesInboxSourceFilter(funk, f)).toBe(false)
  })
})
