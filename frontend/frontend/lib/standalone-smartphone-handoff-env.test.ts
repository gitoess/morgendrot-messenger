import { describe, expect, it } from 'vitest'
import {
  buildStandaloneSmartphoneHandoffEnv,
  resolveHandoffExportPackageId,
  resolveHandoffSimpleMode,
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
})
