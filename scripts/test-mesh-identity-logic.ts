/**
 * Simulation: Logik hinter ShieldCheck (ohne Browser).
 * Hinweis: Der Haken hängt an der IOTA-Absenderadresse + Vault-Eintrag mit meshNodeId + meshPublicKeyHex,
 * nicht an einem „live eingehenden Funk-Paket“ im Posteingang.
 */
import { strict as assert } from 'node:assert'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const verifyUrl = pathToFileURL(join(root, 'frontend', 'frontend', 'lib', 'mesh-contact-verify.ts')).href
const { isMeshEntryVerified, isAddressMeshVerifiedInDirectory } = await import(verifyUrl)

const addr = '0x' + 'e'.repeat(64)

assert.equal(isMeshEntryVerified(undefined), false, 'no entry')
assert.equal(isMeshEntryVerified({ label: 'x' } as { meshNodeId?: string }), false, 'no mesh')
assert.equal(
  isMeshEntryVerified({ meshNodeId: '!abc', meshPublicKeyHex: 'a'.repeat(64) }),
  true,
  'full mesh binding'
)
assert.equal(
  isMeshEntryVerified({ meshNodeId: '!abc', meshPublicKeyHex: '' }),
  false,
  'missing key'
)

const dir: Record<string, { label: string; meshNodeId?: string; meshPublicKeyHex?: string }> = {
  [addr]: { label: 'Tom', meshNodeId: '!beef', meshPublicKeyHex: 'b'.repeat(64) },
}

assert.equal(isAddressMeshVerifiedInDirectory(dir, addr), true, 'directory hit')
assert.equal(isAddressMeshVerifiedInDirectory(dir, addr.toUpperCase()), true, 'case normalize')
assert.equal(
  isAddressMeshVerifiedInDirectory(dir, '0x' + 'f'.repeat(64)),
  false,
  'unknown address'
)
assert.equal(isAddressMeshVerifiedInDirectory(dir, 'not-hex'), false, 'invalid address')

console.log('test-mesh-identity-logic: ok (ShieldCheck-Prädikat)')
