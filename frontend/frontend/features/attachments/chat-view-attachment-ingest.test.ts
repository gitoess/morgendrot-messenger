import { describe, it, expect } from 'vitest'
import { validateCompactPickFileType } from './chat-view-attachment-ingest'

function file(name: string, type: string, bytes: BlobPart = ''): File {
  return new File([bytes], name, { type })
}

describe('validateCompactPickFileType', () => {
  it('akzeptiert Bild per MIME', () => {
    expect(validateCompactPickFileType(file('x.png', 'image/png'))).toBeNull()
  })

  it('akzeptiert Bild per Dateiendung bei leerem type', () => {
    expect(validateCompactPickFileType(file('photo.JPEG', ''))).toBeNull()
  })

  it('akzeptiert .txt', () => {
    expect(validateCompactPickFileType(file('notes.txt', 'text/plain', 'a'))).toBeNull()
  })

  it('akzeptiert .opus / Ogg-MIME', () => {
    expect(validateCompactPickFileType(file('v.opus', 'audio/ogg'))).toBeNull()
  })

  it('lehnt z. B. PDF ab', () => {
    const r = validateCompactPickFileType(file('doc.pdf', 'application/pdf'))
    expect(r).not.toBeNull()
    expect(r!.ok).toBe(false)
  })
})
