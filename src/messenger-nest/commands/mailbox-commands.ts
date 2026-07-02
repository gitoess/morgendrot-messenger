/**
 * Slice D: Mailbox / Offline / Queue (/fetch, Purge, RPC, IOTA-Name).
 */
import { CFG, ensurePackageIdInHistory } from '../../config.js';
import { normalizeAddress } from '../../utils.js';
import { getClient } from '../../chain-access.js';
import { purgeHandshakeCache, purgeInboxCache, purgeSessionKeysArchive } from '../../vault-local.js';
import {
  clearPeerSessionArchiveState,
  persistSessionKeysToVault,
  rotatePeerSessionEpochForPeer,
} from '../messenger-session-keys-state.js';
import { getWalletPassword } from '../messenger-session-password.js';
import { fetchLastMessages, fetchPlaintextOnlyForRecipient, isRebasedStorageEnabled } from '../messenger-fetch.js';
import type { FetchedMessage } from '../messenger-fetch.js';
import { purgeHandshake, purgeMessage, purgeTeamPlaintextBroadcast } from '../messenger-chain-wrap.js';
import {
    purgeHandshakeBidirectional,
    purgeMessageBidirectional,
} from '../command-handler-shared.js';
import type { PeerState } from '../peer-state.js';
import type { CommandHandlerResult, MessengerCommandContext } from './command-types.js';

const HEX64 = /^0x[a-fA-F0-9]{64}$/;

function parsePurgeNonce(raw: string): bigint | null {
    const t = String(raw ?? '').trim();
    if (!t) return null;
    try {
        const b = BigInt(t);
        return b < 0n ? null : b;
    } catch {
        return null;
    }
}

/** 4. Argument bei `/purge-msg`: Team-Broadcast statt pairwise. */
function isTeamPurgeModeFlag(raw: string | undefined): boolean {
    const t = String(raw ?? '').trim().toLowerCase();
    return t === 'team' || t === 'team-broadcast' || t === 'teambroadcast';
}

const MAILBOX_COMMANDS = new Set([
    '/purge-handshake',
    '/purge-msg',
    '/purge-message',
    '/purge-team-broadcast',
    '/purge-handshake-cache',
    '/purge-local-inbox',
    '/rotate-session-epoch',
    '/clear-local-history',
    '/inbox',
    '/fetch',
    '/rpc-rotate',
    '/resolve-iota-name',
    '/iota-name-lookup',
]);

export async function tryHandleMailboxCommand(ctx: MessengerCommandContext): Promise<CommandHandlerResult | null> {
    let c = ctx.cmd;
    let a = ctx.args;
    if (!MAILBOX_COMMANDS.has(c) && c !== '/inbox') return null;

    const { opts, myAddress: MY_ADDR, keys, peerMap } = ctx;

    if (c === '/purge-handshake') {
        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
        if (!isRebasedStorageEnabled()) return { ok: false, message: 'MAILBOX_ID nicht gesetzt.' };
        if (a.length >= 2 && /^0x[a-fA-F0-9]{64}$/.test(String(a[0]).trim()) && /^0x[a-fA-F0-9]{64}$/.test(String(a[1]).trim())) {
            await purgeHandshake(a[0].trim(), a[1].trim());
            return { ok: true, message: 'Handshake gepurged.' };
        }
        if (!peerMap?.size) {
            return { ok: false, message: 'Befehl benötigt Chat-Verbindung oder 2 Argumente (recipient, sender).' };
        }
        for (const p of peerMap.values()) await purgeHandshakeBidirectional(MY_ADDR, p.address);
        return {
            ok: true,
            message: `${peerMap.size} Handshake-Zeile(n) gepurged (je Richtung Empfänger/Sender automatisch probiert).`,
        };
    }

    if (c === '/purge-msg' || c === '/purge-message') {
        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
        if (!a[0]) {
            return {
                ok: false,
                message:
                    'Verwendung: /purge-msg <empfänger> <sender> <nonce> (UI) oder /purge-msg <teamMailboxId> <sender> <nonce> team-broadcast — oder /purge-msg <nonce> [sender] mit Chat-Connect.',
            };
        }
        if (!isRebasedStorageEnabled()) {
            return { ok: false, message: 'MAILBOX_ID nicht gesetzt (Mailbox-Modus nötig zum Purgen von Nachrichten).' };
        }
        if (a.length >= 3 && HEX64.test(String(a[0]).trim()) && HEX64.test(String(a[1]).trim())) {
            const recipient = a[0].trim();
            const sender = a[1].trim();
            const nonceBn = parsePurgeNonce(String(a[2]));
            if (nonceBn === null) return { ok: false, message: 'Ungültige Nonce (Zahl erwartet).' };
            if (isTeamPurgeModeFlag(a[3])) {
                await purgeTeamPlaintextBroadcast(recipient, sender, nonceBn);
                return { ok: true, message: 'Team-Broadcast aus Mailbox gepurged (Rebate).' };
            }
            await purgeMessage(recipient, sender, nonceBn);
            return { ok: true, message: 'Nachricht aus Mailbox gepurged.' };
        }
        if (!peerMap?.size) {
            return {
                ok: false,
                message:
                    'Befehl benötigt Chat-Verbindung (/connect) oder 3 Argumente: Empfänger, Sender, Nonce (wie im Rebate-Tab).',
            };
        }
        const nonceBnPeer = parsePurgeNonce(String(a[0]));
        const senderArg = a[1]?.trim();
        if (nonceBnPeer === null) return { ok: false, message: 'Ungültige Nonce (Zahl erwartet).' };
        const toPurge: PeerState[] = senderArg
            ? [peerMap.get(senderArg) ?? [...peerMap.values()].find((p) => normalizeAddress(p.address) === normalizeAddress(senderArg))].filter(
                  (p): p is PeerState => !!p
              )
            : [...peerMap.values()];
        for (const p of toPurge) await purgeMessageBidirectional(MY_ADDR, p.address, nonceBnPeer);
        return { ok: true, message: 'Nachricht gepurged (Empfänger/Sender-Reihenfolge automatisch probiert).' };
    }

    if (c === '/purge-team-broadcast') {
        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
        if (!isRebasedStorageEnabled()) {
            return { ok: false, message: 'MAILBOX_ID nicht gesetzt (Mailbox-Modus nötig).' };
        }
        if (a.length < 3) {
            return {
                ok: false,
                message:
                    'Verwendung: /purge-team-broadcast <teamMailboxObjectId> <broadcastSender> <nonce> — oder /purge-msg <teamMailboxId> <sender> <nonce> team-broadcast',
            };
        }
        const teamMb = String(a[0]).trim();
        const broadcastSender = String(a[1]).trim();
        const nonceBn = parsePurgeNonce(String(a[2]));
        if (!HEX64.test(teamMb) || !HEX64.test(broadcastSender)) {
            return { ok: false, message: 'Team-Mailbox und Broadcast-Sender: jeweils 0x + 64 Hex.' };
        }
        if (nonceBn === null) return { ok: false, message: 'Ungültige Nonce (Zahl erwartet).' };
        await purgeTeamPlaintextBroadcast(teamMb, broadcastSender, nonceBn);
        return { ok: true, message: 'Team-Broadcast aus Mailbox gepurged (Rebate).' };
    }

    if (c === '/purge-handshake-cache') {
        const vp = CFG.VAULT_FILE || '.morgendrot-vault';
        purgeHandshakeCache(vp);
        purgeSessionKeysArchive(vp);
        clearPeerSessionArchiveState();
        return { ok: true, message: 'Handshake- und Session-Key-Cache geleert (lokal, immer purgable).' };
    }

    if (c === '/rotate-session-epoch') {
        const peerAddr = String(a[0] ?? '').trim();
        if (!HEX64.test(peerAddr)) {
            return { ok: false, message: 'Peer-Adresse (0x + 64 Hex) erforderlich: /rotate-session-epoch <peer0x>' };
        }
        const peerNorm = normalizeAddress(peerAddr);
        const peer =
            peerMap?.get(peerNorm) ??
            [...(peerMap?.values() ?? [])].find((p) => normalizeAddress(p.address) === peerNorm);
        if (!peer) {
            return {
                ok: false,
                message: 'Kein verbundener Partner — zuerst /connect oder Handshake-Cache laden.',
            };
        }
        const newEpoch = rotatePeerSessionEpochForPeer(peer.address, peer.pubKeyRaw);
        const vp = CFG.VAULT_FILE || '.morgendrot-vault';
        const pw = getWalletPassword();
        if (vp && pw) {
            try {
                await persistSessionKeysToVault(vp, pw);
            } catch {
                /* RAM-Rotation gilt trotzdem */
            }
        }
        return {
            ok: true,
            message: `Session keyEpoch für ${peer.address.slice(0, 12)}… → ${newEpoch} (Archiv in Vault).`,
        };
    }

    if (c === '/purge-local-inbox') {
        const vp = CFG.VAULT_FILE || '.morgendrot-vault';
        const shredInbox = a[0] === '1' || String(a[0] ?? '').toLowerCase() === 'shred';
        purgeInboxCache(vp, { shred: shredInbox });
        return {
            ok: true,
            message: shredInbox ? 'Lokale Inbox geschreddert und entfernt.' : 'Lokale Inbox geleert (Datei gelöscht).',
        };
    }

    if (c === '/clear-local-history') {
        const vp = CFG.VAULT_FILE || '.morgendrot-vault';
        const rawH = a[0] != null ? String(a[0]).trim().toLowerCase() : '';
        const shredH = rawH !== '0' && rawH !== 'false' && rawH !== 'no';
        purgeInboxCache(vp, { shred: shredH });
        return {
            ok: true,
            message: shredH
                ? 'clearLocalHistory: lokaler Inbox-Klartext-Cache (.inbox.enc) überschrieben und gelöscht.'
                : 'clearLocalHistory: lokale Inbox-Datei gelöscht (ohne Shred).',
        };
    }

    if (c === '/inbox') {
        c = '/fetch';
        if (a.length === 0) a = ['20'];
    }

    if (c === '/fetch') {
        if (!MY_ADDR?.trim()) {
            return { ok: false, message: 'MY_ADDRESS fehlt. Bitte zuerst unter „1. Anfang & Verbindung“ setzen.' };
        }
        const packageIdOverride = a[2] != null && /^0x[a-fA-F0-9]{64}$/.test(String(a[2]).trim()) ? String(a[2]).trim() : undefined;
        if (packageIdOverride) ensurePackageIdInHistory(packageIdOverride);
        const pkgId = packageIdOverride || String(CFG.PACKAGE_ID ?? '').trim();
        if (!pkgId) {
            return {
                ok: false,
                message:
                    'PACKAGE_ID fehlt. Bitte /set-package-id ausführen, PACKAGE_ID in .env setzen oder als 3. Argument übergeben (z. B. /inbox 50 undefined 0x…).',
            };
        }
        if (!/^0x[a-fA-F0-9]{64}$/.test(pkgId)) {
            return {
                ok: false,
                message:
                    'PACKAGE_ID muss 0x gefolgt von 64 Hex-Zeichen sein (z. B. aus create_globals). Aktuell: ' +
                    (pkgId.length > 20 ? pkgId.slice(0, 20) + '…' : pkgId),
            };
        }
        const myAddrNorm = normalizeAddress(MY_ADDR);
        if (!/^0x[a-fa-f0-9]{64}$/.test(myAddrNorm)) {
            return { ok: false, message: 'MY_ADDRESS muss 0x gefolgt von 64 Hex-Zeichen sein.' };
        }
        const rawN = a[0] != null ? String(a[0]).trim() : '10';
        const n = Math.min(500, Math.max(1, parseInt(rawN, 10) || 10));
        if (Number.isNaN(n) || n < 1 || n > 500) {
            return { ok: false, message: 'Anzahl muss zwischen 1 und 500 liegen (z. B. 50).' };
        }
        const senderArg = a[1] != null && String(a[1]).trim().startsWith('0x') ? normalizeAddress(String(a[1]).trim()) : undefined;
        const bossView = a[3] != null && String(a[3]).trim().toLowerCase() === 'boss';
        const mergeLocalInbox = a[4] === '1' || String(a[4] ?? '').trim().toLowerCase() === 'true';
        const rawOff = a[5] != null ? String(a[5]).trim() : '0';
        const offset = Math.max(0, parseInt(rawOff, 10) || 0);
        if (isRebasedStorageEnabled() && (!CFG.MAILBOX_ID || !/^0x[a-fA-F0-9]{64}$/.test(CFG.MAILBOX_ID))) {
            return {
                ok: false,
                message: 'MAILBOX_ID fehlt oder hat ungültiges Format (0x + 64 Hex). In .env setzen (aus create_globals-Event).',
            };
        }
        const doFetch = async (): Promise<CommandHandlerResult> => {
        try {
            const { isChainReachable } = await import('../../chain-access.js');
            if (!(await isChainReachable())) {
                return { ok: false, message: 'Kette nicht erreichbar. RPC_URL prüfen oder später erneut versuchen.' };
            }
            const silent = opts?.silentFetch === true;
            const fetchOpts: {
                silent?: boolean;
                packageId?: string;
                mergeLocalInbox?: boolean;
                offset?: number;
                skipMessagingEvents?: boolean;
            } = {};
            if (silent) fetchOpts.silent = true;
            if (opts?.mailboxKeysOnly === true) fetchOpts.skipMessagingEvents = true;
            if (packageIdOverride) fetchOpts.packageId = packageIdOverride;
            if (mergeLocalInbox) fetchOpts.mergeLocalInbox = true;
            const peerMapForFetch = null;
            let messages: FetchedMessage[];
            let inboxHasMore = false;
            if (bossView && CFG.ROLE === 'boss' && CFG.KOMMANDANT_ADDRESSES.length > 0) {
                const need = Math.min(2000, offset + n);
                const bossFetched = await fetchLastMessages(
                    myAddrNorm,
                    peerMapForFetch,
                    keys?.privateKey ?? null,
                    need,
                    undefined,
                    senderArg,
                    { ...fetchOpts, offset: 0 }
                );
                const bossMessages = bossFetched.messages;
                const withRecipient: FetchedMessage[] = [...bossMessages];
                const perK = Math.max(5, Math.floor(need / (CFG.KOMMANDANT_ADDRESSES.length + 1)));
                const pkgIdBoss = packageIdOverride || String(CFG.PACKAGE_ID ?? '').trim();
                for (const kommandantAddr of CFG.KOMMANDANT_ADDRESSES) {
                    if (normalizeAddress(kommandantAddr) === normalizeAddress(myAddrNorm)) continue;
                    const kMessages = await fetchPlaintextOnlyForRecipient(kommandantAddr, perK, pkgIdBoss);
                    withRecipient.push(...kMessages);
                }
                withRecipient.sort((x, y) => (y.ts ?? 0) - (x.ts ?? 0));
                inboxHasMore = withRecipient.length > offset + n;
                messages = withRecipient.slice(offset, offset + n);
            } else {
                fetchOpts.offset = offset;
                const fetched = await fetchLastMessages(
                    myAddrNorm,
                    peerMapForFetch,
                    keys?.privateKey ?? null,
                    n,
                    undefined,
                    senderArg,
                    fetchOpts
                );
                messages = fetched.messages;
                inboxHasMore = fetched.hasMore;
            }
            if (messages.length === 0) {
                return {
                    ok: true,
                    message: 'Keine neuen Nachrichten auf der Chain gefunden.',
                    messages: [],
                    data: [],
                    hasMore: false,
                };
            }
            return {
                ok: true,
                message: senderArg
                    ? `Letzte ${n} Nachrichten von ${senderArg.slice(0, 12)}… geladen.`
                    : `${messages.length} Nachricht(en) geladen.`,
                messages,
                data: messages,
                hasMore: inboxHasMore,
            };
        } catch (e: unknown) {
            const msg = String((e as Error)?.message ?? e);
            if (msg.includes('invalid param')) {
                return {
                    ok: false,
                    message: 'Ungültige Parameter (z. B. MAILBOX_ID oder PACKAGE_ID prüfen – 0x + 64 Hex). create_globals ausgeführt?',
                };
            }
            if (msg.includes('MAILBOX') || msg.includes('getDynamicFields')) {
                return {
                    ok: false,
                    message: 'Mailbox nicht erreichbar oder MAILBOX_ID fehlt. Ohne Mailbox: PACKAGE_ID und RPC_URL müssen stimmen.',
                };
            }
            if (msg.includes('queryEvents') || msg.includes('package')) {
                return { ok: false, message: 'Kette/Package-Fehler. PACKAGE_ID und RPC_URL prüfen.' };
            }
            return { ok: false, message: msg || 'Nachrichten konnten nicht geladen werden.' };
        }
        };
        const mbOverride = String(opts?.mailboxObjectId ?? '').trim();
        if (/^0x[a-fA-F0-9]{64}$/i.test(mbOverride)) {
            const { runWithMailboxObjectIdOverride } = await import('../../mailbox-object-id-scope.js');
            return runWithMailboxObjectIdOverride(mbOverride, doFetch);
        }
        return doFetch();
    }

    if (c === '/rpc-rotate') {
        const { resetRpcClient, isChainReachable, getActiveRpcUrl, getRpcCandidateCount } = await import('../../chain-access.js');
        resetRpcClient('next');
        const reachable = await isChainReachable();
        return {
            ok: true,
            message: `RPC: ${getActiveRpcUrl()} (erreichbar: ${reachable ? 'ja' : 'nein'}).`,
            rpcUrl: getActiveRpcUrl(),
            reachable,
            rpcCandidateCount: getRpcCandidateCount(),
        };
    }

    if (c === '/resolve-iota-name' || c === '/iota-name-lookup') {
        const name = String(a[0] ?? '').trim();
        if (!name) {
            return {
                ok: false,
                message: 'Verwendung: /resolve-iota-name <name.iota> (Indexer JSON-RPC iotax_iotaNamesLookup).',
            };
        }
        const { iotaNamesLookup, registrationNftMatchesAllowedPackages } = await import('../../iota-names-lookup.js');
        try {
            const rec = await iotaNamesLookup(CFG.RPC_URL, name);
            const lines: string[] = [
                `Name: ${name}`,
                `Ziel-Adresse: ${rec.targetAddress ?? '(nicht gesetzt)'}`,
                `Registrierungs-NFT: ${rec.nftId}`,
            ];
            if (rec.expirationTimestampMs != null) lines.push(`Ablauf (ms): ${rec.expirationTimestampMs}`);
            const allow = CFG.VERIFIED_IOTA_NAME_PACKAGE_IDS;
            let registrationNftVerified: boolean | undefined;
            let registrationNftType: string | undefined;
            if (allow.length > 0) {
                const v = await registrationNftMatchesAllowedPackages(getClient(), rec.nftId, allow);
                registrationNftVerified = v.matches;
                registrationNftType = v.objectType;
                lines.push(
                    v.matches
                        ? 'Allowlist: NFT-Typ passt zu einem der VERIFIED_IOTA_NAME_PACKAGE_IDS.'
                        : 'Allowlist: NFT-Typ passt NICHT – möglicher Spoofing-Name.'
                );
                if (v.objectType) lines.push(`On-Chain-Typ: ${v.objectType}`);
            } else {
                lines.push('VERIFIED_IOTA_NAME_PACKAGE_IDS leer – nur Lookup, kein Paket-Check.');
            }
            return {
                ok: true,
                message: lines.join('\n'),
                iotaName: {
                    name,
                    nftId: rec.nftId,
                    targetAddress: rec.targetAddress,
                    expirationTimestampMs: rec.expirationTimestampMs,
                    registrationNftVerified,
                    registrationNftType,
                },
            };
        } catch (e: unknown) {
            return { ok: false, message: String((e as Error)?.message ?? e) };
        }
    }

    return null;
}
