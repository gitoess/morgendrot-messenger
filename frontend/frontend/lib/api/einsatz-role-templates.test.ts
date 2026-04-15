import { describe, it, expect } from 'vitest'
import { parseEinsatzRoleTemplatesResponse } from './einsatz-role-templates'

describe('parseEinsatzRoleTemplatesResponse', () => {
  it('lehnt ungültiges JSON ab', () => {
    const r = parseEinsatzRoleTemplatesResponse('not json', 200)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('JSON')
  })

  it('HTTP-Fehlerstatus → Fehler aus Body', () => {
    const r = parseEinsatzRoleTemplatesResponse(JSON.stringify({ ok: false, error: 'nope' }), 500)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('nope')
  })

  it('HTTP 200 aber ok:false → API-Fehler', () => {
    const r = parseEinsatzRoleTemplatesResponse(JSON.stringify({ ok: false, error: 'validation' }), 200)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('validation')
  })

  it('ok:true mit Template-Array', () => {
    const body = {
      ok: true,
      templates: [
        {
          id: 'medic',
          label: 'Medic',
          chainRole: 'worker',
          roleId: 2,
        },
      ],
    }
    const r = parseEinsatzRoleTemplatesResponse(JSON.stringify(body), 200)
    expect(r.ok).toBe(true)
    expect(r.templates).toHaveLength(1)
    expect(r.templates?.[0]?.id).toBe('medic')
    expect(r.message).toBeUndefined()
  })

  it('ok:true ohne templates → leeres Array', () => {
    const r = parseEinsatzRoleTemplatesResponse(JSON.stringify({ ok: true }), 200)
    expect(r.ok).toBe(true)
    expect(r.templates).toEqual([])
  })

  it('ok:true mit message', () => {
    const r = parseEinsatzRoleTemplatesResponse(
      JSON.stringify({ ok: true, templates: [], message: 'saved' }),
      200
    )
    expect(r.ok).toBe(true)
    expect(r.message).toBe('saved')
  })

  it('HTTP-Fehler ohne error-Feld → HTTP-Code-Text', () => {
    const r = parseEinsatzRoleTemplatesResponse(JSON.stringify({ ok: true, templates: [] }), 502)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('HTTP 502')
  })

  it('HTTP 200 ok:false ohne error → generische API-Meldung', () => {
    const r = parseEinsatzRoleTemplatesResponse(JSON.stringify({ ok: false }), 200)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('API meldet Fehler.')
  })

  it('JSON null → Unerwartetes Format', () => {
    const r = parseEinsatzRoleTemplatesResponse('null', 200)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Unerwartetes Antwortformat.')
  })

  it('JSON-Array als Root → kein ok-Feld', () => {
    const r = parseEinsatzRoleTemplatesResponse(JSON.stringify([{ id: 'x' }]), 200)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('API meldet Fehler.')
  })

  it('templates kein Array → leeres Array', () => {
    const r = parseEinsatzRoleTemplatesResponse(
      JSON.stringify({ ok: true, templates: { not: 'array' } }),
      200
    )
    expect(r.ok).toBe(true)
    expect(r.templates).toEqual([])
  })

  it('message kein String → undefined', () => {
    const r = parseEinsatzRoleTemplatesResponse(
      JSON.stringify({ ok: true, templates: [], message: 42 }),
      200
    )
    expect(r.ok).toBe(true)
    expect(r.message).toBeUndefined()
  })

  it('HTTP 400 mit ok:true im Body trotzdem Fehlerpfad', () => {
    const r = parseEinsatzRoleTemplatesResponse(JSON.stringify({ ok: true, templates: [] }), 400)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('HTTP 400')
  })
})
