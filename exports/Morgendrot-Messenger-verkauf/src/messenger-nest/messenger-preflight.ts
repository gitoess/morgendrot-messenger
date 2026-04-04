/**
 * Kammer „Vorfeld“: Backend-Veto vor riskanten Befehlen (KI, Tippfehler, unwirtschaftlicher Purge).
 */
import { CFG } from '../config.js';
import { getClient, getOwnedAccessKeys, getOwnedTickets } from '../chain-access.js';

export type PreFlightOptions = { myAddress?: string };

/** Backend-Veto vor kritischen Actions: purge*, transfer-coins, use-ticket, transfer-key, create-key (KI-Halluzination abfangen). Optional: Rebate-Check bei PURGE_MIN_REBATE_MIST. */
export async function preFlightCheck(
    cmd: string,
    args: string[],
    options?: PreFlightOptions
): Promise<{ ok: boolean; reason?: string }> {
    if (cmd === '/purge-key') {
        const keyId = (args[0] ?? '').trim();
        if (!keyId || keyId.startsWith('<') || keyId.toLowerCase() === 'undefined' || !/^0x[0-9a-fA-F]+$/.test(keyId))
            return { ok: false, reason: 'Key-Objekt-ID angeben (0x…). Zuerst /list-keys ausführen.' };
        if (CFG.PURGE_MIN_REBATE_MIST > 0 && options?.myAddress && CFG.PACKAGE_ID) {
            try {
                const client = getClient();
                const keys = await getOwnedAccessKeys(client, CFG.PACKAGE_ID, options.myAddress);
                const key = keys.find((k) => (k.objectId || '').trim().toLowerCase() === keyId.trim().toLowerCase());
                const rebateStr = key?.storageRebate;
                if (rebateStr != null) {
                    const rebateMist = BigInt(rebateStr);
                    if (rebateMist < BigInt(CFG.PURGE_MIN_REBATE_MIST))
                        return {
                            ok: false,
                            reason: `Purge unwirtschaftlich: Rebate ${rebateStr} Mist unter Minimum ${CFG.PURGE_MIN_REBATE_MIST} (PURGE_MIN_REBATE_MIST).`,
                        };
                }
            } catch {
                // Chain nicht erreichbar oder Fehler: Veto aus Sicherheit überspringen, Argument-Check reicht
            }
        }
        return { ok: true };
    }
    if (cmd === '/purge-ticket') {
        const ticketId = (args[0] ?? '').trim();
        if (!ticketId || ticketId.startsWith('<') || !/^0x[0-9a-fA-F]+$/.test(ticketId))
            return { ok: false, reason: 'Ticket-Objekt-ID angeben (0x…). Zuerst /list-tickets ausführen.' };
        if (!CFG.ENABLE_PURGE) return { ok: false, reason: 'Purge deaktiviert (ENABLE_PURGE).' };
        if (CFG.PURGE_MIN_REBATE_MIST > 0 && options?.myAddress && CFG.PACKAGE_ID) {
            try {
                const client = getClient();
                const tickets = await getOwnedTickets(client, CFG.PACKAGE_ID, options.myAddress);
                const ticket = tickets.find((t) => (t.objectId || '').trim().toLowerCase() === ticketId.trim().toLowerCase());
                const rebateStr = ticket?.storageRebate;
                if (rebateStr != null) {
                    const rebateMist = BigInt(rebateStr);
                    if (rebateMist < BigInt(CFG.PURGE_MIN_REBATE_MIST))
                        return {
                            ok: false,
                            reason: `Purge unwirtschaftlich: Rebate ${rebateStr} Mist unter Minimum ${CFG.PURGE_MIN_REBATE_MIST} (PURGE_MIN_REBATE_MIST).`,
                        };
                }
            } catch {}
        }
        return { ok: true };
    }
    if (cmd === '/transfer-coins') {
        const toAddr = (args[0] ?? '').trim();
        const iotaStr = (args[1] ?? '').trim();
        if (!toAddr || !toAddr.startsWith('0x') || toAddr.length !== 66)
            return { ok: false, reason: 'Adresse muss 0x + 64 Hex sein.' };
        if (!iotaStr) return { ok: false, reason: 'Betrag fehlt (z. B. 0.1).' };
        return { ok: true };
    }
    if (cmd === '/use-ticket') {
        const ticketId = (args[0] ?? '').trim();
        const eventId = (args[1] ?? '').trim();
        if (!ticketId || !eventId || !/^0x[0-9a-fA-F]+$/.test(ticketId) || !/^0x[0-9a-fA-F]+$/.test(eventId))
            return { ok: false, reason: 'Verwendung: /use-ticket <ticketId> <eventId> (beide 0x…).' };
        return { ok: true };
    }
    if (cmd === '/transfer-key') {
        const keyId = (args[0] ?? '').trim();
        const newOwner = (args[1] ?? '').trim();
        if (!keyId || !newOwner || keyId.startsWith('<') || !/^0x[0-9a-fA-F]+$/.test(keyId) || !/^0x[0-9a-fA-F]+$/.test(newOwner))
            return { ok: false, reason: 'Verwendung: /transfer-key <keyId> <newOwner> (beide 0x…). Zuerst /list-keys.' };
        return { ok: true };
    }
    if (cmd === '/create-key' || cmd === '/create-keys') {
        const lock = (args[0] ?? '').trim();
        const recipient = (args[1] ?? '').trim();
        if (!lock || lock.startsWith('<') || !recipient || !/^0x[0-9a-fA-F]+$/.test(recipient))
            return {
                ok: false,
                reason: 'Verwendung: /create-key <LOCK_ID oder Adresse> <Empfänger 0x…>. LOCK_ID in .env oder MY_ADDRESS.',
            };
        return { ok: true };
    }
    if (cmd === '/purge-asset') {
        const assetId = (args[0] ?? '').trim();
        if (!assetId || assetId.startsWith('<') || !/^0x[0-9a-fA-F]+$/.test(assetId))
            return { ok: false, reason: 'Asset-Objekt-ID angeben (0x…). Zuerst /list-assets ausführen.' };
        return { ok: true };
    }
    if (cmd === '/transfer-asset') {
        const assetId = (args[0] ?? '').trim();
        const newOwner = (args[1] ?? '').trim();
        if (!assetId || assetId.startsWith('<') || !/^0x[0-9a-fA-F]+$/.test(assetId))
            return { ok: false, reason: 'Asset-Objekt-ID angeben (0x…). Zuerst /list-assets.' };
        if (!newOwner || !/^0x[0-9a-fA-F]+$/.test(newOwner))
            return { ok: false, reason: 'Neuer Besitzer (Adresse 0x…) angeben.' };
        return { ok: true };
    }
    if (cmd === '/transfer-asset-key-package') {
        const assetId = (args[0] ?? '').trim();
        const keyId = (args[1] ?? '').trim();
        const newOwner = (args[2] ?? '').trim();
        if (!assetId || !/^0x[0-9a-fA-F]+$/.test(assetId))
            return { ok: false, reason: 'Asset-Objekt-ID angeben (0x…).' };
        if (!keyId || !/^0x[0-9a-fA-F]+$/.test(keyId))
            return { ok: false, reason: 'Key-Objekt-ID angeben (0x…). Zuerst /list-keys.' };
        if (!newOwner || !/^0x[0-9a-fA-F]+$/.test(newOwner))
            return { ok: false, reason: 'Neuer Besitzer (Adresse 0x…) angeben.' };
        return { ok: true };
    }
    if (cmd === '/link-nfc-asset') {
        const assetId = (args[0] ?? '').trim();
        const nfcUid = (args[1] ?? '').trim();
        if (!assetId || !/^0x[0-9a-fA-F]+$/.test(assetId))
            return { ok: false, reason: 'Asset-Objekt-ID angeben (0x…).' };
        if (!nfcUid) return { ok: false, reason: 'NFC-UID angeben (z. B. per „Hardware-Tag koppeln“ auslesen).' };
        return { ok: true };
    }
    return { ok: true };
}
