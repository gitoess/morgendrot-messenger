import { describe, expect, it } from 'vitest'
import { parseJsonObjectFromFileText, stripUtf8Bom } from './morg-pkg-import-utils'

describe('stripUtf8Bom', () => {
  it('entfernt UTF-8-BOM', () => {
    expect(stripUtf8Bom('\uFEFF{"a":1}')).toBe('{"a":1}')
  })

  it('ohne BOM unverändert', () => {
    expect(stripUtf8Bom('x')).toBe('x')
    expect(stripUtf8Bom('')).toBe('')
  })
})

describe('parseJsonObjectFromFileText', () => {
  it('gültiges Objekt', () => {
    const r = parseJsonObjectFromFileText('  \n{"x":1}  ')
    expect(r).toEqual({ ok: true, value: { x: 1 } })
  })

  it('BOM + Objekt', () => {
    const r = parseJsonObjectFromFileText('\uFEFF{"k":true}')
    expect(r).toEqual({ ok: true, value: { k: true } })
  })

  it('leer nach trim', () => {
    expect(parseJsonObjectFromFileText('  \t ')).toEqual({ ok: false, error: 'Datei ist leer.' })
  })

  it('kein Objekt: Array', () => {
    const r = parseJsonObjectFromFileText('[1]')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/kein Array/)
  })

  it('kein Objekt: null', () => {
    const r = parseJsonObjectFromFileText('null')
    expect(r.ok).toBe(false)
  })

  it('Syntaxfehler', () => {
    const r = parseJsonObjectFromFileText('{')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Syntaxfehler/)
  })
})
