/**
 * Kammer „Chain-Hülle“: dünne Wrapper um chain-access; nutzt CFG + Session-Passwort.
 * Keine zusätzliche Geschäftslogik – nur Adress-Auflösung und Logging wo im Original.
 */
import { logger } from '../logger.js';
import { CFG } from '../config.js';
import {
    MOVE_MAX_PURE_VECTOR_U8_BYTES,
    MESSAGING_MAX_PLAINTEXT_UTF8_BYTES,
    sendEcdhInit,
    storeEncryptedMessage,
    storePlaintextMessage,
    purgeHandshake as chainPurgeHandshake,
    purgeMessage as chainPurgeMessage,
    enableEmergencyPurgeVault as chainEnableEmergencyPurgeVault,
    purgeVaultOnChain as chainPurgeVaultOnChain,
    createAccessKey as chainCreateAccessKey,
    createAccessKeyAndSendPlain as chainCreateAccessKeyAndSendPlain,
    enableEmergencyPurgeKey as chainEnableEmergencyPurgeKey,
    purgeKey as chainPurgeKey,
    createVaultOnChain as chainCreateVaultOnChain,
    updateVaultOnChain as chainUpdateVaultOnChain,
    getVaultFromChain,
    createAccessKeysBatchPtb as chainCreateAccessKeysBatchPtb,
} from '../chain-access.js';
import { deriveSharedSecret, deriveAesGcmKey, encryptMessage, decryptMessage } from '../crypto-layer.js';
import { buildEmergencyBinaryV2, tryParseEmergencyBinaryV2 } from '../emergency-binary-wire.js';
import { getWalletPassword } from './messenger-session-password.js';
import type { SignAndExecuteOptions } from '../chain-access.js';
import { assertMessengerMediaNetBlobWithinLimit } from '../messenger-media-limits.js';

/** Optionen für Sponsored Transaction: sender = logischer Absender (z. B. Gast), Sponsor zahlt Gas. */
export type SponsorOpts = { sponsorForSender?: string };

function messengerGasPolicyOpts(): SignAndExecuteOptions | undefined {
    return CFG.MESSENGER_AUTO_SPONSOR ? { messengerGasPolicy: true } : undefined;
}

export async function sendHandshake(recipient: string, myPubRaw: Uint8Array) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const result = await sendEcdhInit(recipient, MY_ADDR, myPubRaw, getWalletPassword(), messengerGasPolicyOpts());
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}${result.status ? ` (${result.status})` : ''}`);
    return result;
}

const MESH_V2_MAX_BYTES = 240;

/** Innerer Wire-Body für Funk: 12 Byte IV + AES-GCM(cipher+tag) wie bei /send (encryptMessage). */
export async function buildMeshPeerInnerBlob(
    message: string,
    peerPubRaw: Uint8Array,
    myPrivKey: CryptoKey
): Promise<Uint8Array> {
    const sharedSecret = await deriveSharedSecret(myPrivKey, peerPubRaw);
    const aesKey = await deriveAesGcmKey(sharedSecret);
    const encrypted = await encryptMessage(aesKey, message);
    const full = new Uint8Array(Buffer.from(encrypted.ciphertext, 'base64'));
    const iv = new Uint8Array(Buffer.from(encrypted.iv, 'base64'));
    const inner = new Uint8Array(12 + full.length);
    inner.set(iv, 0);
    inner.set(full, 12);
    return inner;
}

export async function decryptMeshPeerInnerBlob(
    inner: Uint8Array,
    senderPubRaw: Uint8Array,
    myPrivKey: CryptoKey
): Promise<string | null> {
    if (inner.length < 13) return null;
    const ivB64 = Buffer.from(inner.subarray(0, 12)).toString('base64');
    const combinedB64 = Buffer.from(inner.subarray(12)).toString('base64');
    try {
        const aesKey = await deriveAesGcmKey(await deriveSharedSecret(myPrivKey, senderPubRaw));
        return await decryptMessage(aesKey, ivB64, combinedB64);
    } catch {
        return null;
    }
}

/** Vollständiges Emergency-Binary-v2 (PRIVATE_APP) für einen Peer. */
export function packMeshEmergencyV2Wire(
    myIotaAddress: string,
    meshNonce: number,
    inner: Uint8Array
): { ok: true; wire: Uint8Array } | { ok: false; error: string } {
    return buildEmergencyBinaryV2(myIotaAddress, meshNonce, inner, MESH_V2_MAX_BYTES);
}

export async function decryptMeshEmergencyV2Wire(
    wire: Uint8Array,
    senderPubRaw: Uint8Array,
    myPrivKey: CryptoKey
): Promise<string | null> {
    const parsed = tryParseEmergencyBinaryV2(wire, MESH_V2_MAX_BYTES);
    if (!parsed) return null;
    return decryptMeshPeerInnerBlob(parsed.ciphertext, senderPubRaw, myPrivKey);
}

function debugSendWire(): boolean {
    return process.env.MORG_DEBUG_SEND_WIRE === '1' || process.env.MORG_DEBUG_SEND_WIRE === 'true';
}

function wireKindForLog(plaintext: string): string {
    if (plaintext.startsWith('[[MORG_COMPACT_IMG_V1:')) return 'compact_img';
    if (plaintext.startsWith('[[MORG_FILE_TXT_V1:')) return 'file_txt';
    if (plaintext.startsWith('[[MORG_TXT_V1:')) return 'txt_v1';
    if (plaintext.startsWith('[[MORG_AUDIO_V1:')) return 'audio';
    if (/^\s*\{/.test(plaintext) || /^\s*\[/.test(plaintext)) return 'maybe_json_envelope';
    return 'plain';
}

export async function sendEncryptedMessage(
    recipient: string,
    message: string,
    peerPubRaw: Uint8Array,
    myPrivKey: CryptoKey
) {
    const msgUtf8 = new TextEncoder().encode(message).length;
    if (msgUtf8 > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
        throw new Error(
            `Nachricht zu lang (${msgUtf8} B UTF-8, max. ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES}; Move reines Arg ${MOVE_MAX_PURE_VECTOR_U8_BYTES} B).`
        );
    }
    assertMessengerMediaNetBlobWithinLimit(message);
    if (debugSendWire()) {
        logger.info(
            `morg.send.wire kind=${wireKindForLog(message)} utf8=${msgUtf8} head=${JSON.stringify(message.slice(0, 80))}`
        );
    }
    const sharedSecret = await deriveSharedSecret(myPrivKey, peerPubRaw);
    const aesKey = await deriveAesGcmKey(sharedSecret);
    const encrypted = await encryptMessage(aesKey, message);
    const full = Buffer.from(encrypted.ciphertext, 'base64');
    const nonce = BigInt(Date.now());
    const ciphertext = new Uint8Array(full.subarray(0, -16));
    const iv = new Uint8Array(Buffer.from(encrypted.iv, 'base64'));
    const tag = new Uint8Array(full.subarray(-16));
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const result = await storeEncryptedMessage(
        recipient,
        MY_ADDR,
        ciphertext,
        iv,
        tag,
        nonce,
        CFG.ENABLE_PLAINTEXT_CHANNEL ? new TextEncoder().encode(message) : undefined,
        getWalletPassword(),
        messengerGasPolicyOpts()
    );
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}${result.status ? ` (${result.status})` : ''}`);
    return result;
}

/** Nur Klartext senden – kein Handshake nötig. */
export async function sendPlaintextOnly(recipient: string, text: string) {
    const n = new TextEncoder().encode(text).length;
    if (n > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
        throw new Error(
            `Klartext zu lang (${n} B UTF-8, max. ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES}; Move reines Arg ${MOVE_MAX_PURE_VECTOR_U8_BYTES} B).`
        );
    }
    assertMessengerMediaNetBlobWithinLimit(text);
    const nonce = BigInt(Date.now());
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return storePlaintextMessage(recipient, MY_ADDR, new TextEncoder().encode(text), nonce, getWalletPassword(), {
        forceLegacyPlaintext: true,
        signOptions: messengerGasPolicyOpts(),
    });
}

export async function purgeHandshake(recipient: string, sender: string) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const result = await chainPurgeHandshake(recipient, sender, MY_ADDR, getWalletPassword(), messengerGasPolicyOpts());
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}`);
    return result;
}

export async function purgeMessage(recipient: string, sender: string, nonce: bigint) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const result = await chainPurgeMessage(recipient, sender, nonce, MY_ADDR, getWalletPassword(), messengerGasPolicyOpts());
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}`);
    return result;
}

export async function enableEmergencyPurgeVault() {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return chainEnableEmergencyPurgeVault(MY_ADDR, getWalletPassword(), messengerGasPolicyOpts());
}

export async function purgeVaultOnChain(ownerAddress: string) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return chainPurgeVaultOnChain(ownerAddress, MY_ADDR, getWalletPassword(), messengerGasPolicyOpts());
}

export async function createAccessKey(lockId: string, recipient: string, ttlDays: bigint, opts?: SponsorOpts) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const sender = (opts?.sponsorForSender || '').trim();
    const useSponsor = Boolean(sender && CFG.SPONSORED_TRANSACTION_ENABLED && CFG.SPONSOR_GAS_OWNER && sender !== MY_ADDR);
    const signAddr = sender || MY_ADDR;
    const signPw = useSponsor ? undefined : getWalletPassword();
    const policy = messengerGasPolicyOpts();
    const options = useSponsor
        ? { sponsorAddress: CFG.SPONSOR_GAS_OWNER!, sponsorPassword: getWalletPassword(), ...policy }
        : policy;
    return chainCreateAccessKey(lockId, recipient, ttlDays, signAddr, signPw, options);
}

export async function createAccessKeyAndSendPlain(
    lockId: string,
    recipient: string,
    ttlDays: bigint,
    messageText: string,
    opts?: SponsorOpts
) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const sender = (opts?.sponsorForSender || '').trim();
    const useSponsor = Boolean(sender && CFG.SPONSORED_TRANSACTION_ENABLED && CFG.SPONSOR_GAS_OWNER && sender !== MY_ADDR);
    const signAddr = sender || MY_ADDR;
    const signPw = useSponsor ? undefined : getWalletPassword();
    const policy = messengerGasPolicyOpts();
    const options = useSponsor
        ? { sponsorAddress: CFG.SPONSOR_GAS_OWNER!, sponsorPassword: getWalletPassword(), ...policy }
        : policy;
    return chainCreateAccessKeyAndSendPlain(lockId, recipient, ttlDays, messageText, signAddr, signPw, options);
}

export async function createAccessKeysBatch(
    lockId: string,
    recipient: string,
    ttlDays: bigint,
    count: number,
    opts?: { sponsorForSender?: string }
) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const sender = (opts?.sponsorForSender || '').trim();
    const useSponsor = Boolean(sender && CFG.SPONSORED_TRANSACTION_ENABLED && CFG.SPONSOR_GAS_OWNER && sender !== MY_ADDR);
    const signAddr = sender || MY_ADDR;
    const signPw = useSponsor ? undefined : getWalletPassword();
    const policy = messengerGasPolicyOpts();
    const options = useSponsor
        ? { sponsorAddress: CFG.SPONSOR_GAS_OWNER!, sponsorPassword: getWalletPassword(), ...policy }
        : policy;
    return chainCreateAccessKeysBatchPtb(lockId, recipient, ttlDays, count, signAddr, signPw, options);
}

export async function enableEmergencyPurgeKey(keyObjectId: string) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return chainEnableEmergencyPurgeKey(keyObjectId, MY_ADDR, getWalletPassword(), messengerGasPolicyOpts());
}

export async function purgeKey(keyObjectId: string) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return chainPurgeKey(keyObjectId, MY_ADDR, getWalletPassword(), messengerGasPolicyOpts());
}

export async function createVaultOnChain(encryptedPayload: Uint8Array, ttlDays: bigint) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const { getClient } = await import('../chain-access.js');
    const existing = await getVaultFromChain(getClient(), CFG.VAULT_REGISTRY_ID!, CFG.PACKAGE_ID, MY_ADDR);
    const g = messengerGasPolicyOpts();
    const result =
        existing && existing.length > 0
            ? await chainUpdateVaultOnChain(encryptedPayload, ttlDays, MY_ADDR, getWalletPassword(), g)
            : await chainCreateVaultOnChain(encryptedPayload, ttlDays, MY_ADDR, getWalletPassword(), g);
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}`);
    return result;
}
