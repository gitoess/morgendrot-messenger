/**
 * Kammer „Inbox/Fetch“: Nachrichten von Chain laden, entschlüsseln, mit lokalem Cache mergen.
 */
import { logger } from '../logger.js';
import { CFG, isMessengerMailboxModeActive, readMailboxIdHistory, readPackageIdHistory, readTeamMailboxIds } from '../config.js';
import { isPrivateMailboxObjectIdOverrideActive } from '../mailbox-object-id-scope.js';
import { getClient, getHandshakeFromMailbox, findPeerHandshakeFrom } from '../chain-access.js';
import {
    loadHandshakeCache,
    saveHandshakeCache,
    appendInboxCache,
    loadInboxCache,
} from '../vault-local.js';
import { decryptIotaPeerSessionMessage } from '../shared/morgendrot-crypto-session-wire.js';
import {
    getPeerSessionArchive,
    restoreSessionKeysFromVault,
    syncPeerSessionArchiveFromHandshakeMap,
} from './messenger-session-keys-state.js';
import { normalizeAddress, toEventBytes } from '../utils.js';
import type { PeerState } from './peer-state.js';
import { getWalletPassword } from './messenger-session-password.js';
import {
    chainMessageLogicalDedupKey,
    fetchMailboxInboxRpcRows,
    fetchMessagingEventInboxRpcRows,
    fetchTeamPlainBroadcastRpcRows,
    mailboxEncryptedInboxKey,
    mailboxPlainInboxKey,
    type MailboxInboxRpcRow,
    type MessagingEventInboxRpcRow,
    type TeamPlainBroadcastRpcRow,
} from '@morgendrot/core/iota';

/** Boss-`getClient()` und Core-`IotaClient` — getrennte SDK-Installationspfade, zur Laufzeit kompatibel. */
type CoreIotaClient = Parameters<typeof fetchMailboxInboxRpcRows>[0];

function coreRpcClient(): CoreIotaClient {
    return getClient() as unknown as CoreIotaClient;
}

function pushUniqueMsgItem(items: MsgItem[], keySeen: Set<string>, item: MsgItem): void {
    if (item.key && keySeen.has(item.key)) return;
    const lk = chainMessageLogicalDedupKey({
        sender: item.sender,
        recipient: item.recipient ?? '',
        nonce: item.nonce,
    });
    if (lk && keySeen.has(lk)) return;
    items.push(item);
    if (item.key) keySeen.add(item.key);
    if (lk) keySeen.add(lk);
}

function eventAlreadyInMailbox(keySeen: Set<string>, sender: string, recipient: string, nonce: bigint): boolean {
    const lk = chainMessageLogicalDedupKey({ sender, recipient, nonce });
    return Boolean(lk && keySeen.has(lk));
}

/** Alias für ältere Aufrufer; gleiche Bedingung wie `isMessengerMailboxModeActive` (config). */
export function isRebasedStorageEnabled(): boolean {
    return isMessengerMailboxModeActive();
}

type MsgItem = {
    nonce: bigint;
    sender: string;
    /** Gegenüber (bei ausgehenden Nachrichten = Empfänger, für Entschlüsselung/Handshake) */
    recipient?: string;
    key: string;
    isPlain: boolean;
    iv?: Uint8Array;
    cipher?: Uint8Array;
    tag?: Uint8Array;
    text?: Uint8Array;
    /** Chain-Zeitpunkt (ms), falls von Mailbox oder Event geliefert */
    tsMs?: number;
    /** Nur bei Mailbox-gespeicherten verschlüsselten Nachrichten mit /purge-msg entfernbar */
    chainPurgeable?: boolean;
    /** Gruppen-Klartext (TeamPlainBroadcastKey) — kein recipient. */
    teamBroadcast?: boolean;
};

/** Sort-/Anzeige-Zeit: Chain-ts, sonst ms-artige Nonce (Events ohne `timestampMs`). */
function effectiveInboxTsMs(m: { tsMs?: number; nonce: bigint }): number {
    if (m.tsMs != null && Number.isFinite(m.tsMs) && m.tsMs > 0) return m.tsMs;
    const n = Number(m.nonce);
    if (Number.isFinite(n) && n >= 1_000_000_000_000) return n;
    return 0;
}

function fetchedChainMeta(m: MsgItem): Pick<FetchedMessage, 'chainPurgeable' | 'recipient' | 'inboxKey' | 'chainPurgeKind'> {
    if (m.teamBroadcast) {
        return {
            recipient: m.recipient,
            chainPurgeable: true,
            inboxKey: m.key,
            chainPurgeKind: 'team-broadcast',
        };
    }
    return {
        recipient: m.recipient,
        chainPurgeable: m.isPlain ? m.chainPurgeable === true : m.chainPurgeable !== false,
        inboxKey: m.key,
    };
}

function inboxTsFromRow(tsMs: number | undefined, nonce: bigint): number | undefined {
    if (tsMs != null && Number.isFinite(tsMs) && tsMs > 0) return tsMs;
    const n = Number(nonce);
    if (Number.isFinite(n) && n >= 1_000_000_000_000) return n;
    return undefined;
}

function rowMatchesPeerFilters(
    sender: string,
    recipient: string,
    myNorm: string,
    matchesPeer: (s: string) => boolean,
    matchesCounterparty: (peerAddr: string | undefined) => boolean
): boolean {
    const incoming = normalizeAddress(recipient) === myNorm;
    const outgoing = normalizeAddress(sender) === myNorm;
    if (!incoming && !outgoing) return false;
    const peerAddr = incoming ? sender : recipient;
    if (!peerAddr?.trim()) return false;
    return matchesPeer(peerAddr) && matchesCounterparty(peerAddr);
}

function mailboxRpcRowToMsgItem(row: MailboxInboxRpcRow): MsgItem {
    const nonce = BigInt(row.nonce);
    const tsMs = inboxTsFromRow(row.ts, nonce);
    if (row.kind === 'plain') {
        return {
            nonce,
            sender: row.sender,
            recipient: row.recipient,
            key: mailboxPlainInboxKey({
                sender: row.sender,
                recipient: row.recipient,
                nonce: row.nonce,
                tsMs,
            }),
            isPlain: true,
            text: new TextEncoder().encode(row.text),
            tsMs,
            chainPurgeable: true,
        };
    }
    return {
        nonce,
        sender: row.sender,
        recipient: row.recipient,
        key: mailboxEncryptedInboxKey({
            sender: row.sender,
            recipient: row.recipient,
            nonce: row.nonce,
            tsMs,
        }),
        isPlain: false,
        iv: row.iv,
        cipher: row.ciphertext,
        tag: row.tag,
        tsMs,
        chainPurgeable: true,
    };
}

function eventRpcRowToMsgItem(row: MessagingEventInboxRpcRow): MsgItem {
    if (row.kind === 'plain') {
        return {
            nonce: row.nonce,
            sender: row.sender,
            recipient: row.recipient,
            key: row.inboxKey,
            isPlain: true,
            text: new TextEncoder().encode(row.text),
            tsMs: row.tsMs,
            chainPurgeable: false,
        };
    }
    return {
        nonce: row.nonce,
        sender: row.sender,
        recipient: row.recipient,
        key: row.inboxKey,
        isPlain: false,
        iv: row.iv,
        cipher: row.ciphertext,
        tag: row.tag,
        tsMs: row.tsMs,
        chainPurgeable: false,
    };
}

function teamRpcRowToMsgItem(row: TeamPlainBroadcastRpcRow, parentId: string): MsgItem {
    const nonce = BigInt(row.nonce);
    const tsMs = inboxTsFromRow(row.ts, nonce);
    return {
        nonce,
        sender: row.sender,
        recipient: parentId,
        key: `team:${parentId}:${normalizeAddress(row.sender)}:${nonce}`,
        isPlain: true,
        text: new TextEncoder().encode(row.text),
        tsMs,
        chainPurgeable: true,
        teamBroadcast: true,
    };
}

/** Einzelne angezeigte Nachricht (für UI/API). */
export type FetchedMessage = {
    sender: string;
    text: string;
    isPlain: boolean;
    nonce?: string;
    ts?: number;
    recipient?: string;
    /** false: nur Event (Klartext oder Legacy) – kein Mailbox-Eintrag zum Purgen */
    chainPurgeable?: boolean;
    /** Stabiler Dedup-Schlüssel (evid:… / mb:… / ev:…) — für UI bei gleicher nonce. */
    inboxKey?: string;
    chainPurgeKind?: 'pairwise' | 'team-broadcast';
};

const PACKAGE_ID_HEX = /^0x[a-fA-F0-9]{64}$/i;

/** Events (verschlüsselt + Klartext) für ein Move-Paket — Posteingang-Union, unabhängig von USE_MAILBOX. */
function maxEventPagesForInboxFetch(inboxLimit: number, isPrimaryPackage: boolean): number {
    if (!isPrimaryPackage) {
        if (inboxLimit >= 200) return 8;
        if (inboxLimit >= 80) return 4;
        return 2;
    }
    if (inboxLimit >= 200) return 15;
    if (inboxLimit >= 80) return 8;
    return 4;
}

async function appendMailboxInboxFromCoreRpc(
    parentId: string,
    packageId: string,
    myAddress: string,
    myNorm: string,
    items: MsgItem[],
    matchesPeer: (s: string) => boolean,
    matchesCounterparty: (peerAddr: string | undefined) => boolean,
    keySeen: Set<string>,
    fetchWindow: number
): Promise<void> {
    const pkg = packageId.trim();
    if (!PACKAGE_ID_HEX.test(pkg)) return;
    const client = coreRpcClient();
    const includePlain = Boolean(CFG.MAILBOX_STORE_PLAINTEXT);
    const rows = await fetchMailboxInboxRpcRows(client, {
        mailboxObjectId: parentId,
        packageId: pkg,
        myAddress,
        includePlaintext: includePlain,
        includeEncrypted: true,
        limit: fetchWindow,
        offset: 0,
    });
    for (const row of rows) {
        if (!rowMatchesPeerFilters(row.sender, row.recipient, myNorm, matchesPeer, matchesCounterparty)) {
            continue;
        }
        pushUniqueMsgItem(items, keySeen, mailboxRpcRowToMsgItem(row));
    }
    const teamRows = await fetchTeamPlainBroadcastRpcRows(client, {
        teamMailboxObjectId: parentId,
        packageId: pkg,
        limit: fetchWindow,
        offset: 0,
    });
    for (const row of teamRows) {
        if (!matchesCounterparty(row.sender)) continue;
        pushUniqueMsgItem(items, keySeen, teamRpcRowToMsgItem(row, parentId));
    }
}

async function appendMessagingEventsFromCoreRpc(
    packageId: string,
    myAddress: string,
    myNorm: string,
    items: MsgItem[],
    matchesPeer: (s: string) => boolean,
    matchesCounterparty: (peerAddr: string | undefined) => boolean,
    keySeen: Set<string>,
    fetchWindow: number,
    opts?: { maxEventPages?: number }
): Promise<void> {
    const pkg = packageId.trim();
    if (!PACKAGE_ID_HEX.test(pkg)) return;
    const rows = await fetchMessagingEventInboxRpcRows(coreRpcClient(), {
        packageId: pkg,
        myAddress,
        limit: fetchWindow,
        offset: 0,
        maxEventPages: opts?.maxEventPages,
    });
    for (const row of rows) {
        const peerAddr = normalizeAddress(row.sender) === myNorm ? row.recipient : row.sender;
        if (!matchesPeer(peerAddr) || !matchesCounterparty(peerAddr)) continue;
        if (eventAlreadyInMailbox(keySeen, row.sender, row.recipient, row.nonce)) continue;
        if (keySeen.has(row.inboxKey)) continue;
        pushUniqueMsgItem(items, keySeen, eventRpcRowToMsgItem(row));
    }
}

const MAILBOX_ID_HEX = /^0x[a-fA-F0-9]{64}$/;

function mailboxIdsForInboxUnion(): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (id: string) => {
        const t = id.trim();
        if (!MAILBOX_ID_HEX.test(t)) return;
        const n = t.toLowerCase();
        if (seen.has(n)) return;
        seen.add(n);
        out.push(t);
    };
    add(CFG.MAILBOX_ID || '');
    for (const h of readMailboxIdHistory()) add(h);
    for (const h of readTeamMailboxIds()) add(h);
    return out;
}

function packageIdsForInboxUnion(primaryPackageId: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (id: string) => {
        const t = id.trim();
        if (!PACKAGE_ID_HEX.test(t)) return;
        const n = t.toLowerCase();
        if (seen.has(n)) return;
        seen.add(n);
        out.push(t);
    };
    if (primaryPackageId) add(primaryPackageId);
    const cfg = (CFG.PACKAGE_ID || '').trim();
    if (cfg) add(cfg);
    for (const h of readPackageIdHistory()) add(h);
    const my = (CFG.MY_ADDRESS || '').trim().toLowerCase();
    return out.filter((id) => id.toLowerCase() !== my);
}

/** Holt die letzten N Nachrichten von der Chain, entschlüsselt und zeigt sie an. */
export async function fetchLastMessages(
    myAddress: string,
    peerOrMap: PeerState | Map<string, PeerState> | null,
    myPrivKey: CryptoKey | null,
    count: number,
    seenKeys?: Set<string>,
    senderFilter?: string,
    opts?: {
        silent?: boolean;
        packageId?: string;
        mergeLocalInbox?: boolean;
        offset?: number;
        /** Nur Dynamic Fields — Events kommen vom ersten Posteingang-Fetch. */
        skipMessagingEvents?: boolean;
    }
): Promise<{ messages: FetchedMessage[]; hasMore: boolean }> {
    const out: FetchedMessage[] = [];
    if (count <= 0) return { messages: out, hasMore: false };
    const packageIdForQuery =
        opts?.packageId && /^0x[a-fA-F0-9]{64}$/.test(opts.packageId.trim())
            ? opts.packageId.trim()
            : (CFG.PACKAGE_ID?.trim() || '');
    const standalone = peerOrMap == null || (peerOrMap instanceof Map && peerOrMap.size === 0);
    const peerMap = standalone
        ? new Map<string, PeerState>()
        : peerOrMap instanceof Map
          ? peerOrMap
          : new Map([[peerOrMap.address, peerOrMap]]);
    if (standalone) {
        const vaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
        const pw = getWalletPassword();
        if (vaultPath && pw) {
            try {
                const cached = await loadHandshakeCache(vaultPath, pw);
                for (const [addr, e] of cached) {
                    peerMap.set(normalizeAddress(addr), {
                        address: addr,
                        pubKeyRaw: e.pubKeyRaw,
                        handshakeNonce: e.handshakeNonce,
                    });
                }
                await restoreSessionKeysFromVault(vaultPath, pw, peerMap);
            } catch {}
        }
    }
    const peerAddrs = standalone ? null : new Set([...peerMap.keys()].map((a) => normalizeAddress(a)));
    const senderNorm = senderFilter?.trim().startsWith('0x') ? normalizeAddress(senderFilter.trim()) : undefined;

    /** Optionaler /fetch-Absenderfilter: Gegenüber-Adresse (bei Eingang = Absender, bei Ausgang = Empfänger). */
    const matchesCounterparty = (peerAddr: string | undefined) =>
        !senderNorm || (peerAddr != null && normalizeAddress(peerAddr) === senderNorm);
    const matchesPeer = (s: string) => !peerAddrs || peerAddrs.has(normalizeAddress(s));

    const items: MsgItem[] = [];
    const myNorm = normalizeAddress(myAddress);
    const skip = Math.max(0, Math.floor(opts?.offset ?? 0));
    const fetchWindow = skip + count + 1;
    const mailboxPackageId = packageIdForQuery || CFG.PACKAGE_ID || '';

    if (isRebasedStorageEnabled()) {
        const mailboxParents = isPrivateMailboxObjectIdOverrideActive()
            ? [CFG.MAILBOX_ID]
            : mailboxIdsForInboxUnion();
        const keySeen = new Set<string>();
        for (const parentId of mailboxParents) {
            if (!MAILBOX_ID_HEX.test(String(parentId || '').trim())) continue;
            await appendMailboxInboxFromCoreRpc(
                parentId.trim(),
                mailboxPackageId,
                myAddress,
                myNorm,
                items,
                matchesPeer,
                matchesCounterparty,
                keySeen,
                fetchWindow
            );
        }
        if (!opts?.skipMessagingEvents) {
            const primaryPkg = mailboxPackageId.trim().toLowerCase();
            for (const pkg of packageIdsForInboxUnion(packageIdForQuery)) {
                const isPrimary = pkg.trim().toLowerCase() === primaryPkg;
                await appendMessagingEventsFromCoreRpc(
                    pkg,
                    myAddress,
                    myNorm,
                    items,
                    matchesPeer,
                    matchesCounterparty,
                    keySeen,
                    fetchWindow,
                    { maxEventPages: maxEventPagesForInboxFetch(count, isPrimary) }
                );
            }
        }
    } else if (!opts?.skipMessagingEvents) {
        const keySeen = new Set<string>();
        const primaryPkg = mailboxPackageId.trim().toLowerCase();
        for (const pkg of packageIdsForInboxUnion(packageIdForQuery)) {
            const isPrimary = pkg.trim().toLowerCase() === primaryPkg;
            await appendMessagingEventsFromCoreRpc(
                pkg,
                myAddress,
                myNorm,
                items,
                matchesPeer,
                matchesCounterparty,
                keySeen,
                fetchWindow,
                { maxEventPages: maxEventPagesForInboxFetch(count, isPrimary) }
            );
        }
    }

    if (standalone && items.length > 0) {
        const counterpartyByNorm = new Map<string, string>();
        for (const m of items) {
            const isOut = normalizeAddress(m.sender) === myNorm;
            const peerRaw = isOut ? m.recipient : m.sender;
            if (!peerRaw?.trim()) continue;
            const n = normalizeAddress(peerRaw);
            if (!counterpartyByNorm.has(n)) counterpartyByNorm.set(n, peerRaw);
        }
        for (const peerAddr of counterpartyByNorm.values()) {
            const n = normalizeAddress(peerAddr);
            if (peerMap.has(n)) continue;
            const hs =
                (await getHandshakeFromMailbox(myAddress, peerAddr)) ??
                (await findPeerHandshakeFrom(myAddress, peerAddr));
            if (hs)
                peerMap.set(n, {
                    address: peerAddr,
                    pubKeyRaw: hs.pubKeyRaw,
                    handshakeNonce: hs.nonce,
                });
        }
        const vaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
        const pw = getWalletPassword();
        if (vaultPath && pw && peerMap.size > 0) {
            try {
                await saveHandshakeCache(vaultPath, pw, peerMap);
                syncPeerSessionArchiveFromHandshakeMap(peerMap);
            } catch {}
        }
    }

    items.sort((a, b) => {
        const ta = effectiveInboxTsMs(a);
        const tb = effectiveInboxTsMs(b);
        if (tb !== ta) return tb - ta;
        return a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0;
    });
    const hasMore = items.length > skip + count;
    const toShow = items.slice(skip, skip + count);

    for (const m of toShow) {
        if (seenKeys?.has(m.key)) continue;
        seenKeys?.add(m.key);
        if (m.isPlain) {
            const text = m.text && m.text.length > 0 ? new TextDecoder().decode(m.text) : '';
            logger.debug(`Inbox Klartext-Eintrag von ${m.sender.slice(0, 12)}… nonce=${m.nonce} (${text.length} Zeichen)`);
            const ts = effectiveInboxTsMs(m);
            out.push({
                sender: m.sender,
                text,
                isPlain: true,
                nonce: String(m.nonce),
                ts: ts > 0 ? ts : undefined,
                ...fetchedChainMeta(m),
            });
        } else if (m.iv && m.cipher && m.tag) {
            const isOutgoingMsg = normalizeAddress(m.sender) === myNorm;
            const peerAddrForHs = isOutgoingMsg && m.recipient?.trim() ? m.recipient : m.sender;
            const ts = effectiveInboxTsMs(m);
            const baseMeta = {
                sender: m.sender,
                isPlain: false as const,
                nonce: String(m.nonce),
                ts: ts > 0 ? ts : undefined,
                ...fetchedChainMeta(m),
            };
            if (!myPrivKey) {
                out.push({
                    ...baseMeta,
                    text: '[Verschlüsselt] Wallet nicht entsperrt – im UI „Schlüssel & Tresor“ / Entsperren, dann Posteingang neu laden.',
                });
                continue;
            }
            let peer =
                peerMap.get(normalizeAddress(peerAddrForHs)) ??
                peerMap.get(peerAddrForHs) ??
                [...peerMap.values()].find((p) => normalizeAddress(p.address) === normalizeAddress(peerAddrForHs));
            if (!peer && normalizeAddress(peerAddrForHs) === myNorm) {
                try {
                    const hs =
                        (await getHandshakeFromMailbox(myAddress, peerAddrForHs)) ??
                        (await findPeerHandshakeFrom(myAddress, peerAddrForHs));
                    if (hs) {
                        peer = { address: peerAddrForHs, pubKeyRaw: hs.pubKeyRaw, handshakeNonce: hs.nonce };
                    }
                } catch {}
            }
            if (!peer) {
                out.push({
                    ...baseMeta,
                    text: `[Verschlüsselt] Kein Handshake mit ${isOutgoingMsg ? 'Empfänger' : 'Absender'} ${String(peerAddrForHs).slice(0, 14)}… – zuerst /connect (Partner aus Handshake).`,
                });
                continue;
            }
            try {
                const decrypted = await decryptIotaPeerSessionMessage({
                    iv: m.iv,
                    ciphertext: m.cipher,
                    tag: m.tag,
                    myAddress,
                    peerAddress: peerAddrForHs,
                    myPrivKey,
                    peerPubRaw: peer.pubKeyRaw,
                    sessionArchive: getPeerSessionArchive(peerAddrForHs),
                });
                logger.debug(
                    `Inbox verschlüsselt entschlüsselt von ${m.sender.slice(0, 12)}… nonce=${m.nonce} (${decrypted.length} Zeichen)`
                );
                out.push({
                    sender: m.sender,
                    text: decrypted,
                    isPlain: false,
                    nonce: String(m.nonce),
                    ts: ts > 0 ? ts : undefined,
                    ...fetchedChainMeta(m),
                });
                const vaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
                const pw = getWalletPassword();
                if (vaultPath && pw) {
                    appendInboxCache(vaultPath, pw, {
                        sender: m.sender,
                        recipient: isOutgoingMsg && m.recipient?.trim() ? m.recipient : myAddress,
                        nonce: String(m.nonce),
                        text: decrypted,
                        ts: ts > 0 ? ts : 0,
                        packageId: (CFG.PACKAGE_ID || '').trim() || undefined,
                    }).catch(() => {});
                }
            } catch {
                out.push({
                    ...baseMeta,
                    text: '[Verschlüsselt] Entschlüsselung fehlgeschlagen (Key passt nicht oder Nutzlast beschädigt).',
                });
            }
        } else if (!m.isPlain) {
            const ts = effectiveInboxTsMs(m);
            out.push({
                sender: m.sender,
                text: '[Verschlüsselt] Eintrag ohne gültige IV/Cipher/Tag-Felder im Index.',
                isPlain: false,
                nonce: String(m.nonce),
                ts: ts > 0 ? ts : undefined,
                recipient: m.recipient,
                chainPurgeable: m.chainPurgeable !== false,
                inboxKey: m.key,
            });
        }
    }
    const vaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
    const pw = getWalletPassword();
    const qPkg = packageIdForQuery.trim().toLowerCase();
    const cfgPkg = (CFG.PACKAGE_ID || '').trim().toLowerCase();
    const mergeLocalInbox = Boolean(vaultPath && pw && opts?.mergeLocalInbox === true);
    if (mergeLocalInbox && pw) {
        try {
            const cached = await loadInboxCache(vaultPath, pw);
            const key = (s: string, n: string, t: string, tsVal: number) =>
                `${normalizeAddress(s)}:${n}:${tsVal}:${t.slice(0, 30)}`;
            const seen = new Set<string>();
            const merged: FetchedMessage[] = [];
            for (const c of cached) {
                const cid = (c.packageId || '').trim().toLowerCase();
                if (cid) {
                    if (cid !== qPkg) continue;
                } else if (qPkg !== cfgPkg) {
                    continue;
                }
                const k = key(c.sender, c.nonce, c.text, c.ts ?? 0);
                if (seen.has(k)) continue;
                seen.add(k);
                merged.push({
                    sender: c.sender,
                    text: c.text,
                    isPlain: false,
                    nonce: c.nonce,
                    ts: c.ts,
                    chainPurgeable: true,
                });
            }
            for (const o of out) {
                const k = key(o.sender, o.nonce ?? '', o.text ?? '', o.ts ?? 0);
                if (seen.has(k)) continue;
                seen.add(k);
                merged.push(o);
            }
            merged.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
            const result = merged.slice(skip, skip + count).map(
                ({ sender, text, isPlain, nonce, ts, chainPurgeable, recipient, inboxKey, chainPurgeKind }) => ({
                    sender,
                    text,
                    isPlain,
                    nonce,
                    ts,
                    chainPurgeable,
                    recipient,
                    inboxKey,
                    chainPurgeKind,
                })
            );
            if (toShow.length > 0 && !opts?.silent) logger.info(`Letzte ${result.length} Nachricht(en) geladen (inkl. lokaler Inbox).`);
            return { messages: result, hasMore };
        } catch {}
    }
    if (toShow.length > 0 && !opts?.silent) logger.info(`Letzte ${toShow.length} Nachricht(en) geladen.`);
    return {
        messages: out.map(({ sender, text, isPlain, nonce, ts, chainPurgeable, recipient, inboxKey, chainPurgeKind }) => ({
            sender,
            text,
            isPlain,
            nonce,
            ts,
            chainPurgeable,
            recipient,
            inboxKey,
            chainPurgeKind,
        })),
        hasMore,
    };
}

/** Nur Klartext-Nachrichten für eine bestimmte Empfängeradresse (Boss-Übersicht). */
export async function fetchPlaintextOnlyForRecipient(
    targetRecipient: string,
    count: number,
    packageId: string
): Promise<FetchedMessage[]> {
    const out: FetchedMessage[] = [];
    if (!CFG.ENABLE_PLAINTEXT_CHANNEL || !packageId || count <= 0) return out;
    const eventQuery = { MoveModule: { package: packageId, module: 'messaging' } };
    let plainCursor: string | null = null;
    const plainSeen = new Set<string>();
    const maxPages = 5;
    const items: { nonce: bigint; sender: string; text: string; tsMs: number }[] = [];
    for (let pg = 0; pg < maxPages; pg++) {
        const events = await getClient().queryEvents({
            query: eventQuery,
            limit: 500,
            order: 'descending',
            ...(plainCursor != null ? { cursor: plainCursor } : {}),
        } as any);
        const data = (events.data ?? []) as any[];
        const plain = data.filter(
            (e: any) =>
                e.type?.endsWith('::messaging::PlaintextMessage') &&
                normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(targetRecipient)
        );
        for (const msg of plain) {
            const d = msg.parsedJson as any;
            const key = `plain:${d.sender}:${d.nonce}`;
            if (plainSeen.has(key)) continue;
            plainSeen.add(key);
            const tRaw = (msg as { timestampMs?: bigint | number | string }).timestampMs;
            let tsMs = 0;
            if (typeof tRaw === 'bigint') tsMs = Number(tRaw);
            else if (typeof tRaw === 'number') tsMs = tRaw;
            else if (typeof tRaw === 'string') tsMs = parseInt(tRaw, 10) || 0;
            items.push({
                nonce: BigInt(d.nonce ?? 0),
                sender: d.sender,
                text: new TextDecoder().decode(toEventBytes(d.text)),
                tsMs,
            });
        }
        const next = (events as any).nextCursor;
        if (next == null || next === plainCursor) break;
        plainCursor = next;
    }
    items.sort((a, b) => {
        if (b.tsMs !== a.tsMs) return b.tsMs - a.tsMs;
        return a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0;
    });
    return items
        .slice(0, count)
        .map((m) => ({
            sender: m.sender,
            text: m.text,
            isPlain: true,
            recipient: targetRecipient,
            ts: m.tsMs > 0 ? m.tsMs : undefined,
        }));
}
