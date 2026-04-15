import { describe, it, expect } from 'vitest'
import { parseUnlockApiResponse } from './unlock-response-parse'

describe('parseUnlockApiResponse', () => {
  it('mappt Erfolg mit message', () => {
    expect(parseUnlockApiResponse(JSON.stringify({ ok: true, message: 'OK' }), true)).toEqual({
      ok: true,
      message: 'OK',
    })
  })

  it('mappt Fehler mit code SIGNER_IMPORT_REQUIRED', () => {
    const r = parseUnlockApiResponse(
      JSON.stringify({
        ok: false,
        code: 'SIGNER_IMPORT_REQUIRED',
        error: 'Bitte Mnemonic',
      }),
      false
    )
    expect(r).toEqual({
      ok: false,
      error: 'Bitte Mnemonic',
      code: 'SIGNER_IMPORT_REQUIRED',
    })
  })

  it('bei HTTP 400 und leerem ok-Feld liefert Fehlertext', () => {
    const r = parseUnlockApiResponse(JSON.stringify({ error: 'Falsches Passwort' }), false)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Falsches Passwort')
  })

  it('HTTP 200 mit ok:false im Body liefert Fehler', () => {
    const r = parseUnlockApiResponse(JSON.stringify({ ok: false, error: 'Abgelehnt' }), true)
    expect(r).toEqual({ ok: false, error: 'Abgelehnt', code: undefined })
  })
})
