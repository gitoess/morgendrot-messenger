import { describe, expect, it } from 'vitest'
import {
  buildStandaloneSmartphoneHandoffEnv,
  resolveHandoffExportPackageId,
  resolveHandoffSimpleMode,
  reconcileHandoffExportGlobals,
} from '@morgendrot/shared/standalone-smartphone-handoff-env'

const PKG = '0x' + 'a'.repeat(64)
const BOSS = '0x' + 'b'.repeat(64)
const MB = '0x' + 'c'.repeat(64)

describe('standalone-smartphone-handoff-env', () => {
  it('builds env with package, boss, mailbox, ttl', () => {
    const env = buildStandaloneSmartphoneHandoffEnv({
      rpcUrl: 'https://api.testnet.iota.cafe',
      packageId: PKG,
      bossAddress: BOSS,
      mailboxId: MB,
      exportTtlDays: 14,
      exportEnablePurge: false,
    })
    expect(env).toContain(`PACKAGE_ID=${PKG}`)
    expect(env).toContain(`BOSS_ADDRESS=${BOSS}`)
    expect(env).toContain(`MAILBOX_ID=${MB}`)
    expect(env).toContain('DEFAULT_TTL_DAYS=14')
    expect(env).toContain('ENABLE_PURGE=false')
    expect(env).toContain('MY_ADDRESS=')
  })

  it('resolveHandoffSimpleMode: arbeiter default true', () => {
    expect(resolveHandoffSimpleMode('arbeiter')).toBe(true)
    expect(resolveHandoffSimpleMode('kommandant')).toBe(false)
  })

  it('resolveHandoffExportPackageId: boss from context', () => {
    const r = resolveHandoffExportPackageId({ source: 'boss', bossPackageId: PKG })
    expect(r).toEqual({ ok: true, packageId: PKG })
  })

  it('resolveHandoffExportPackageId: history fails offline', () => {
    const r = resolveHandoffExportPackageId({ source: 'history' })
    expect(r.ok).toBe(false)
  })

  it('reconcileHandoffExportGlobals: mismatch auto-corrects', () => {
    const chainMb = '0x' + 'd'.repeat(64)
    const wrongMb = '0x' + 'e'.repeat(64)
    const r = reconcileHandoffExportGlobals({
      packageId: PKG,
      mailboxId: wrongMb,
      resolved: {
        mailboxId: chainMb,
        commandRegistryId: '0x' + '1'.repeat(64),
        vaultRegistryId: '0x' + '2'.repeat(64),
      },
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.mailboxId).toBe(chainMb)
      expect(r.corrected).toBe(true)
      expect(r.warnings.length).toBeGreaterThan(0)
    }
  })

  it('reconcileHandoffExportGlobals: strict rejects mismatch', () => {
    const r = reconcileHandoffExportGlobals({
      packageId: PKG,
      mailboxId: MB,
      resolved: {
        mailboxId: '0x' + 'f'.repeat(64),
        commandRegistryId: '0x' + '1'.repeat(64),
        vaultRegistryId: '0x' + '2'.repeat(64),
      },
      autoCorrect: false,
    })
    expect(r.ok).toBe(false)
  })
})
