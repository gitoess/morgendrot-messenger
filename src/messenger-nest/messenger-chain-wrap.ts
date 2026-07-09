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
    storeTeamPlaintextBroadcast,
    storeTeamEncryptedBroadcast,
    purgeHandshake as chainPurgeHandshake,
    purgeMessage as chainPurgeMessage,
    purgeTeamPlaintextBroadcast as chainPurgeTeamPlaintextBroadcast,
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
import { encryptIotaPeerSessionMessage } from '../shared/morgendrot-crypto-session-wire.js';
import { getSendKeyEpochForPeer } from './messenger-session-keys-state.js';
import { getWalletPassword } from './messenger-session-password.js';
import type { SignAndExecuteOptions } from '../chain-access.js';
import { assertMessengerMediaNetBlobWithinLimit } from '../messenger-media-limits.js';
import { plaintextStartsWithMorgEmergencyV1 } from '../shared/morg-emergency-v1-text.js';
import { parseMailboxOutNonceMarker } from '@morgendrot/core/queue/offline-mailbox';

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

export {
    buildMeshPeerInnerBlob,
    decryptMeshPeerInnerBlob,
    packMeshEmergencyV2Wire,
    decryptMeshEmergencyV2Wire,
} from '../shared/mesh-peer-wire.js';

function debugSendWire(): boolean {
    return process.env.MORG_DEBUG_SEND_WIRE === '1' || process.env.MORG_DEBUG_SEND_WIRE === 'true';
}

function wireKindForLog(plaintext: string): string {
    if (plaintextStartsWithMorgEmergencyV1(plaintext)) return 'emergency_v1';
    if (plaintext.startsWith('[[MORG_MAILBOX_NONCE_V1:')) return 'mailbox_nonce_v1';
    if (plaintext.startsWith('[[MORG_COMPACT_IMG_V1:')) return 'compact_img';
    if (plaintext.startsWith('[[MORG_FILE_TXT_V1:')) return 'file_txt';
    if (plaintext.startsWith('[[MORG_TXT_V1:')) return 'txt_v1';
    if (plaintext.startsWith('[[MORG_AUDIO_V1:')) return 'audio';
    if (/^\s*\{/.test(plaintext) || /^\s*\[/.test(plaintext)) return 'maybe_json_envelope';
    return 'plain';
}

export type SendEncryptedMessageOptions = {
    /** `true` → Chain-Event `send_encrypted_message`; `false` → `store_encrypted_message*`. */
    forceLegacyEncrypted?: boolean;
};

export async function sendEncryptedMessage(
    recipient: string,
    message: string,
    peerPubRaw: Uint8Array,
    myPrivKey: CryptoKey,
    sendOpts?: SendEncryptedMessageOptions
) {
    const parsedNonce = parseMailboxOutNonceMarker(message);
    const bodyForE2ee = parsedNonce ? parsedNonce.rest : message;
    const msgUtf8 = new TextEncoder().encode(bodyForE2ee).length;
    if (msgUtf8 > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
        throw new Error(
            `Nachricht zu lang (${msgUtf8} B UTF-8, max. ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES}; Move reines Arg ${MOVE_MAX_PURE_VECTOR_U8_BYTES} B).`
        );
    }
    assertMessengerMediaNetBlobWithinLimit(bodyForE2ee);
    if (plaintextStartsWithMorgEmergencyV1(bodyForE2ee)) {
        logger.warn(
            `morg.sos.outgoing kind=emergency_v1 utf8=${msgUtf8} head=${JSON.stringify(bodyForE2ee.slice(0, 120))}`
        );
    }
    if (debugSendWire()) {
        logger.info(
            `morg.send.wire kind=${wireKindForLog(message)} utf8=${msgUtf8} head=${JSON.stringify(message.slice(0, 80))}`
        );
    }
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const nonce = parsedNonce ? parsedNonce.nonce : BigInt(Date.now());
    const packed = await encryptIotaPeerSessionMessage({
        plaintext: bodyForE2ee,
        myAddress: MY_ADDR,
        peerAddress: recipient,
        myPrivKey,
        peerPubRaw,
        msgId: String(nonce),
        keyEpoch: getSendKeyEpochForPeer(recipient),
    });
    const ciphertext = packed.ciphertext;
    const iv = packed.iv;
    const tag = packed.tag;
    const result = await storeEncryptedMessage(
        recipient,
        MY_ADDR,
        ciphertext,
        iv,
        tag,
        nonce,
        undefined,
        getWalletPassword(),
        {
            forceLegacyEncrypted: sendOpts?.forceLegacyEncrypted,
            signOptions: messengerGasPolicyOpts(),
        }
    );
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}${result.status ? ` (${result.status})` : ''}`);
    return result;
}

/** Bereits verschlüsseltes Wire on-chain speichern (Offline-Queue, kein Re-Encrypt). */
export async function sendEncryptedWireOnly(
    recipient: string,
    ciphertext: Uint8Array,
    iv: Uint8Array,
    tag: Uint8Array,
    nonce: bigint,
    sendOpts?: SendEncryptedMessageOptions
) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const result = await storeEncryptedMessage(
        recipient,
        MY_ADDR,
        ciphertext,
        iv,
        tag,
        nonce,
        undefined,
        getWalletPassword(),
        {
            forceLegacyEncrypted: sendOpts?.forceLegacyEncrypted,
            signOptions: messengerGasPolicyOpts(),
        }
    );
    if (result?.digest) logger.info(`TX ausgeführt: ${result.digest}${result.status ? ` (${result.status})` : ''}`);
    return result;
}

export type SendPlaintextOnlyOptions = {
  /**
   * `true` (Default): Move-Event-Pfad `send_plaintext_message` (Legacy, z. B. CLI `/send-plain`).
   * `false`: wenn `MAILBOX_STORE_PLAINTEXT` + gültige `MAILBOX_ID` — `store_plaintext_message*` (Mailbox).
   */
  forceLegacyPlaintext?: boolean;
};

/** Nur Klartext senden – kein Handshake nötig. */
export async function sendPlaintextOnly(recipient: string, text: string, sendOpts?: SendPlaintextOnlyOptions) {
    const parsedNonce = parseMailboxOutNonceMarker(text);
    const body = parsedNonce ? parsedNonce.rest : text;
    const n = new TextEncoder().encode(body).length;
    if (n > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
        throw new Error(
            `Klartext zu lang (${n} B UTF-8, max. ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES}; Move reines Arg ${MOVE_MAX_PURE_VECTOR_U8_BYTES} B).`
        );
    }
    assertMessengerMediaNetBlobWithinLimit(body);
    if (plaintextStartsWithMorgEmergencyV1(body)) {
        logger.warn(
            `morg.sos.outgoing plaintext kind=emergency_v1 utf8=${n} head=${JSON.stringify(body.slice(0, 120))}`
        );
    }
    const nonce = parsedNonce ? parsedNonce.nonce : BigInt(Date.now());
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const forceLegacy = sendOpts?.forceLegacyPlaintext !== false;
    return storePlaintextMessage(recipient, MY_ADDR, new TextEncoder().encode(body), nonce, getWalletPassword(), {
        forceLegacyPlaintext: forceLegacy,
        signOptions: messengerGasPolicyOpts(),
    });
}

/** Team-Broadcast Klartext — 1× TX in Shared Team-Mailbox (Gruppenchat M2c). */
export async function sendTeamPlaintextBroadcastOnly(teamMailboxObjectId: string, text: string) {
    const parsedNonce = parseMailboxOutNonceMarker(text);
    const body = parsedNonce ? parsedNonce.rest : text;
    const n = new TextEncoder().encode(body).length;
    if (n > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
        throw new Error(
            `Klartext zu lang (${n} B UTF-8, max. ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES}; Move reines Arg ${MOVE_MAX_PURE_VECTOR_U8_BYTES} B).`
        );
    }
    assertMessengerMediaNetBlobWithinLimit(body);
    const nonce = parsedNonce ? parsedNonce.nonce : BigInt(Date.now());
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return storeTeamPlaintextBroadcast(
        teamMailboxObjectId.trim(),
        MY_ADDR,
        new TextEncoder().encode(body),
        nonce,
        getWalletPassword(),
        { signOptions: messengerGasPolicyOpts() }
    );
}

/** Team-Broadcast verschlüsselt — 1× TX in Shared Team-Mailbox (§ H.23 B1). */
export async function sendTeamEncryptedBroadcastOnly(
    teamMailboxObjectId: string,
    wireJson: string
) {
    type Wire = {
        ciphertextB64?: string;
        ivB64?: string;
        tagB64?: string;
        keyEpoch?: number;
        nonce?: string;
    };
    let parsed: Wire;
    try {
        parsed = JSON.parse(wireJson) as Wire;
    } catch {
        throw new Error('Team-Broadcast verschlüsselt: ungültiges Wire-JSON.');
    }
    const ciphertext = base64ToUint8(String(parsed.ciphertextB64 ?? ''));
    const iv = base64ToUint8(String(parsed.ivB64 ?? ''));
    const tag = base64ToUint8(String(parsed.tagB64 ?? ''));
    if (ciphertext.length === 0 || iv.length === 0 || tag.length === 0) {
        throw new Error('Team-Broadcast verschlüsselt: ciphertext/iv/tag fehlen.');
    }
    const keyEpoch = BigInt(Math.max(1, Math.trunc(Number(parsed.keyEpoch) || 1)));
    const nonce = parsed.nonce?.trim() ? BigInt(parsed.nonce.trim()) : BigInt(Date.now());
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    return storeTeamEncryptedBroadcast(
        teamMailboxObjectId.trim(),
        MY_ADDR,
        ciphertext,
        iv,
        tag,
        keyEpoch,
        nonce,
        getWalletPassword(),
        { signOptions: messengerGasPolicyOpts() }
    );
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

export async function purgeTeamPlaintextBroadcast(
    teamMailboxObjectId: string,
    broadcastSender: string,
    nonce: bigint
) {
    const MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    const result = await chainPurgeTeamPlaintextBroadcast(
        teamMailboxObjectId,
        broadcastSender,
        nonce,
        MY_ADDR,
        getWalletPassword(),
        messengerGasPolicyOpts()
    );
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
