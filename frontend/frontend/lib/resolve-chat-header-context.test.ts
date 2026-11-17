import { describe, expect, it } from 'vitest'
import {
  posteingangTitleForSendPath,
  resolveChatHeaderContext,
} from '@/frontend/lib/resolve-chat-header-context'
import { TEST_API_STATUS_SEND_READY } from '@/frontend/lib/test-fixtures/messenger-capabilities'

describe('resolveChatHeaderContext', () => {
  it('zeigt Kontakt-Kontext im Privat-Modus', () => {
    const ctx = resolveChatHeaderContext({
      channelMode: 'private',
      role: 'consumer',
      apiStatus: TEST_API_STATUS_SEND_READY,
      activeConversationTitle: 'Max',
      activeConversationSubtitle: '0xabc',
      showAllConversationsActive: false,
      inboxConversationGroupId: null,
    })
    expect(ctx.title).toBe('Chat mit Max')
    expect(ctx.subtitle).toBe('0xabc')
  })

  it('zeigt Pinnwand-Titel im Brett-Modus', () => {
    const ctx = resolveChatHeaderContext({
      channelMode: 'pinnwand',
      role: 'arbeiter',
      apiStatus: { ...TEST_API_STATUS_SEND_READY, simpleMode: true },
      activeConversationTitle: null,
      showAllConversationsActive: false,
      inboxConversationGroupId: null,
    })
    expect(ctx.title).toBe('Lagebild')
  })

  it('zeigt Posteingang Alle ohne Auswahl', () => {
    const ctx = resolveChatHeaderContext({
      channelMode: 'private',
      role: 'consumer',
      apiStatus: TEST_API_STATUS_SEND_READY,
      activeConversationTitle: null,
      showAllConversationsActive: false,
      inboxConversationGroupId: null,
    })
    expect(ctx.title).toBe('Posteingang Alle')
    expect(ctx.icon).toBe('inbox')
  })

  it('zeigt Sendepfad-Titel bei Gesamteingang', () => {
    const ctx = resolveChatHeaderContext({
      channelMode: 'private',
      role: 'consumer',
      apiStatus: TEST_API_STATUS_SEND_READY,
      activeConversationTitle: null,
      showAllConversationsActive: true,
      inboxConversationGroupId: null,
      activeSendPath: 'telegram',
    })
    expect(ctx.title).toBe('Posteingang Telegram')
    expect(ctx.subtitle).toBeUndefined()
    expect(ctx.icon).toBe('inbox')
  })
})

describe('posteingangTitleForSendPath', () => {
  it('mappt Sendepfade auf Posteingang-Titel', () => {
    expect(posteingangTitleForSendPath({})).toBe('Posteingang Alle')
    expect(posteingangTitleForSendPath({ activeSendPath: 'telegram' })).toBe('Posteingang Telegram')
    expect(posteingangTitleForSendPath({ activeSendPath: 'mesh' })).toBe('Posteingang Funk')
    expect(posteingangTitleForSendPath({ activeSendPath: 'internet' })).toBe('Posteingang Alle')
    expect(
      posteingangTitleForSendPath({ activeSendPath: 'internet', iotaPathFocus: true })
    ).toBe('Posteingang IOTA')
  })
})
