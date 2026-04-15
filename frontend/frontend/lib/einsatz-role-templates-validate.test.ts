import { describe, it, expect } from 'vitest'
import { validateEinsatzRoleTemplatesBody, EINSATZ_TEMPLATES_MAX } from './einsatz-role-templates-validate'

const validOne = {
  templates: [
    {
      id: 'medic-1',
      label: 'Medic',
      chainRole: 'arbeiter',
      roleId: 2,
    },
  ],
}

describe('validateEinsatzRoleTemplatesBody', () => {
  it('akzeptiert gültige Vorlage', () => {
    const r = validateEinsatzRoleTemplatesBody(validOne)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.templates).toHaveLength(1)
      expect(r.templates[0]?.id).toBe('medic-1')
      expect(r.templates[0]?.chainRole).toBe('arbeiter')
    }
  })

  it('lehnt kein Objekt ab', () => {
    expect(validateEinsatzRoleTemplatesBody([]).ok).toBe(false)
    expect(validateEinsatzRoleTemplatesBody(null).ok).toBe(false)
  })

  it('lehnt fehlendes templates-Array ab', () => {
    expect(validateEinsatzRoleTemplatesBody({}).ok).toBe(false)
  })

  it('lehnt doppelte id ab', () => {
    const r = validateEinsatzRoleTemplatesBody({
      templates: [
        { id: 'x', label: 'A', chainRole: 'user', roleId: 0 },
        { id: 'x', label: 'B', chainRole: 'user', roleId: 1 },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Doppelte')
  })

  it('lehnt ungültige chainRole ab', () => {
    const r = validateEinsatzRoleTemplatesBody({
      templates: [{ id: 'a', label: 'L', chainRole: 'boss', roleId: 0 }],
    })
    expect(r.ok).toBe(false)
  })

  it('lehnt roleId außerhalb 0–63 ab', () => {
    const r = validateEinsatzRoleTemplatesBody({
      templates: [{ id: 'a', label: 'L', chainRole: 'user', roleId: 64 }],
    })
    expect(r.ok).toBe(false)
  })

  it('lehnt zu viele Einträge ab', () => {
    const many = Array.from({ length: EINSATZ_TEMPLATES_MAX + 1 }, (_, i) => ({
      id: `x${i}`,
      label: 'L',
      chainRole: 'user' as const,
      roleId: 0,
    }))
    const r = validateEinsatzRoleTemplatesBody({ templates: many })
    expect(r.ok).toBe(false)
  })

  it('normalisiert id zu Kleinbuchstaben', () => {
    const r = validateEinsatzRoleTemplatesBody({
      templates: [{ id: 'ABC', label: 'L', chainRole: 'user', roleId: 0 }],
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.templates[0]?.id).toBe('abc')
  })
})
