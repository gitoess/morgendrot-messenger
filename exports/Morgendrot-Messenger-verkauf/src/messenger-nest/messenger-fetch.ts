/**
 * Kammer „Inbox/Fetch“: Nachrichten von Chain laden, entschlüsseln, mit lokalem Cache mergen.
 */
import { logger } from '../logger.js';
import { CFG } from '../config.js';
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

export function isRebasedStorageEnabled(): boolean {
    return Boolean(CFG.PACKAGE_ID && CFG.MAILBOX_ID && CFG.USE_MAILBOX);
}

type MsgItem = {
    nonce: bigint;
    sender: string;
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
    myPrivKey: CryptoKey,
    count: number,
    seenKeys?: Set<string>,
    senderFilter?: string,
    opts?: { silent?: boolean; packageId?: string; mergeLocalInbox?: boolean }
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

    const matchesSender = (s: string) => !senderNorm || normalizeAddress(s) === senderNorm;
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
        const msgEntries = allEntries.filter((e: any) => {
            const r = e?.name?.value?.recipient;
            return e?.name?.type === typeName('MsgKey') && r != null && normalizeAddress(String(r)) === myNorm;
        });
        const ids = msgEntries.map((e: any) => e.objectId).filter(Boolean);
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
                if (!matchesPeer(sender) || !matchesSender(sender)) continue;
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
                        key: `${sender}:${nonce}`,
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
        if (CFG.ENABLE_PLAINTEXT_CHANNEL && packageIdForQuery) {
            const eventQuery = { MoveModule: { package: packageIdForQuery, module: 'messaging' } };
            let plainCursor: string | null = null;
            const maxPlainPages = 10;
            const plainSeen = new Set<string>();
            for (let pg = 0; pg < maxPlainPages; pg++) {
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
                        normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(myAddress) &&
                        matchesPeer(e.parsedJson?.sender) &&
                        matchesSender(e.parsedJson?.sender)
                );
                for (const msg of plain) {
                    const d = msg.parsedJson as any;
                    const key = `plain:${d.sender}:${d.nonce}`;
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
        const enc = data.filter(
            (e: any) =>
                e.type?.endsWith('::messaging::EncryptedMessage') &&
                normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(myAddress) &&
                matchesPeer(e.parsedJson?.sender) &&
                matchesSender(e.parsedJson?.sender)
        );
        const plain = data.filter(
            (e: any) =>
                e.type?.endsWith('::messaging::PlaintextMessage') &&
                normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(myAddress) &&
                matchesPeer(e.parsedJson?.sender) &&
                matchesSender(e.parsedJson?.sender)
        );
        for (const msg of enc) {
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
                    key: `${d.sender}:${d.nonce}`,
                    isPlain: false,
                    iv: ivBytes,
                    cipher: cipherBytes,
                    tag: tagBytes,
                    tsMs: Number.isFinite(tsMs) ? tsMs : undefined,
                    chainPurgeable: false,
                });
            }
        }
        for (const msg of plain) {
            const d = msg.parsedJson as any;
            const tRaw = (msg as { timestampMs?: bigint | number }).timestampMs;
            const tsMs =
                typeof tRaw === 'bigint' ? Number(tRaw) : typeof tRaw === 'number' ? tRaw : undefined;
            items.push({
                nonce: BigInt(d.nonce ?? 0),
                sender: d.sender,
                key: `plain:${d.sender}:${d.nonce}`,
                isPlain: true,
                text: toEventBytes(d.text),
                tsMs: Number.isFinite(tsMs) ? tsMs : undefined,
                chainPurgeable: false,
            });
        }
    }

    if (standalone && items.length > 0) {
        const uniqueSenders = [...new Set(items.map((m) => normalizeAddress(m.sender)))];
        for (const addr of uniqueSenders) {
            if (peerMap.has(addr)) continue;
            const senderAddr = items.find((m) => normalizeAddress(m.sender) === addr)?.sender;
            if (!senderAddr) continue;
            const hs =
                (await getHandshakeFromMailbox(myAddress, senderAddr)) ??
                (await findPeerHandshakeFrom(myAddress, senderAddr));
            if (hs)
                peerMap.set(normalizeAddress(senderAddr), {
                    address: senderAddr,
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
    const toShow = items.slice(0, count);

    for (const m of toShow) {
        if (seenKeys?.has(m.key)) continue;
        seenKeys?.add(m.key);
        const wallTs = m.tsMs
            ? new Date(m.tsMs).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
              })
            : new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (m.isPlain) {
            const text = m.text && m.text.length > 0 ? new TextDecoder().decode(m.text) : '';
            console.log(`\n\x1b[90m[${wallTs}]\x1b[0m \x1b[36m[Klartext]\x1b[0m \x1b[33m<< ${m.sender.slice(0, 10)}…\x1b[0m ${text}\n> `);
            out.push({
                sender: m.sender,
                text,
                isPlain: true,
                nonce: String(m.nonce),
                ts: m.tsMs,
                chainPurgeable: m.chainPurgeable === true,
            });
        } else if (m.iv && m.cipher && m.tag) {
            const peer =
                peerMap.get(normalizeAddress(m.sender)) ??
                peerMap.get(m.sender) ??
                [...peerMap.values()].find((p) => normalizeAddress(p.address) === normalizeAddress(m.sender));
            if (!peer) continue;
            const combined = new Uint8Array([...m.cipher, ...m.tag]);
            try {
                const aesKey = await deriveAesGcmKey(await deriveSharedSecret(myPrivKey, peer.pubKeyRaw));
                const decrypted = await decryptMessage(
                    aesKey,
                    Buffer.from(m.iv).toString('base64'),
                    Buffer.from(combined).toString('base64')
                );
                console.log(`\n\x1b[90m[${wallTs}]\x1b[0m \x1b[33m<< ${m.sender.slice(0, 10)}…\x1b[0m ${decrypted}\n> `);
                out.push({
                    sender: m.sender,
                    text: decrypted,
                    isPlain: false,
                    nonce: String(m.nonce),
                    ts: m.tsMs,
                    chainPurgeable: m.chainPurgeable !== false,
                });
                const vaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
                const pw = getWalletPassword();
                if (vaultPath && pw) {
                    appendInboxCache(vaultPath, pw, {
                        sender: m.sender,
                        recipient: myAddress,
                        nonce: String(m.nonce),
                        text: decrypted,
                        ts: Date.now(),
                        packageId: (CFG.PACKAGE_ID || '').trim() || undefined,
                    }).catch(() => {});
                }
            } catch {
                // Entschlüsselung fehlgeschlagen – überspringen
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
            const result = merged.slice(0, count).map(({ sender, text, isPlain, nonce, ts, chainPurgeable }) => ({
                sender,
                text,
                isPlain,
                nonce,
                ts,
                chainPurgeable,
            }));
            if (toShow.length > 0 && !opts?.silent) logger.info(`Letzte ${result.length} Nachricht(en) geladen (inkl. lokaler Inbox).`);
            return result;
        } catch {}
    }
    if (toShow.length > 0 && !opts?.silent) logger.info(`Letzte ${toShow.length} Nachricht(en) geladen.`);
    return out.map(({ sender, text, isPlain, nonce, ts, chainPurgeable }) => ({
        sender,
        text,
        isPlain,
        nonce,
        ts,
        chainPurgeable,
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
    const items: { nonce: bigint; sender: string; text: string }[] = [];
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
            items.push({
                nonce: BigInt(d.nonce ?? 0),
                sender: d.sender,
                text: new TextDecoder().decode(toEventBytes(d.text)),
            });
        }
        const next = (events as any).nextCursor;
        if (next == null || next === plainCursor) break;
        plainCursor = next;
    }
    items.sort((a, b) => (a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0));
    return items.slice(0, count).map((m) => ({ sender: m.sender, text: m.text, isPlain: true, recipient: targetRecipient }));
}
