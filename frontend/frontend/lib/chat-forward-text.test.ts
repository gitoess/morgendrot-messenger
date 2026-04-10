import { describe, it, expect } from 'vitest'
import type { Message } from './types'
import { buildForwardComposerPayload, extractForwardablePlainText } from './chat-forward-text'

describe('extractForwardablePlainText', () => {
  it('leer → Platzhalter', () => {
    expect(extractForwardablePlainText(undefined)).toEqual({ text: '(leer)', isMediaHint: false })
  })

  it('Klartext ohne MORG', () => {
    expect(extractForwardablePlainText('Hallo')).toEqual({ text: 'Hallo', isMediaHint: false })
  })

  it('erkennt Kompaktbild-Wire als Medienhinweis', () => {
    const r = extractForwardablePlainText('[[MORG_COMPACT_IMG_V1:abc]]')
    expect(r.isMediaHint).toBe(true)
    expect(r.text).toContain('Medieninhalt')
  })
})

describe('buildForwardComposerPayload', () => {
  it('baut Header und Text', () => {
    const msg: Message = {
      id: '1',
      from: '0xs',
      content: 'body',
      timestamp: 1_700_000_000_000,
      recipient: '0xr',
    }
    const withSender = buildForwardComposerPayload(msg, true)
    expect(withSender).toContain('Weitergeleitet')
    expect(withSender).toContain('0xs')
    expect(withSender).toContain('body')

    const noSender = buildForwardComposerPayload(msg, false)
    expect(noSender).toContain('Weitergeleitet')
    expect(noSender).not.toContain('0xs')
    expect(noSender).toContain('body')
  })
})
