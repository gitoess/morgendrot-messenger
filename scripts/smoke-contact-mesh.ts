/**
 * Kurztest: Kontakt-Mesh-Felder + verschlüsselter Export (ohne Root-Test-Suite).
 */
import { existsSync, unlinkSync } from 'node:fs';

const p = '.morgendrot-contact-labels-test.json';
if (existsSync(p)) unlinkSync(p);
process.env.CONTACT_LABELS_FILE = p;

const {
    saveContactLabel,
    saveContactMeshFields,
    loadContactDirectory,
    getContactByMeshNodeId,
    getContactByBleUuid,
    mergeContactDirectory,
} = await import('../src/contact-labels.js');
const { encryptMeshDirectory, decryptMeshDirectory } = await import('../src/contact-mesh-sync.js');

const a = '0x' + 'c'.repeat(64);
saveContactLabel(a, 'Tom');
saveContactMeshFields(a, {
    meshNodeId: '!deadbeef',
    meshPublicKeyHex: 'a'.repeat(64),
    bleUuid: '550e8400-e29b-41d4-a716-446655440000',
});

const d = loadContactDirectory();
if (d[a].label !== 'Tom' || d[a].meshNodeId !== '!deadbeef' || d[a].bleUuid !== '550e8400-e29b-41d4-a716-446655440000') {
    throw new Error('mesh fields');
}
const h = getContactByMeshNodeId('!DEADBEEF');
if (!h || h.address !== a) throw new Error('lookup');
const ble = getContactByBleUuid('550E8400-E29B-41D4-A716-446655440000');
if (!ble || ble.address !== a) throw new Error('ble lookup');

const bundle = encryptMeshDirectory('longpassword12', d);
const d2 = decryptMeshDirectory('longpassword12', bundle);
if (!d2[a]) throw new Error('decrypt');

mergeContactDirectory({ [a]: { label: 'Tom2', meshNodeId: '!ab' } });
const d3 = loadContactDirectory();
if (d3[a].label !== 'Tom2') throw new Error('merge');

unlinkSync(p);
console.log('smoke-contact-mesh: ok');
