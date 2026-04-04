/**
 * Verschlüsselter Export/Import nur der Kontakt-Mesh-Metadaten (kein vollständiger Wallet-Vault).
 * AES-256-GCM + scrypt (für QR/LAN-Transfer PC ↔ Handy).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import type { ContactDirectory } from './contact-labels.js';
import { loadContactDirectory, mergeContactDirectory } from './contact-labels.js';

const VERSION = 1;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

export type EncryptedMeshBundle = {
    v: number;
    salt: string;
    iv: string;
    tag: string;
    ciphertext: string;
};

function deriveKey(password: string, salt: Buffer): Buffer {
    return scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
}

/** Baut minimiertes JSON nur mit label + mesh-Feldern pro Adresse. */
export function meshSubsetForExport(dir: ContactDirectory): ContactDirectory {
    const out: ContactDirectory = {};
    for (const [addr, e] of Object.entries(dir)) {
        if (!/^0x[a-f0-9]{64}$/.test(addr)) continue;
        out[addr] = {
            label: e.label,
            ...(e.meshNodeId && { meshNodeId: e.meshNodeId }),
            ...(e.meshPublicKeyHex && { meshPublicKeyHex: e.meshPublicKeyHex }),
            ...(e.bleUuid && { bleUuid: e.bleUuid }),
        };
    }
    return out;
}

export function encryptMeshDirectory(password: string, dir: ContactDirectory): EncryptedMeshBundle {
    const salt = randomBytes(16);
    const key = deriveKey(password, salt);
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plain = JSON.stringify(meshSubsetForExport(dir));
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        v: VERSION,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ciphertext: enc.toString('base64'),
    };
}

export function decryptMeshDirectory(password: string, bundle: EncryptedMeshBundle): ContactDirectory {
    if (bundle.v !== VERSION) throw new Error('Unbekannte Bundle-Version');
    const salt = Buffer.from(bundle.salt, 'base64');
    const iv = Buffer.from(bundle.iv, 'base64');
    const tag = Buffer.from(bundle.tag, 'base64');
    const ciphertext = Buffer.from(bundle.ciphertext, 'base64');
    if (iv.length !== IV_LEN || tag.length !== TAG_LEN) throw new Error('Ungültige IV/Tag-Länge');
    const key = deriveKey(password, salt);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plain) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Ungültiger Klartext');
    }
    return parsed as ContactDirectory;
}

/** Exportiert aktuelles Verzeichnis verschlüsselt (Passwort nur über TLS/localhost verwenden). */
export function exportEncryptedContactMesh(password: string): EncryptedMeshBundle {
    return encryptMeshDirectory(password, loadContactDirectory());
}

export function importEncryptedContactMesh(password: string, bundle: EncryptedMeshBundle): { merged: number } {
    const incoming = decryptMeshDirectory(password, bundle);
    return mergeContactDirectory(incoming);
}
