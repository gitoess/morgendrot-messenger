/**
 * Crypto Layer – autark, keine Abhängigkeit zu IOTA/Chain.
 * ECDH (P-256) + AES-GCM für Shared Secret und symmetrische Verschlüsselung.
 */
import crypto from 'crypto';

const subtle = crypto.webcrypto.subtle;
export const CURVE = 'P-256';

export type KeyPair = { privateKey: CryptoKey; pubRaw: Uint8Array };

export async function generateKeyPair(extractable = true): Promise<KeyPair> {
    const keyPair = await subtle.generateKey(
        { name: 'ECDH', namedCurve: CURVE },
        extractable,
        ['deriveBits', 'deriveKey']
    );
    const pubRaw = await subtle.exportKey('raw', keyPair.publicKey);
    return { privateKey: keyPair.privateKey, pubRaw: new Uint8Array(pubRaw) };
}

export async function deriveSharedSecret(privateKey: CryptoKey, peerPubRaw: Uint8Array): Promise<Uint8Array> {
    const peerPubKey = await subtle.importKey(
        'raw',
        Buffer.from(peerPubRaw),
        { name: 'ECDH', namedCurve: CURVE },
        false,
        []
    );
    const sharedBits = await subtle.deriveBits(
        { name: 'ECDH', public: peerPubKey },
        privateKey,
        256
    );
    return new Uint8Array(sharedBits);
}

export async function deriveAesGcmKey(sharedSecret: Uint8Array): Promise<CryptoKey> {
    const baseKey = await subtle.importKey('raw', Buffer.from(sharedSecret), 'HKDF', false, ['deriveBits', 'deriveKey']);
    return await subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(16),
            info: new TextEncoder().encode('morgendrot-aes-gcm'),
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

export async function encryptMessage(aesKey: CryptoKey, message: string): Promise<{ iv: string; ciphertext: string }> {
    const iv = crypto.randomBytes(12);
    const ciphertext = await subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        new TextEncoder().encode(message)
    );
    return {
        iv: iv.toString('base64'),
        ciphertext: Buffer.from(ciphertext).toString('base64'),
    };
}

export async function decryptMessage(
    aesKey: CryptoKey,
    ivBase64: string,
    ciphertextBase64: string
): Promise<string> {
    const decrypted = await subtle.decrypt(
        { name: 'AES-GCM', iv: Buffer.from(ivBase64, 'base64') },
        aesKey,
        Buffer.from(ciphertextBase64, 'base64')
    );
    return new TextDecoder().decode(decrypted);
}
