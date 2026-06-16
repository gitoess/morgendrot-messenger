import { describe, expect, it } from 'vitest'
import { countConversationMediaStats } from '@/frontend/lib/inbox-conversation-media-stats'
import { COMPACT_IMG_PREFIX, MORG_AUDIO_V1_PREFIX } from '@/frontend/lib/compact-image-wire'

describe('countConversationMediaStats', () => {
  it('zählt Bilder, Links und Sprachnachrichten', () => {
    const stats = countConversationMediaStats([
      {
        id: '1',
        from: '0x' + 'a'.repeat(64),
        content: `${COMPACT_IMG_PREFIX}abc]]`,
        timestamp: 1,
      },
      {
        id: '2',
        from: '0x' + 'b'.repeat(64),
        content: 'Siehe https://example.com/doc',
        timestamp: 2,
      },
      {
        id: '3',
        from: '0x' + 'c'.repeat(64),
        content: `${MORG_AUDIO_V1_PREFIX}len=4|abcd]]`,
        timestamp: 3,
      },
    ])
    expect(stats.photos).toBe(1)
    expect(stats.sharedLinks).toBe(1)
    expect(stats.voiceMessages).toBe(1)
  })
})
