import { describe, expect, it } from 'vitest'
import { bossRegistryStatus } from './boss-registry-bootstrap'

const PKG = `0x${'a'.repeat(64)}`
const MB = `0x${'b'.repeat(64)}`
const VR = `0x${'c'.repeat(64)}`
const CR = `0x${'d'.repeat(64)}`

describe('bossRegistryStatus', () => {
  it('needsBootstrap wenn Package ohne Mailbox', () => {
    const s = bossRegistryStatus({ packageId: PKG } as never)
    expect(s.hasPackage).toBe(true)
    expect(s.needsBootstrap).toBe(true)
  })

  it('vollständig wenn alle IDs da', () => {
    const s = bossRegistryStatus({
      packageId: PKG,
      mailboxId: MB,
      einsatzConfig: { vaultRegistryId: VR, commandRegistryId: CR },
    } as never)
    expect(s.needsBootstrap).toBe(false)
  })
})
