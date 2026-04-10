import { describe, it, expect } from 'vitest'
import { parseOkEnvelopePassthrough, parseSimpleOkEnvelopeText } from './api-simple-ok-envelope'

describe('parseSimpleOkEnvelopeText', () => {
  it('erkennt Erfolg mit message', () => {
    const r = parseSimpleOkEnvelopeText(
      JSON.stringify({ ok: true, message: 'Lokaler Inbox-Cache geschreddert.' })
    )
    expect(r).toEqual({ ok: true, message: 'Lokaler Inbox-Cache geschreddert.' })
  })
  it('erkennt Erfolg ohne message', () => {
    const r = parseSimpleOkEnvelopeText(JSON.stringify({ ok: true }))
    expect(r).toEqual({ ok: true })
  })
  it('mappt ok:false mit error', () => {
    const r = parseSimpleOkEnvelopeText(JSON.stringify({ ok: false, error: 'Intern' }))
    expect(r).toEqual({ ok: false, error: 'Intern' })
  })
  it('nutzt falseOkFallback wenn weder error noch message', () => {
    const r = parseSimpleOkEnvelopeText(JSON.stringify({ ok: false }), {
      falseOkFallback: 'Speziell.',
    })
    expect(r).toEqual({ ok: false, error: 'Speziell.' })
  })
  it('lehnt kein JSON ab', () => {
    const r = parseSimpleOkEnvelopeText('not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/JSON/)
  })
  it('lehnt Objekt ohne ok-Feld ab', () => {
    const r = parseSimpleOkEnvelopeText(JSON.stringify({ message: 'x' }))
    expect(r.ok).toBe(false)
  })
})

describe('parseOkEnvelopePassthrough', () => {
  it('liefert body mit Zusatzfeldern bei ok:true', () => {
    const r = parseOkEnvelopePassthrough(
      JSON.stringify({ ok: true, helpText: 'Hilfe', extra: 1 })
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.body.helpText).toBe('Hilfe')
      expect(r.body.extra).toBe(1)
    }
  })
  it('gleiche Fehlerpfade wie parseSimpleOkEnvelopeText bei ok:false', () => {
    const r = parseOkEnvelopePassthrough(JSON.stringify({ ok: false, error: 'x' }))
    expect(r).toEqual({ ok: false, error: 'x' })
  })
})
