/**
 * Kammer „Inbox/Fetch“: Nachrichten von Chain laden, entschlüsseln, mit lokalem Cache mergen.
 */
import { logger } from '../logger.js';
import { CFG, isMessengerMailboxModeActive, readMailboxIdHistory, readPackageIdHistory } from '../config.js';
import { isPrivateMailboxObjectIdOverrideActive } from '../mailbox-object-id-scope.js';
import {
    getClient,
    typeName,
    getHandshakeFromMailbox,
    findPeerHandshakeFrom,
} from '../chain-access.js';
import {
    loadHandshakeCache,
    saveHandshakeCache,
    appendInboxCache,
    loadInboxCache,
} from '../vault-local.js';
import { deriveSharedSecret, deriveAesGcmKey, decryptMessage } from '../crypto-layer.js';
import { normalizeAddress, toEventBytes } from '../utils.js';
import type { PeerState } from './peer-state.js';
import { getWalletPassword } from './messenger-session-password.js';

/** Alias für ältere Aufrufer; gleiche Bedingung wie `isMessengerMailboxModeActive` (config). */
export function isRebasedStorageEnabled(): boolean {
    return isMessengerMailboxModeActive();
}

/** Dynamic-Field-Typ: nach Package-Upgrade steht in der Kette oft noch die alte `0x…::messaging::MsgKey`. */
function typeMatchesMsgKey(typeStr: unknown): boolean {
    const t = String(typeStr ?? '');
    return t === typeName('MsgKey') || t.endsWith('::messaging::MsgKey');
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
};

/** Chain-Zeit: Sekunden (<1e12) → ms; ungültig → undefined. */
function parseChainTimeMs(raw: unknown): number | undefined {
    if (raw == null) return undefined;
    const n =
        typeof raw === 'bigint'
            ? Number(raw)
            : typeof raw === 'string'
              ? parseInt(raw, 10)
              : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    if (n < 1_000_000_000_000) return n * 1000;
    return n;
}

/** MsgKey: Sendezeit = ms-Nonce; sonst created_at_ms; sonst expires_at_ms − TTL (Move store). */
function resolveMailboxTsMs(
    rawCreated: unknown,
    rawExpires: unknown,
    nonce: bigint,
    ttlDays = 30
): number | undefined {
    const n = Number(nonce);
    if (Number.isFinite(n) && n >= 1_000_000_000_000) return n;
    const created = parseChainTimeMs(rawCreated);
    const expires = parseChainTimeMs(rawExpires);
    if (expires != null && expires > 1_000_000_000_000) {
        const approx = expires - ttlDays * 86_400_000;
        if (approx > 1_000_000_000_000) return approx;
    }
    return created;
}

/** Sort-/Anzeige-Zeit: Chain-ts, sonst ms-artige Nonce (Events ohne `timestampMs`). */
function effectiveInboxTsMs(m: { tsMs?: number; nonce: bigint }): number {
    if (m.tsMs != null && Number.isFinite(m.tsMs) && m.tsMs > 0) return m.tsMs;
    const n = Number(m.nonce);
    if (Number.isFinite(n) && n >= 1_000_000_000_000) return n;
    return 0;
}

function resolveEventTsMs(tsMs: number | undefined, nonce: bigint): number | undefined {
    if (tsMs != null && Number.isFinite(tsMs) && tsMs > 0) return tsMs;
    const n = Number(nonce);
    if (Number.isFinite(n) && n >= 1_000_000_000_000) return n;
    return undefined;
}

function eventStableId(msg: { id?: unknown }): string {
    const id = msg.id;
    if (id == null) return '';
    if (typeof id === 'string') return id.trim();
    try {
        return JSON.stringify(id);
    } catch {
        return String(id);
    }
}

/** Eindeutiger Posteingang-Schlüssel — Event-ID bevorzugt (gleiche nonce=1 kommt oft vor). */
function inboxDedupKey(parts: {
    eventId?: string;
    channel: 'ev' | 'plain' | 'mb' | 'mbp';
    sender: string;
    recipient: string;
    nonce: string | number | bigint;
    tsMs?: number;
}): string {
    const eid = (parts.eventId || '').trim();
    if (eid) return `evid:${eid}`;
    return `${parts.channel}:${normalizeAddress(parts.sender)}:${normalizeAddress(parts.recipient)}:${parts.nonce}:${parts.tsMs ?? 0}`;
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
};

const PACKAGE_ID_HEX = /^0x[a-fA-F0-9]{64}$/i;

/** Events (verschlüsselt + Klartext) für ein Move-Paket — Posteingang-Union, unabhängig von USE_MAILBOX. */
function maxEventPagesForInboxFetch(inboxLimit: number, isPrimaryPackage: boolean): number {
    if (!isPrimaryPackage) return 2;
    if (inboxLimit >= 200) return 15;
    if (inboxLimit >= 80) return 8;
    return 4;
}

async function appendMessagingEventsForPackage(
    packageId: string,
    myAddress: string,
    items: MsgItem[],
    matchesPeer: (s: string) => boolean,
    matchesCounterparty: (peerAddr: string | undefined) => boolean,
    keySeen: Set<string>,
    opts?: { maxEventPages?: number }
): Promise<void> {
    const eventQuery = { MoveModule: { package: packageId, module: 'messaging' } };
    let eventCursor: string | null = null;
    const allEventData: any[] = [];
    const maxEventPages = opts?.maxEventPages ?? 15;
    for (let p = 0; p < maxEventPages; p++) {
        const events = await getClient().queryEvents({
            query: eventQuery,
            limit: 1000,
            order: 'descending',
            ...(eventCursor != null ? { cursor: eventCursor } : {}),
        } as any);
        const data = (events.data ?? []) as any[];
        allEventData.push(...data);
        const next = (events as any).nextCursor;
        if (next == null || next === eventCursor) break;
        eventCursor = next;
    }
    const data = allEventData;
    const encIn = data.filter(
        (e: any) =>
            e.type?.endsWith('::messaging::EncryptedMessage') &&
            normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(myAddress) &&
            matchesPeer(e.parsedJson?.sender) &&
            matchesCounterparty(e.parsedJson?.sender)
    );
    const encOut = data.filter(
        (e: any) =>
            e.type?.endsWith('::messaging::EncryptedMessage') &&
            normalizeAddress(e.parsedJson?.sender) === normalizeAddress(myAddress) &&
            matchesPeer(e.parsedJson?.recipient) &&
            matchesCounterparty(e.parsedJson?.recipient)
    );
    for (const msg of [...encIn, ...encOut]) {
        const d = msg.parsedJson as any;
        const ivBytes = toEventBytes(d.iv);
        const cipherBytes = toEventBytes(d.ciphertext);
        const tagBytes = toEventBytes(d.tag);
        const tRaw = (msg as { timestampMs?: bigint | number }).timestampMs;
        const tsRaw =
            typeof tRaw === 'bigint' ? Number(tRaw) : typeof tRaw === 'number' ? tRaw : undefined;
        const nonce = BigInt(d.nonce ?? 0);
        const tsMs = resolveEventTsMs(tsRaw, nonce);
        if (ivBytes.length >= 12 && cipherBytes.length > 0 && tagBytes.length === 16) {
            const key = inboxDedupKey({
                eventId: eventStableId(msg),
                channel: 'ev',
                sender: d.sender,
                recipient: d.recipient,
                nonce: d.nonce ?? nonce,
                tsMs,
            });
            if (keySeen.has(key)) continue;
            keySeen.add(key);
            items.push({
                nonce,
                sender: d.sender,
                recipient: d.recipient,
                key,
                isPlain: false,
                iv: ivBytes,
                cipher: cipherBytes,
                tag: tagBytes,
                tsMs,
                chainPurgeable: false,
            });
        }
    }
    const plainInEv = data.filter(
        (e: any) =>
            e.type?.endsWith('::messaging::PlaintextMessage') &&
            normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(myAddress) &&
            matchesPeer(e.parsedJson?.sender) &&
            matchesCounterparty(e.parsedJson?.sender)
    );
    const plainOutEv2 = data.filter(
        (e: any) =>
            e.type?.endsWith('::messaging::PlaintextMessage') &&
            normalizeAddress(e.parsedJson?.sender) === normalizeAddress(myAddress) &&
            matchesPeer(e.parsedJson?.recipient) &&
            matchesCounterparty(e.parsedJson?.recipient)
    );
    for (const msg of [...plainInEv, ...plainOutEv2]) {
        const d = msg.parsedJson as any;
        const tRaw = (msg as { timestampMs?: bigint | number }).timestampMs;
        const tsRaw =
            typeof tRaw === 'bigint' ? Number(tRaw) : typeof tRaw === 'number' ? tRaw : undefined;
        const nonce = BigInt(d.nonce ?? 0);
        const tsMs = resolveEventTsMs(tsRaw, nonce);
        const key = inboxDedupKey({
            eventId: eventStableId(msg),
            channel: 'plain',
            sender: d.sender,
            recipient: d.recipient,
            nonce: d.nonce ?? nonce,
            tsMs,
        });
        if (keySeen.has(key)) continue;
        keySeen.add(key);
        items.push({
            nonce,
            sender: d.sender,
            recipient: d.recipient,
            key,
            isPlain: true,
            text: toEventBytes(d.text),
            tsMs,
            chainPurgeable: false,
        });
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
    return out;
}

async function appendMailboxDynamicFieldsToItems(
    parentId: string,
    items: MsgItem[],
    myNorm: string,
    matchesPeer: (s: string) => boolean,
    matchesCounterparty: (peerAddr: string | undefined) => boolean
): Promise<void> {
    let cursor: string | null = null;
    const allEntries: any[] = [];
    const maxPages = 20;
    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
        const page = await getClient().getDynamicFields({
            parentId,
            limit: 500,
            ...(cursor ? { cursor } : {}),
        } as any);
        const entries = (page as any)?.data ?? [];
        allEntries.push(...entries);
        const hasNext = (page as any)?.hasNextPage === true;
        const nextCursor = (page as any)?.nextCursor;
        if (!hasNext || !nextCursor) break;
        cursor = nextCursor;
    }
    const msgKeyIn = allEntries.filter((e: any) => {
        const r = e?.name?.value?.recipient;
        return typeMatchesMsgKey(e?.name?.type) && r != null && normalizeAddress(String(r)) === myNorm;
    });
    const msgKeyOut = allEntries.filter((e: any) => {
        const s = e?.name?.value?.sender;
        return typeMatchesMsgKey(e?.name?.type) && s != null && normalizeAddress(String(s)) === myNorm;
    });
    const ids = [...new Set([...msgKeyIn, ...msgKeyOut].map((e: any) => e.objectId).filter(Boolean))] as string[];
    if (ids.length) {
        const BATCH = 50;
        const objs: any[] = [];
        for (let i = 0; i < ids.length; i += BATCH) {
            const chunk = ids.slice(i, i + BATCH);
            const part = await getClient().multiGetObjects({ ids: chunk, options: { showContent: true } } as any);
            objs.push(...(part ?? []));
        }
        for (const o of objs) {
            const f = o?.data?.content?.fields;
            if (!f) continue;
            const sender = f.sender as string;
            const recipient = f.recipient as string;
            const incoming = recipient != null && normalizeAddress(String(recipient)) === myNorm;
            const outgoing = sender != null && normalizeAddress(String(sender)) === myNorm;
            if (!incoming && !outgoing) continue;
            const peerAddr = incoming ? sender : recipient;
            if (!peerAddr || !matchesPeer(peerAddr) || !matchesCounterparty(peerAddr)) continue;
            const nonce = BigInt(f.nonce ?? 0);
            const ivBytes = toEventBytes(f.iv);
            const cipherBytes = toEventBytes(f.ciphertext);
            const tagBytes = toEventBytes(f.tag);
            const tsMs = resolveMailboxTsMs(f.created_at_ms, f.expires_at_ms, nonce);
            if (ivBytes.length >= 12 && cipherBytes.length > 0 && tagBytes.length === 16) {
                    items.push({
                        nonce,
                        sender,
                        recipient,
                        key: inboxDedupKey({
                            channel: 'mb',
                            sender,
                            recipient,
                            nonce,
                            tsMs,
                        }),
                        isPlain: false,
                        iv: ivBytes,
                        cipher: cipherBytes,
                        tag: tagBytes,
                        tsMs,
                        chainPurgeable: true,
                    });
            }
        }
    }
    if (CFG.MAILBOX_STORE_PLAINTEXT) {
        const plainKeyIn = allEntries.filter((e: any) => {
            const r = e?.name?.value?.recipient;
            const t = String(e?.name?.type ?? '');
            return (
                (t === typeName('PlainMsgKey') || t.endsWith('::messaging::PlainMsgKey')) &&
                r != null &&
                normalizeAddress(String(r)) === myNorm
            );
        });
        const plainKeyOut = allEntries.filter((e: any) => {
            const s = e?.name?.value?.sender;
            const t = String(e?.name?.type ?? '');
            return (
                (t === typeName('PlainMsgKey') || t.endsWith('::messaging::PlainMsgKey')) &&
                s != null &&
                normalizeAddress(String(s)) === myNorm
            );
        });
        const plainIds = [...new Set([...plainKeyIn, ...plainKeyOut].map((e: any) => e.objectId).filter(Boolean))] as string[];
        if (plainIds.length) {
            const BATCH = 50;
            const plainObjs: any[] = [];
            for (let i = 0; i < plainIds.length; i += BATCH) {
                const chunk = plainIds.slice(i, i + BATCH);
                const part = await getClient().multiGetObjects({ ids: chunk, options: { showContent: true } } as any);
                plainObjs.push(...(part ?? []));
            }
            for (const o of plainObjs) {
                const f = o?.data?.content?.fields;
                if (!f) continue;
                const sender = f.sender as string;
                const recipient = f.recipient as string;
                const incoming = recipient != null && normalizeAddress(String(recipient)) === myNorm;
                const outgoing = sender != null && normalizeAddress(String(sender)) === myNorm;
                if (!incoming && !outgoing) continue;
                const peerAddr = incoming ? sender : recipient;
                if (!peerAddr || !matchesPeer(peerAddr) || !matchesCounterparty(peerAddr)) continue;
                const nonce = BigInt(f.nonce ?? 0);
                const tsMs = resolveMailboxTsMs(f.created_at_ms, f.expires_at_ms, nonce);
                const textBytes = toEventBytes(f.text);
                if (textBytes.length === 0) continue;
                    items.push({
                        nonce,
                        sender,
                        recipient,
                        key: inboxDedupKey({
                            channel: 'mbp',
                            sender,
                            recipient,
                            nonce,
                            tsMs,
                        }),
                        isPlain: true,
                        text: textBytes,
                        tsMs,
                        chainPurgeable: true,
                    });
            }
        }
    }
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

    if (isRebasedStorageEnabled()) {
        const mailboxParents = isPrivateMailboxObjectIdOverrideActive()
            ? [CFG.MAILBOX_ID]
            : mailboxIdsForInboxUnion();
        for (const parentId of mailboxParents) {
            if (!MAILBOX_ID_HEX.test(String(parentId || '').trim())) continue;
            await appendMailboxDynamicFieldsToItems(
                parentId.trim(),
                items,
                myNorm,
                matchesPeer,
                matchesCounterparty
            );
        }
        const keySeen = new Set<string>();
        for (const it of items) {
            if (it.key) keySeen.add(it.key);
        }
        if (!opts?.skipMessagingEvents) {
            const primaryPkg = (packageIdForQuery || CFG.PACKAGE_ID || '').trim().toLowerCase();
            for (const pkg of packageIdsForInboxUnion(packageIdForQuery)) {
                const isPrimary = pkg.trim().toLowerCase() === primaryPkg;
                await appendMessagingEventsForPackage(
                    pkg,
                    myAddress,
                    items,
                    matchesPeer,
                    matchesCounterparty,
                    keySeen,
                    { maxEventPages: maxEventPagesForInboxFetch(count, isPrimary) }
                );
            }
        }
    } else if (!opts?.skipMessagingEvents) {
        const keySeen = new Set<string>();
        const primaryPkg = (packageIdForQuery || CFG.PACKAGE_ID || '').trim().toLowerCase();
        for (const pkg of packageIdsForInboxUnion(packageIdForQuery)) {
            const isPrimary = pkg.trim().toLowerCase() === primaryPkg;
            await appendMessagingEventsForPackage(
                pkg,
                myAddress,
                items,
                matchesPeer,
                matchesCounterparty,
                keySeen,
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
            } catch {}
        }
    }

    items.sort((a, b) => {
        const ta = effectiveInboxTsMs(a);
        const tb = effectiveInboxTsMs(b);
        if (tb !== ta) return tb - ta;
        return a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0;
    });
    const skip = Math.max(0, Math.floor(opts?.offset ?? 0));
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
                recipient: m.recipient,
                chainPurgeable: m.chainPurgeable === true,
                inboxKey: m.key,
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
                recipient: m.recipient,
                chainPurgeable: m.chainPurgeable !== false,
                inboxKey: m.key,
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
            const combined = new Uint8Array([...m.cipher, ...m.tag]);
            try {
                const aesKey = await deriveAesGcmKey(await deriveSharedSecret(myPrivKey, peer.pubKeyRaw));
                const decrypted = await decryptMessage(
                    aesKey,
                    Buffer.from(m.iv).toString('base64'),
                    Buffer.from(combined).toString('base64')
                );
                logger.debug(
                    `Inbox verschlüsselt entschlüsselt von ${m.sender.slice(0, 12)}… nonce=${m.nonce} (${decrypted.length} Zeichen)`
                );
                out.push({
                    sender: m.sender,
                    text: decrypted,
                    isPlain: false,
                    nonce: String(m.nonce),
                    ts: ts > 0 ? ts : undefined,
                    recipient: m.recipient,
                    chainPurgeable: m.chainPurgeable !== false,
                    inboxKey: m.key,
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
                ({ sender, text, isPlain, nonce, ts, chainPurgeable, recipient, inboxKey }) => ({
                    sender,
                    text,
                    isPlain,
                    nonce,
                    ts,
                    chainPurgeable,
                    recipient,
                    inboxKey,
                })
            );
            if (toShow.length > 0 && !opts?.silent) logger.info(`Letzte ${result.length} Nachricht(en) geladen (inkl. lokaler Inbox).`);
            return { messages: result, hasMore };
        } catch {}
    }
    if (toShow.length > 0 && !opts?.silent) logger.info(`Letzte ${toShow.length} Nachricht(en) geladen.`);
    return {
        messages: out.map(({ sender, text, isPlain, nonce, ts, chainPurgeable, recipient, inboxKey }) => ({
            sender,
            text,
            isPlain,
            nonce,
            ts,
            chainPurgeable,
            recipient,
            inboxKey,
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
