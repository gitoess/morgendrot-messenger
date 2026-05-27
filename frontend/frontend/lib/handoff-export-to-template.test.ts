import { describe, expect, it } from 'vitest'
import {
  buildEinsatzTemplateFromHandoffExport,
  helperRoleToChainRole,
  slugifyHandoffTemplateId,
  upsertEinsatzRoleTemplate,
} from './handoff-export-to-template'

describe('handoff-export-to-template', () => {
  it('slugify erzeugt gültige id', () => {
    expect(slugifyHandoffTemplateId('Reporter Nur-Lesen')).toBe('reporter-nur-lesen')
    expect(slugifyHandoffTemplateId('')).toBe('vorlage')
  })

  it('messenger → chainRole user', () => {
    expect(helperRoleToChainRole('messenger')).toBe('user')
    expect(helperRoleToChainRole('kommandant')).toBe('kommandant')
  })

  it('build + upsert', () => {
    const t = buildEinsatzTemplateFromHandoffExport({
      id: 'reporter',
      label: 'Reporter',
      helperRole: 'messenger',
      roleId: 12,
    })
    expect(t.roleId).toBe(12)
    expect(t.chainRole).toBe('user')
    const merged = upsertEinsatzRoleTemplate(
      [{ id: 'reporter', label: 'Alt', chainRole: 'user', roleId: 4 }],
      t
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.roleId).toBe(12)
  })
})
