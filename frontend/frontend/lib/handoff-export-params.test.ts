import { describe, expect, it } from 'vitest'
import {
  describeRoleIdBits,
  handoffParamsFromEinsatzTemplate,
  resolveHandoffExportParams,
} from './handoff-export-params'

describe('handoff-export-params', () => {
  it('überschreibt ROLE_ID per Tuning', () => {
    const r = resolveHandoffExportParams('helfer', { roleId: 4 })
    expect(r.roleId).toBe(4)
    expect(describeRoleIdBits(r.roleId)).toBe('L')
  })

  it('Einsatz-Vorlage Reporter → spezial + roleId', () => {
    const m = handoffParamsFromEinsatzTemplate({
      id: 'reporter',
      label: 'Reporter',
      chainRole: 'user',
      roleId: 4,
    })
    expect(m.presetId).toBe('spezial')
    expect(m.tuning.roleId).toBe(4)
  })

  it('Vorlage mit kommandant → fuehrer', () => {
    const m = handoffParamsFromEinsatzTemplate({
      id: 'zf',
      label: 'Zugführer',
      chainRole: 'kommandant',
      roleId: 14,
    })
    expect(m.presetId).toBe('fuehrer')
  })
})
