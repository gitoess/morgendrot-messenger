import { describe, expect, it } from 'vitest'
import { messageMatchesInboxMediaFilter } from '@/frontend/lib/inbox-media-filter'
import type { Message } from '@/frontend/lib/types'
import { COMPACT_IMG_PREFIX, MORG_AUDIO_V1_PREFIX } from '@/frontend/lib/compact-image-wire'

function msg(content: string): Message {
  return {
    id: '1',
    from: '0x' + 'a'.repeat(64),
    content,
    timestamp: 1,
  }
}

describe('messageMatchesInboxMediaFilter', () => {
  it('all lässt alles durch', () => {
    expect(messageMatchesInboxMediaFilter(msg('hallo'), 'all')).toBe(true)
  })

  it('images erkennt Kompaktbild', () => {
    expect(messageMatchesInboxMediaFilter(msg(`${COMPACT_IMG_PREFIX}abc`), 'images')).toBe(true)
    expect(messageMatchesInboxMediaFilter(msg('nur text'), 'images')).toBe(false)
  })

  it('audio erkennt MORG_AUDIO', () => {
    expect(messageMatchesInboxMediaFilter(msg(`${MORG_AUDIO_V1_PREFIX}x`), 'audio')).toBe(true)
    expect(messageMatchesInboxMediaFilter(msg(`${COMPACT_IMG_PREFIX}x`), 'audio')).toBe(false)
  })
})
