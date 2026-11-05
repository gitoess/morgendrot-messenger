import { describe, expect, it } from 'vitest'
import { collectCompactImagesFromInboxMessages } from '@/frontend/lib/evidence-wire-inbox-images'
import { COMPACT_IMG_PREFIX, COMPACT_IMG_SUFFIX } from '@/frontend/lib/compact-image-wire'

describe('collectCompactImagesFromInboxMessages', () => {
  it('findet Compact-Img und ignoriert Klartext', () => {
    const wire = `${COMPACT_IMG_PREFIX}YWJj${COMPACT_IMG_SUFFIX}`
    const rows = collectCompactImagesFromInboxMessages([
      { id: '1', content: 'hallo', ts: 1, sender: '0xa', recipient: '0xb' },
      { id: '2', content: wire, ts: 2, sender: '0xa', recipient: '0xb' },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.messageId).toBe('2')
    expect(rows[0]?.blobBase64).toBe('YWJj')
  })
})
