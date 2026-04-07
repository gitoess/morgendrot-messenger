/**
 * Kammer „Inbox/Fetch“: Nachrichten von Chain laden, entschlüsseln, mit lokalem Cache mergen.
 */
import { logger } from '../logger.js';
import { CFG, isMessengerMailboxModeActive } from '../config.js';
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
};

/** Holt die letzten N Nachrichten von der Chain, entschlüsselt und zeigt sie an. */
export async function fetchLastMessages(
    myAddress: string,
    peerOrMap: PeerState | Map<string, PeerState> | null,
    myPrivKey: CryptoKey | null,
    count: number,
    seenKeys?: Set<string>,
    senderFilter?: string,
    opts?: { silent?: boolean; packageId?: string; mergeLocalInbox?: boolean; offset?: number }
): Promise<FetchedMessage[]> {
    const out: FetchedMessage[] = [];
    if (count <= 0) return out;
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
        let cursor: string | null = null;
        const allEntries: any[] = [];
        const maxPages = 20;
        for (let pageNum = 0; pageNum < maxPages; pageNum++) {
            const page = await getClient().getDynamicFields({
                parentId: CFG.MAILBOX_ID,
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
            return e?.name?.type === typeName('MsgKey') && r != null && normalizeAddress(String(r)) === myNorm;
        });
        const msgKeyOut = allEntries.filter((e: any) => {
            const s = e?.name?.value?.sender;
            return e?.name?.type === typeName('MsgKey') && s != null && normalizeAddress(String(s)) === myNorm;
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
                const rawCreated = f.created_at_ms;
                const createdNum =
                    typeof rawCreated === 'bigint'
                        ? Number(rawCreated)
                        : typeof rawCreated === 'string'
                          ? parseInt(rawCreated, 10)
                          : Number(rawCreated ?? 0);
                const tsMs = Number.isFinite(createdNum) && createdNum > 0 ? createdNum : undefined;
                if (ivBytes.length >= 12 && cipherBytes.length > 0 && tagBytes.length === 16) {
                    items.push({
                        nonce,
                        sender,
                        recipient,
                        key: `${sender}:${recipient}:${nonce}`,
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
                    const rawCreated = f.created_at_ms;
                    const createdNum =
                        typeof rawCreated === 'bigint'
                            ? Number(rawCreated)
                            : typeof rawCreated === 'string'
                              ? parseInt(rawCreated, 10)
                              : Number(rawCreated ?? 0);
                    const tsMs = Number.isFinite(createdNum) && createdNum > 0 ? createdNum : undefined;
                    const textBytes = toEventBytes(f.text);
                    if (textBytes.length === 0) continue;
                    items.push({
                        nonce,
                        sender,
                        recipient,
                        key: `plain:${sender}:${recipient}:${nonce}`,
                        isPlain: true,
                        text: textBytes,
                        tsMs,
                        chainPurgeable: true,
                    });
                }
            }
        }
        if (CFG.ENABLE_PLAINTEXT_CHANNEL && packageIdForQuery) {
            const eventQuery = { MoveModule: { package: packageIdForQuery, module: 'messaging' } };
            let plainCursor: string | null = null;
            const maxPlainPages = 10;
            const plainSeen = new Set<string>();
            for (const it of items) {
                if (it.isPlain && it.key) plainSeen.add(it.key);
            }
            for (let pg = 0; pg < maxPlainPages; pg++) {
                const events = await getClient().queryEvents({
                    query: eventQuery,
                    limit: 500,
                    order: 'descending',
                    ...(plainCursor != null ? { cursor: plainCursor } : {}),
                } as any);
                const data = (events.data ?? []) as any[];
                const plainIn = data.filter(
                    (e: any) =>
                        e.type?.endsWith('::messaging::PlaintextMessage') &&
                        normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(myAddress) &&
                        matchesPeer(e.parsedJson?.sender) &&
                        matchesCounterparty(e.parsedJson?.sender)
                );
                const plainOutEv = data.filter(
                    (e: any) =>
                        e.type?.endsWith('::messaging::PlaintextMessage') &&
                        normalizeAddress(e.parsedJson?.sender) === normalizeAddress(myAddress) &&
                        matchesPeer(e.parsedJson?.recipient) &&
                        matchesCounterparty(e.parsedJson?.recipient)
                );
                for (const msg of [...plainIn, ...plainOutEv]) {
                    const d = msg.parsedJson as any;
                    const key = `plain:${d.sender}:${d.recipient}:${d.nonce}`;
                    if (plainSeen.has(key)) continue;
                    plainSeen.add(key);
                    const tRaw = (msg as { timestampMs?: bigint | number }).timestampMs;
                    const tsMs =
                        typeof tRaw === 'bigint'
                            ? Number(tRaw)
                            : typeof tRaw === 'number'
                              ? tRaw
                              : undefined;
                    items.push({
                        nonce: BigInt(d.nonce ?? 0),
                        sender: d.sender,
                        recipient: d.recipient,
                        key,
                        isPlain: true,
                        text: toEventBytes(d.text),
                        tsMs: Number.isFinite(tsMs) ? tsMs : undefined,
                        chainPurgeable: false,
                    });
                }
                const next = (events as any).nextCursor;
                if (next == null || next === plainCursor) break;
                plainCursor = next;
            }
        }
    } else if (packageIdForQuery) {
        const eventQuery = { MoveModule: { package: packageIdForQuery, module: 'messaging' } };
        let eventCursor: string | null = null;
        const allEventData: any[] = [];
        const maxEventPages = 5;
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
            const tsMs =
                typeof tRaw === 'bigint' ? Number(tRaw) : typeof tRaw === 'number' ? tRaw : undefined;
            if (ivBytes.length >= 12 && cipherBytes.length > 0 && tagBytes.length === 16) {
                items.push({
                    nonce: BigInt(d.nonce ?? 0),
                    sender: d.sender,
                    recipient: d.recipient,
                    key: `${d.sender}:${d.recipient}:${d.nonce}`,
                    isPlain: false,
                    iv: ivBytes,
                    cipher: cipherBytes,
                    tag: tagBytes,
                    tsMs: Number.isFinite(tsMs) ? tsMs : undefined,
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
            const tsMs =
                typeof tRaw === 'bigint' ? Number(tRaw) : typeof tRaw === 'number' ? tRaw : undefined;
            items.push({
                nonce: BigInt(d.nonce ?? 0),
                sender: d.sender,
                recipient: d.recipient,
                key: `plain:${d.sender}:${d.recipient}:${d.nonce}`,
                isPlain: true,
                text: toEventBytes(d.text),
                tsMs: Number.isFinite(tsMs) ? tsMs : undefined,
                chainPurgeable: false,
            });
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
        const ta = a.tsMs ?? 0;
        const tb = b.tsMs ?? 0;
        if (tb !== ta) return tb - ta;
        return a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0;
    });
    const skip = Math.max(0, Math.floor(opts?.offset ?? 0));
    const toShow = items.slice(skip, skip + count);

    for (const m of toShow) {
        if (seenKeys?.has(m.key)) continue;
        seenKeys?.add(m.key);
        if (m.isPlain) {
            const text = m.text && m.text.length > 0 ? new TextDecoder().decode(m.text) : '';
            logger.debug(`Inbox Klartext-Eintrag von ${m.sender.slice(0, 12)}… nonce=${m.nonce} (${text.length} Zeichen)`);
            out.push({
                sender: m.sender,
                text,
                isPlain: true,
                nonce: String(m.nonce),
                ts: m.tsMs,
                recipient: m.recipient,
                chainPurgeable: m.chainPurgeable === true,
            });
        } else if (m.iv && m.cipher && m.tag) {
            const isOutgoingMsg = normalizeAddress(m.sender) === myNorm;
            const peerAddrForHs = isOutgoingMsg && m.recipient?.trim() ? m.recipient : m.sender;
            const baseMeta = {
                sender: m.sender,
                isPlain: false as const,
                nonce: String(m.nonce),
                ts: m.tsMs,
                recipient: m.recipient,
                chainPurgeable: m.chainPurgeable !== false,
            };
            if (!myPrivKey) {
                out.push({
                    ...baseMeta,
                    text: '[Verschlüsselt] Wallet nicht entsperrt – im UI „Schlüssel & Tresor“ / Entsperren, dann Posteingang neu laden.',
                });
                continue;
            }
            const peer =
                peerMap.get(normalizeAddress(peerAddrForHs)) ??
                peerMap.get(peerAddrForHs) ??
                [...peerMap.values()].find((p) => normalizeAddress(p.address) === normalizeAddress(peerAddrForHs));
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
                    ts: m.tsMs,
                    recipient: m.recipient,
                    chainPurgeable: m.chainPurgeable !== false,
                });
                const vaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
                const pw = getWalletPassword();
                if (vaultPath && pw) {
                    appendInboxCache(vaultPath, pw, {
                        sender: m.sender,
                        recipient: isOutgoingMsg && m.recipient?.trim() ? m.recipient : myAddress,
                        nonce: String(m.nonce),
                        text: decrypted,
                        ts: Date.now(),
                        packageId: (CFG.PACKAGE_ID || '').trim() || undefined,
                    }).catch(() => {});
                }
            } catch {
                out.push({
                    ...baseMeta,
                    text: '[Verschlüsselt] Entschlüsselung fehlgeschlagen (Key passt nicht oder Nutzlast beschädigt).',
                });
            }
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
            const key = (s: string, n: string, t: string) => `${normalizeAddress(s)}:${n}:${t.slice(0, 30)}`;
            const seen = new Set<string>();
            const merged: FetchedMessage[] = [];
            for (const c of cached) {
                const cid = (c.packageId || '').trim().toLowerCase();
                if (cid) {
                    if (cid !== qPkg) continue;
                } else if (qPkg !== cfgPkg) {
                    continue;
                }
                const k = key(c.sender, c.nonce, c.text);
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
                const k = key(o.sender, o.nonce ?? '', o.text ?? '');
                if (seen.has(k)) continue;
                seen.add(k);
                merged.push(o);
            }
            merged.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
            const result = merged.slice(skip, skip + count).map(({ sender, text, isPlain, nonce, ts, chainPurgeable, recipient }) => ({
                sender,
                text,
                isPlain,
                nonce,
                ts,
                chainPurgeable,
                recipient,
            }));
            if (toShow.length > 0 && !opts?.silent) logger.info(`Letzte ${result.length} Nachricht(en) geladen (inkl. lokaler Inbox).`);
            return result;
        } catch {}
    }
    if (toShow.length > 0 && !opts?.silent) logger.info(`Letzte ${toShow.length} Nachricht(en) geladen.`);
    return out.map(({ sender, text, isPlain, nonce, ts, chainPurgeable, recipient }) => ({
        sender,
        text,
        isPlain,
        nonce,
        ts,
        chainPurgeable,
        recipient,
    }));
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
