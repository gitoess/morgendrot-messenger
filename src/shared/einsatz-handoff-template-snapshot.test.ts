import { describe, expect, it } from 'vitest'
import { parseEinsatzHandoffTemplateSnapshot } from './einsatz-handoff-template-snapshot.js'
import { parseEinsatzRoleTemplates } from './einsatz-role-templates.js'

const ADDR_A = '0x' + 'a'.repeat(64)

describe('einsatz-handoff-template-snapshot', () => {
  it('parst gültigen Snapshot', () => {
    const r = parseEinsatzHandoffTemplateSnapshot({
      schemaVersion: 1,
      presetId: 'helfer',
      bezeichnungHint: 'Medic',
      tuning: { roleId: 12, helperRole: 'messenger', simpleMode: true },
      capabilitiesOverride: { transport: { lora: { write: true } } },
      export: {
        teamMailboxIds: [ADDR_A],
        partnerAddresses: [ADDR_A],
        includeIotaArchivReadme: true,
      },
    })
    expect(r.ok).toBe(true)
  })

  it('lehnt ungültige Partner-Adresse ab', () => {
    const r = parseEinsatzHandoffTemplateSnapshot({
      schemaVersion: 1,
      presetId: 'helfer',
      export: { partnerAddresses: ['not-an-address'] },
    })
    expect(r.ok).toBe(false)
  })

  it('wird in parseEinsatzRoleTemplates akzeptiert', () => {
    const r = parseEinsatzRoleTemplates({
      templates: [
        {
          id: 'medic',
          label: 'Medic',
          chainRole: 'arbeiter',
          roleId: 12,
          handoffSnapshot: {
            schemaVersion: 1,
            presetId: 'helfer',
            export: { teamMailboxIds: [ADDR_A] },
          },
        },
      ],
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.templates[0]?.handoffSnapshot?.presetId).toBe('helfer')
  })
})
