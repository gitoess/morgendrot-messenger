/**
 * Gemeinsame Hilfen für `messenger-command-handler.ts` (Slice F).
 */
import { CFG } from '../config.js';
import { addressOwnsObject, getClient } from '../chain-access.js';
import { purgeHandshake, purgeMessage } from './messenger-chain-wrap.js';
import type { CommandApiOptions } from './command-api-options.js';
import {
    resolveForceLegacyEncrypted,
    resolveForceLegacyPlaintext,
} from '../messaging-persistence-resolve.js';

export function messengerGasPolicyOpts() {
    return CFG.MESSENGER_AUTO_SPONSOR ? ({ messengerGasPolicy: true as const } as const) : undefined;
}

/** Optional: nur mit Besitz von PAIRING_GATE_NFT_OBJECT_ID (privates Peering). */
export async function assertPairingGateNftOwned(myAddress: string): Promise<{ ok: false; message: string } | undefined> {
    const gate = (CFG.PAIRING_GATE_NFT_OBJECT_ID || '').trim();
    if (!gate) return undefined;
    if (!/^0x[a-fA-F0-9]{64}$/i.test(gate)) {
        return {
            ok: false,
            message:
                'PAIRING_GATE_NFT_OBJECT_ID ist gesetzt aber ungültig (erwartet: 0x + 64 Hex). Bitte .env korrigieren oder leeren – sonst kein klares Türsteher-Verhalten.',
        };
    }
    const owns = await addressOwnsObject(getClient(), gate, myAddress);
    if (owns) return undefined;
    return {
        ok: false,
        message:
            'PAIRING_GATE_NFT_OBJECT_ID ist gesetzt: Deine Wallet muss dieses NFT (Türsteher) besitzen für /pairing-offer und /pairing-find.',
    };
}

export function moveMailboxEntryMissing(msg: string): boolean {
    return /E_HS_MISSING|E_MSG_MISSING|HS_MISSING|MSG_MISSING|missing|not found|MoveAbort|does not exist|object not found|Move abort|No dynamic field|dynamic field/i.test(
        msg
    );
}

/** Move HsKey/MsgKey ist (recipient, sender) wie beim Speichern – je nachdem wer den Handshake zuerst gesendet hat, muss die andere Richtung probiert werden. */
export async function purgeHandshakeBidirectional(me: string, peer: string): Promise<void> {
    const m = me.trim();
    const p = peer.trim();
    try {
        await purgeHandshake(m, p);
        return;
    } catch (e) {
        if (!moveMailboxEntryMissing(String((e as Error)?.message ?? e))) throw e;
    }
    await purgeHandshake(p, m);
}

export async function purgeMessageBidirectional(me: string, peer: string, nonce: bigint): Promise<void> {
    const m = me.trim();
    const p = peer.trim();
    try {
        await purgeMessage(m, p, nonce);
        return;
    } catch (e) {
        if (!moveMailboxEntryMissing(String((e as Error)?.message ?? e))) throw e;
    }
    await purgeMessage(p, m, nonce);
}

export function resolveCommandForceLegacyPlaintext(opts?: CommandApiOptions): boolean {
    return resolveForceLegacyPlaintext({
        messagingPersistenceMode: opts?.messagingPersistenceMode,
    });
}

export function resolveCommandForceLegacyEncrypted(opts?: CommandApiOptions): boolean {
    return resolveForceLegacyEncrypted({
        messagingPersistenceMode: opts?.messagingPersistenceMode,
    });
}

/** Kurzdarstellung einer 0x-Adresse für CLI-/API-Antworten. */
export function formatAddressShort(addr: string, head = 12): string {
    const t = addr.trim();
    if (t.length <= head + 1) return t;
    return `${t.slice(0, head)}…`;
}
