import { describe, expect, it } from 'vitest'
import {
  contactSidebarSendPathFilter,
  conversationMenuChainToolsVisible,
  inboxSourceFilterForSendPath,
  inboxToolbarToolsForSendPath,
  showChainSidebarExtrasOnSendPath,
  showTelegramAlarmOnSendPath,
} from '@/frontend/lib/send-path-inbox-source-filter'

describe('inboxSourceFilterForSendPath', () => {
  it('filtert die Liste nie mehr nach Sendepfad (immer all)', () => {
    expect(
      inboxSourceFilterForSendPath({ activeSendPath: 'internet', iotaPathFocus: false })
    ).toBe('all')
    expect(
      inboxSourceFilterForSendPath({ activeSendPath: 'internet', iotaPathFocus: true })
    ).toBe('all')
    expect(inboxSourceFilterForSendPath({ activeSendPath: 'mesh' })).toBe('all')
    expect(inboxSourceFilterForSendPath({ activeSendPath: 'telegram' })).toBe('all')
    expect(inboxSourceFilterForSendPath({ activeSendPath: 'adhoc' })).toBe('all')
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

  it('IOTA: Chain-Tools + Kanal-Filter (Liste entkoppelt)', () => {
    const t = inboxToolbarToolsForSendPath({ activeSendPath: 'internet', iotaPathFocus: true })
    expect(t.showWirePaste).toBe(true)
    expect(t.showPakete).toBe(true)
    expect(t.showKanalFilterToggle).toBe(true)
    expect(conversationMenuChainToolsVisible({ activeSendPath: 'internet', iotaPathFocus: true })).toBe(
      true
    )
  })

  it('Funk/Telegram: Pakete+Verlauf+Kanal-Filter, kein Wire/On-Chain/Burn', () => {
    for (const activeSendPath of ['mesh', 'telegram'] as const) {
      const t = inboxToolbarToolsForSendPath({ activeSendPath })
      expect(t.showWirePaste).toBe(false)
      expect(t.showPakete).toBe(true)
      expect(t.showOnChainNft).toBe(false)
      expect(t.showKanalFilterToggle).toBe(true)
      expect(t.showDecryptExport).toBe(true)
      expect(t.showNachrichtenverlauf).toBe(true)
      expect(conversationMenuChainToolsVisible({ activeSendPath })).toBe(false)
    }
  })
})
