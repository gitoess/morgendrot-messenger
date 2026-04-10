import { describe, it, expect } from 'vitest'
import { parseApiJsonEnvelope, parseJsonObjectRecord } from './api-response-guard'

describe('parseApiJsonEnvelope', () => {
  it('akzeptiert gültiges { ok: true }', () => {
    const r = parseApiJsonEnvelope('{"ok":true,"x":1}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.ok).toBe(true)
  })
  it('lehnt ungültiges JSON ab', () => {
    const r = parseApiJsonEnvelope('not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('invalid_json')
  })
  it('lehnt Objekt ohne ok ab', () => {
    const r = parseApiJsonEnvelope('{"x":1}')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('schema')
  })
})

describe('parseJsonObjectRecord', () => {
  it('akzeptiert beliebiges Objekt', () => {
    const r = parseJsonObjectRecord('{"backendRunning":true}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.backendRunning).toBe(true)
  })
  it('lehnt Array ab', () => {
    expect(parseJsonObjectRecord('[1]').ok).toBe(false)
  })
})
