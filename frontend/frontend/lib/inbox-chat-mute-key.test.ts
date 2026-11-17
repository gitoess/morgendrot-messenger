import { describe, expect, it } from 'vitest'
import { muteKeyForConversation, muteKeyForInboxMessage } from '@/frontend/lib/inbox-chat-mute-key'

const ME = `0x${'1'.repeat(64)}`
const PEER = `0x${'2'.repeat(64)}`
const TEAM = `0x${'3'.repeat(64)}`

describe('inbox-chat-mute-key (T53)', () => {
  it('dialog → Gegenüber-Adresse', () => {
    expect(
      muteKeyForInboxMessage({ from: PEER, recipient: ME }, ME)
    ).toBe(PEER.toLowerCase())
  })

  it('pinnwand / team', () => {
    expect(muteKeyForInboxMessage({ from: PEER, pinnwandPost: true }, ME)).toBe('pinnwand')
    expect(
      muteKeyForInboxMessage(
        { from: PEER, recipient: TEAM, chainPurgeKind: 'team-broadcast' },
        ME
      )
    ).toBe(`team:${TEAM}`)
  })

  it('conversation helper', () => {
    expect(muteKeyForConversation({ inboxPartnerKey: PEER })).toBe(PEER.toLowerCase())
    expect(muteKeyForConversation({ isPinnwand: true })).toBe('pinnwand')
    expect(muteKeyForConversation({ teamMailboxObjectId: TEAM })).toBe(`team:${TEAM}`)
  })
})
