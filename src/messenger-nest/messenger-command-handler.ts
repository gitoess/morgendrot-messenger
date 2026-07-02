/**
 * Kammer „Befehl“: ein Dispatcher für /api/command und Terminal (kein zweiter Pfad).
 */
import { logger } from '../logger.js';
import {
    CFG,
    ROLE_BITS,
    hasRoleBit,
    getConnectAddresses,
    savePartnerToFile,
    savePackageIdToFile,
    setEnvKey,
    assignDeviceRoleInEnv,
    ensureStreamsAnchorIdInHistory,
} from '../config.js';
import { normalizeAddress } from '../utils.js';
import { HEARTBEAT_INTERVAL_PRESETS_MS, isAllowedHeartbeatIntervalMs } from '../shared/heartbeat-presets.js';
import {
    getClient,
    getVaultFromChain,
    getVaultFromChainDebug,
    listVaultRegistryDynamicFields,
    emergencyPurgeVaultPtb as chainEmergencyPurgeVaultPtb,
    purgeMultipleKeys as chainPurgeMultipleKeys,
    purgeMultipleTickets as chainPurgeMultipleTickets,
    transferAccessKey as chainTransferAccessKey,
    getOwnedAccessKeys,
    createTicket as chainCreateTicket,
    useTicket as chainUseTicket,
    enableEmergencyPurgeTicket as chainEnableEmergencyPurgeTicket,
    purgeTicket as chainPurgeTicket,
    transferTicket as chainTransferTicket,
    getOwnedTickets,
    createPhysicalAsset as chainCreatePhysicalAsset,
    attestPhysicalAsset as chainAttestPhysicalAsset,
    buildAssetAttestationMessage,
    signPersonalMessageWithSdkSigner,
    linkNfcToAsset as chainLinkNfcToAsset,
    transferPhysicalAsset as chainTransferPhysicalAsset,
    transferAssetAndKeyPtb as chainTransferAssetAndKeyPtb,
    purgePhysicalAsset as chainPurgePhysicalAsset,
    getOwnedPhysicalAssets,
    verifyAssetCreatorSignature,
    transferCoins as chainTransferCoins,
    iotaToMist,
    createTicketsBatchPtb as chainCreateTicketsBatchPtb,
    publishPackageCli,
    applyPublishResultToEnv,
    sendPairingOffer,
    queryRecentPairingOffers,
} from '../chain-access.js';
import {
    saveVaultLocal,
    loadVaultContent,
    vaultFileExists,
    exportEcdhKeyMaterialForBrowser,
    listVaultFiles,
    encryptVaultPayloadForChain,
    writeVaultPackageId,
    readVaultAnchorId,
    writeVaultAnchorId,
    loadVaultFromChainPayload,
    saveHandshakeCache,
    purgeInboxCache,
    sanitizeVaultNotes,
    vaultNotesToLegacyString,
    type PersonalSecretEntry,
    type VaultNoteEntry,
} from '../vault-local.js';
import { preFlightCheck } from './messenger-preflight.js';
import { HELP_START, HELP_CHAT } from './messenger-help.js';
import type { CommandApiOptions } from './command-api-options.js';
import {
    getWalletPassword,
    setWalletPassword,
    getSessionIotaMnemonic,
    clearSessionIotaMnemonic,
    clearWalletPassword,
} from './messenger-session-password.js';
import { applySdkSignerFromImport, countMnemonicWords } from './sdk-signer-import.js';
import {
    getStreamsBridgeUrlForFetch,
    getStreamsBridgeUrlsToTry,
    fetchWithTimeout,
} from './streams-bridge-client.js';
import {
    createVaultOnChain,
    createAccessKey,
    createAccessKeyAndSendPlain,
    createAccessKeysBatch,
    enableEmergencyPurgeKey,
    purgeKey,
    sendHandshake,
} from './messenger-chain-wrap.js';
import {
    runConnectLogic,
    runConnectAcceptFirstIncoming,
    watchHandshakeUpdates,
    tryRestoreHandshakeSessionFromVault,
} from './messenger-connect.js';
import { syncPeerSessionArchiveFromHandshakeMap } from './messenger-session-keys-state.js';
import { listenForMessages } from './messenger-listener.js';
import type { PeerState } from './peer-state.js';
import { encryptPairingPayload, decryptPairingPayload, generatePairingNonce } from '../pairing-crypto.js';
import { saveContactLabel } from '../contact-labels.js';
import { messengerGasPolicyOpts, assertPairingGateNftOwned } from './command-handler-shared.js';
import { tryHandleMailboxCommand } from './commands/mailbox-commands.js';
import { tryHandleMailboxLifecycleCommand } from './commands/mailbox-lifecycle-commands.js';
import { tryHandleSendCommand } from './commands/send-commands.js';
import type { MessengerCommandContext } from './commands/command-types.js';
import { runVaultOnchainPreflight } from '../vault-onchain-preflight.js';
import { syncVaultChainConfig } from '../vault-sync-chain-config.js';

export type MessengerCommandDeps = {
    getMyAddress: () => string;
    vaultStateRef: {
        current: {
            keys: { privateKey: CryptoKey; pubRaw: Uint8Array };
            notes: string;
            vaultNotes: VaultNoteEntry[];
            personalSecrets?: PersonalSecretEntry[];
        } | null;
    };
    sessionState: { peerMap: Map<string, PeerState> | null; connecting: boolean };
    useVault: boolean;
    vaultPath: string;
    setSessionStatus: (s: Record<string, unknown>) => void;
};

export function createMessengerCommandHandler(deps: MessengerCommandDeps) {
    const { vaultStateRef, sessionState, useVault, vaultPath, setSessionStatus } = deps;

    return async (cmd: string, a: string[], opts?: CommandApiOptions) => {
        const MY_ADDR = deps.getMyAddress();
                try {
                    let c = String(cmd ?? '').trim().toLowerCase();
                    if (c && !c.startsWith('/')) c = '/' + c;
                    if (c.length > 1) c = c.replace(/\/+$/, '');
                    if (c === '/purge-teambroadcast' || c === '/purge_team_broadcast') c = '/purge-team-broadcast';
                    if (c === '/vault-lock') {
                        vaultStateRef.current = null;
                        sessionState.peerMap = null;
                        sessionState.connecting = false;
                        clearSessionIotaMnemonic();
                        clearWalletPassword();
                        const vpLock = CFG.VAULT_FILE || '.morgendrot-vault';
                        purgeInboxCache(vpLock, { shred: true });
                        setSessionStatus({ connected: false, hasKeys: false, connectedAddresses: [] });
                        const { requestUiVaultUnlock } = await import('../api-server.js');
                        requestUiVaultUnlock();
                        return {
                            ok: true,
                            message:
                                'Tresor gesperrt: Keys + Wallet-Passwort aus RAM; lokaler Klartext-Inbox-Cache (.inbox.enc) geschreddert. Vault-Datei unverändert. ' +
                                (CFG.SIGNER === 'sdk'
                                    ? 'Beim Entsperren: Vault-Passwort — und bei erneutem SDK-Setup ggf. Seed/Mnemonic erneut eingeben (wurde aus dem RAM entfernt).'
                                    : 'Beim Entsperren: Vault-Passwort im Entsperr-Dialog eingeben.'),
                        };
                    }
                    if (c === '/cancel-connect') {
                        sessionState.connecting = false;
                        return {
                            ok: true,
                            message:
                                'Connect-/Warte-Flag zurückgesetzt. Nächster /connect oder /pairing-wait möglich. (Laufender Hintergrund-Connect kann noch kurz laufen – bei Problemen Prozess neu starten.)',
                        };
                    }
                    const keys = vaultStateRef.current?.keys ?? null;
                    const needKeys = !['/help', '/set-package-id', '/vault-save', '/vault-load', '/vault-load-from-chain', '/vault-delete-local', '/vault-show-signer-import', '/vault-show-ecdh-jwk', '/vault-ecdh-jwk', '/vault-debug-chain', '/vault-list-chain', '/vault-list', '/vault-lock', '/vault-onchain', '/vault-notes-get', '/vault-sync-chain-config', '/emergency-purge', '/list-keys', '/list-tickets', '/list-assets', '/inbox', '/fetch', '/generate-address', '/publish-package', '/check-chain', '/gas-station-topup', '/cancel-connect', '/shadow-sweep', '/rpc-rotate', '/resolve-iota-name', '/iota-name-lookup', '/clear-local-history', '/create-private-mailbox', '/create-team-mailbox', '/private-mailbox-contents'].includes(c);
                    if (needKeys && !keys) return { ok: false, message: 'Tresor gesperrt. Bitte /vault-load mit Passwort (oder Backend mit Vault neu starten).' };
                    const needPeer = ['/purge-handshake', '/purge-msg', '/purge-message', '/morg-pkg-export', '/morg-pkg-import'].includes(
                        c
                    );
                    const hex64Peer = /^0x[a-fA-F0-9]{64}$/;
                    const purgeMsgWithArgs =
                        (c === '/purge-msg' || c === '/purge-message') &&
                        a.length >= 3 &&
                        hex64Peer.test(String(a[0]).trim()) &&
                        hex64Peer.test(String(a[1]).trim());
                    const purgeTeamBroadcastWithArgs =
                        c === '/purge-team-broadcast' &&
                        a.length >= 3 &&
                        hex64Peer.test(String(a[0]).trim()) &&
                        hex64Peer.test(String(a[1]).trim());
                    const purgeHandshakeWithArgs = c === '/purge-handshake' && a.length >= 2 && hex64Peer.test(String(a[0]).trim()) && hex64Peer.test(String(a[1]).trim());
                    if (needPeer && !sessionState.peerMap?.size && !purgeMsgWithArgs && !purgeHandshakeWithArgs && !purgeTeamBroadcastWithArgs) {
                        return { ok: false, message: 'Befehl benötigt Chat-Verbindung. Zuerst /connect ausführen.' };
                    }
                    const vetoedCommands = ['/purge-key', '/purge-ticket', '/purge-asset', '/transfer-coins', '/use-ticket', '/transfer-key', '/transfer-asset', '/transfer-asset-key-package', '/create-key', '/create-keys', '/create-tickets', '/create-asset', '/link-nfc-asset'];
                    if (vetoedCommands.includes(c)) {
                        const veto = await preFlightCheck(c, a, { myAddress: MY_ADDR });
                        if (!veto.ok) return { ok: false, message: veto.reason ?? 'Veto.' };
                    }
                    const peerMap = sessionState.peerMap;
                    const cmdCtx: MessengerCommandContext = {
                        cmd: c,
                        args: a,
                        opts,
                        myAddress: MY_ADDR,
                        keys,
                        peerMap,
                        sessionState,
                    };
                    const lifecycleEarly = await tryHandleMailboxLifecycleCommand(cmdCtx);
                    if (lifecycleEarly) return lifecycleEarly;
                    const mailboxEarly = await tryHandleMailboxCommand(cmdCtx);
                    if (mailboxEarly) return mailboxEarly;
                    if (c === '/vault-save') {
                        const raw = [...a].map((x) => String(x ?? ''))
                        let includeIotaMnemonic = false
                        if (raw.length > 0) {
                            const tail = raw[raw.length - 1]!.trim()
                            if (
                                tail === 'includeIotaMnemonic' ||
                                tail === '1' ||
                                tail.toLowerCase() === 'true'
                            ) {
                                includeIotaMnemonic = true
                                raw.pop()
                            }
                        }
                        const savePath =
                            raw[2] != null && String(raw[2]).trim()
                                ? String(raw[2]).trim()
                                : (CFG.VAULT_FILE || '.morgendrot-vault');
                        const pw = getWalletPassword() || raw[0];
                        if (!pw) return { ok: false, message: 'Kein Passwort (eingeben oder Wallet entsperren).' };
                        if (!keys) return { ok: false, message: 'Tresor gesperrt. Zuerst /vault-load (oder von Chain laden).' };
                        const notesArg =
                            raw[1] !== undefined && raw[1] !== null ? String(raw[1]) : (vaultStateRef.current?.notes ?? '');
                        const vaultNotes =
                            vaultStateRef.current?.vaultNotes ??
                            sanitizeVaultNotes([], notesArg);
                        const notes = vaultNotesToLegacyString(vaultNotes);
                        const phrase = includeIotaMnemonic ? getSessionIotaMnemonic() : undefined;
                        if (includeIotaMnemonic && !phrase) {
                            return {
                                ok: false,
                                message:
                                    'Keine Mnemonic in der Sitzung (SIGNER=sdk: nach Entsperren mit Mnemonic erneut versuchen oder Häkchen erst nach erfolgreichem Unlock).',
                            };
                        }
                        const psecrets = vaultStateRef.current?.personalSecrets ?? [];
                        await saveVaultLocal(keys, pw, savePath, notes, phrase, psecrets, vaultNotes);
                        if (vaultStateRef.current) {
                            vaultStateRef.current = {
                                keys: vaultStateRef.current.keys,
                                notes,
                                vaultNotes,
                                personalSecrets: psecrets,
                            };
                        }
                        if (CFG.PACKAGE_ID) writeVaultPackageId(savePath, CFG.PACKAGE_ID);
                        if (CFG.STREAMS_ANCHOR_ID) await writeVaultAnchorId(savePath, CFG.STREAMS_ANCHOR_ID, pw);
                        const extra = includeIotaMnemonic ? ' IOTA-Mnemonic liegt verschlüsselt in der Datei (gleiches Vault-Passwort).' : '';
                        return {
                            ok: true,
                            message: 'Vault gespeichert.' + (CFG.STREAMS_ANCHOR_ID ? ' (inkl. Streams Anchor-ID, verschlüsselt)' : '') + extra,
                        };
                    }
                    if (c === '/vault-load') {
                        const loadPath = (a[1] != null && String(a[1]).trim()) ? String(a[1]).trim() : (CFG.VAULT_FILE || '.morgendrot-vault');
                        /** Explizites Arg zuerst (UI „Tresor-Passwort“), sonst Sitzung — sonst ignorieren zweiter Vault-Passwort beim Entsperren. */
                        const explicitPw = a[0] != null && String(a[0]).trim() ? String(a[0]).trim() : '';
                        const pw = explicitPw || getWalletPassword() || '';
                        if (!pw) return { ok: false, message: 'Kein Passwort.' };
                        if (!vaultFileExists(loadPath)) return { ok: false, message: 'Vault-Datei existiert nicht: ' + loadPath + ' – zuerst „Lokal sichern“.' };
                        try {
                            const content = await loadVaultContent(pw, loadPath);
                            vaultStateRef.current = {
                                keys: content.keys,
                                notes: content.notes,
                                vaultNotes: content.vaultNotes,
                                personalSecrets: content.personalSecrets ?? [],
                            };
                            if (CFG.SIGNER === 'sdk' && (content.iotaSdkSignerImport || '').trim()) {
                                applySdkSignerFromImport(content.iotaSdkSignerImport!);
                            }
                            const restoredAnchor = await readVaultAnchorId(loadPath, pw);
                            if (restoredAnchor && !CFG.STREAMS_ANCHOR_ID) {
                                (CFG as { STREAMS_ANCHOR_ID: string }).STREAMS_ANCHOR_ID = restoredAnchor;
                                process.env.STREAMS_ANCHOR_ID = restoredAnchor;
                                ensureStreamsAnchorIdInHistory(restoredAnchor);
                            }
                            const n = await tryRestoreHandshakeSessionFromVault(
                                loadPath,
                                pw,
                                MY_ADDR,
                                content.keys.privateKey,
                                sessionState,
                                setSessionStatus
                            );
                            setSessionStatus({ hasKeys: true });
                            const hsRestoreNote =
                                n > 0 ? ` Handshake-Cache: ${n} Partner (Status „verbunden“).` : '';
                            return {
                                ok: true,
                                message:
                                    'Vault geladen.' +
                                    (restoredAnchor ? ' Streams Anchor-ID wiederhergestellt.' : '') +
                                    hsRestoreNote,
                                notes: content.notes,
                                vaultNotes: content.vaultNotes,
                                personalSecrets: content.personalSecrets ?? [],
                            };
                        } catch (e) {
                            const msg = String((e as Error)?.message ?? e);
                            const decryptFail = /decrypt|decryption|ungültig|Payload|tag|password|passwort|invalid|failed/i.test(msg);
                            return { ok: false, message: decryptFail ? 'Entschlüsselung fehlgeschlagen – Passwort korrekt?' : ('Vault laden fehlgeschlagen: ' + msg) };
                        }
                    }
                    if (c === '/vault-show-signer-import') {
                        if (CFG.SIGNER !== 'sdk') {
                            return {
                                ok: false,
                                message:
                                    'Nur bei SIGNER=sdk. Bei SIGNER=cli liegt der Key im IOTA-CLI-Keystore — kein Mnemonic in der Morgendrot-Vault.',
                            };
                        }
                        const loadPath =
                            a[1] != null && String(a[1]).trim() ? String(a[1]).trim() : CFG.VAULT_FILE || '.morgendrot-vault';
                        const pw = String(a[0] ?? '').trim();
                        if (!pw) {
                            return {
                                ok: false,
                                message: 'Verwendung: /vault-show-signer-import <passwort> [pfad-zur-vault-datei]',
                            };
                        }
                        if (!vaultFileExists(loadPath)) {
                            return {
                                ok: false,
                                message:
                                    'Keine Vault-Datei: ' +
                                    loadPath +
                                    '. Zuerst im Tresor „Lokal sichern“ (mit „Signer-Import mit speichern“) oder /vault-load-from-chain.',
                            };
                        }
                        try {
                            const content = await loadVaultContent(pw, loadPath);
                            const imp = (content.iotaSdkSignerImport || '').trim();
                            if (!imp) {
                                return {
                                    ok: false,
                                    message:
                                        'Kein gespeicherter Signer-Import in dieser Vault. Beim Speichern „Signer-Import mit speichern“ aktivieren oder externes Backup nutzen.',
                                };
                            }
                            return {
                                ok: true,
                                message:
                                    'Signer-Import aus lokaler Vault gelesen. An einem sicheren Ort notieren; nicht weitergeben. Ohne Backup gehen Identität und ggf. gebundene Credits bei Geräteverlust verloren.',
                                signerImport: imp,
                            };
                        } catch (e) {
                            const msg = String((e as Error)?.message ?? e);
                            const decryptFail = /decrypt|decryption|ungültig|Payload|tag|password|passwort|invalid|failed/i.test(msg);
                            return {
                                ok: false,
                                message: decryptFail ? 'Entschlüsselung fehlgeschlagen – Passwort korrekt?' : 'Fehler: ' + msg,
                            };
                        }
                    }
                    if (c === '/vault-ecdh-jwk') {
                        if (!keys) {
                            return { ok: false, message: 'Tresor gesperrt. Zuerst entsperren (/vault-load oder UI-Unlock).' };
                        }
                        const exported = await exportEcdhKeyMaterialForBrowser(keys);
                        if (!exported.ok) return { ok: false, message: exported.message };
                        return {
                            ok: true,
                            message:
                                'Chat-ECDH aus entsperrter Sitzung — nur für Direkt-Versand im Browser; nicht weitergeben.',
                            ecdhPrivateJwk: exported.ecdhPrivateJwk,
                            ecdhPrivatePkcs8Base64: exported.ecdhPrivatePkcs8Base64,
                            ecdhPubRawBase64: exported.ecdhPubRawBase64,
                        };
                    }
                    if (c === '/vault-show-ecdh-jwk') {
                        const loadPath =
                            a[1] != null && String(a[1]).trim() ? String(a[1]).trim() : CFG.VAULT_FILE || '.morgendrot-vault';
                        const pw = String(a[0] ?? '').trim();
                        if (!pw) {
                            return {
                                ok: false,
                                message: 'Verwendung: /vault-show-ecdh-jwk <passwort> [pfad-zur-vault-datei]',
                            };
                        }
                        if (!vaultFileExists(loadPath)) {
                            return {
                                ok: false,
                                message:
                                    'Keine Vault-Datei: ' +
                                    loadPath +
                                    '. Zuerst im Tresor „Lokal sichern“ oder /vault-load-from-chain.',
                            };
                        }
                        try {
                            const content = await loadVaultContent(pw, loadPath);
                            const exported = await exportEcdhKeyMaterialForBrowser(content.keys);
                            if (!exported.ok) return { ok: false, message: exported.message };
                            return {
                                ok: true,
                                message:
                                    'Chat-ECDH aus lokaler Vault gelesen. Nur für Direkt-Versand im Browser; nicht weitergeben.',
                                ecdhPrivateJwk: exported.ecdhPrivateJwk,
                                ecdhPrivatePkcs8Base64: exported.ecdhPrivatePkcs8Base64,
                                ecdhPubRawBase64: exported.ecdhPubRawBase64,
                            };
                        } catch (e) {
                            const msg = String((e as Error)?.message ?? e);
                            const decryptFail = /decrypt|decryption|ungültig|Payload|tag|password|passwort|invalid|failed/i.test(msg);
                            return {
                                ok: false,
                                message: decryptFail ? 'Entschlüsselung fehlgeschlagen – Passwort korrekt?' : 'Fehler: ' + msg,
                            };
                        }
                    }
                    if (c === '/vault-notes-get') {
                        if (!keys) {
                            return { ok: true, unlocked: false, notes: [] as VaultNoteEntry[] };
                        }
                        const vaultNotes =
                            vaultStateRef.current?.vaultNotes ??
                            sanitizeVaultNotes([], vaultStateRef.current?.notes ?? '');
                        return { ok: true, unlocked: true, notes: vaultNotes };
                    }
                    if (c === '/vault-notes-set') {
                        if (!keys) return { ok: false, message: 'Tresor gesperrt.' };
                        const rawArgs = [...a].map((x) => String(x ?? ''));
                        const persistLocal =
                            rawArgs.includes('persistLocal') ||
                            rawArgs[rawArgs.length - 1] === '1' ||
                            rawArgs[rawArgs.length - 1]?.toLowerCase() === 'true';
                        const b64 = rawArgs.find((x) => x && x !== 'persistLocal' && x !== '1' && x.toLowerCase() !== 'true') ?? '';
                        let parsed: unknown = [];
                        if (b64.trim()) {
                            try {
                                parsed = JSON.parse(Buffer.from(b64.trim(), 'base64url').toString('utf8'));
                            } catch {
                                return { ok: false, message: 'Notizen-Payload ungültig (base64url/JSON).' };
                            }
                        }
                        const vaultNotes = sanitizeVaultNotes(parsed);
                        const notes = vaultNotesToLegacyString(vaultNotes);
                        const psecrets = vaultStateRef.current?.personalSecrets ?? [];
                        vaultStateRef.current = {
                            keys: vaultStateRef.current!.keys,
                            notes,
                            vaultNotes,
                            personalSecrets: psecrets,
                        };
                        if (persistLocal) {
                            const pw = getWalletPassword();
                            if (!pw) return { ok: false, message: 'Kein Wallet-Passwort — zuerst entsperren.' };
                            const savePath = CFG.VAULT_FILE || '.morgendrot-vault';
                            await saveVaultLocal(keys, pw, savePath, notes, undefined, psecrets, vaultNotes);
                            if (CFG.PACKAGE_ID) writeVaultPackageId(savePath, CFG.PACKAGE_ID);
                            if (CFG.STREAMS_ANCHOR_ID) await writeVaultAnchorId(savePath, CFG.STREAMS_ANCHOR_ID, pw);
                            return { ok: true, message: 'Notizen in Vault-Datei gespeichert.', notes: vaultNotes };
                        }
                        return { ok: true, message: 'Notizen im RAM aktualisiert.', notes: vaultNotes };
                    }
                    if (c === '/vault-sync-chain-config') {
                        const apply = !a.includes('dry-run') && a[a.length - 1] !== '0';
                        const sync = await syncVaultChainConfig(MY_ADDR, { apply });
                        const parts = [
                            sync.applied.length ? `Übernommen: ${sync.applied.join('; ')}` : 'Nichts automatisch übernommen.',
                            sync.skipped.length ? `Offen: ${sync.skipped.join('; ')}` : '',
                            sync.preflight.ok
                                ? `Chain-Check OK (${sync.preflight.network}).`
                                : sync.preflight.issues.join(' '),
                        ].filter(Boolean);
                        return {
                            ok: sync.preflight.ok || sync.applied.length > 0,
                            message: parts.join(' '),
                            applied: sync.applied,
                            skipped: sync.skipped,
                            preflight: sync.preflight,
                        };
                    }
                    if (c === '/vault-onchain') {
                        if (!keys) return { ok: false, message: 'Tresor gesperrt. Zuerst /vault-load.' };
                        if (!CFG.VAULT_REGISTRY_ID) return { ok: false, message: 'VAULT_REGISTRY_ID nicht gesetzt.' };
                        const pre = await runVaultOnchainPreflight(MY_ADDR);
                        if (!pre.ok) {
                            return {
                                ok: false,
                                message: pre.issues.join(' '),
                                preflight: pre,
                            };
                        }
                        const rawOn = [...a].map((x) => String(x ?? ''));
                        let includeMnOnChain = false;
                        if (rawOn.length > 0) {
                            const tailOn = rawOn[rawOn.length - 1]!.trim();
                            if (
                                tailOn === 'includeIotaMnemonic' ||
                                tailOn === '1' ||
                                tailOn.toLowerCase() === 'true'
                            ) {
                                includeMnOnChain = true;
                                rawOn.pop();
                            }
                        }
                        const pw = getWalletPassword() || rawOn[0];
                        if (!pw) return { ok: false, message: 'Kein Wallet-Passwort.' };
                        const notesArgOn =
                            rawOn[1] !== undefined && rawOn[1] !== null
                                ? String(rawOn[1])
                                : (vaultStateRef.current?.notes ?? '');
                        const vaultNotesOn =
                            vaultStateRef.current?.vaultNotes ??
                            sanitizeVaultNotes([], notesArgOn);
                        const notes = vaultNotesToLegacyString(vaultNotesOn);
                        const phraseOnChain = includeMnOnChain ? getSessionIotaMnemonic() : undefined;
                        if (includeMnOnChain && !phraseOnChain) {
                            return {
                                ok: false,
                                message: 'On-Chain: keine Mnemonic in der Sitzung – erst mit SIGNER=sdk entsperren oder Häkchen aus.',
                            };
                        }
                        const psecretsOn = vaultStateRef.current?.personalSecrets ?? [];
                        const enc = await encryptVaultPayloadForChain(
                            keys,
                            pw,
                            notes,
                            phraseOnChain,
                            psecretsOn,
                            vaultNotesOn
                        );
                        await createVaultOnChain(enc, CFG.DEFAULT_TTL_DAYS);
                        if (vaultStateRef.current) {
                            vaultStateRef.current = {
                                keys: vaultStateRef.current.keys,
                                notes,
                                vaultNotes: vaultNotesOn,
                                personalSecrets: psecretsOn,
                            };
                        }
                        const chainMsg = pre.vaultOnChain
                            ? 'On-Chain-Vault aktualisiert.'
                            : 'On-Chain-Vault erstellt.';
                        return {
                            ok: true,
                            message: chainMsg,
                            preflight: pre,
                        };
                    }
                    if (c === '/vault-change-password') {
                        const currentPw = String(a[0] ?? '').trim();
                        const newPw = String(a[1] ?? '').trim();
                        if (!currentPw || !newPw) {
                            return {
                                ok: false,
                                message: 'Verwendung: /vault-change-password <aktuelles-passwort> <neues-passwort>',
                            };
                        }
                        if (newPw.length < 8) {
                            return { ok: false, message: 'Neues Passwort: mindestens 8 Zeichen.' };
                        }
                        const path = (CFG.VAULT_FILE || '.morgendrot-vault').trim();
                        if (!vaultFileExists(path)) {
                            return {
                                ok: false,
                                message:
                                    'Keine Vault-Datei — zuerst entsperren und „Lokal sichern“, oder Passwort beim ersten Setup im Entsperr-Dialog setzen.',
                            };
                        }
                        if (!keys) {
                            return {
                                ok: false,
                                message: 'Tresor gesperrt — zuerst mit dem aktuellen Passwort entsperren.',
                            };
                        }
                        try {
                            const content = await loadVaultContent(currentPw, path);
                            const vaultNotes =
                                vaultStateRef.current?.vaultNotes ?? content.vaultNotes;
                            const notes = vaultNotesToLegacyString(vaultNotes);
                            const psecrets = vaultStateRef.current?.personalSecrets ?? content.personalSecrets ?? [];
                            const phrase = (content.iotaSdkSignerImport || '').trim() || undefined;
                            await saveVaultLocal(keys, newPw, path, notes, phrase, psecrets, vaultNotes);
                            if (vaultStateRef.current) {
                                vaultStateRef.current = {
                                    keys: vaultStateRef.current.keys,
                                    notes,
                                    vaultNotes,
                                    personalSecrets: psecrets,
                                };
                            }
                            if (CFG.PACKAGE_ID) writeVaultPackageId(path, CFG.PACKAGE_ID);
                            if (CFG.STREAMS_ANCHOR_ID) await writeVaultAnchorId(path, CFG.STREAMS_ANCHOR_ID, newPw);
                            setWalletPassword(newPw);
                            return {
                                ok: true,
                                message:
                                    'Vault-Datei mit neuem Passwort verschlüsselt. Die laufende Sitzung nutzt das neue Passwort.',
                            };
                        } catch (e) {
                            const msg = String((e as Error)?.message ?? e);
                            const decryptFail = /decrypt|decryption|ungültig|Payload|tag|password|passwort|invalid|failed/i.test(
                                msg
                            );
                            return {
                                ok: false,
                                message: decryptFail
                                    ? 'Aktuelles Passwort falsch oder Datei beschädigt.'
                                    : 'Passwort ändern fehlgeschlagen: ' + msg,
                            };
                        }
                    }
                    if (c === '/vault-list-chain') {
                        if (!CFG.VAULT_REGISTRY_ID) return { ok: false, message: 'VAULT_REGISTRY_ID nötig.' };
                        const names = await listVaultRegistryDynamicFields(getClient(), CFG.VAULT_REGISTRY_ID);
                        return { ok: true, message: names.length + ' Eintrag/Einträge.', names, registryId: CFG.VAULT_REGISTRY_ID };
                    }
                    if (c === '/vault-debug-chain') {
                        if (!CFG.VAULT_REGISTRY_ID || !CFG.PACKAGE_ID) return { ok: false, message: 'VAULT_REGISTRY_ID und PACKAGE_ID nötig.' };
                        const debug = await getVaultFromChainDebug(getClient(), CFG.VAULT_REGISTRY_ID, CFG.PACKAGE_ID, MY_ADDR);
                        const parts = [debug.found ? 'Vault-Eintrag gefunden.' : ('Nicht gefunden: ' + (debug.error || 'Struktur unbekannt'))];
                        if (debug.dataKeys?.length) parts.push('dataKeys: ' + debug.dataKeys.join(', '));
                        if (debug.valueKeys?.length) parts.push('valueKeys: ' + debug.valueKeys.join(', '));
                        if (debug.contentKeys?.length) parts.push('contentKeys: ' + debug.contentKeys.join(', '));
                        if (debug.keys?.length) parts.push('fields: ' + debug.keys.join(', '));
                        return { ok: true, message: parts.join(' | '), debug };
                    }
                    if (c === '/vault-list') {
                        const list = listVaultFiles(process.cwd());
                        const defaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
                        return { ok: true, message: list.length ? list.join('\n') : 'Keine Vault-Dateien (.morgendrot-vault*) im Arbeitsverzeichnis.', paths: list, defaultPath };
                    }
                    if (c === '/vault-load-from-chain') {
                        if (!CFG.VAULT_REGISTRY_ID || !CFG.PACKAGE_ID) return { ok: false, message: 'VAULT_REGISTRY_ID und PACKAGE_ID nötig.' };
                        const explicitPw = a[0] != null && String(a[0]).trim() ? String(a[0]).trim() : '';
                        const pw = explicitPw || getWalletPassword() || '';
                        if (!pw) return { ok: false, message: 'Kein Passwort.' };
                        try {
                            const enc = await getVaultFromChain(getClient(), CFG.VAULT_REGISTRY_ID, CFG.PACKAGE_ID, MY_ADDR);
                            if (!enc || enc.length === 0) return { ok: false, message: 'Kein Vault auf der Chain (z. B. dynamicFieldNotFound). Einmal „On-Chain speichern“ ausführen, dann „Von Chain laden“.' };
                            const content = await loadVaultFromChainPayload(enc, pw);
                            vaultStateRef.current = {
                                keys: content.keys,
                                notes: content.notes,
                                vaultNotes: content.vaultNotes,
                                personalSecrets: content.personalSecrets ?? [],
                            };
                            if (CFG.SIGNER === 'sdk' && (content.iotaSdkSignerImport || '').trim()) {
                                applySdkSignerFromImport(content.iotaSdkSignerImport!);
                            }
                            const vaultPathChain = CFG.VAULT_FILE || '.morgendrot-vault';
                            const nChain = await tryRestoreHandshakeSessionFromVault(
                                vaultPathChain,
                                pw,
                                MY_ADDR,
                                content.keys.privateKey,
                                sessionState,
                                setSessionStatus
                            );
                            setSessionStatus({ hasKeys: true });
                            const hsRestoreChainNote =
                                nChain > 0 ? ` Handshake-Cache: ${nChain} Partner (Status „verbunden“).` : '';
                            return {
                                ok: true,
                                message: 'Vault von Chain geladen.' + hsRestoreChainNote,
                                notes: content.notes,
                                vaultNotes: content.vaultNotes,
                                personalSecrets: content.personalSecrets ?? [],
                            };
                        } catch (e) {
                            const msg = String((e as Error)?.message ?? e);
                            const decryptFail = /decrypt|decryption|ungültig|Payload|tag|password|passwort|invalid|failed/i.test(msg);
                            return { ok: false, message: decryptFail ? 'Entschlüsselung fehlgeschlagen – Passwort korrekt?' : ('Von Chain laden fehlgeschlagen: ' + msg) };
                        }
                    }
                    if (c === '/vault-delete-local') {
                        const delPath =
                            a[0] != null && String(a[0]).trim()
                                ? String(a[0]).trim()
                                : (CFG.VAULT_FILE || '.morgendrot-vault');
                        if (!vaultFileExists(delPath)) {
                            return { ok: false, message: 'Keine lokale Vault-Datei: ' + delPath };
                        }
                        if (!CFG.VAULT_REGISTRY_ID || !CFG.PACKAGE_ID) {
                            return {
                                ok: false,
                                message:
                                    'VAULT_REGISTRY_ID und PACKAGE_ID nötig — lokale Datei wird nur gelöscht, wenn ein On-Chain-Vault für MY_ADDRESS existiert.',
                            };
                        }
                        try {
                            let enc: Uint8Array | null = null;
                            for (let attempt = 0; attempt < 6; attempt++) {
                                enc = await getVaultFromChain(getClient(), CFG.VAULT_REGISTRY_ID, CFG.PACKAGE_ID, MY_ADDR);
                                if (enc && enc.length > 0) break;
                                if (attempt < 5) {
                                    await new Promise((r) => setTimeout(r, 2000));
                                }
                            }
                            if (!enc || enc.length === 0) {
                                return {
                                    ok: false,
                                    message:
                                        'Kein On-Chain-Vault für diese Adresse — lokale Datei bleibt erhalten. Zuerst „Auf Chain sichern“.',
                                };
                            }
                            const { unlink } = await import('node:fs/promises');
                            await unlink(delPath);
                            return {
                                ok: true,
                                message:
                                    'Lokale Vault-Datei gelöscht: ' +
                                    delPath +
                                    '. Beim nächsten Start reicht On-Chain-Entsperren (oder Seed-Import).',
                            };
                        } catch (e) {
                            return { ok: false, message: 'Löschen fehlgeschlagen: ' + String((e as Error)?.message ?? e) };
                        }
                    }
                    if (c === '/emergency-purge' && CFG.VAULT_REGISTRY_ID) {
                        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
                        const res = await chainEmergencyPurgeVaultPtb(MY_ADDR, MY_ADDR, getWalletPassword(), messengerGasPolicyOpts());
                        const vpEp = CFG.VAULT_FILE || '.morgendrot-vault';
                        purgeInboxCache(vpEp, { shred: true });
                        return {
                            ok: true,
                            message:
                                'Vault Notfall-Purge ausgeführt (PTB: enable + purge in 1 TX).' +
                                (res.digest ? ' Digest: ' + res.digest : '') +
                                ' Lokaler Klartext-Inbox-Cache geschreddert.',
                        };
                    }
                    if (c === '/device-status') {
                        const { getMonitorStatus } = await import('../monitoring.js');
                        const devices = getMonitorStatus();
                        if (!devices.length) return { ok: true, message: 'Keine Geräte konfiguriert (MONITOR_DEVICES leer).', data: [] };
                        const lines = devices.map(d => `${d.device.slice(0,12)}… ${d.status} (zuletzt: ${d.lastSeen ? new Date(d.lastSeen).toLocaleString('de') : 'nie'})`);
                        return { ok: true, message: lines.join('\n'), data: devices };
                    }
                    if (c === '/heartbeat') {
                        if (!hasRoleBit(ROLE_BITS.S)) return { ok: true, message: 'Heartbeat übersprungen (S-Bit nicht gesetzt – ROLE_ID=' + CFG.ROLE_ID + ').' };
                        const bridgeUrl = getStreamsBridgeUrlForFetch();
                        if (!bridgeUrl) return { ok: false, message: 'STREAMS_BRIDGE_URL muss eine gültige URL sein (z. B. http://localhost:3345). In Überwachung: Bridge-URL eintragen und Setzen klicken. Aktuell: ' + (CFG.STREAMS_BRIDGE_URL || '(leer)').slice(0, 50) + (CFG.STREAMS_BRIDGE_URL && CFG.STREAMS_BRIDGE_URL.length > 50 ? '…' : '') };
                        if (!CFG.STREAMS_ANCHOR_ID) return { ok: false, message: 'STREAMS_ANCHOR_ID nicht gesetzt. An wen senden? In Überwachung: Kanal (Anchor-ID) eintragen – vom Boss/Kommandant oder nach Kanal abonnieren.' };
                        const { getStreamsAdapter } = await import('../streams-adapter.js');
                        const payload = JSON.stringify({ type: 'heartbeat', device: MY_ADDR, ts: Date.now(), transport: 'internet' });
                        try {
                            await getStreamsAdapter().publish(CFG.STREAMS_ANCHOR_ID, payload);
                            return { ok: true, message: 'Heartbeat gesendet.' };
                        } catch (e) {
                            const msg = (e as Error)?.message ?? String(e);
                            return { ok: false, message: 'Heartbeat fehlgeschlagen: ' + msg + '. Bridge erreichbar? STREAMS_BRIDGE_URL prüfen (z. B. http://localhost:…).' };
                        }
                    }
                    if (c === '/set-heartbeat-interval') {
                        const ms = parseInt(String(a[0]).trim(), 10);
                        if (Number.isNaN(ms) || !isAllowedHeartbeatIntervalMs(ms)) {
                            const labels = HEARTBEAT_INTERVAL_PRESETS_MS.map((x) => `${x / 60_000} min`).join(', ');
                            return {
                                ok: false,
                                message: `Intervall muss ein Preset sein (${labels}). Werte in Millisekunden: ${HEARTBEAT_INTERVAL_PRESETS_MS.join(', ')}.`,
                            };
                        }
                        setEnvKey('HEARTBEAT_INTERVAL_MS', String(ms));
                        (CFG as { HEARTBEAT_INTERVAL_MS: number }).HEARTBEAT_INTERVAL_MS = ms;
                        return {
                            ok: true,
                            message: `Heartbeat-Intervall auf ${ms / 60_000} min (${ms} ms) gesetzt. Wird beim nächsten Takt angewendet.`,
                        };
                    }
                    if (c === '/set-heartbeat-enabled') {
                        const v = String(a[0] ?? '').trim().toLowerCase();
                        const on = v === 'true' || v === '1' || v === 'on' || v === 'ja';
                        const off = v === 'false' || v === '0' || v === 'off' || v === 'aus';
                        if (!on && !off) {
                            return { ok: false, message: 'Nutzung: /set-heartbeat-enabled true|false (Puls an/aus).' };
                        }
                        setEnvKey('ENABLE_HEARTBEAT', on ? 'true' : 'false');
                        (CFG as { ENABLE_HEARTBEAT: boolean }).ENABLE_HEARTBEAT = on;
                        return {
                            ok: true,
                            message: on
                                ? 'Heartbeat (Puls) aktiviert – Intervall wie konfiguriert.'
                                : 'Heartbeat (Puls) aus – Funkstille bis wieder aktiviert.',
                        };
                    }
                    if (c === '/streams-create') {
                        const bridgeUrl = getStreamsBridgeUrlForFetch();
                        if (!bridgeUrl) return { ok: false, message: 'STREAMS_BRIDGE_URL muss eine gültige URL sein (z. B. http://localhost:3345). Zuerst Bridge-URL eintragen und auf Setzen klicken. Aktuell: ' + (CFG.STREAMS_BRIDGE_URL || '(leer)').slice(0, 60) + (CFG.STREAMS_BRIDGE_URL && CFG.STREAMS_BRIDGE_URL.length > 60 ? '…' : '') };
                        try {
                            const res = await fetchWithTimeout(`${bridgeUrl}/streams/create`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sender: MY_ADDR }),
                            });
                            if (!res.ok) return { ok: false, message: `Bridge antwortete mit ${res.status}.` };
                            const data = await res.json() as { anchor_id?: string; anchorId?: string };
                            const anchor = data.anchor_id || data.anchorId || '';
                            if (!anchor) return { ok: false, message: 'Keine Anchor-ID von Bridge erhalten.' };
                            (CFG as { STREAMS_ANCHOR_ID: string }).STREAMS_ANCHOR_ID = anchor;
                            process.env.STREAMS_ANCHOR_ID = anchor;
                            setEnvKey('STREAMS_ANCHOR_ID', anchor);
                            const pw = getWalletPassword();
                            if (pw && useVault) await writeVaultAnchorId(vaultPath, anchor, pw);
                            const streamsChannelUrl = `${bridgeUrl}?anchor=${encodeURIComponent(anchor)}`;
                            return {
                                ok: true,
                                message: `Streams-Kanal erstellt. Anchor-ID: ${anchor.slice(0, 24)}…` + (pw && useVault ? ' (im Vault gesichert)' : ' WARNUNG: /vault-save ausführen!'),
                                anchorId: anchor,
                                streamsChannelUrl,
                            };
                        } catch (e) { return { ok: false, message: 'Streams-Kanal erstellen fehlgeschlagen: ' + ((e as Error)?.message || e) }; }
                    }
                    if (c === '/streams-subscribe') {
                        const bridgeUrlSub = getStreamsBridgeUrlForFetch();
                        if (!bridgeUrlSub) return { ok: false, message: 'STREAMS_BRIDGE_URL muss eine gültige URL sein (z. B. http://localhost:3345). Zuerst Bridge-URL eintragen und Setzen klicken.' };
                        const anchorArg = a[0]?.trim() || CFG.STREAMS_ANCHOR_ID;
                        if (!anchorArg) return { ok: false, message: 'Anchor-ID als Argument oder STREAMS_ANCHOR_ID setzen.' };
                        try {
                            const res = await fetchWithTimeout(`${bridgeUrlSub}/streams/subscribe`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ anchor_id: anchorArg, subscriber: MY_ADDR }),
                            });
                            if (!res.ok) return { ok: false, message: `Bridge antwortete mit ${res.status}.` };
                            if (!CFG.STREAMS_ANCHOR_ID) {
                                (CFG as { STREAMS_ANCHOR_ID: string }).STREAMS_ANCHOR_ID = anchorArg;
                                process.env.STREAMS_ANCHOR_ID = anchorArg;
                                setEnvKey('STREAMS_ANCHOR_ID', anchorArg);
                            }
                            return { ok: true, message: `Kanal ${anchorArg.slice(0, 16)}… abonniert.` };
                        } catch (e) { return { ok: false, message: 'Subscribe fehlgeschlagen: ' + ((e as Error)?.message || e) }; }
                    }
                    if (c === '/streams-publish') {
                        const { getStreamsAdapter, encryptStreamPayload } = await import('../streams-adapter.js');
                        if (!CFG.STREAMS_ANCHOR_ID) return { ok: false, message: 'STREAMS_ANCHOR_ID nicht gesetzt.' };
                        if (!CFG.STREAMS_BRIDGE_URL) return { ok: false, message: 'STREAMS_BRIDGE_URL nicht gesetzt.' };
                        const raw = a.join(' ').trim() || 'ping';
                        const pw = getWalletPassword();
                        try {
                            const payload = pw ? await encryptStreamPayload(raw, pw) : raw;
                            await getStreamsAdapter().publish(CFG.STREAMS_ANCHOR_ID, payload);
                            return { ok: true, message: 'Streams-Nachricht gesendet.' + (pw ? ' (verschlüsselt)' : ' (WARNUNG: unverschlüsselt – kein Wallet-Passwort)') };
                        } catch (e) { return { ok: false, message: 'Streams-Publish fehlgeschlagen: ' + ((e as Error)?.message || e) }; }
                    }
                    if (c === '/streams-status') {
                        const bridgeOk = getStreamsBridgeUrlForFetch();
                        return {
                            ok: true,
                            message: [
                                'STREAMS_BRIDGE_URL: ' + (CFG.STREAMS_BRIDGE_URL || '(nicht gesetzt)') + (bridgeOk ? ' (gültig)' : ' (ungültig – muss http:// oder https:// sein)'),
                                'STREAMS_ANCHOR_ID: ' + (CFG.STREAMS_ANCHOR_ID || '(nicht gesetzt)'),
                                'STREAMS_TOPIC: ' + (CFG.STREAMS_TOPIC || '(nicht gesetzt)'),
                                'STREAMS_LISTEN_ENABLED: ' + CFG.STREAMS_LISTEN_ENABLED,
                                'OPEN_STREAMS_ENABLED: ' + CFG.OPEN_STREAMS_ENABLED,
                                'AUDIT_STREAMS_ENABLED: ' + CFG.AUDIT_STREAMS_ENABLED,
                            ].join('\n')
                        };
                    }
                    if (c === '/streams-fetch') {
                        const urlsToTry = getStreamsBridgeUrlsToTry();
                        if (!urlsToTry.length) return { ok: false, message: 'STREAMS_BRIDGE_URL setzen (z. B. http://127.0.0.1:3443 wenn Bridge auf Port 3443 läuft).' };
                        if (!CFG.STREAMS_ANCHOR_ID) return { ok: false, message: 'STREAMS_ANCHOR_ID nicht gesetzt. Kanal wählen oder unter Streams eintragen.' };
                        const { decryptStreamPayload } = await import('../streams-adapter.js');
                        const pw = getWalletPassword();
                        let lastError: Error | null = null;
                        for (const baseUrl of urlsToTry) {
                            try {
                                const res = await fetchWithTimeout(`${baseUrl}?anchor=${encodeURIComponent(CFG.STREAMS_ANCHOR_ID)}`);
                                if (!res.ok) continue;
                                const raw = await res.text();
                                if (/^\s*</.test(raw)) continue;
                                let data: { messages?: Array<{ sender?: string; payload: string; ts?: number }> } | Array<{ sender?: string; payload: string; ts?: number }>;
                                try { data = JSON.parse(raw) as typeof data; } catch { continue; }
                                const list = Array.isArray(data) ? data : data?.messages ?? [];
                                const decoded: Array<{ sender?: string; payload: string; ts?: number }> = [];
                                const maxMessages = 500;
                                for (const m of list.slice(-maxMessages)) {
                                    let text = m.payload;
                                    if (pw && m.payload) {
                                        try { text = await decryptStreamPayload(m.payload, pw); }
                                        catch {
                                            const looksBase64 = /^[A-Za-z0-9+/]+=*$/.test(m.payload.trim()) && m.payload.length > 44;
                                            text = looksBase64 ? '[Verschlüsselt – Passwort anders?] ' + m.payload.slice(0, 24) + '…' : m.payload;
                                        }
                                    }
                                    decoded.push({ ...m, payload: text });
                                }
                                const lines = decoded.map(m => {
                                    const from = (m.sender && m.sender.length >= 10) ? m.sender.slice(0, 10) : 'Kanal';
                                    return `[${from}] ${m.payload.slice(0, 120)}${m.ts ? ' (' + new Date(m.ts).toLocaleString('de') + ')' : ''}`;
                                });
                                const usedFallback = baseUrl !== (CFG.STREAMS_BRIDGE_URL || '').trim().replace(/\/$/, '');
                                const msg = (usedFallback ? `Bridge auf ${baseUrl} gefunden. STREAMS_BRIDGE_URL auf ${baseUrl} setzen. ` : '') + (list.length ? lines.join('\n') : 'Keine Nachrichten auf dem Kanal.');
                                return { ok: true, message: msg, data: decoded, streamsBridgeUsed: usedFallback ? baseUrl : undefined };
                            } catch (e) {
                                lastError = e as Error;
                            }
                        }
                        const msg = (lastError as Error)?.message || String(lastError);
                        const hint = /fetch failed|ECONNREFUSED|ENOTFOUND|network|timeout/i.test(msg)
                            ? ' UI läuft oft auf 3342, Streams-Bridge auf 3443 oder 9343 – Bridge-URL prüfen (z. B. http://127.0.0.1:3443).'
                            : '';
                        return { ok: false, message: 'Streams-Fetch fehlgeschlagen: ' + msg + hint };
                    }
                    if (c === '/streams-purge') {
                        const bridgeUrlPurge = getStreamsBridgeUrlForFetch();
                        if (!bridgeUrlPurge) return { ok: false, message: 'STREAMS_BRIDGE_URL muss eine gültige URL sein (z. B. http://localhost:3345).' };
                        if (!CFG.STREAMS_ANCHOR_ID) return { ok: false, message: 'STREAMS_ANCHOR_ID nicht gesetzt.' };
                        try {
                            const res = await fetchWithTimeout(`${bridgeUrlPurge}?anchor=${encodeURIComponent(CFG.STREAMS_ANCHOR_ID)}&purge=1`);
                            if (!res.ok) return { ok: false, message: `Bridge antwortete mit ${res.status}.` };
                            const data = await res.json() as { ok?: boolean; message?: string };
                            return { ok: true, message: data?.message ?? 'Streams-Kanal geleert.' };
                        } catch (e) { return { ok: false, message: 'Streams-Purge fehlgeschlagen: ' + ((e as Error)?.message || e) }; }
                    }
                    if (c === '/purge-expired-tickets') {
                        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert (ENABLE_PURGE=false).' };
                        const { purgeExpiredTickets, getOwnedEventRegistries } = await import('../chain-access.js');
                        let registryIds: string[] = [];
                        const explicitId = (a[0]?.trim() || CFG.EVENT_REGISTRY_ID || '').trim();
                        if (explicitId && explicitId !== CFG.PACKAGE_ID && /^0x[a-fA-F0-9]{64}$/.test(explicitId)) {
                            registryIds = [explicitId];
                        } else if (!explicitId || explicitId === CFG.PACKAGE_ID) {
                            if (!CFG.PACKAGE_ID) return { ok: false, message: 'PACKAGE_ID fehlt.' };
                            registryIds = await getOwnedEventRegistries(getClient(), CFG.PACKAGE_ID, MY_ADDR);
                        }
                        if (registryIds.length === 0) return { ok: false, message: 'Keine Event-Registry gefunden. Zuerst /create-event-registry ausführen oder EVENT_REGISTRY_ID in .env setzen (Objekt-ID, nicht Package-ID).' };
                        const digests: string[] = [];
                        for (const registryId of registryIds) {
                            try {
                                const res = await purgeExpiredTickets(registryId, MY_ADDR);
                                if (res?.digest) digests.push(res.digest);
                            } catch (e) { return { ok: false, message: 'purgeExpiredTickets fehlgeschlagen: ' + ((e as Error)?.message || e) }; }
                        }
                        return { ok: true, message: 'Abgelaufene Tickets gepurged.' + (digests.length ? ' Digest(s): ' + digests.join(', ') : '') };
                    }
                    if (c === '/create-key-and-notify' && a[0] && a[1]) {
                        const lock = (a[0].trim() === '<LOCK_ID>' ? (CFG.LOCK_ID || CFG.MY_ADDRESS || '').trim() : a[0].trim());
                        if (!lock) return { ok: false, message: 'LOCK_ID oder MY_ADDRESS für Lock-Adresse setzen ( .env oder Platzhalter ersetzen).' };
                        const ttlNum = a[2] ? parseInt(String(a[2]).trim(), 10) : NaN;
                        const ttl = !Number.isNaN(ttlNum) && ttlNum > 0 ? BigInt(ttlNum) : CFG.DEFAULT_KEY_TTL_DAYS;
                        const messageText = a.slice(3).join(' ').trim() || 'AccessKey ausgestellt.';
                        const sponsorOpts = (opts as { sponsorForSender?: string } | undefined)?.sponsorForSender ? { sponsorForSender: (opts as { sponsorForSender?: string }).sponsorForSender } : undefined;
                        const res = await createAccessKeyAndSendPlain(lock, a[1], ttl, messageText, sponsorOpts);
                        if (res?.status === 'failure') return { ok: false, message: 'PTB (Key + Nachricht) fehlgeschlagen.' };
                        const out: { ok: boolean; message: string; objectId?: string; digest?: string; gasSummary?: import('../chain-access.js').GasSummary } = { ok: true, message: 'Key ausgestellt und Nachricht in einer TX gesendet.' };
                        if (res?.createdObjectIds?.[0]) out.objectId = res.createdObjectIds[0];
                        if (res?.digest) out.digest = res.digest;
                        if (res?.gasSummary) out.gasSummary = res.gasSummary;
                        return out;
                    }
                    if ((c === '/create-key' || c === '/create-keys') && a[0] && a[1]) {
                        const lock = (a[0].trim() === '<LOCK_ID>' ? (CFG.LOCK_ID || CFG.MY_ADDRESS || '').trim() : a[0].trim());
                        if (!lock) return { ok: false, message: 'LOCK_ID oder MY_ADDRESS für Lock-Adresse setzen ( .env oder Platzhalter ersetzen).' };
                        const ttlNum = a[2] ? parseInt(String(a[2]).trim(), 10) : NaN;
                        const ttl = !Number.isNaN(ttlNum) && ttlNum > 0 ? BigInt(ttlNum) : CFG.DEFAULT_KEY_TTL_DAYS;
                        const count = Math.max(1, parseInt(a[3] || '1', 10) || 1);
                        const sponsorOpts = (opts as { sponsorForSender?: string } | undefined)?.sponsorForSender ? { sponsorForSender: (opts as { sponsorForSender?: string }).sponsorForSender } : undefined;
                        if (count === 1) {
                            const res = (await createAccessKey(lock, a[1], ttl, sponsorOpts)) as
                                | { status?: string; createdObjectIds?: string[]; digest?: string; gasSummary?: import('../chain-access.js').GasSummary }
                                | undefined;
                            if (res?.status === 'failure') return { ok: false, message: 'AccessKey-TX fehlgeschlagen.' };
                            const out: { ok: boolean; message: string; objectId?: string; digest?: string; gasSummary?: import('../chain-access.js').GasSummary } = { ok: true, message: `AccessKey für ${lock} an ${a[1]} ausgestellt.` };
                            if (res?.createdObjectIds?.[0]) out.objectId = res.createdObjectIds[0];
                            if (res?.digest) out.digest = res.digest;
                            if (res?.gasSummary) out.gasSummary = res.gasSummary;
                            return out;
                        }
                        const res = (await createAccessKeysBatch(lock, a[1], ttl, count, sponsorOpts)) as
                            | { createdObjectIds?: string[]; digest?: string; gasSummary?: import('../chain-access.js').GasSummary }
                            | undefined;
                        const out: { ok: boolean; message: string; createdObjectIds?: string[]; digest?: string; gasSummary?: import('../chain-access.js').GasSummary } =
                            { ok: true, message: `${count} AccessKeys in einer TX (PTB) ausgestellt.` };
                        if (res?.createdObjectIds?.length) out.createdObjectIds = res.createdObjectIds;
                        if (res?.digest) out.digest = res.digest;
                        if (res?.gasSummary) out.gasSummary = res.gasSummary;
                        return out;
                    }
                    if (c === '/emergency-purge-key') {
                        const keyId = (a[0] != null && typeof a[0] === 'string') ? a[0].trim() : '';
                        if (!keyId || keyId.startsWith('<') || keyId.toLowerCase() === 'undefined' || !/^0x[0-9a-fA-F]+$/.test(keyId))
                            return { ok: false, message: 'Key-Objekt-ID angeben (0x…). Zuerst /list-keys ausführen.' };
                        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
                        await enableEmergencyPurgeKey(keyId);
                        return { ok: true, message: 'Notfall-Purge aktiviert. Danach /purge-key <keyId>.' };
                    }
                    if (c === '/purge-key') {
                        const keyId = (a[0] != null && typeof a[0] === 'string') ? a[0].trim() : '';
                        if (!keyId || keyId.startsWith('<') || keyId.toLowerCase() === 'undefined' || !/^0x[0-9a-fA-F]+$/.test(keyId))
                            return { ok: false, message: 'Key-Objekt-ID angeben (0x…). Zuerst /list-keys ausführen.' };
                        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
                        await purgeKey(keyId);
                        return { ok: true, message: 'AccessKey gepurged.' };
                    }
                    if (c === '/purge-keys' && a.length >= 1) {
                        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
                        const ids = a.map((x) => String(x).trim()).filter(Boolean);
                        if (ids.length === 0) return { ok: false, message: 'Mindestens eine Key-Objekt-ID (0x…) angeben.' };
                        const res = await chainPurgeMultipleKeys(ids, MY_ADDR, getWalletPassword());
                        return { ok: true, message: ids.length + ' AccessKey(s) in einer TX gepurged.', digest: res.digest, gasSummary: res.gasSummary };
                    }
                    if (c === '/purge-tickets' && a.length >= 1) {
                        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
                        const ids = a.map((x) => String(x).trim()).filter(Boolean);
                        if (ids.length === 0) return { ok: false, message: 'Mindestens eine Ticket-Objekt-ID (0x…) angeben.' };
                        const res = await chainPurgeMultipleTickets(ids, MY_ADDR, getWalletPassword());
                        return { ok: true, message: ids.length + ' Ticket(s) in einer TX gepurged (PTB).', digest: res.digest, gasSummary: res.gasSummary };
                    }
                    if (c === '/transfer-key' && a[0] && a[1]) {
                        await chainTransferAccessKey(a[0].trim(), a[1].trim(), MY_ADDR, getWalletPassword());
                        return { ok: true, message: `AccessKey an ${a[1].slice(0, 12)}… übertragen.` };
                    }
                    if (c === '/list-keys') {
                        const owner = (a[0] || MY_ADDR || '').trim();
                        if (!owner) return { ok: false, message: 'Adresse angeben oder MY_ADDRESS setzen.' };
                        const client = getClient();
                        const keys = await getOwnedAccessKeys(client, CFG.PACKAGE_ID, owner);
                        return { ok: true, message: `${keys.length} AccessKey(s)`, keys };
                    }
                    if (c === '/create-event-registry' && a[0]) {
                        const eventId = a[0].trim();
                        if (!/^0x[a-fA-F0-9]{64}$/.test(eventId)) return { ok: false, message: 'event_id muss 0x + 64 Hex-Zeichen sein.' };
                        const { createEventRegistry } = await import('../chain-access.js');
                        try {
                            const res = await createEventRegistry(eventId, MY_ADDR, getWalletPassword());
                            const registryId = res?.createdObjectIds?.[0];
                            if (registryId) setEnvKey('EVENT_REGISTRY_ID', registryId);
                            return {
                                ok: true,
                                message: 'Event-Registry erstellt.' + (registryId ? ' EVENT_REGISTRY_ID gesetzt: ' + registryId.slice(0, 18) + '…' : ''),
                                objectId: registryId,
                                digest: res?.digest,
                            };
                        } catch (e) { return { ok: false, message: 'createEventRegistry fehlgeschlagen: ' + ((e as Error)?.message || e) }; }
                    }
                    if (c === '/create-ticket' && a[0] && a[1] !== undefined && a[2] !== undefined && a[3] !== undefined && a[4]) {
                        const eventId = a[0].trim();
                        const validFromMs = BigInt(String(a[1]).trim() || '0');
                        const validUntilMs = BigInt(String(a[2]).trim() || '0');
                        const metadataHex = (a[3] || '').trim();
                        const recipient = a[4].trim();
                        if (!/^0x[a-fA-F0-9]{64}$/.test(eventId)) return { ok: false, message: 'event_id muss 0x + 64 Hex-Zeichen sein.' };
                        if (!/^0x[a-fA-F0-9]{64}$/.test(recipient)) return { ok: false, message: 'recipient muss 0x + 64 Hex-Zeichen sein (z. B. MY_ADDRESS).' };
                        const res = (await chainCreateTicket(eventId, validFromMs, validUntilMs, metadataHex, recipient, MY_ADDR, getWalletPassword())) as
                            | { createdObjectIds?: string[]; digest?: string; gasSummary?: import('../chain-access.js').GasSummary }
                            | undefined;
                        const out: { ok: boolean; message: string; objectId?: string; digest?: string; gasSummary?: import('../chain-access.js').GasSummary } = { ok: true, message: `Ticket für Event ${eventId.slice(0, 12)}… an ${recipient.slice(0, 12)}… ausgestellt.` };
                        if (res?.createdObjectIds?.[0]) out.objectId = res.createdObjectIds[0];
                        if (res?.digest) out.digest = res.digest;
                        if (res?.gasSummary) out.gasSummary = res.gasSummary;
                        return out;
                    }
                    if (c === '/create-tickets' && a[0] && a[1] !== undefined && a[2] !== undefined && a[3] !== undefined && a[4] && a[5]) {
                        const eventId = a[0].trim();
                        const validFromMs = BigInt(String(a[1]).trim() || '0');
                        const validUntilMs = BigInt(String(a[2]).trim() || '0');
                        const metadataHex = (a[3] || '').trim();
                        const recipient = a[4].trim();
                        const count = Math.max(1, Math.min(50, parseInt(a[5], 10) || 1));
                        if (!/^0x[a-fA-F0-9]{64}$/.test(eventId)) return { ok: false, message: 'event_id muss 0x + 64 Hex-Zeichen sein.' };
                        if (!/^0x[a-fA-F0-9]{64}$/.test(recipient)) return { ok: false, message: 'recipient muss 0x + 64 Hex-Zeichen sein.' };
                        const res = await chainCreateTicketsBatchPtb(eventId, validFromMs, validUntilMs, metadataHex, recipient, count, MY_ADDR, getWalletPassword());
                        const out: { ok: boolean; message: string; createdObjectIds?: string[]; digest?: string; gasSummary?: import('../chain-access.js').GasSummary } =
                            { ok: true, message: `${count} Ticket(s) in einer TX (PTB) ausgestellt.` };
                        if (res?.createdObjectIds?.length) out.createdObjectIds = res.createdObjectIds;
                        if (res?.digest) out.digest = res.digest;
                        if (res?.gasSummary) out.gasSummary = res.gasSummary;
                        return out;
                    }
                    if (c === '/use-ticket' && a[0] && a[1]) {
                        const sponsorPw = CFG.SPONSOR_GAS_PASSWORD ?? (MY_ADDR === CFG.SPONSOR_GAS_OWNER ? getWalletPassword() : undefined);
                        const useSponsor =
                            CFG.SPONSORED_TRANSACTION_ENABLED &&
                            CFG.SPONSOR_GAS_OWNER &&
                            MY_ADDR !== CFG.SPONSOR_GAS_OWNER &&
                            Boolean(sponsorPw);
                        const sponsorOpts =
                            useSponsor && CFG.SPONSOR_GAS_OWNER && sponsorPw
                                ? { sponsorAddress: CFG.SPONSOR_GAS_OWNER, sponsorPassword: sponsorPw }
                                : undefined;
                        await chainUseTicket(a[0].trim(), a[1].trim(), MY_ADDR, getWalletPassword(), sponsorOpts);
                        return { ok: true, message: 'Ticket eingelöst (used=true).' + (sponsorOpts ? ' (Gas: Sponsor)' : '') };
                    }
                    if (c === '/emergency-purge-ticket' && a[0]) {
                        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
                        await chainEnableEmergencyPurgeTicket(a[0].trim(), MY_ADDR, getWalletPassword());
                        return { ok: true, message: 'Notfall-Purge aktiviert. Danach /purge-ticket <ticketId>.' };
                    }
                    if (c === '/purge-ticket' && a[0]) {
                        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
                        await chainPurgeTicket(a[0].trim(), MY_ADDR, getWalletPassword());
                        return { ok: true, message: 'Ticket gepurged.' };
                    }
                    if (c === '/transfer-ticket' && a[0] && a[1]) {
                        await chainTransferTicket(a[0].trim(), a[1].trim(), MY_ADDR, getWalletPassword());
                        return { ok: true, message: `Ticket an ${a[1].slice(0, 12)}… übertragen.` };
                    }
                    if (c === '/list-tickets') {
                        const owner = (a[0] || MY_ADDR || '').trim();
                        if (!owner) return { ok: false, message: 'Adresse angeben oder MY_ADDRESS setzen.' };
                        const client = getClient();
                        const tickets = await getOwnedTickets(client, CFG.PACKAGE_ID, owner);
                        return { ok: true, message: `${tickets.length} Ticket(s)`, tickets };
                    }
                    if (c === '/create-asset' && a[0]) {
                        const name = String(a[0]).trim();
                        const metadata = a.length >= 2 ? String(a[1]).trim() : '';
                        const streamsAnchorId = a.length >= 3 ? String(a[2]).trim() || undefined : undefined;
                        const res = await chainCreatePhysicalAsset(name, metadata, MY_ADDR, getWalletPassword(), undefined, streamsAnchorId);
                        const out: { ok: boolean; message: string; objectId?: string; digest?: string; gasSummary?: import('../chain-access.js').GasSummary } =
                            { ok: true, message: `PhysicalAsset „${name.slice(0, 32)}${name.length > 32 ? '…' : ''}“ erstellt.` };
                        if (res?.createdObjectIds?.[0]) out.objectId = res.createdObjectIds[0];
                        if (res?.digest) out.digest = res.digest;
                        if (res?.gasSummary) out.gasSummary = res.gasSummary;
                        const objectId = res?.createdObjectIds?.[0];
                        if (objectId && /^0x[a-fA-F0-9]{64}$/.test(objectId) && MY_ADDR && /^0x[a-fA-F0-9]{64}$/.test(MY_ADDR)) {
                            try {
                                const message = buildAssetAttestationMessage(objectId, MY_ADDR);
                                const sigBytes = await signPersonalMessageWithSdkSigner(message);
                                if (sigBytes && sigBytes.length > 0) {
                                    await chainAttestPhysicalAsset(objectId, sigBytes, MY_ADDR, getWalletPassword());
                                    (out as { attested?: boolean }).attested = true;
                                }
                            } catch {
                                // Attestation optional; Asset ist erstellt
                            }
                        }
                        return out;
                    }
                    if (c === '/link-nfc-asset' && a[0] && a[1]) {
                        await chainLinkNfcToAsset(a[0].trim(), a[1].trim(), MY_ADDR, getWalletPassword());
                        return { ok: true, message: 'NFC-UID mit Asset verknüpft (Sicherheitssiegel Grün).' };
                    }
                    if (c === '/transfer-asset' && a[0] && a[1]) {
                        await chainTransferPhysicalAsset(a[0].trim(), a[1].trim(), MY_ADDR, getWalletPassword());
                        return { ok: true, message: `PhysicalAsset an ${a[1].slice(0, 12)}… übertragen.` };
                    }
                    if (c === '/transfer-asset-key-package' && a[0] && a[1] && a[2]) {
                        await chainTransferAssetAndKeyPtb(a[0].trim(), a[1].trim(), a[2].trim(), MY_ADDR, getWalletPassword());
                        return { ok: true, message: `Asset + Key atomar an ${a[2].slice(0, 12)}… übertragen.` };
                    }
                    if (c === '/purge-asset' && a[0]) {
                        if (!CFG.ENABLE_PURGE) return { ok: false, message: 'Purge deaktiviert.' };
                        await chainPurgePhysicalAsset(a[0].trim(), MY_ADDR, getWalletPassword());
                        return { ok: true, message: 'PhysicalAsset gepurged (Rebate).' };
                    }
                    if (c === '/list-assets') {
                        const owner = (a[0] || MY_ADDR || '').trim();
                        if (!owner) return { ok: false, message: 'Adresse angeben oder MY_ADDRESS setzen.' };
                        const client = getClient();
                        const assets = await getOwnedPhysicalAssets(client, CFG.PACKAGE_ID, owner);
                        const bossAddr = (CFG.BOSS_ADDRESS || CFG.MY_ADDRESS || '').trim();
                        for (const ast of assets) {
                            (ast as { creatorVerified?: boolean }).creatorVerified = !!(ast.creatorAddress && ast.creatorSignature && bossAddr && /^0x[a-fA-F0-9]{64}$/.test(bossAddr)) &&
                                await verifyAssetCreatorSignature(ast.objectId, ast.creatorAddress, ast.creatorSignature, bossAddr);
                        }
                        return { ok: true, message: `${assets.length} PhysicalAsset(s)`, assets };
                    }
                    if (c === '/shadow-sweep') {
                        const sm =
                            String((opts as { shadowMnemonic?: string } | undefined)?.shadowMnemonic ?? '').trim() ||
                            a.join(' ').trim();
                        if (countMnemonicWords(sm) < 12) {
                            return {
                                ok: false,
                                message:
                                    'Schatten-Mnemonic: mindestens 12 Wörter. Alle Wörter nach /shadow-sweep angeben oder API-JSON-Feld shadowMnemonic nutzen.',
                            };
                        }
                        const { executeShadowSweep } = await import('../shadow-sweep.js');
                        const result = await executeShadowSweep(getClient(), sm);
                        if (!result.ok) return { ok: false, message: result.error };
                        return {
                            ok: true,
                            message: `Sweep OK. Main ${result.mainAddress}. Secret Key jetzt kopieren (einmalig). TX ${result.digest ?? '—'}.`,
                            shadowAddress: result.shadowAddress,
                            mainAddress: result.mainAddress,
                            mainSecretKey: result.mainSecretKey,
                            digest: result.digest,
                            transferredObjectCount: result.transferredObjectCount,
                            sentMistApprox: result.sentMistApprox,
                            note: result.note,
                        };
                    }
                    if (c === '/handshake' && a[0]) {
                        const addr = a[0].trim();
                        if (!addr.startsWith('0x')) return { ok: false, message: 'Adresse muss mit 0x beginnen' };
                        await sendHandshake(addr, keys!.pubRaw);
                        savePartnerToFile(addr);
                        return { ok: true, message: `Handshake an ${addr.slice(0, 12)}… gesendet. Partner in .morgendrot-partner gespeichert.` };
                    }
                    if (c === '/pairing-offer') {
                        const secret = (a[0] ?? '').trim();
                        const displayName = ((a[1] ?? 'Kontakt') as string).trim().slice(0, 64) || 'Kontakt';
                        const ttlSec = Math.min(300, Math.max(15, parseInt(String(a[2] ?? '60'), 10) || 60));
                        if (secret.length < 6) return { ok: false, message: 'Geheimnis mindestens 6 Zeichen (telefonisch vereinbaren).' };
                        const gateErr = await assertPairingGateNftOwned(MY_ADDR);
                        if (gateErr) return gateErr;
                        const myNorm = normalizeAddress(MY_ADDR);
                        if (!/^0x[a-f0-9]{64}$/.test(myNorm)) return { ok: false, message: 'MY_ADDRESS muss 0x + 64 Hex sein.' };
                        const expiresAtMs = Date.now() + ttlSec * 1000;
                        const nonce = generatePairingNonce();
                        let ciphertext: Uint8Array;
                        try {
                            ciphertext = encryptPairingPayload(secret, nonce, {
                                v: 1,
                                address: myNorm,
                                displayName,
                                expiresAtMs,
                            });
                        } catch (e: unknown) {
                            return { ok: false, message: String((e as Error)?.message ?? e) };
                        }
                        try {
                            const res = await sendPairingOffer(
                                MY_ADDR,
                                nonce,
                                ciphertext,
                                BigInt(expiresAtMs),
                                getWalletPassword(),
                                messengerGasPolicyOpts()
                            );
                            return {
                                ok: true,
                                message: `Peering-Angebot ${ttlSec}s on-chain. Geheimnis nur telefonisch. Partner: „Suchen“ (/pairing-find), du: /pairing-wait oder nach Handshake /connect.`,
                                digest: res.digest,
                            };
                        } catch (e: unknown) {
                            const msg = String((e as Error)?.message ?? e);
                            if (/emit_pairing_offer|FunctionNotFound|function.*not found|No function|Invariant violation/i.test(msg)) {
                                return {
                                    ok: false,
                                    message:
                                        'Package enthält emit_pairing_offer nicht – Move-Paket aus move-test neu publishen (PairingOffer-Event). Siehe move-test/sources/messaging.move.',
                                };
                            }
                            return { ok: false, message: msg };
                        }
                    }
                    if (c === '/pairing-find') {
                        const secret = (a[0] ?? '').trim();
                        if (secret.length < 6) return { ok: false, message: 'Geheimnis mindestens 6 Zeichen.' };
                        const gateErr = await assertPairingGateNftOwned(MY_ADDR);
                        if (gateErr) return gateErr;
                        const maxCand = CFG.PAIRING_FIND_MAX_CANDIDATES;
                        const maxDec = CFG.PAIRING_FIND_MAX_DECRYPT_ATTEMPTS;
                        const offers = await queryRecentPairingOffers(maxCand);
                        const now = Date.now();
                        const me = normalizeAddress(MY_ADDR);
                        if (offers.length === 0) {
                            return {
                                ok: false,
                                message:
                                    'Keine PairingOffer-Events gefunden (letzte Seiten). Prüfen: dieselbe PACKAGE_ID wie beim Partner, RPC_URL z. B. https://api.testnet.iota.cafe, Move-Paket mit emit_pairing_offer. Partner muss /pairing-offer vor dir ausgeführt haben.',
                            };
                        }
                        let checkedUnexpired = 0;
                        let decryptAttempts = 0;
                        for (const o of offers) {
                            if (now > o.expiresAtMs) continue;
                            checkedUnexpired++;
                            if (decryptAttempts >= maxDec) {
                                return {
                                    ok: false,
                                    message: `Trial-Decrypt-Budget erreicht (${maxDec} gültige Angebote pro Lauf). Zu viele gleichzeitige Offers auf diesem Package – PAIRING_FIND_MAX_DECRYPT_ATTEMPTS oder PAIRING_FIND_MAX_CANDIDATES in .env erhöhen, oder eigenes Package (Expertenmodus).`,
                                };
                            }
                            decryptAttempts++;
                            const data = decryptPairingPayload(secret, o.nonce, o.ciphertext);
                            if (!data) continue;
                            const addr = normalizeAddress(data.address);
                            if (!/^0x[a-f0-9]{64}$/.test(addr)) continue;
                            if (addr === me) continue;
                            const dataExp = Number(data.expiresAtMs);
                            if (!Number.isFinite(dataExp) || dataExp < now) continue;
                            await sendHandshake(addr, keys!.pubRaw);
                            savePartnerToFile(addr);
                            saveContactLabel(addr, String(data.displayName || 'Partner'));
                            return {
                                ok: true,
                                message: `Handshake an „${data.displayName || 'Partner'}“ gesendet (Adresse nur intern). Danach /connect.`,
                            };
                        }
                        return {
                            ok: false,
                            message:
                                (checkedUnexpired === 0
                                    ? 'Es gibt PairingOffers, aber alle sind abgelaufen – beim /pairing-offer eine längere TTL (Sekunden) wählen und schneller /pairing-find ausführen.'
                                    : `Geheimnis passt zu keinem der ${checkedUnexpired} noch gültigen Angebot(e) (Tippfehler? anderes Geheimnis als beim Partner?). `) +
                                'Beide Instanzen: gleiche PACKAGE_ID und RPC. Paket muss emit_pairing_offer enthalten (move-test neu publishen).',
                        };
                    }
                    if (c === '/pairing-wait') {
                        if (sessionState.peerMap?.size) return { ok: true, message: 'Bereits verbunden.' };
                        if (sessionState.connecting) return { ok: false, message: 'Connect/Warte läuft bereits.' };
                        sessionState.connecting = true;
                        const timeoutMs = CFG.PAIRING_WAIT_TIMEOUT_MS;
                        (async () => {
                            try {
                                const pm = await runConnectAcceptFirstIncoming(MY_ADDR, keys!, timeoutMs);
                                sessionState.peerMap = pm;
                                const vp = CFG.VAULT_FILE || '.morgendrot-vault';
                                const pw = getWalletPassword();
                                if (vp && pw && pm.size > 0) {
                                    saveHandshakeCache(vp, pw, pm)
                                        .then(() => syncPeerSessionArchiveFromHandshakeMap(pm))
                                        .catch(() => {});
                                }
                                if (CFG.ENABLE_LISTENER) {
                                    const firstPeer = pm.values().next().value;
                                    if (pm.size === 1 && firstPeer) watchHandshakeUpdates(MY_ADDR, firstPeer);
                                    listenForMessages(MY_ADDR, pm, keys!.privateKey);
                                }
                                setSessionStatus({ connected: true, partnerCount: pm.size, connectedAddresses: Array.from(pm.keys()) });
                                logger.info(`pairing-wait: verbunden mit ${pm.size} Partner(n).`);
                            } catch (e: unknown) {
                                logger.error('pairing-wait: ' + String((e as Error)?.message ?? e));
                            } finally {
                                sessionState.connecting = false;
                            }
                        })();
                        return {
                            ok: true,
                            message: `Warte auf eingehenden Handshake (max. ${Math.round(timeoutMs / 1000)}s). Stelle sicher, dass der Partner /pairing-find ausgeführt hat.`,
                        };
                    }
                    const sendHandled = await tryHandleSendCommand(cmdCtx);
                    if (sendHandled) return sendHandled;
                    if (c === '/set-package-id' && a[0]) {
                        const id = a[0].trim();
                        if (!id) return { ok: false, message: 'Package-ID eingeben' };
                        (CFG as { PACKAGE_ID: string }).PACKAGE_ID = id;
                        process.env.PACKAGE_ID = id;
                        savePackageIdToFile(id);
                        return { ok: true, message: `PACKAGE_ID gesetzt und in .morgendrot-package-id gespeichert.`, packageId: id };
                    }
                    if (c === '/publish-package') {
                        const rawDir = (a[0] ?? 'move-test').trim() || 'move-test';
                        if (/[\\/]/.test(rawDir) || rawDir.includes('..')) {
                            return { ok: false, message: 'Nur Ordnername angeben (z. B. move-test), kein Pfad.' };
                        }
                        try {
                            const result = await publishPackageCli(rawDir);
                            const applied = applyPublishResultToEnv(result);
                            const envNote = applied.envPackageOk
                                ? 'PACKAGE_ID in .env gespeichert.'
                                : `.env nicht aktualisiert (${applied.envPackageError || 'Schreibfehler'}).`;
                            const capNote =
                                result.upgradeCapId && applied.envCapOk
                                    ? ' UPGRADE_CAP_ID gespeichert (upgrade:move-package).'
                                    : '';
                            return {
                                ok: true,
                                message:
                                    `Move-Paket publiziert (${rawDir}). ${envNote}${capNote} ` +
                                    'Bei neuem Package: create_globals + MAILBOX_ID. Für Fix ohne neue ID: npm run upgrade:move-package.',
                                packageId: result.packageId,
                                objectId: result.packageId,
                                upgradeCapId: result.upgradeCapId,
                            };
                        } catch (e: unknown) {
                            return { ok: false, message: e instanceof Error ? e.message : String(e) };
                        }
                    }
                    if (c === '/transfer-coins') {
                        let toAddr = (a[0] ?? '').trim();
                        let iotaStr = (a[1] ?? '').trim();
                        if (!toAddr && a.length > 0) toAddr = (a[0] ?? '').trim();
                        if (!iotaStr && toAddr.includes(' ')) {
                            const parts = toAddr.split(/\s+/).filter(Boolean);
                            const last = parts.pop();
                            toAddr = parts.join(' ');
                            if (last && /^\d+(?:\.\d+)?$/.test(last)) iotaStr = last;
                        }
                        const addrMatch = toAddr.match(/(0x[a-fA-F0-9]{64})/);
                        if (addrMatch) toAddr = addrMatch[1];
                        if (!toAddr) return { ok: false, message: 'Adresse und Betrag fehlen. Im Assistenten z. B.: „Sende 1 IOTA an 0x…“ oder hier: /transfer-coins 0x… 0.1' };
                        if (!toAddr.startsWith('0x') || toAddr.length !== 66) return { ok: false, message: 'Adresse muss 0x gefolgt von 64 Hex-Zeichen sein (z. B. 0x…).' };
                        if (!iotaStr) return { ok: false, message: 'Betrag fehlt. Beispiel: /transfer-coins 0x… 0.1 oder „Sende 1 IOTA an 0x…“.' };
                        const amountMist = iotaToMist(iotaStr);
                        if (amountMist <= 0n) return { ok: false, message: 'Betrag in IOTA angeben (z. B. 0.1).' };
                        const maxIota = (CFG.MAX_SEND_AMOUNT_IOTA || '').trim();
                        if (maxIota) {
                            const maxMist = iotaToMist(maxIota);
                            if (amountMist > maxMist) return { ok: false, message: `MAX_SEND_AMOUNT_IOTA überschritten (max ${maxIota} IOTA).` };
                        }
                        try {
                            await chainTransferCoins(toAddr, amountMist, MY_ADDR, getWalletPassword());
                            return { ok: true, message: `${iotaStr} IOTA an ${toAddr.slice(0, 18)}… gesendet.` };
                        } catch (e: any) {
                            return { ok: false, message: String(e?.message || e) };
                        }
                    }
                    if (c === '/set-role') {
                        if (!hasRoleBit(ROLE_BITS.D)) return { ok: false, message: 'D-Bit (Delegation) nicht gesetzt – Rollenaenderung verweigert (ROLE_ID=' + CFG.ROLE_ID + ').' };
                        const raw0 = (a[0] ?? '').trim();
                        const raw1 = (a[1] ?? '').trim();
                        const addrOk = /^0x[a-fA-F0-9]{64}$/.test(raw0);
                        if (addrOk) {
                            if (!raw1) return { ok: false, message: 'Zweites Argument: Rolle (z. B. arbeiter, kommandant).' };
                            if (!CFG.ENABLE_HIERARCHY_CHANGE) return { ok: false, message: 'ENABLE_HIERARCHY_CHANGE=false – Geräte-Rolle in Boss-.env nicht änderbar.' };
                            const res = assignDeviceRoleInEnv(raw0, raw1);
                            return res.ok ? { ok: true, message: res.message } : { ok: false, message: res.error ?? 'Fehler' };
                        }
                        const roleOnly = (raw0 === '_' ? raw1 : (raw1 || raw0)).trim().toLowerCase();
                        if (!roleOnly) return { ok: false, message: 'Lokal: Rolle angeben (UI). Oder: /set-role 0x…64 <rolle> für Gerät in Boss-.env (WORKER/KOMMANDANT + DEVICE_ROLES).' };
                        if (!['boss', 'kommandant', 'arbeiter', 'worker', 'messenger', 'lock', 'monitor', 'waerter'].includes(roleOnly)) {
                            return { ok: false, message: 'Rolle ungültig (boss, kommandant, arbeiter, worker, messenger, lock, monitor, waerter).' };
                        }
                        const rnorm = roleOnly === 'worker' ? 'arbeiter' : roleOnly;
                        const r = setEnvKey('ROLE', rnorm);
                        return r.ok ? { ok: true, message: 'Lokale ROLE in .env gesetzt.' } : { ok: false, message: r.error ?? 'Fehler' };
                    }
                    if (c === '/help') {
                        const helpText = peerMap?.size ? HELP_CHAT : HELP_START;
                        return { ok: true, message: 'Hilfe', helpText };
                    }
                    if (c === '/exit') {
                        setTimeout(() => process.exit(0), 500);
                        return { ok: true, message: 'Programm wird beendet.' };
                    }
                    // Fallback: Zeile wie "sende 1 iota an 0x..." (wurde als cmd übergeben) → /transfer-coins
                    const rawLine = (c + ' ' + (a || []).join(' ')).trim();
                    const iotaSendMatch = rawLine.match(/(?:\/)?(?:sende|schick|überweis)\s+(\d+(?:\.\d+)?)\s*(?:iota|miota|coins?)?\s*(?:an\s+)?(0x[a-fA-F0-9]{64})/i) || rawLine.match(/(\d+(?:\.\d+)?)\s*(?:iota|miota)\s*an\s+(0x[a-fA-F0-9]{64})/i);
                    if (iotaSendMatch) {
                        const iotaStr = iotaSendMatch[1];
                        const toAddr = iotaSendMatch[2];
                        const amountMist = iotaToMist(iotaStr);
                        if (amountMist > 0n && toAddr.startsWith('0x')) {
                            const maxIota = (CFG.MAX_SEND_AMOUNT_IOTA || '').trim();
                            if (maxIota) {
                                const maxMist = iotaToMist(maxIota);
                                if (amountMist > maxMist) return { ok: false, message: `MAX_SEND_AMOUNT_IOTA überschritten (max ${maxIota} IOTA).` };
                            }
                            try {
                                await chainTransferCoins(toAddr, amountMist, MY_ADDR, getWalletPassword());
                                return { ok: true, message: `${iotaStr} IOTA an ${toAddr.slice(0, 18)}… gesendet.` };
                            } catch (e: any) {
                                return { ok: false, message: String(e?.message || e) };
                            }
                        }
                    }
                    if (c === '/connect') {
                        if (sessionState.peerMap?.size) return { ok: true, message: 'Bereits verbunden.' };
                        if (sessionState.connecting) return { ok: false, message: 'Connect läuft bereits.' };
                        const connectAddr = a[0]?.trim().startsWith('0x') ? a[0].trim() : undefined;
                        const addrs = connectAddr ? [connectAddr] : getConnectAddresses().filter((addr) => addr && addr.startsWith('0x'));
                        if (addrs.length === 0) return { ok: false, message: 'Adresse angeben (0x…) oder PARTNER_ADDRESS/KOMMANDANT_ADDRESSES in .env setzen.' };
                        sessionState.connecting = true;
                        (async () => {
                            try {
                                const pm = await runConnectLogic(MY_ADDR, keys!, addrs);
                                sessionState.peerMap = pm;
                                const vp = CFG.VAULT_FILE || '.morgendrot-vault';
                                const pw = getWalletPassword();
                                if (vp && pw && pm.size > 0) {
                                    saveHandshakeCache(vp, pw, pm)
                                        .then(() => syncPeerSessionArchiveFromHandshakeMap(pm))
                                        .catch(() => {});
                                }
                                if (CFG.ENABLE_LISTENER) {
                                    const firstPeer = pm.values().next().value;
                                    if (pm.size === 1 && firstPeer) watchHandshakeUpdates(MY_ADDR, firstPeer);
                                    listenForMessages(MY_ADDR, pm, keys!.privateKey);
                                }
                                setSessionStatus({ connected: true, partnerCount: pm.size, connectedAddresses: Array.from(pm.keys()) });
                                logger.info(`Connect via UI: Kanal zu ${pm.size} Partner(n) etabliert.`);
                            } catch (e: any) {
                                logger.error('Connect via UI fehlgeschlagen: ' + (e?.message || e));
                            } finally {
                                sessionState.connecting = false;
                            }
                        })();
                        return { ok: true, message: 'Connect gestartet. Warte auf Handshake… (Status aktualisiert sich automatisch).' };
                    }
                    return { ok: false, message: 'Unbekannter Befehl. /help' };
                } catch (e: any) {
                    return { ok: false, message: String(e?.message || e) };
                }
    };
}
