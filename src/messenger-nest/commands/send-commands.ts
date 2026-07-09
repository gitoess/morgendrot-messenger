/**
 * Slice B: Senden / Mesh / .morg-pkg (/send, /send-plain, …).
 */
import { logger } from '../../logger.js';
import { normalizeAddress } from '../../utils.js';
import {
    MESSAGING_MAX_PLAINTEXT_UTF8_BYTES,
    MOVE_MAX_PURE_VECTOR_U8_BYTES,
    storePlaintextMessageBatch,
} from '../../chain-access.js';
import { assertMessengerMediaNetBlobWithinLimit } from '../../messenger-media-limits.js';
import { getWalletPassword } from '../messenger-session-password.js';
import {
    sendEncryptedMessage,
    sendEncryptedWireOnly,
    sendPlaintextOnly,
    sendTeamPlaintextBroadcastOnly,
    sendTeamEncryptedBroadcastOnly,
    buildMeshPeerInnerBlob,
    packMeshEmergencyV2Wire,
    decryptMeshEmergencyV2Wire,
} from '../messenger-chain-wrap.js';
import { buildMorgPkgV1, decryptMorgPkgV1, isMorgPkgV1Shape } from '../morg-pkg-wire.js';
import { splitMeshPlaintextForV2 } from '../../mesh-v2-fragment.js';
import { base64ToUint8, uint8ToBase64 } from '../../shared/bytes-base64.js';
import {
    messengerGasPolicyOpts,
    resolveCommandForceLegacyEncrypted,
    resolveCommandForceLegacyPlaintext,
} from '../command-handler-shared.js';
import type { CommandHandlerResult, MessengerCommandContext } from './command-types.js';
import { denyMessengerReadCommand, denyMessengerSendCommand } from '../../messenger-capability-gates.js';

const SEND_COMMANDS = new Set([
    '/send-plain',
    '/send-team-broadcast',
    '/send-team-broadcast-encrypted',
    '/send',
    '/send-encrypted',
    '/sos-gateway-ack',
    '/mesh-build-v2',
    '/mesh-decrypt-v2',
    '/morg-pkg-export',
    '/morg-pkg-import',
    '/boss-command',
]);

export async function tryHandleSendCommand(ctx: MessengerCommandContext): Promise<CommandHandlerResult | null> {
    const c = ctx.cmd;
    if (!SEND_COMMANDS.has(c)) return null;

    const { args: a, opts, myAddress: MY_ADDR, keys, sessionState } = ctx;

    if (c === '/send-plain') {
        const capDenied = denyMessengerSendCommand(c);
        if (capDenied) return capDenied;
        const addrsRaw = String(a[0] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const addrs = addrsRaw.filter((addr) => /^0x[a-fA-F0-9]{64}$/.test(addr));
        const text = a.slice(1).join(' ').trim() || '(leer)';
        if (new TextEncoder().encode(text).length > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
            return {
                ok: false,
                message:
                    `Nachricht zu lang für die Chain (max. ~${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES} Byte UTF-8 pro Sendung, Move-Limit ${MOVE_MAX_PURE_VECTOR_U8_BYTES}). Kürzerer Text oder kleineres Bild neu kodieren.`,
            };
        }
        if (addrs.length === 0) {
            return {
                ok: false,
                message:
                    'Klartext: Empfängeradresse (0x + 64 Hex) angeben. Kein Handshake nötig – beliebige oder unbekannte Adresse möglich. Beispiel: /send-plain 0x… dein Text',
            };
        }
        const { runWithMailboxObjectIdOverride } = await import('../../mailbox-object-id-scope.js');
        const forceLegacyPlaintext = resolveCommandForceLegacyPlaintext(opts);
        return runWithMailboxObjectIdOverride(String(opts?.mailboxObjectId ?? ''), async () => {
            const { parseMailboxOutNonceMarker } = await import('@morgendrot/core/queue/offline-mailbox');
            let lastDigest: string | undefined;
            let lastNonce: string | undefined;
            for (const addr of addrs) {
                const result = await sendPlaintextOnly(addr, text, { forceLegacyPlaintext });
                if (result?.digest) lastDigest = result.digest;
            }
            const parsed = parseMailboxOutNonceMarker(text);
            if (parsed) lastNonce = parsed.nonce.toString();
            return {
                ok: true,
                message:
                    addrs.length > 1
                        ? `Klartext an ${addrs.length} Empfänger gesendet.`
                        : `Klartext an ${addrs[0].slice(0, 12)}… gesendet.`,
                digest: lastDigest,
                txDigest: lastDigest,
                nonce: lastNonce,
            };
        });
    }

    if (c === '/send-team-broadcast') {
        const capDenied = denyMessengerSendCommand(c);
        if (capDenied) return capDenied;
        const teamMb = String(opts?.mailboxObjectId ?? '').trim();
        if (!/^0x[a-fA-F0-9]{64}$/.test(teamMb)) {
            return {
                ok: false,
                message:
                    'Team-Broadcast: gültige Team-Mailbox-Object-ID (mailboxObjectId, 0x + 64 Hex) angeben — Gruppe im UI verknüpfen oder /create-team-mailbox.',
            };
        }
        const text = a.join(' ').trim() || '(leer)';
        if (new TextEncoder().encode(text).length > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
            return {
                ok: false,
                message: `Nachricht zu lang für Team-Broadcast (max. ~${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES} Byte UTF-8).`,
            };
        }
        const { parseMailboxOutNonceMarker } = await import('@morgendrot/core/queue/offline-mailbox');
        const result = await sendTeamPlaintextBroadcastOnly(teamMb, text);
        const parsed = parseMailboxOutNonceMarker(text);
        const lastDigest = result?.digest;
        return {
            ok: true,
            message: `Team-Broadcast in ${teamMb.slice(0, 12)}… gespeichert (1× TX).`,
            digest: lastDigest,
            txDigest: lastDigest,
            nonce: parsed ? parsed.nonce.toString() : undefined,
        };
    }

    if (c === '/send-team-broadcast-encrypted') {
        const capDenied = denyMessengerSendCommand(c);
        if (capDenied) return capDenied;
        const teamMb = String(opts?.mailboxObjectId ?? '').trim();
        if (!/^0x[a-fA-F0-9]{64}$/.test(teamMb)) {
            return {
                ok: false,
                message:
                    'Team-Broadcast verschlüsselt: gültige Team-Mailbox-Object-ID (mailboxObjectId, 0x + 64 Hex) angeben.',
            };
        }
        const wire = a.join(' ').trim();
        if (!wire) {
            return { ok: false, message: 'Team-Broadcast verschlüsselt: Wire-JSON fehlt.' };
        }
        const result = await sendTeamEncryptedBroadcastOnly(teamMb, wire);
        const lastDigest = result?.digest;
        let nonceOut: string | undefined;
        try {
            const parsed = JSON.parse(wire) as { nonce?: string };
            if (parsed.nonce?.trim()) nonceOut = parsed.nonce.trim();
        } catch {
            /* ignore */
        }
        return {
            ok: true,
            message: `Verschlüsselter Team-Broadcast in ${teamMb.slice(0, 12)}… gespeichert (1× TX).`,
            digest: lastDigest,
            txDigest: lastDigest,
            nonce: nonceOut,
        };
    }

    if (c === '/send') {
        const capDenied = denyMessengerSendCommand(c);
        if (capDenied) return capDenied;
        const pm = sessionState.peerMap;
        if (!pm?.size) return { ok: false, message: 'Nicht verbunden. Zuerst /connect ausführen.' };
        const { resolveSendRecipientAndText } = await import('./send-command-args.js');
        const peerAddrs = [...pm.values()].map((p) => p.address);
        const resolved = resolveSendRecipientAndText(a ?? [], peerAddrs);
        if (!resolved.ok) return { ok: false, message: resolved.message };
        const { recipient: sendRecipient, text } = resolved;
        if (new TextEncoder().encode(text).length > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
            return {
                ok: false,
                message:
                    `Nachricht zu lang für Mailbox/Move (max. ~${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES} Byte UTF-8; reines Arg-Limit ${MOVE_MAX_PURE_VECTOR_U8_BYTES}). Bild: „Bild anhängen“ erneut (Server komprimiert für Chain) oder kürzerer Text.`,
            };
        }
        const normRecipient = normalizeAddress(sendRecipient);
        const peer =
            pm.get(sendRecipient) ??
            pm.get(normRecipient) ??
            [...pm.values()].find((p) => normalizeAddress(p.address) === normRecipient);
        if (!peer) {
            return {
                ok: false,
                message:
                    'Empfänger nicht in peerMap — zuerst Handshake/Connect für genau diese 0x-Adresse.',
            };
        }
        const forceLegacyEncrypted = resolveCommandForceLegacyEncrypted(opts);
        const { runWithMailboxObjectIdOverride } = await import('../../mailbox-object-id-scope.js');
        return runWithMailboxObjectIdOverride(String(opts?.mailboxObjectId ?? ''), async () => {
            const { parseMailboxOutNonceMarker } = await import('@morgendrot/core/queue/offline-mailbox');
            const result = await sendEncryptedMessage(peer.address, text, peer.pubKeyRaw, keys!.privateKey, {
                forceLegacyEncrypted,
            });
            const parsed = parseMailboxOutNonceMarker(text);
            const lastNonce = parsed ? parsed.nonce.toString() : undefined;
            return {
                ok: true,
                message: `Verschlüsselte Nachricht an ${peer.address.slice(0, 12)}… gesendet.`,
                digest: result?.digest,
                txDigest: result?.digest,
                nonce: lastNonce,
            };
        });
    }

    if (c === '/send-encrypted') {
        const capDenied = denyMessengerSendCommand(c);
        if (capDenied) return capDenied;
        const recipientRaw = String(a[0] ?? '').trim();
        if (!/^0x[a-fA-F0-9]{64}$/.test(recipientRaw)) {
            return {
                ok: false,
                message: 'Verwendung: /send-encrypted <0xEmpfänger> <verschlüsseltes-JSON-Wire>',
            };
        }
        const wireJson = (a ?? []).slice(1).join(' ').trim();
        if (!wireJson) {
            return { ok: false, message: 'Verschlüsseltes Wire (JSON) fehlt.' };
        }
        let wire: {
            v?: number;
            ciphertextB64?: string;
            ivB64?: string;
            tagB64?: string;
            nonce?: string;
        };
        try {
            wire = JSON.parse(wireJson) as typeof wire;
        } catch {
            return { ok: false, message: 'Verschlüsseltes Wire ist kein gültiges JSON.' };
        }
        if (wire.v !== 1 || !wire.ciphertextB64 || !wire.ivB64 || !wire.tagB64 || !wire.nonce) {
            return { ok: false, message: 'Verschlüsseltes Wire: v=1, ciphertextB64, ivB64, tagB64, nonce erforderlich.' };
        }
        let nonce: bigint;
        try {
            nonce = BigInt(String(wire.nonce));
        } catch {
            return { ok: false, message: 'Verschlüsseltes Wire: nonce ungültig.' };
        }
        const forceLegacyEncrypted = resolveCommandForceLegacyEncrypted(opts);
        const { runWithMailboxObjectIdOverride } = await import('../../mailbox-object-id-scope.js');
        return runWithMailboxObjectIdOverride(String(opts?.mailboxObjectId ?? ''), async () => {
            const result = await sendEncryptedWireOnly(
                recipientRaw,
                base64ToUint8(wire.ciphertextB64!),
                base64ToUint8(wire.ivB64!),
                base64ToUint8(wire.tagB64!),
                nonce,
                { forceLegacyEncrypted }
            );
            return {
                ok: true,
                message: `Verschlüsseltes Wire an ${recipientRaw.slice(0, 12)}… gesendet.`,
                digest: result?.digest,
                txDigest: result?.digest,
                nonce: nonce.toString(),
            };
        });
    }

    if (c === '/sos-gateway-ack') {
        const pmAck = sessionState.peerMap;
        if (!pmAck?.size) return { ok: false, message: 'Nicht verbunden. Zuerst /connect ausführen.' };
        const digest = String(a[0] ?? '')
            .trim()
            .toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(digest)) {
            return {
                ok: false,
                message: 'Verwendung: /sos-gateway-ack <sha256-hex-64> (Digest der SOS-Nutzlast UTF-8).',
            };
        }
        logger.warn(`morg.sos.gateway_ack digest=${digest} peers=${pmAck.size}`);
        return { ok: true, message: 'SOS-Gateway-Ack protokolliert (keine Mailbox-Transaktion).' };
    }

    if (c === '/mesh-build-v2') {
        const capDenied = denyMessengerSendCommand(c);
        if (capDenied) return capDenied;
        const pmMesh = sessionState.peerMap;
        if (!pmMesh?.size) return { ok: false, message: 'Nicht verbunden. Zuerst /connect ausführen.' };
        const textMesh = a && a.length > 0 ? a.join(' ').trim() : '';
        if (!textMesh) return { ok: false, message: 'Verwendung: /mesh-build-v2 <Text>' };
        if (new TextEncoder().encode(textMesh).length > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
            return {
                ok: false,
                message: `Mesh-Nutzlast zu lang (max. ~${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES} Byte UTF-8).`,
            };
        }
        try {
            assertMessengerMediaNetBlobWithinLimit(textMesh);
        } catch (e) {
            return { ok: false, message: (e as Error).message };
        }
        const myMesh = (MY_ADDR || '').trim().toLowerCase();
        if (!/^0x[a-f0-9]{64}$/.test(myMesh)) return { ok: false, message: 'MY_ADDRESS ungültig oder fehlt.' };
        const frags = splitMeshPlaintextForV2(textMesh);
        const wires: { recipient: string; wireBase64: string; meshNonce: number }[] = [];
        for (const p of pmMesh.values()) {
            for (const fragPlain of frags) {
                const meshNonce = Math.floor(Math.random() * 0x100000000) >>> 0;
                const inner = await buildMeshPeerInnerBlob(fragPlain, p.pubKeyRaw, keys!.privateKey);
                const built = await packMeshEmergencyV2Wire(myMesh, meshNonce, inner);
                if (!built.ok) return { ok: false, message: built.error };
                wires.push({
                    recipient: p.address,
                    wireBase64: uint8ToBase64(built.wire),
                    meshNonce,
                });
            }
        }
        return {
            ok: true,
            message: `Mesh-v2 bereit (${wires.length} Paket/e, PRIVATE_APP${frags.length > 1 ? `, ${frags.length} Textfragment/e` : ''}).`,
            wires,
        };
    }

    if (c === '/mesh-decrypt-v2') {
        const capDenied = denyMessengerReadCommand(c);
        if (capDenied) return capDenied;
        const senderMesh = (a[0] ?? '').trim();
        const b64 = (a[1] ?? '').trim();
        if (!senderMesh || !b64) {
            return { ok: false, message: 'Verwendung: /mesh-decrypt-v2 <0xAbsender> <wireBase64>' };
        }
        const pmDec = sessionState.peerMap;
        if (!pmDec?.size) return { ok: false, message: 'Nicht verbunden (Peer-Keys nötig).' };
        const normS = normalizeAddress(senderMesh);
        const peerDec =
            [...pmDec.values()].find((p) => normalizeAddress(p.address) === normS) ??
            pmDec.get(senderMesh) ??
            pmDec.get(normS);
        if (!peerDec) {
            return { ok: false, message: 'Absender nicht in peerMap – Handshake/Connect prüfen.' };
        }
        const raw = base64ToUint8(b64);
        const plain = await decryptMeshEmergencyV2Wire(raw, peerDec.pubKeyRaw, keys!.privateKey);
        if (!plain) return { ok: false, message: 'Mesh-v2 Entschlüsselung fehlgeschlagen.' };
        return { ok: true, message: plain, text: plain };
    }

    if (c === '/morg-pkg-export') {
        const capDenied = denyMessengerSendCommand(c);
        if (capDenied) return capDenied;
        const pmEx = sessionState.peerMap;
        if (!pmEx?.size) return { ok: false, message: 'Nicht verbunden. Zuerst /connect ausführen.' };
        const addrRaw = (a[0] ?? '').trim();
        const textEx =
            (typeof opts?.commandPlaintext === 'string' ? opts.commandPlaintext.trim() : '') ||
            (a.length > 1 ? a.slice(1).join(' ').trim() : '');
        if (!addrRaw || !textEx) {
            return { ok: false, message: 'Verwendung: /morg-pkg-export <0xEmpfänger> <Klartext…>' };
        }
        if (!/^0x[a-fA-F0-9]{64}$/i.test(addrRaw)) {
            return { ok: false, message: 'Empfänger: 0x + 64 Hex (Handshake-Partner).' };
        }
        const normR = normalizeAddress(addrRaw);
        const peerEx =
            [...pmEx.values()].find((p) => normalizeAddress(p.address) === normR) ??
            pmEx.get(addrRaw) ??
            pmEx.get(normR);
        if (!peerEx) {
            return {
                ok: false,
                message: 'Empfänger nicht in peerMap – nur für verbundene Partner nach Handshake.',
            };
        }
        try {
            const morgPkg = await buildMorgPkgV1({
                plaintext: textEx,
                sender: MY_ADDR,
                recipient: peerEx.address,
                recipientPubRaw: peerEx.pubKeyRaw,
                senderPrivKey: keys!.privateKey,
            });
            return {
                ok: true,
                message: 'ECDH-.morg-pkg erstellt (AES-GCM wie /send). Datei offline übergeben.',
                morgPkg,
            };
        } catch (e: unknown) {
            return { ok: false, message: String((e as Error)?.message ?? e) };
        }
    }

    if (c === '/morg-pkg-import') {
        const capDenied = denyMessengerReadCommand(c);
        if (capDenied) return capDenied;
        const rawPkg = opts?.morgPkg;
        if (rawPkg == null || typeof rawPkg !== 'object') {
            return {
                ok: false,
                message:
                    'API-Body: Feld „morgPkg“ mit dem vollständigen JSON-Paket mitschicken (siehe UI „.morg-pkg importieren“).',
            };
        }
        const pmIm = sessionState.peerMap;
        if (!pmIm?.size) return { ok: false, message: 'Nicht verbunden (Absender-ECDH-Key aus Handshake nötig).' };
        if (!isMorgPkgV1Shape(rawPkg)) {
            return {
                ok: false,
                message:
                    'morgPkg ungültig: schema morgendrot.morgpkg.v1, version 1, Felder sender/recipient/ivB64/ciphertextB64.',
            };
        }
        const normFrom = normalizeAddress(rawPkg.sender);
        const peerIm =
            [...pmIm.values()].find((p) => normalizeAddress(p.address) === normFrom) ??
            pmIm.get(rawPkg.sender) ??
            pmIm.get(normFrom);
        if (!peerIm) {
            return {
                ok: false,
                message:
                    'Absender (pkg.sender) nicht in peerMap – vor dem Öffnen mit dem Absender Handshake/Connect ausführen.',
            };
        }
        try {
            const plain = await decryptMorgPkgV1(rawPkg, {
                myAddress: MY_ADDR,
                myPrivKey: keys!.privateKey,
                senderPubRaw: peerIm.pubKeyRaw,
            });
            return { ok: true, message: 'Paket entschlüsselt.', plaintext: plain, text: plain };
        } catch (e: unknown) {
            return { ok: false, message: String((e as Error)?.message ?? e) };
        }
    }

    if (c === '/boss-command' && a[0] != null && a[1] != null) {
        const capDenied = denyMessengerSendCommand(c);
        if (capDenied) return capDenied;
        let targets: string[];
        try {
            targets = JSON.parse(String(a[0]));
        } catch {
            return { ok: false, message: 'Targets als JSON-Array (z. B. ["0x…"]).' };
        }
        const cmdText = String(a[1] ?? '').trim();
        if (!cmdText) return { ok: false, message: 'Befehlstext fehlt.' };
        const valid = (Array.isArray(targets) ? targets : []).filter(
            (t): t is string => typeof t === 'string' && /^0x[a-fA-F0-9]{64}$/.test(String(t).trim())
        );
        if (valid.length === 0) return { ok: false, message: 'Keine gültigen Zieladressen.' };
        if (valid.length === 1) {
            await sendPlaintextOnly(valid[0].trim(), cmdText);
        } else {
            const nonce = BigInt(Date.now());
            await storePlaintextMessageBatch(
                valid,
                MY_ADDR,
                new TextEncoder().encode(cmdText),
                nonce,
                getWalletPassword(),
                messengerGasPolicyOpts()
            );
        }
        return {
            ok: true,
            message: `Befehl an ${valid.length} Ziel(e) gesendet` + (valid.length > 1 ? ' (PTB: 1 TX für alle).' : '.'),
        };
    }

    return null;
}
