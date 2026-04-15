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
})
