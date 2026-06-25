import { describe, expect, it } from 'vitest'
import { buildHandoffZipExportBody } from './handoff-export-build-body'

describe('buildHandoffZipExportBody', () => {
  const base = {
    activePresetId: 'helfer' as const,
    bezeichnung: 'Test Helfer',
    selectedTeamIds: [`0x${'a'.repeat(64)}`],
    handoffBoss: `0x${'b'.repeat(64)}`,
    handoffMailbox: `0x${'a'.repeat(64)}`,
    handoffRpc: 'https://api.testnet.iota.cafe',
    handoffPkgSource: 'boss' as const,
    handoffPkgCustom: `0x${'c'.repeat(64)}`,
    handoffCmdReg: '',
    handoffVaultReg: '',
    handoffDirectIota: '',
    partnerExportCsv: '',
    includeIotaArchivReadme: true,
    protectWithPassword: false,
    einsatzChainMode: 'mainnet-direct' as const,
    bossDefaultTtlDays: 30,
    exportEnablePurge: true,
  }

  it('erzeugt Helfer-Body mit ROLE messenger', () => {
    const body = buildHandoffZipExportBody(base)
    expect(body.handoffLabel).toBe('Test Helfer')
    expect(body.helperRole).toBe('messenger')
    expect(body.simpleMode).toBe(true)
    expect(body.mailboxId).toBe(base.handoffMailbox)
  })

  it('setzt helperAddress im Gruppen-Pool', () => {
    const helper = `0x${'d'.repeat(64)}`
    const body = buildHandoffZipExportBody({ ...base, helperAddress: helper })
    expect(body.messengerGroupHandoff).toContain(helper)
  })
})
