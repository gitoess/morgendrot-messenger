import { describe, expect, it } from 'vitest'
import {
  applyEinsatzHandoffTemplate,
  buildHandoffTemplateSnapshotFromExport,
  buildEinsatzTemplateFromHandoffExport,
} from './handoff-export-to-template'
import { resolveHandoffExportParams } from './handoff-export-params'
import { validateEinsatzRoleTemplatesBody } from './einsatz-role-templates-validate'

describe('handoff-export-to-template Phase 4', () => {
  it('speichert und validiert vollen Snapshot', () => {
    const resolved = resolveHandoffExportParams('helfer', {
      roleId: 12,
      helperRole: 'messenger',
      omitTeamMailboxes: false,
    })
    const snapshot = buildHandoffTemplateSnapshotFromExport({
      presetId: 'helfer',
      bezeichnung: 'Medic Süd',
      resolvedParams: resolved,
      tuningRoleId: 12,
      tuningHelperRole: '',
      tuningSimpleMode: 'preset',
      capabilitiesOverride: {
        transport: {
          lora: { read: true, write: true },
          telegram: { read: true, write: false },
        },
      },
      selectedTeamIds: ['0x' + 'a'.repeat(64)],
      selectedPartnerAddresses: ['0x' + 'b'.repeat(64)],
      includeIotaArchivReadme: true,
      handoffRpc: '',
      handoffPkgSource: 'boss',
      handoffPkgCustom: '',
      handoffBoss: '',
      handoffMailbox: '',
      handoffCmdReg: '',
      handoffVaultReg: '',
      handoffDirectIota: '',
    })
    const template = buildEinsatzTemplateFromHandoffExport({
      id: 'medic-sued',
      label: 'Medic Süd',
      helperRole: 'messenger',
      roleId: 12,
      handoffSnapshot: snapshot,
    })
    const validated = validateEinsatzRoleTemplatesBody({ templates: [template] })
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    const applied = applyEinsatzHandoffTemplate(validated.templates[0]!)
    expect(applied.hasFullSnapshot).toBe(true)
    expect(applied.presetId).toBe('helfer')
    expect(applied.capabilitiesOverride?.transport?.telegram?.write).toBe(false)
    expect(applied.selectedTeamIds).toHaveLength(1)
    expect(applied.selectedPartnerAddresses).toHaveLength(1)
    expect(applied.includeIotaArchivReadme).toBe(true)
  })

  it('Legacy-Vorlage ohne Snapshot bleibt kompatibel', () => {
    const applied = applyEinsatzHandoffTemplate({
      id: 'legacy',
      label: 'Reporter',
      chainRole: 'arbeiter',
      roleId: 4,
    })
    expect(applied.hasFullSnapshot).toBe(false)
    expect(applied.presetId).toBe('helfer')
    expect(applied.tuning.helperRole).toBe('arbeiter')
  })
})
