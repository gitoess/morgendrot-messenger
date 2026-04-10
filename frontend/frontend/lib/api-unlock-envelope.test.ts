import { describe, it, expect } from 'vitest'
import { parseUnlockBackendEnvelopeText } from './api-unlock-envelope'

describe('parseUnlockBackendEnvelopeText', () => {
  it('erkennt Erfolg', () => {
    const r = parseUnlockBackendEnvelopeText(
      JSON.stringify({ ok: true, message: 'Entsperrt', vaultVerified: true })
    )
    expect(r).toEqual({ ok: true })
  })
  it('mappt ok:false mit error', () => {
    const r = parseUnlockBackendEnvelopeText(JSON.stringify({ ok: false, error: 'Falsches Passwort' }))
    expect(r).toEqual({ ok: false, error: 'Falsches Passwort' })
  })
  it('nutzt message wenn error fehlt', () => {
    const r = parseUnlockBackendEnvelopeText(JSON.stringify({ ok: false, message: 'Hinweis' }))
    expect(r).toEqual({ ok: false, error: 'Hinweis' })
  })
  it('lehnt kein JSON ab', () => {
    const r = parseUnlockBackendEnvelopeText('<html>')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/JSON/)
  })
  it('lehnt Objekt ohne ok-Feld ab', () => {
    const r = parseUnlockBackendEnvelopeText(JSON.stringify({ error: 'x' }))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Antwortformat/)
  })
})
