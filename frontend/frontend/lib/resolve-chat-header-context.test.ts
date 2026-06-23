import { describe, expect, it } from 'vitest'
import { resolveChatHeaderContext } from '@/frontend/lib/resolve-chat-header-context'
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

  it('zeigt Platzhalter ohne Auswahl', () => {
    const ctx = resolveChatHeaderContext({
      channelMode: 'private',
      role: 'consumer',
      apiStatus: TEST_API_STATUS_SEND_READY,
      activeConversationTitle: null,
      showAllConversationsActive: false,
      inboxConversationGroupId: null,
    })
    expect(ctx.title).toBe('Chats')
  })
})
