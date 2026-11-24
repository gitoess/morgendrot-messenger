import { describe, expect, it } from 'vitest'
import { formatUnknownError } from './format-unknown-error'

describe('formatUnknownError', () => {
  it('Error: bevorzugt message', () => {
    expect(formatUnknownError(new Error('net down'))).toBe('net down')
  })

  it('Error: ohne message, nutzt name', () => {
    const e = new Error()
    e.message = ''
    e.name = 'TypeError'
    expect(formatUnknownError(e)).toBe('TypeError')
  })

  it('Error: ohne message und name → Fallback', () => {
    const e = new Error()
    e.message = ''
    e.name = ''
    expect(formatUnknownError(e)).toBe('Fehler')
  })

  it('String durchreichen', () => {
    expect(formatUnknownError('plain')).toBe('plain')
  })

  it('Objekt mit message', () => {
    expect(formatUnknownError({ message: '  api ' })).toBe('  api ')
  })

  it('Objekt mit error-String', () => {
    expect(formatUnknownError({ error: 'bad' })).toBe('bad')
  })

  it('Objekt serialisierbar', () => {
    expect(formatUnknownError({ code: 1, x: 'y' })).toBe('{"code":1,"x":"y"}')
  })

  it('leeres Objekt → lesbarer Fallback', () => {
    expect(formatUnknownError({})).toBe('Funk-Fehler (nicht lesbar)')
  })

  it('Zirkelreferenz: JSON.stringify scheitert → lesbarer Fallback', () => {
    const o: Record<string, unknown> = {}
    o.self = o
    expect(formatUnknownError(o)).toBe('Funk-Fehler (nicht lesbar)')
  })

  it('Error mit message [object Object] → name/Fallback', () => {
    expect(formatUnknownError(new Error('[object Object]'))).toBe('Error')
  })

  it('Routing-Objekt mit numerischem error', () => {
    expect(formatUnknownError({ id: 9, error: 5 })).toMatch(/Routing-Fehler 5/)
  })

  it('Primitives', () => {
    expect(formatUnknownError(null)).toBe('null')
    expect(formatUnknownError(undefined)).toBe('undefined')
    expect(formatUnknownError(42)).toBe('42')
  })
})
