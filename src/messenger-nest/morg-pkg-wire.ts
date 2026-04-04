/**
 * Offline-Paket (.morg-pkg): gleiche ECDH P-256 + HKDF + AES-GCM wie /send (encryptMessage),
 * ohne On-Chain-Speicherung – für Sneakernet/USB.
 */
import { normalizeAddress } from '../utils.js';
import { deriveSharedSecret, deriveAesGcmKey, encryptMessage, decryptMessage } from '../crypto-layer.js';
import { MESSAGING_MAX_PLAINTEXT_UTF8_BYTES, MOVE_MAX_PURE_VECTOR_U8_BYTES } from '../chain-access.js';
import { assertMessengerMediaNetBlobWithinLimit } from '../messenger-media-limits.js';

export const MORG_PKG_SCHEMA = 'morgendrot.morgpkg.v1' as const;

export type MorgPkgV1 = {
    schema: typeof MORG_PKG_SCHEMA;
    version: 1;
    createdAtMs: number;
    sender: string;
    recipient: string;
    ivB64: string;
    ciphertextB64: string;
};

function assertPlaintextLimits(plaintext: string): void {
    const n = new TextEncoder().encode(plaintext).length;
    if (n > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
        throw new Error(
            `Nachricht zu lang (${n} B UTF-8, max. ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES}; Move reines Arg ${MOVE_MAX_PURE_VECTOR_U8_BYTES} B).`
        );
    }
    assertMessengerMediaNetBlobWithinLimit(plaintext);
}

export async function buildMorgPkgV1(params: {
    plaintext: string;
    sender: string;
    recipient: string;
    recipientPubRaw: Uint8Array;
    senderPrivKey: CryptoKey;
}): Promise<MorgPkgV1> {
    assertPlaintextLimits(params.plaintext);
    const sharedSecret = await deriveSharedSecret(params.senderPrivKey, params.recipientPubRaw);
    const aesKey = await deriveAesGcmKey(sharedSecret);
    const encrypted = await encryptMessage(aesKey, params.plaintext);
    return {
        schema: MORG_PKG_SCHEMA,
        version: 1,
        createdAtMs: Date.now(),
        sender: normalizeAddress(params.sender),
        recipient: normalizeAddress(params.recipient),
        ivB64: encrypted.iv,
        ciphertextB64: encrypted.ciphertext,
    };
}

export function isMorgPkgV1Shape(o: unknown): o is MorgPkgV1 {
    if (!o || typeof o !== 'object') return false;
    const r = o as Record<string, unknown>;
    return (
        r.schema === MORG_PKG_SCHEMA &&
        r.version === 1 &&
        typeof r.sender === 'string' &&
        typeof r.recipient === 'string' &&
        typeof r.ivB64 === 'string' &&
        typeof r.ciphertextB64 === 'string' &&
        r.ivB64.length > 0 &&
        r.ciphertextB64.length > 0
    );
}

export async function decryptMorgPkgV1(
    pkg: MorgPkgV1,
    params: { myAddress: string; myPrivKey: CryptoKey; senderPubRaw: Uint8Array }
): Promise<string> {
    if (!isMorgPkgV1Shape(pkg)) throw new Error('Ungültiges .morg-pkg (Schema/Version/Felder).');
    const me = normalizeAddress(params.myAddress);
    if (normalizeAddress(pkg.recipient) !== me) {
        throw new Error('Paket ist nicht für diese Wallet-Adresse (recipient ≠ MY_ADDRESS).');
    }
    const sharedSecret = await deriveSharedSecret(params.myPrivKey, params.senderPubRaw);
    const aesKey = await deriveAesGcmKey(sharedSecret);
    return decryptMessage(aesKey, pkg.ivB64, pkg.ciphertextB64);
}
