import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('offerLocalVaultSave', () => {
  it('bietet Tresor sichern für Vault-Inhalte an', () => {
    const src = readFileSync(join(__dirname, 'offer-local-vault-save.ts'), 'utf8')
    expect(src).toMatch(/Tresor sichern/)
    expect(src).toMatch(/notes/)
    expect(src).toMatch(/secrets/)
    expect(src).toMatch(/seed/)
    expect(src).toMatch(/handshake/)
  })
})
