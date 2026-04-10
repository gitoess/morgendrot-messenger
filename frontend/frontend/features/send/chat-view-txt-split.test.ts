import { describe, it, expect } from 'vitest'
import { MESSAGING_WIRE_UTF8_MAX, wireUtf8ByteLength } from '@/frontend/lib/compact-image-wire'
import { buildTxtFileWireParts, TXT_FILE_PART_MAX_CHARS } from './chat-view-txt-split'

describe('buildTxtFileWireParts', () => {
  it('ein Teil bei kurzem Text', () => {
    const parts = buildTxtFileWireParts('notes.txt', 'hello', undefined)
    expect(parts).toHaveLength(1)
    expect(wireUtf8ByteLength(parts[0]!)).toBeLessThanOrEqual(MESSAGING_WIRE_UTF8_MAX)
    expect(parts[0]).toMatch(/MORG_FILE_TXT_V1:/)
  })

  it('leerer Text erzeugt einen Wire; Caption außerhalb des Kerns', () => {
    const parts = buildTxtFileWireParts('empty.txt', '', 'cap')
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatch(/MORG_FILE_TXT_V1:/)
    expect(parts[0]).toContain('\n\ncap')
    expect(wireUtf8ByteLength(parts[0]!)).toBeLessThanOrEqual(MESSAGING_WIRE_UTF8_MAX)
  })

  it('sehr langer Text wird in mehrere Teile gesplittet', () => {
    const chunk = 'x'.repeat(TXT_FILE_PART_MAX_CHARS + 500)
    const parts = buildTxtFileWireParts('big.txt', chunk, undefined)
    expect(parts.length).toBeGreaterThan(1)
    for (const w of parts) {
      expect(wireUtf8ByteLength(w)).toBeLessThanOrEqual(MESSAGING_WIRE_UTF8_MAX)
    }
  })
})
