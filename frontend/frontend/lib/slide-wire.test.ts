import { describe, expect, it } from 'vitest'
import {
  MORG_SLIDE_V1_PREFIX,
  MORG_SLIDE_V1_SUFFIX,
  parseSlideFragmentMessage,
} from './slide-wire'

const mk = (inner: string) => `${MORG_SLIDE_V1_PREFIX}${inner}${MORG_SLIDE_V1_SUFFIX}`

describe('parseSlideFragmentMessage', () => {
  it('gültiges Fragment', () => {
    const w = mk('myseq|3|1|YWJj') // abc
    expect(parseSlideFragmentMessage(w)).toEqual({
      sequenceId: 'myseq',
      total: 3,
      index: 1,
      payloadBase64: 'YWJj',
    })
  })

  it('SequenceId darf | enthalten (join der führenden Teile)', () => {
    const w = mk('a|b|2|0|QQ==')
    expect(parseSlideFragmentMessage(w)).toEqual({
      sequenceId: 'a|b',
      total: 2,
      index: 0,
      payloadBase64: 'QQ==',
    })
  })

  it('BOM + Whitespace vorne', () => {
    const w = `\uFEFF  \n${mk('s|1|0|eA==')}`
    expect(parseSlideFragmentMessage(w)?.sequenceId).toBe('s')
  })

  it('Whitespace innerhalb des Markers entfernt', () => {
    const w = mk('s|1|0|Y W J j') // spaces stripped in inner
    expect(parseSlideFragmentMessage(w)?.payloadBase64).toBe('YWJj')
  })

  it('Marker eingebettet im Text', () => {
    const w = `prefix ${mk('x|2|1|QQ==')} tail`
    expect(parseSlideFragmentMessage(w)?.index).toBe(1)
  })

  it('null bei fehlendem Suffix', () => {
    expect(parseSlideFragmentMessage(`${MORG_SLIDE_V1_PREFIX}1|1|0|eA==`)).toBeNull()
  })

  it('null bei zu wenig Feldern', () => {
    expect(parseSlideFragmentMessage(mk('a|1|0'))).toBeNull()
  })

  it('null bei leerer sequenceId', () => {
    expect(parseSlideFragmentMessage(mk('|1|0|eA=='))).toBeNull()
  })

  it('null bei ungültigen Zahlen oder Range', () => {
    expect(parseSlideFragmentMessage(mk('s|x|0|eA=='))).toBeNull()
    expect(parseSlideFragmentMessage(mk('s|0|0|eA=='))).toBeNull()
    expect(parseSlideFragmentMessage(mk('s|1|1|eA=='))).toBeNull()
    expect(parseSlideFragmentMessage(mk('s|2|-1|eA=='))).toBeNull()
  })

  it('null bei leerem Payload', () => {
    expect(parseSlideFragmentMessage(mk('s|1|0|'))).toBeNull()
  })
})
