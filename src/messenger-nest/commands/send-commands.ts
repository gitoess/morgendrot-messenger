/**
 * Slice B: Senden / Mesh / .morg-pkg (/send, /send-plain, …).
 */
import { logger } from '../../logger.js';
import { CFG, ROLE_BITS, hasRoleBit } from '../../config.js';
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
    sendPlaintextOnly,
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

const SEND_COMMANDS = new Set([
    '/send-plain',
    '/send',
    '/sos-gateway-ack',
    '/mesh-build-v2',
    '/mesh-decrypt-v2',
    '/morg-pkg-export',
    '/morg-pkg-import',
    '/boss-command',
]);

function hierarchyCanSend(): boolean {
    const isHierarchyRole = ['boss', 'kommandant', 'arbeiter'].includes(CFG.ROLE);
    return !isHierarchyRole || hasRoleBit(ROLE_BITS.S);
}

export async function tryHandleSendCommand(ctx: MessengerCommandContext): Promise<CommandHandlerResult | null> {
    const c = ctx.cmd;
    if (!SEND_COMMANDS.has(c)) return null;

    const { args: a, opts, myAddress: MY_ADDR, keys, sessionState } = ctx;
    const canSend = hierarchyCanSend();

    if (c === '/send-plain') {
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
            for (const addr of addrs) await sendPlaintextOnly(addr, text, { forceLegacyPlaintext });
            return {
                ok: true,
                message:
                    addrs.length > 1
                        ? `Klartext an ${addrs.length} Empfänger gesendet.`
                        : `Klartext an ${addrs[0].slice(0, 12)}… gesendet.`,
            };
        });
    }

    if (c === '/send') {
        if (!canSend) {
            return {
                ok: false,
                message: 'S-Bit (Send) nicht gesetzt – Senden verweigert (ROLE_ID=' + CFG.ROLE_ID + '). Bei Hierarchie ROLE_ID z. B. 14 setzen.',
            };
        }
        const pm = sessionState.peerMap;
        if (!pm?.size) return { ok: false, message: 'Nicht verbunden. Zuerst /connect ausführen.' };
        const text = a && a.length > 0 ? a.join(' ').trim() : '';
        if (!text) return { ok: false, message: 'Verwendung: /send <Text> (Nachricht eingeben).' };
        if (new TextEncoder().encode(text).length > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
            return {
                ok: false,
                message:
                    `Nachricht zu lang für Mailbox/Move (max. ~${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES} Byte UTF-8; reines Arg-Limit ${MOVE_MAX_PURE_VECTOR_U8_BYTES}). Bild: „Bild anhängen“ erneut (Server komprimiert für Chain) oder kürzerer Text.`,
            };
        }
        const forceLegacyEncrypted = resolveCommandForceLegacyEncrypted(opts);
        const { runWithMailboxObjectIdOverride } = await import('../../mailbox-object-id-scope.js');
        return runWithMailboxObjectIdOverride(String(opts?.mailboxObjectId ?? ''), async () => {
            for (const p of pm.values()) {
                await sendEncryptedMessage(p.address, text, p.pubKeyRaw, keys!.privateKey, {
                    forceLegacyEncrypted,
                });
            }
            return {
                ok: true,
                message: pm.size > 1 ? `An ${pm.size} Partner gesendet.` : 'Verschlüsselte Nachricht gesendet.',
            };
        });
    }

    if (c === '/sos-gateway-ack') {
        if (!canSend) return { ok: false, message: 'S-Bit (Send) nicht gesetzt – SOS-Gateway-Ack verweigert.' };
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
        if (!canSend) {
            return {
                ok: false,
                message: 'S-Bit (Send) nicht gesetzt – Mesh-Build verweigert (ROLE_ID=' + CFG.ROLE_ID + ').',
            };
        }
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
        if (!canSend) {
            return {
                ok: false,
                message: 'S-Bit (Send) nicht gesetzt – .morg-pkg-Export verweigert (ROLE_ID=' + CFG.ROLE_ID + ').',
            };
        }
        const pmEx = sessionState.peerMap;
        if (!pmEx?.size) return { ok: false, message: 'Nicht verbunden. Zuerst /connect ausführen.' };
        const addrRaw = (a[0] ?? '').trim();
        const textEx = a.length > 1 ? a.slice(1).join(' ').trim() : '';
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
        if (!canSend) {
            return {
                ok: false,
                message: 'S-Bit (Send) nicht gesetzt – Senden verweigert (ROLE_ID=' + CFG.ROLE_ID + ').',
            };
        }
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
