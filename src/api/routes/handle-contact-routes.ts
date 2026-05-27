/**
 * Kontakt-, Mesh- und Messenger-Chain-Query-Routen.
 */
import type http from 'node:http';
import { CFG } from '../../config.js';
import { parseAndValidateInitialProfile } from '../../initial-profile-provision.js';
import {
    findPeerHandshake,
    findPeerHandshakeFrom,
    listIncomingHandshakeOffers,
    listOutgoingHandshakeOffers,
    hasValidTicket,
    getOwnedTickets,
    getOwnedAccessKeys,
    getAllOwnedObjects,
    getMailboxRebateCandidates,
    getClient,
} from '../../chain-access.js';
import {
    saveContactLabel,
    saveContactMeshFields,
    loadContactDirectory,
    getContactByMeshNodeId,
    getContactByBleUuid,
    getContactLabel,
    applyInitialProfileToContacts,
    resolveContactStorageKey,
} from '../../contact-labels.js';
import type { ApiRouteContext, SendJsonFn } from './api-route-types.js';

export async function handleContactRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    ctx: ApiRouteContext
): Promise<boolean> {
    if (url === '/api/contact-labels' && req.method === 'GET') {
        try {
            const { loadContactLabels } = await import('../../contact-labels.js');
            sendJson(
                res,
                200,
                { ok: true, labels: loadContactLabels(), directory: loadContactDirectory() },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/contact-labels/apply-initial-profile' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const v = parseAndValidateInitialProfile(data);
                if (!v.ok) {
                    sendJson(res, 400, { ok: false, error: v.error }, cors);
                    return;
                }
                const { applied } = applyInitialProfileToContacts(v.profile);
                sendJson(
                    res,
                    200,
                    { ok: true, applied, message: applied + ' Kontakt(e) in die lokale Kontaktdatei übernommen.' },
                    cors
                );
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
        });
        return true;
    }

    if (url === '/api/mesh-contact-lookup' && req.method === 'GET') {
        try {
            const q = new URL(req.url || '', 'http://x');
            const nodeId = String(q.searchParams.get('nodeId') ?? '').trim();
            if (!nodeId) {
                sendJson(res, 400, { ok: false, error: 'nodeId fehlt' }, cors);
                return true;
            }
            const hit = getContactByMeshNodeId(nodeId);
            sendJson(
                res,
                200,
                {
                    ok: true,
                    verified: !!hit,
                    ...(hit && { address: hit.address, entry: hit.entry }),
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/mesh-contact-lookup-ble' && req.method === 'GET') {
        try {
            const q = new URL(req.url || '', 'http://x');
            const uuid = String(q.searchParams.get('uuid') ?? '').trim();
            if (!uuid) {
                sendJson(res, 400, { ok: false, error: 'uuid fehlt' }, cors);
                return true;
            }
            const hit = getContactByBleUuid(uuid);
            sendJson(
                res,
                200,
                {
                    ok: true,
                    verified: !!hit,
                    ...(hit && { address: hit.address, entry: hit.entry }),
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/contact-mesh-export-encrypted' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body || '{}');
                const password = String(data.password ?? '');
                if (password.length < 8) {
                    sendJson(res, 400, { ok: false, error: 'Passwort mindestens 8 Zeichen.' }, cors);
                    return;
                }
                const { exportEncryptedContactMesh } = await import('../../contact-mesh-sync.js');
                const bundle = exportEncryptedContactMesh(password);
                sendJson(res, 200, { ok: true, bundle }, cors);
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
        });
        return true;
    }

    if (url === '/api/contact-mesh-import-encrypted' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body || '{}');
                const password = String(data.password ?? '');
                const bundle = data.bundle;
                if (password.length < 8) {
                    sendJson(res, 400, { ok: false, error: 'Passwort mindestens 8 Zeichen.' }, cors);
                    return;
                }
                if (!bundle || typeof bundle !== 'object') {
                    sendJson(res, 400, { ok: false, error: 'bundle fehlt' }, cors);
                    return;
                }
                const { importEncryptedContactMesh } = await import('../../contact-mesh-sync.js');
                const { merged } = importEncryptedContactMesh(password, bundle);
                sendJson(res, 200, { ok: true, merged, message: `${merged} Kontakt(e) zusammengeführt.` }, cors);
            } catch (e: unknown) {
                sendJson(res, 400, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
        });
        return true;
    }

    if (url === '/api/contact-label' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const addressRaw = String(data.address ?? '').trim();
                const telegramRaw =
                    data.telegramChatId !== undefined ? String(data.telegramChatId) : undefined;
                const address = resolveContactStorageKey(addressRaw, telegramRaw);
                if (!address) {
                    sendJson(
                        res,
                        400,
                        {
                            ok: false,
                            error: 'IOTA-Adresse (0x + 64 Hex) oder gültige Telegram Chat-ID erforderlich.',
                        },
                        cors
                    );
                    return;
                }
                const hasExplicitLabel = Object.prototype.hasOwnProperty.call(data, 'label');
                const label = hasExplicitLabel
                    ? String(data.label ?? '').trim().slice(0, 64) || 'Partner'
                    : getContactLabel(address) || 'Partner';
                saveContactLabel(address, label);
                if (data.clearMesh === true) {
                    saveContactMeshFields(address, {
                        meshNodeId: null,
                        meshPublicKeyHex: null,
                        bleUuid: null,
                        mailboxObjectId: null,
                        mailboxSharedId: null,
                        mailboxPrivateId: null,
                        mailboxTeamId: null,
                        mailboxBufferId: null,
                        telegramChatId: null,
                    });
                } else if (
                    data.meshNodeId !== undefined ||
                    data.meshPublicKeyHex !== undefined ||
                    data.bleUuid !== undefined ||
                    data.mailboxObjectId !== undefined ||
                    data.mailboxSharedId !== undefined ||
                    data.mailboxPrivateId !== undefined ||
                    data.mailboxTeamId !== undefined ||
                    data.mailboxBufferId !== undefined ||
                    data.telegramChatId !== undefined
                ) {
                    saveContactMeshFields(address, {
                        ...(data.meshNodeId !== undefined && { meshNodeId: String(data.meshNodeId) }),
                        ...(data.meshPublicKeyHex !== undefined && {
                            meshPublicKeyHex: String(data.meshPublicKeyHex),
                        }),
                        ...(data.bleUuid !== undefined && { bleUuid: String(data.bleUuid) }),
                        ...(data.mailboxObjectId !== undefined && {
                            mailboxObjectId: String(data.mailboxObjectId),
                        }),
                        ...(data.mailboxSharedId !== undefined && {
                            mailboxSharedId: String(data.mailboxSharedId),
                        }),
                        ...(data.mailboxPrivateId !== undefined && {
                            mailboxPrivateId: String(data.mailboxPrivateId),
                        }),
                        ...(data.mailboxTeamId !== undefined && {
                            mailboxTeamId: String(data.mailboxTeamId),
                        }),
                        ...(data.mailboxBufferId !== undefined && {
                            mailboxBufferId: String(data.mailboxBufferId),
                        }),
                        ...(data.telegramChatId !== undefined && {
                            telegramChatId: String(data.telegramChatId),
                        }),
                    });
                }
                sendJson(res, 200, { ok: true, message: 'Kontakt gespeichert.' }, cors);
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
        });
        return true;
    }

    if (url.startsWith('/api/find-peer-handshake') && req.method === 'GET') {
        try {
            const myAddr = CFG.MY_ADDRESS;
            if (!myAddr) {
                sendJson(res, 400, { ok: false, error: 'MY_ADDRESS nicht gesetzt' }, cors);
                return true;
            }
            const u = new URL(req.url || '', 'http://localhost');
            const peer = String(u.searchParams.get('peer') || '').trim();
            const result = /^0x[a-fA-F0-9]{64}$/.test(peer)
                ? await findPeerHandshakeFrom(myAddr, peer)
                : await findPeerHandshake(myAddr);
            if (!result) {
                sendJson(res, 200, { ok: true, found: false, message: 'Kein Handshake gefunden' }, cors);
                return true;
            }
            sendJson(
                res,
                200,
                {
                    ok: true,
                    found: true,
                    sender: result.sender,
                    nonce: String(result.nonce),
                    peerPubRawBase64: Buffer.from(result.pubKeyRaw).toString('base64'),
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/pending-handshakes' && req.method === 'GET') {
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const myAddr = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
            if (!myAddr || !/^0x[a-fA-F0-9]{64}$/i.test(myAddr)) {
                sendJson(res, 400, { ok: false, error: 'MY_ADDRESS nicht gesetzt oder ungültig' }, cors);
                return true;
            }
            const extraMailboxIds = (u.searchParams.get('mailboxIds') ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter((s) => /^0x[a-fA-F0-9]{64}$/i.test(s));
            const offers = await listIncomingHandshakeOffers(myAddr, {
                limit: 25,
                ...(extraMailboxIds.length ? { extraMailboxIds } : {}),
            });
            const outgoingOffers = await listOutgoingHandshakeOffers(myAddr, {
                limit: 25,
                ...(extraMailboxIds.length ? { extraMailboxIds } : {}),
            });
            sendJson(res, 200, { ok: true, offers, outgoingOffers }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url.startsWith('/api/has-valid-ticket') && req.method === 'GET') {
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
            const eventId = u.searchParams.get('eventId')?.trim();
            if (!owner || !eventId) {
                sendJson(res, 400, { ok: false, error: 'owner und eventId als Query-Parameter nötig' }, cors);
                return true;
            }
            const client = getClient();
            const valid = await hasValidTicket(client, CFG.PACKAGE_ID, owner, eventId);
            sendJson(res, 200, { ok: true, valid }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url.startsWith('/api/list-tickets') && req.method === 'GET') {
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
            if (!owner) {
                sendJson(res, 400, { ok: false, error: 'owner als Query-Parameter oder MY_ADDRESS nötig' }, cors);
                return true;
            }
            const client = getClient();
            const tickets = await getOwnedTickets(client, CFG.PACKAGE_ID, owner);
            sendJson(res, 200, { ok: true, tickets }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url.startsWith('/api/list-keys') && req.method === 'GET') {
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
            if (!owner) {
                sendJson(res, 400, { ok: false, error: 'owner als Query-Parameter oder MY_ADDRESS nötig' }, cors);
                return true;
            }
            const client = getClient();
            const keys = await getOwnedAccessKeys(client, CFG.PACKAGE_ID, owner);
            sendJson(res, 200, { ok: true, keys }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/owned-objects' && req.method === 'GET') {
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
            if (!owner || !/^0x[a-fA-F0-9]{64}$/.test(owner)) {
                sendJson(res, 400, { ok: false, error: 'owner als Query-Parameter (0x + 64 Hex) oder MY_ADDRESS nötig' }, cors);
                return true;
            }
            const client = getClient();
            const ourPackageId = CFG.PACKAGE_ID?.trim() || null;
            const objects = await getAllOwnedObjects(client, owner, ourPackageId);
            sendJson(res, 200, { ok: true, owner, objects }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/resolve-private-mailbox-owner' && req.method === 'GET') {
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const mailboxObjectId =
                u.searchParams.get('mailboxObjectId')?.trim() || u.searchParams.get('objectId')?.trim() || '';
            if (!/^0x[a-fA-F0-9]{64}$/i.test(mailboxObjectId)) {
                sendJson(res, 400, { ok: false, error: 'mailboxObjectId (0x + 64 Hex) fehlt' }, cors);
                return true;
            }
            const { getPrivateMailboxOwnerFromChain } = await import('../../chain-access.js');
            const r = await getPrivateMailboxOwnerFromChain(mailboxObjectId);
            sendJson(res, 200, { ok: true, ...r }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/private-mailbox-contents' && req.method === 'GET') {
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const mailboxObjectId = u.searchParams.get('mailboxObjectId')?.trim() || u.searchParams.get('objectId')?.trim() || '';
            const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
            if (!/^0x[a-fA-F0-9]{64}$/i.test(mailboxObjectId)) {
                sendJson(res, 400, { ok: false, error: 'mailboxObjectId (0x + 64 Hex) fehlt' }, cors);
                return true;
            }
            if (!owner || !/^0x[a-fA-F0-9]{64}$/i.test(owner)) {
                sendJson(res, 400, { ok: false, error: 'owner als Query oder MY_ADDRESS nötig' }, cors);
                return true;
            }
            const { getPrivateMailboxRebateCandidates } = await import('../../chain-access.js');
            const { handshakes, messages } = await getPrivateMailboxRebateCandidates(mailboxObjectId, owner);
            sendJson(
                res,
                200,
                {
                    ok: true,
                    mailboxObjectId,
                    owner,
                    handshakeCount: handshakes.length,
                    messageCount: messages.length,
                    handshakes,
                    messages,
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/rebate-candidates' && req.method === 'GET') {
        try {
            const u = new URL(req.url || '', 'http://localhost');
            const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
            const packageIdParam = u.searchParams.get('packageId')?.trim();
            const packageId =
                packageIdParam && /^0x[a-fA-F0-9]{64}$/.test(packageIdParam)
                    ? packageIdParam
                    : CFG.PACKAGE_ID?.trim() || '';
            if (!owner) {
                sendJson(res, 400, { ok: false, error: 'owner als Query-Parameter oder MY_ADDRESS nötig' }, cors);
                return true;
            }
            if (!/^0x[a-fA-F0-9]{64}$/.test(owner)) {
                sendJson(res, 400, { ok: false, error: 'owner muss 0x gefolgt von 64 Hex-Zeichen sein' }, cors);
                return true;
            }
            if (!packageId) {
                sendJson(
                    res,
                    400,
                    { ok: false, error: 'PACKAGE_ID fehlt. Im Feld „Package-ID“ eintragen oder zuerst /set-package-id setzen.' },
                    cors
                );
                return true;
            }
            const client = getClient();
            const timeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
                Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
            const [keys, tickets, mailbox] = await Promise.all([
                timeout(getOwnedAccessKeys(client, packageId, owner), 15000, []),
                timeout(getOwnedTickets(client, packageId, owner), 15000, []),
                CFG.MAILBOX_ID
                    ? timeout(getMailboxRebateCandidates(owner), 15000, { handshakes: [], messages: [] })
                    : Promise.resolve({ handshakes: [] as unknown[], messages: [] as unknown[] }),
            ]);
            sendJson(
                res,
                200,
                {
                    ok: true,
                    owner,
                    packageId,
                    keys,
                    tickets,
                    mailboxHandshakes: mailbox.handshakes,
                    mailboxMessages: mailbox.messages,
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/purge-after-lieferung' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const purges = Array.isArray(data.purges) ? data.purges : [];
                if (purges.length === 0) {
                    sendJson(res, 400, { ok: false, error: 'purges: [{ sender, recipient, nonce }] erforderlich' }, cors);
                    return;
                }
                const purgeHandler = ctx.getPurgeAfterLieferungHandler();
                if (!purgeHandler) {
                    sendJson(res, 503, { ok: false, error: 'Purge nur im Messenger-Modus mit Wallet verfügbar.' }, cors);
                    return;
                }
                purgeHandler(purges)
                    .then((result) => {
                        sendJson(res, 200, result, cors);
                    })
                    .catch((e: unknown) => {
                        sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                    });
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
        });
        return true;
    }

    return false;
}
