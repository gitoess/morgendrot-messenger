/**
 * Kammer „Listener“: Hintergrund-Polling für neue Mailbox-/Event-Nachrichten.
 */
import { logger } from '../logger.js';
import { CFG } from '../config.js';
import { formatNetworkFetchError, formatRpcUrlForLog } from '../network-fetch-error.js';
import { getClient, typeName, getHandshakeFromMailbox, findPeerHandshakeFrom } from '../chain-access.js';
import { decryptIotaPeerSessionMessage } from '../shared/morgendrot-crypto-session-wire.js';
import { getPeerSessionArchive } from './messenger-session-keys-state.js';
import { normalizeAddress, toEventBytes } from '../utils.js';
import type { PeerState } from './peer-state.js';
import { fetchLastMessages, isRebasedStorageEnabled } from './messenger-fetch.js';

async function tryDecryptListenerPeerMessage(
    myAddress: string,
    myPrivKey: CryptoKey,
    peer: PeerState,
    ivBytes: Uint8Array,
    cipherBytes: Uint8Array,
    tagBytes: Uint8Array
): Promise<string | null> {
    try {
        return await decryptIotaPeerSessionMessage({
            iv: ivBytes,
            ciphertext: cipherBytes,
            tag: tagBytes,
            myAddress,
            peerAddress: peer.address,
            myPrivKey,
            peerPubRaw: peer.pubKeyRaw,
            sessionArchive: getPeerSessionArchive(peer.address),
        });
    } catch {
        return null;
    }
}

export async function listenForMessages(
    myAddress: string,
    peerOrMap: PeerState | Map<string, PeerState>,
    myPrivKey: CryptoKey
) {
    const peerMap = peerOrMap instanceof Map ? peerOrMap : new Map([[peerOrMap.address, peerOrMap]]);
    const peerAddrs = new Set([...peerMap.keys()].map((a) => normalizeAddress(a)));
    logger.info(`Listener aktiv für ${myAddress} (${peerMap.size} Partner).`);
    let lastSeenNonce = BigInt(0);
    const lastDecryptWarnNonce = new Map<string, bigint>();

    const seenKeys = new Set<string>();
    if (CFG.FETCH_LAST_ON_START > 0) {
        try {
            await fetchLastMessages(myAddress, peerMap, myPrivKey, CFG.FETCH_LAST_ON_START, seenKeys).then(
                (r) => r.messages
            );
        } catch (e: unknown) {
            logger.warn(
                formatNetworkFetchError(e, {
                    context: 'Fetch letzte Nachrichten beim Start fehlgeschlagen',
                    target: `RPC ${formatRpcUrlForLog(CFG.RPC_URL)}`,
                })
            );
        }
    }

    while (true) {
        try {
            for (const peer of peerMap.values()) {
                const latest =
                    (await getHandshakeFromMailbox(myAddress, peer.address)) ??
                    (await findPeerHandshakeFrom(myAddress, peer.address));
                if (latest && latest.nonce > peer.handshakeNonce) {
                    peer.pubKeyRaw = latest.pubKeyRaw;
                    peer.handshakeNonce = latest.nonce;
                }
            }

            if (isRebasedStorageEnabled()) {
                const page = await getClient().getDynamicFields({ parentId: CFG.MAILBOX_ID, limit: 200 } as any);
                const entries = (page as any)?.data ?? [];
                const msgEntries = entries.filter((e: any) => {
                    const t = String(e?.name?.type ?? '');
                    return (
                        (t === typeName('MsgKey') || t.endsWith('::messaging::MsgKey')) &&
                        e?.name?.value?.recipient === myAddress
                    );
                });

                const ids = msgEntries.map((e: any) => e.objectId).filter(Boolean);
                if (ids.length) {
                    const objs = await getClient().multiGetObjects({ ids, options: { showContent: true } } as any);
                    for (const o of objs as any[]) {
                        const f = o?.data?.content?.fields;
                        if (!f) continue;
                        const sender = f.sender as string;
                        if (!peerAddrs.has(normalizeAddress(sender))) continue;
                        const peer =
                            peerMap.get(sender) ??
                            [...peerMap.values()].find((p) => normalizeAddress(p.address) === normalizeAddress(sender));
                        if (!peer) continue;
                        const nonce = BigInt(f.nonce ?? 0);
                        if (nonce <= peer.handshakeNonce - 120000n) continue;
                        const key = `${sender}:${nonce}`;
                        if (seenKeys.has(key)) continue;
                        seenKeys.add(key);
                        if (nonce > lastSeenNonce) lastSeenNonce = nonce;

                        const ivBytes = toEventBytes(f.iv);
                        const cipherBytes = toEventBytes(f.ciphertext);
                        const tagBytes = toEventBytes(f.tag);
                        if (ivBytes.length < 12 || cipherBytes.length === 0 || tagBytes.length !== 16) continue;
                        const decrypted = await tryDecryptListenerPeerMessage(
                            myAddress,
                            myPrivKey,
                            peer,
                            ivBytes,
                            cipherBytes,
                            tagBytes
                        );
                        if (!decrypted) {
                            if (lastDecryptWarnNonce.get(sender) !== nonce) {
                                lastDecryptWarnNonce.set(sender, nonce);
                                logger.warn(
                                    'Empfangene Nachricht konnte nicht entschlüsselt werden (evtl. Partner neu gestartet / Handshake geändert).'
                                );
                            }
                            continue;
                        }
                        const ts = new Date().toLocaleTimeString('de-DE', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        });
                        console.log(`\n\x1b[90m[${ts}]\x1b[0m \x1b[33m<< ${sender.slice(0, 10)}…\x1b[0m ${decrypted}\n> `);
                    }
                }
                if (CFG.ENABLE_PLAINTEXT_CHANNEL) {
                    const events = await getClient().queryEvents({
                        query: { MoveModule: { package: CFG.PACKAGE_ID, module: 'messaging' } },
                        limit: 30,
                        order: 'descending',
                    });
                    const newPlain = (events.data as any[]).filter(
                        (e: any) =>
                            e.type?.endsWith('::messaging::PlaintextMessage') &&
                            normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(myAddress) &&
                            peerAddrs.has(normalizeAddress(e.parsedJson?.sender))
                    );
                    for (const msg of newPlain) {
                        const data = msg.parsedJson as any;
                        const key = `plain:${data.sender}:${data.nonce}`;
                        if (seenKeys.has(key)) continue;
                        seenKeys.add(key);
                        const textBytes = toEventBytes(data.text);
                        const text = textBytes.length > 0 ? new TextDecoder().decode(textBytes) : '';
                        const ts = new Date().toLocaleTimeString('de-DE', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        });
                        console.log(
                            `\n\x1b[90m[${ts}]\x1b[0m \x1b[36m[Klartext]\x1b[0m \x1b[33m<< ${String(data.sender).slice(0, 10)}…\x1b[0m ${text}\n> `
                        );
                    }
                }
            } else {
                const events = await getClient().queryEvents({
                    query: { MoveModule: { package: CFG.PACKAGE_ID, module: 'messaging' } },
                    limit: 30,
                    order: 'descending',
                });

                const newMsgs = (events.data as any[]).filter(
                    (e: any) =>
                        e.type?.endsWith('::messaging::EncryptedMessage') &&
                        normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(myAddress) &&
                        peerAddrs.has(normalizeAddress(e.parsedJson?.sender))
                );
                const newPlain = CFG.ENABLE_PLAINTEXT_CHANNEL
                    ? (events.data as any[]).filter(
                          (e: any) =>
                              e.type?.endsWith('::messaging::PlaintextMessage') &&
                              normalizeAddress(e.parsedJson?.recipient) === normalizeAddress(myAddress) &&
                              peerAddrs.has(normalizeAddress(e.parsedJson?.sender))
                      )
                    : [];
                if (CFG.LOG_VERBOSE && (newMsgs.length > 0 || newPlain.length > 0)) {
                    logger.info(
                        `Listener: ${newMsgs.length} Nachricht(en), ${newPlain.length} Klartext von ${peerMap.size} Partner(n).`
                    );
                }

                const nonceTolerance = 120000n;
                for (const msg of newPlain) {
                    const data = msg.parsedJson as any;
                    const nonce = BigInt(data.nonce ?? 0);
                    const key = `plain:${data.sender}:${data.nonce}`;
                    if (seenKeys.has(key)) continue;
                    seenKeys.add(key);
                    const textBytes = toEventBytes(data.text);
                    const text = textBytes.length > 0 ? new TextDecoder().decode(textBytes) : '';
                    const ts = new Date().toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    });
                    console.log(
                        `\n\x1b[90m[${ts}]\x1b[0m \x1b[36m[Klartext]\x1b[0m \x1b[33m<< ${String(data.sender).slice(0, 10)}…\x1b[0m ${text}\n> `
                    );
                }
                for (const msg of newMsgs) {
                    const data = msg.parsedJson as any;
                    const sender = data.sender;
                    const peer =
                        peerMap.get(sender) ??
                        [...peerMap.values()].find((p) => normalizeAddress(p.address) === normalizeAddress(sender));
                    if (!peer) continue;
                    const nonce = BigInt(data.nonce ?? 0);
                    if (nonce <= peer.handshakeNonce - nonceTolerance) {
                        if (CFG.LOG_VERBOSE)
                            logger.info(
                                `Listener: Nachricht nonce=${nonce} übersprungen (<= handshakeNonce-2min=${peer.handshakeNonce - nonceTolerance}).`
                            );
                        continue;
                    }
                    const key = `${data.sender}:${data.nonce}`;
                    if (seenKeys.has(key)) continue;
                    seenKeys.add(key);
                    if (nonce > lastSeenNonce) lastSeenNonce = nonce;

                    const ivBytes = toEventBytes(data.iv);
                    const cipherBytes = toEventBytes(data.ciphertext);
                    const tagBytes = toEventBytes(data.tag);
                    if (ivBytes.length < 12 || cipherBytes.length === 0 || tagBytes.length !== 16) {
                        if (CFG.LOG_VERBOSE)
                            logger.warn(
                                `Listener: Nachricht nonce=${nonce} hat ungültige Längen (iv=${ivBytes.length} cipher=${cipherBytes.length} tag=${tagBytes.length}).`
                            );
                        continue;
                    }
                    const decrypted = await tryDecryptListenerPeerMessage(
                        myAddress,
                        myPrivKey,
                        peer,
                        ivBytes,
                        cipherBytes,
                        tagBytes
                    );
                    if (!decrypted) {
                        if (lastDecryptWarnNonce.get(sender) !== nonce) {
                            lastDecryptWarnNonce.set(sender, nonce);
                            logger.warn(
                                'Empfangene Nachricht konnte nicht entschlüsselt werden (evtl. Partner neu gestartet / Handshake geändert).'
                            );
                        }
                        continue;
                    }
                    const ts = new Date().toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    });
                    console.log(
                        `\n\x1b[90m[${ts}]\x1b[0m \x1b[33m<< ${String(data.sender).slice(0, 10)}…\x1b[0m ${decrypted}\n> `
                    );
                }
            }
        } catch (e: unknown) {
            logger.warn(
                formatNetworkFetchError(e, {
                    context: 'Listener-Loop Fehler',
                    target: `RPC ${formatRpcUrlForLog(CFG.RPC_URL)}`,
                })
            );
        }
        await new Promise((r) => setTimeout(r, CFG.LISTENER_POLL_MS));
    }
}
