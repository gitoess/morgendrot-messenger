import { describe, it, expect } from 'vitest'
import { wireUtf8ByteLength } from '@/frontend/lib/compact-image-wire'
import {
  buildChatOutgoingWireContent,
  buildLoraMeshDualWireTexts,
  describeOutgoingWireForDebug,
  isBrowserSendDebugEnabled,
} from './chat-view-outgoing-payload'

describe('buildLoraMeshDualWireTexts', () => {
  it('ohne Composer-Zeile: nur Wire', () => {
    const r = buildLoraMeshDualWireTexts('[[L]]', '[[C]]', '  ')
    expect(r.lumaText).toBe('[[L]]')
    expect(r.chromaText).toBe('[[C]]')
  })

  it('mit Caption: Wire und Text getrennt durch Leerzeilen', () => {
    const r = buildLoraMeshDualWireTexts('[[L]]', '[[C]]', 'Hallo')
    expect(r.lumaText).toBe('[[L]]\n\nHallo')
    expect(r.chromaText).toBe('[[C]]\n\nHallo')
  })

  it('Meshtastic-Budget: lange Caption wird gekürzt (LUMA und CHROMA ≤ Budget)', () => {
    const luma = '[[MORG_LUMA_V1:msgId=aaaaaaaa|len=2|eH]]'
    const chroma = '[[MORG_CHROMA_V1:msgId=aaaaaaaa|len=2|eH]]'
    const longCap = 'x'.repeat(400)
    const budget = 120
    const r = buildLoraMeshDualWireTexts(luma, chroma, longCap, { meshtasticMaxUtf8PerMessage: budget })
    expect(wireUtf8ByteLength(r.lumaText)).toBeLessThanOrEqual(budget)
    expect(wireUtf8ByteLength(r.chromaText)).toBeLessThanOrEqual(budget)
    expect(r.lumaText.startsWith(luma)).toBe(true)
    expect(r.chromaText.startsWith(chroma)).toBe(true)
  })
})

describe('buildChatOutgoingWireContent', () => {
  it('liefert getrimmten Klartext ohne Anhang', () => {
    expect(
      buildChatOutgoingWireContent({
        composerPlainText: '  x  ',
        attachedAudioBase64: null,
        attachedBlobBase64: null,
        attachedTxtFile: null,
      })
    ).toBe('x')
  })

  it('bevorzugt Audio gegenüber Bild und .txt', () => {
    const w = buildChatOutgoingWireContent({
      composerPlainText: '',
      attachedAudioBase64: 'QUFB',
      attachedBlobBase64: 'YmI=',
      attachedTxtFile: { name: 'f.txt', text: 't' },
    })
    expect(w).toContain('MORG_AUDIO_V1')
  })

  it('Bild wenn kein Audio', () => {
    const w = buildChatOutgoingWireContent({
      composerPlainText: '',
      attachedAudioBase64: null,
      attachedBlobBase64: 'YmI=',
      attachedTxtFile: null,
    })
    expect(w).toContain('MORG_COMPACT_IMG_V1')
  })

  it('.txt wenn weder Audio noch Bild', () => {
    const w = buildChatOutgoingWireContent({
      composerPlainText: 'cap',
      attachedAudioBase64: null,
      attachedBlobBase64: null,
      attachedTxtFile: { name: 'readme.txt', text: 'body' },
    })
    expect(w).toContain('MORG_FILE_TXT_V1')
  })
})

describe('describeOutgoingWireForDebug', () => {
  it('klassifiziert Wire-Art und Längen', () => {
    const p = {
      composerPlainText: 'hi',
      attachedAudioBase64: null,
      attachedBlobBase64: 'abcd',
      attachedTxtFile: null,
    }
    const wire = buildChatOutgoingWireContent(p)
    const d = describeOutgoingWireForDebug(p, wire)
    expect(d.wireKind).toBe('compact_img')
    expect(d.flags).toMatchObject({ blob: true, audio: false, txt: false })
    expect(typeof d.utf8Bytes).toBe('number')
  })
})

describe('isBrowserSendDebugEnabled', () => {
  it('in Node/Vitest ohne window → false', () => {
    expect(isBrowserSendDebugEnabled()).toBe(false)
  })
})
