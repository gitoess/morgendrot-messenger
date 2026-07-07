import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveVaultFilePathForSession, vaultFileExists } from './vault-local'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'morg-vault-resolve-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveVaultFilePathForSession', () => {
  it('does not pick cwd vault when explicit absolute VAULT_FILE is configured', () => {
    const cwd = makeTempDir()
    const isolated = makeTempDir()
    const cwdVault = path.join(cwd, '.morgendrot-vault')
    fs.writeFileSync(cwdVault, 'legacy', 'utf8')
    const configured = path.join(isolated, '.morgendrot-vault')
    const resolved = resolveVaultFilePathForSession(configured, cwd)
    expect(resolved).toBe(configured)
    expect(vaultFileExists(resolved)).toBe(false)
  })

  it('falls back to single cwd vault when VAULT_FILE is not configured', () => {
    const cwd = makeTempDir()
    const cwdVault = path.join(cwd, '.morgendrot-vault')
    fs.writeFileSync(cwdVault, 'only-one', 'utf8')
    const prev = process.cwd()
    process.chdir(cwd)
    try {
      const resolved = resolveVaultFilePathForSession(undefined, cwd)
      expect(path.resolve(cwd, resolved)).toBe(cwdVault)
    } finally {
      process.chdir(prev)
    }
  })
})
