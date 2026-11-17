import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('offerLocalVaultSave copy', () => {
  it('klärt: Gruppe/Kanal nicht neu anlegen', () => {
    const src = readFileSync(join(__dirname, 'offer-local-vault-save.ts'), 'utf8')
    expect(src).toMatch(/Gruppe\/Kanal/)
    expect(src).toMatch(/nicht neu angelegt/)
  })
})
