/**
 * Kammer „Chain-Hülle“: dünne Wrapper um chain-access; nutzt CFG + Session-Passwort.
 * Keine zusätzliche Geschäftslogik – nur Adress-Auflösung und Logging wo im Original.
 */
import { logger } from '../logger.js';
import { CFG } from '../config.js';
import {
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
import { deriveSharedSecret, deriveAesGcmKey, encryptMessage } from '../crypto-layer.js';
import { getWalletPassword } from './messenger-session-password.js';

/** Optionen für Sponsored Transaction: sender = logischer Absender (z. B. Gast), Sponsor zahlt Gas. */
export type SponsorOpts = { sponsorForSender?: string };

export async function sendHandshake(recipient: string, myPubRaw: Uint8Array) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const result = await sendEcdhInit(recipient, MY_ADDR, myPubRaw, getWalletPassword());
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}${result.status ? ` (${result.status})` : ''}`);
    return result;
}

export async function sendEncryptedMessage(
    recipient: string,
    message: string,
    peerPubRaw: Uint8Array,
    myPrivKey: CryptoKey
) {
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
        getWalletPassword()
    );
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}${result.status ? ` (${result.status})` : ''}`);
    return result;
}

/** Nur Klartext senden – kein Handshake nötig. */
export async function sendPlaintextOnly(recipient: string, text: string) {
    const nonce = BigInt(Date.now());
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return storePlaintextMessage(recipient, MY_ADDR, new TextEncoder().encode(text), nonce, getWalletPassword(), {
        forceLegacyPlaintext: true,
    });
}

export async function purgeHandshake(recipient: string, sender: string) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const result = await chainPurgeHandshake(recipient, sender, MY_ADDR, getWalletPassword());
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}`);
    return result;
}

export async function purgeMessage(recipient: string, sender: string, nonce: bigint) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const result = await chainPurgeMessage(recipient, sender, nonce, MY_ADDR, getWalletPassword());
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}`);
    return result;
}

export async function enableEmergencyPurgeVault() {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return chainEnableEmergencyPurgeVault(MY_ADDR, getWalletPassword());
}

export async function purgeVaultOnChain(ownerAddress: string) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return chainPurgeVaultOnChain(ownerAddress, MY_ADDR, getWalletPassword());
}

export async function createAccessKey(lockId: string, recipient: string, ttlDays: bigint, opts?: SponsorOpts) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const sender = (opts?.sponsorForSender || '').trim();
    const useSponsor = Boolean(sender && CFG.SPONSORED_TRANSACTION_ENABLED && CFG.SPONSOR_GAS_OWNER && sender !== MY_ADDR);
    const signAddr = sender || MY_ADDR;
    const signPw = useSponsor ? undefined : getWalletPassword();
    const options = useSponsor ? { sponsorAddress: CFG.SPONSOR_GAS_OWNER, sponsorPassword: getWalletPassword() } : undefined;
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
    const options = useSponsor ? { sponsorAddress: CFG.SPONSOR_GAS_OWNER, sponsorPassword: getWalletPassword() } : undefined;
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
    const options = useSponsor ? { sponsorAddress: CFG.SPONSOR_GAS_OWNER, sponsorPassword: getWalletPassword() } : undefined;
    return chainCreateAccessKeysBatchPtb(lockId, recipient, ttlDays, count, signAddr, signPw, options);
}

export async function enableEmergencyPurgeKey(keyObjectId: string) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return chainEnableEmergencyPurgeKey(keyObjectId, MY_ADDR, getWalletPassword());
}

export async function purgeKey(keyObjectId: string) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return chainPurgeKey(keyObjectId, MY_ADDR, getWalletPassword());
}

export async function createVaultOnChain(encryptedPayload: Uint8Array, ttlDays: bigint) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const { getClient } = await import('../chain-access.js');
    const existing = await getVaultFromChain(getClient(), CFG.VAULT_REGISTRY_ID!, CFG.PACKAGE_ID, MY_ADDR);
    const result =
        existing && existing.length > 0
            ? await chainUpdateVaultOnChain(encryptedPayload, ttlDays, MY_ADDR, getWalletPassword())
            : await chainCreateVaultOnChain(encryptedPayload, ttlDays, MY_ADDR, getWalletPassword());
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}`);
    return result;
}
