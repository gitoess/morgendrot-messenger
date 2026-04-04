/**
 * QR-/Sync-Krypto: falsches Passwort scheitert; Bundle-JSON-Größe bleibt für typische Kontaktliste QR-freundlich.
 */
import { strict as assert } from 'node:assert'
import { encryptMeshDirectory, decryptMeshDirectory } from '../src/contact-mesh-sync.js'
import type { ContactDirectory } from '../src/contact-labels.js'

const dir: ContactDirectory = {
  ['0x' + 'a'.repeat(64)]: {
    label: 'Alice',
    meshNodeId: '!cafebabe',
    meshPublicKeyHex: 'd'.repeat(64),
    bleUuid: '11111111-2222-3333-4444-555555555555',
  },
  ['0x' + 'b'.repeat(64)]: {
    label: 'Bob',
    meshNodeId: '!dead',
    meshPublicKeyHex: 'e'.repeat(64),
  },
}

const pw = 'correcthorse12'
const bundle = encryptMeshDirectory(pw, dir)
const json = JSON.stringify(bundle)
const bytes = Buffer.byteLength(json, 'utf8')

assert.ok(bytes < 12_000, `bundle JSON should stay moderate for QR chunking (${bytes} bytes)`)

const round = decryptMeshDirectory(pw, bundle)
assert.equal(Object.keys(round).length, 2, 'roundtrip count')
assert.equal(
  round['0x' + 'a'.repeat(64)]?.bleUuid,
  '11111111-2222-3333-4444-555555555555',
  'bleUuid roundtrip'
)

let wrongFailed = false
try {
  decryptMeshDirectory('wrongpassword', bundle)
} catch {
  wrongFailed = true
}
assert.equal(wrongFailed, true, 'wrong password must not decrypt')

console.log(`test-mesh-qr-crypto: ok (bundle ${bytes} bytes UTF-8, scrypt+aes-gcm)`)
