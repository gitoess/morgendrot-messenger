/**
 * LOGIK: Messenger-Einstieg — orchestriert die Kammern unter `messenger-nest/` (siehe README dort).
 * ABHÄNGIGKEIT: Säule 1 (MY_ADDRESS, PACKAGE_ID); Säule 2 für /send nach /connect.
 * Befehlsausführung: ein Pfad via createMessengerCommandHandler (API + Terminal).
 */
import './install-webcrypto-node.js';

import { logger } from './logger.js';
import {
    CFG,
    getConfigDisplay,
    getConnectAddresses,
    savePackageIdToFile,
    savePartnerToFile,
    ensureStreamsAnchorIdInHistory,
    seedStreamsAnchorHistoryFromKnownFiles,
    sanitizePackageIdHistoryFile,
    refreshIdentityCfgFromDotenv,
} from './config.js';
import { readPasswordMasked } from './read-password.js';
import { getClient, getVaultFromChain } from './chain-access.js';
import {
    saveVaultLocal,
    loadVaultLocal,
    loadVaultContent,
    sanitizePersonalSecrets,
    vaultFileExists,
    readVaultPackageId,
    readVaultAnchorId,
    loadVaultFromChainPayload,
    saveHandshakeCache,
    writeVaultPackageId,
    writeVaultAnchorId,
    sanitizeVaultNotes,
    vaultNotesToLegacyString,
    type PersonalSecretEntry,
    type VaultNoteEntry,
} from './vault-local.js';
import { generateKeyPair } from './crypto-layer.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { normalizeAddress } from './utils.js';

import {
    setWalletPassword,
    getWalletPassword,
    clearWalletPassword,
    getSessionIotaMnemonic,
} from './messenger-nest/messenger-session-password.js';
import { applySdkSignerFromImport } from './messenger-nest/sdk-signer-import.js';
export { setWalletPassword, getWalletPassword, clearWalletPassword };

export { preFlightCheck, type PreFlightOptions } from './messenger-nest/messenger-preflight.js';
export type { FetchedMessage } from './messenger-nest/messenger-fetch.js';

import { HELP_START, HELP_CHAT, HELP_UI_INTRO } from './messenger-nest/messenger-help.js';

/** Nach fehlgeschlagener Vault-Entschlüsselung (ENABLE_UI): neuer Resolver – kein Terminal-Fallback (readline-sync blockiert auf Windows die Event-Loop → API tot). */
async function awaitWalletPasswordAfterVaultFailureUi(): Promise<string> {
    const { setPasswordResolver } = await import('./api-server.js');
    return await new Promise<string>((resolve) => setPasswordResolver(resolve));
}
export { HELP_START, HELP_CHAT, HELP_UI_INTRO };
import { createMessengerCommandHandler } from './messenger-nest/messenger-command-handler.js';
import { isRebasedStorageEnabled } from './messenger-nest/messenger-fetch.js';
import type { PeerState } from './messenger-nest/peer-state.js';
import { runConnectLogic, watchHandshakeUpdates } from './messenger-nest/messenger-connect.js';
import { listenForMessages } from './messenger-nest/messenger-listener.js';
import {
    purgeMessage,
    sendHandshake,
    sendEncryptedMessage,
    sendPlaintextOnly,
} from './messenger-nest/messenger-chain-wrap.js';

/** Terminal: API-ähnliches Ergebnis ausgeben (eine Quelle wie /api/command). */
function logCommandResultForTerminal(r: Record<string, unknown>) {
    if (!r.ok) {
        logger.warn(String(r.message || 'Fehler'));
        return;
    }
    const msg = r.message;
    if (typeof msg === 'string' && msg && msg !== 'Hilfe') logger.info(msg);
    if (typeof r.helpText === 'string' && r.helpText) console.log(r.helpText);
    const keys = r.keys as Array<{ objectId?: string; lockId?: string; validUntil?: string }> | undefined;
    if (Array.isArray(keys) && keys.length) {
        for (const k of keys) {
            logger.info(`${k.objectId ?? '?'} → ${k.lockId ?? '?'} (bis ${k.validUntil ?? '?'})`);
        }
    }
    const tickets = r.tickets as Array<{ objectId?: string }> | undefined;
    if (Array.isArray(tickets) && tickets.length) {
        for (const t of tickets) logger.info(String(t.objectId ?? '?'));
    }
    const assets = r.assets as Array<{ objectId?: string; name?: string }> | undefined;
    if (Array.isArray(assets) && assets.length) {
        for (const a of assets) logger.info(`${a.objectId ?? '?'} — ${a.name ?? ''}`);
    }
}

async function main() {
    const pkgHistRemoved = sanitizePackageIdHistoryFile();
    if (pkgHistRemoved > 0) {
        console.log(`\x1b[33mPackage-ID-History: ${pkgHistRemoved} ungültige Zeile(n) entfernt (.morgendrot-package-id-history).\x1b[0m`);
    }
    refreshIdentityCfgFromDotenv();

    const display = getConfigDisplay();
    const keyLen = Math.max(...display.map((d) => d.key.length), 12);
    console.log('\n\x1b[36m── Morgendrot Konfiguration (.env) ──\x1b[0m');
    for (const { key, value } of display) {
        console.log(`  \x1b[90m${key.padEnd(keyLen)}\x1b[0m = ${value}`);
    }
    console.log('\x1b[36m─────────────────────────────────────\x1b[0m\n');

    let MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;

    /** Sobald die API läuft, muss der UI-Unlock-Resolver gesetzt sein – sonst schlägt /api/unlock fehl, bis z. B. Mnemonic (SIGNER=sdk) oder anderes im try-Block fertig ist. */
    let uiWalletPasswordPromise: Promise<string> | null = null;

    if (CFG.ENABLE_UI) {
        const { startApiServer, setPasswordResolver } = await import('./api-server.js');
        startApiServer();
        if (CFG.SIGNER !== 'sdk') {
            uiWalletPasswordPromise = new Promise<string>((resolve) => {
                setPasswordResolver(resolve);
            });
        }
    } else {
        logger.info('Headless-Modus: ENABLE_UI=false – API-Server wird nicht gestartet.');
    }

    // Nur echte Schloss-Geräte: ROLE=lock oder Arbeiter mit LOCK_ID. Nicht jeder Arbeiter mit MY_ADDRESS (Messenger/Chat).
    if (CFG.ROLE === 'lock' || (CFG.ROLE === 'arbeiter' && CFG.LOCK_ID)) {
        const { runLockMode } = await import('./m2m-lock.js');
        await runLockMode();
        return;
    }

    if (CFG.ROLE === 'monitor') {
        const { runMonitorMode } = await import('./monitoring.js');
        await runMonitorMode();
        return;
    }

    if (CFG.ENABLE_MONITOR && CFG.MONITOR_DEVICES.length > 0) {
        const { runMonitorMode } = await import('./monitoring.js');
        void runMonitorMode();
    }

    try {
        let rl: readline.Interface | null = null;
        let shuttingDown = false;

        process.once('SIGINT', () => {
            shuttingDown = true;
            logger.info('Beende (Ctrl+C)...');
            try {
                rl?.close();
            } catch {}
            process.exit(0);
        });

        /** Mit ENABLE_UI erfolgt Mnemonic über /api/unlock (Browser), nicht über stdin – sonst blockiert der Prozess, während die UI offen ist. */
        if (CFG.SIGNER === 'sdk' && !CFG.ENABLE_UI) {
            const line = await readPasswordMasked(
                'Mnemonic (12+ Wörter) oder IOTA-Bech32-Secret (generate-mnemonic): '
            ).then((s) => s.trim());
            if (!line) throw new Error('Signer-Import leer.');
            applySdkSignerFromImport(line);
            MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
            logger.info('SDK-Signer geladen. Adresse: ' + MY_ADDR.slice(0, 14) + '…');
        }

        const vaultPathEarly = CFG.VAULT_FILE || '.morgendrot-vault';
        const headlessNeedsVaultPw = vaultFileExists(vaultPathEarly) && !process.env.WALLET_PASSWORD;

        let walletPassword: string;
        if (!CFG.ENABLE_UI && process.env.WALLET_PASSWORD) {
            walletPassword = process.env.WALLET_PASSWORD;
        } else if (!CFG.ENABLE_UI) {
            const maxPw = 5;
            let attempt = 0;
            walletPassword = '';
            while (attempt < maxPw) {
                const prompt =
                    attempt === 0
                        ? 'Wallet-Passwort (Headless): '
                        : `Passwort ungültig (Versuch ${attempt + 1}/${maxPw}) – erneut: `;
                const pw = await readPasswordMasked(prompt);
                walletPassword = pw;
                if (!headlessNeedsVaultPw) break;
                try {
                    await loadVaultLocal(pw, vaultPathEarly);
                    break;
                } catch {
                    attempt++;
                    logger.warn('Vault ließ sich mit diesem Passwort nicht öffnen (meist: falsches Passwort).');
                    if (attempt >= maxPw) {
                        logger.error('Abbruch: Zu viele fehlgeschlagene Passwort-Versuche.');
                        process.exit(1);
                    }
                }
            }
        } else {
            if (!uiWalletPasswordPromise) {
                const { setPasswordResolver } = await import('./api-server.js');
                uiWalletPasswordPromise = new Promise<string>((resolve) => {
                    setPasswordResolver(resolve);
                });
            }
            // ENABLE_UI: nur /api/unlock – kein 120s-Timeout + readline-sync (blockiert auf Windows die Event-Loop → /api/status hängt, Next-Proxy ECONNRESET).
            if ((process.env.WALLET_PASSWORD || '').trim()) {
                walletPassword = (process.env.WALLET_PASSWORD || '').trim();
            } else {
                walletPassword = await uiWalletPasswordPromise;
            }
        }
        setWalletPassword(walletPassword);

        const vaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
        const hasLocalVaultFile = vaultFileExists(vaultPath);
        const useVault = Boolean((CFG.VAULT_FILE || '').trim()) || hasLocalVaultFile;
        type VaultState = {
            keys: { privateKey: CryptoKey; pubRaw: Uint8Array };
            notes: string;
            vaultNotes: VaultNoteEntry[];
            personalSecrets: PersonalSecretEntry[];
        };
        const vaultStateRef: { current: VaultState | null } = { current: null };
        let myKeys: { privateKey: CryptoKey; pubRaw: Uint8Array };
        let usedKeysFromVault = false;
        let vaultBootstrapBypass: 'createNew' | 'signerRecover' | null = null;

        if (hasLocalVaultFile) {
            if (CFG.ENABLE_UI) {
                let pw = walletPassword;
                for (;;) {
                    setWalletPassword(pw);
                    walletPassword = pw;
                    const { consumeVaultUnlockBypass } = await import('./api-server.js');
                    const bypass = consumeVaultUnlockBypass();
                    if (bypass === 'createNew' || bypass === 'signerRecover') {
                        vaultBootstrapBypass = bypass;
                        myKeys = await generateKeyPair(true);
                        vaultStateRef.current = {
                            keys: myKeys,
                            notes: '',
                            vaultNotes: [],
                            personalSecrets: [],
                        };
                        logger.info(
                            bypass === 'signerRecover'
                                ? 'Vault-Datei umgangen — Messaging-Tresor nach Seed-Wiederherstellung neu erzeugt.'
                                : 'Vault-Datei umgangen — neues Profil mit frischen Messaging-Keys.'
                        );
                        break;
                    }
                    try {
                        const vaultBlob = await loadVaultContent(pw, vaultPath);
                        myKeys = vaultBlob.keys;
                        vaultStateRef.current = {
                            keys: myKeys,
                            notes: vaultBlob.notes ?? '',
                            vaultNotes: vaultBlob.vaultNotes,
                            personalSecrets: vaultBlob.personalSecrets ?? [],
                        };
                        if (CFG.SIGNER === 'sdk' && (vaultBlob.iotaSdkSignerImport || '').trim()) {
                            applySdkSignerFromImport(vaultBlob.iotaSdkSignerImport!);
                            MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
                            logger.info('SDK-Signer aus Vault-Import geladen. Adresse: ' + MY_ADDR.slice(0, 14) + '…');
                        }
                        break;
                    } catch (e) {
                        const msg = String((e as Error)?.message || e || '');
                        logger.warn(
                            'Vault-Entschlüsselung fehlgeschlagen: ' +
                                (msg || 'unbekannter Fehler') +
                                '. API bleibt gesperrt – erneut /api/unlock (oder nach Timeout CLI).'
                        );
                        clearWalletPassword();
                        pw = await awaitWalletPasswordAfterVaultFailureUi();
                    }
                }
            } else {
                try {
                    const vaultBlob = await loadVaultContent(walletPassword, vaultPath);
                    myKeys = vaultBlob.keys;
                    vaultStateRef.current = {
                        keys: myKeys,
                        notes: vaultBlob.notes ?? '',
                        vaultNotes: vaultBlob.vaultNotes,
                        personalSecrets: vaultBlob.personalSecrets ?? [],
                    };
                    if (CFG.SIGNER === 'sdk' && (vaultBlob.iotaSdkSignerImport || '').trim()) {
                        applySdkSignerFromImport(vaultBlob.iotaSdkSignerImport!);
                        MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
                        logger.info('SDK-Signer aus Vault-Import geladen. Adresse: ' + MY_ADDR.slice(0, 14) + '…');
                    }
                } catch (e) {
                    const msg = String((e as Error)?.message || e || '');
                    logger.error(
                        'Vault-Entschlüsselung fehlgeschlagen: ' +
                            (msg || 'unbekannter Fehler') +
                            '. Bei Headless: WALLET_PASSWORD in .env prüfen oder interaktiv starten.'
                    );
                    process.exit(1);
                }
            }
            if (!vaultBootstrapBypass) {
                usedKeysFromVault = true;
                logger.info('Keys aus lokalem Vault geladen.');
                seedStreamsAnchorHistoryFromKnownFiles();
                const vaultPkg = readVaultPackageId(vaultPath);
                if (vaultPkg && CFG.PACKAGE_ID && normalizeAddress(vaultPkg) !== normalizeAddress(CFG.PACKAGE_ID)) {
                    logger.warn(
                        `Vault wurde mit Package ${vaultPkg.slice(0, 18)}… gespeichert; aktuelle PACKAGE_ID weicht ab. Entschlüsselung kann fehlschlagen – gleiche Package-ID setzen oder neuen Handshake.`
                    );
                }
                const vaultAnchor = await readVaultAnchorId(vaultPath, walletPassword);
                if (vaultAnchor && !CFG.STREAMS_ANCHOR_ID) {
                    (CFG as { STREAMS_ANCHOR_ID: string }).STREAMS_ANCHOR_ID = vaultAnchor;
                    process.env.STREAMS_ANCHOR_ID = vaultAnchor;
                    ensureStreamsAnchorIdInHistory(vaultAnchor);
                    logger.info('Streams Anchor-ID aus Vault wiederhergestellt: ' + vaultAnchor.slice(0, 16) + '…');
                }
            }
        } else if (CFG.VAULT_REGISTRY_ID && CFG.PACKAGE_ID) {
            const enc = await getVaultFromChain(getClient(), CFG.VAULT_REGISTRY_ID, CFG.PACKAGE_ID, MY_ADDR);
            if (enc && enc.length > 0) {
                if (CFG.ENABLE_UI) {
                    let pw = walletPassword;
                    for (;;) {
                        setWalletPassword(pw);
                        walletPassword = pw;
                        try {
                            const content = await loadVaultFromChainPayload(enc, pw);
                            myKeys = content.keys;
                            vaultStateRef.current = {
                                keys: content.keys,
                                notes: content.notes,
                                vaultNotes: content.vaultNotes,
                                personalSecrets: content.personalSecrets ?? [],
                            };
                            if (CFG.SIGNER === 'sdk' && (content.iotaSdkSignerImport || '').trim()) {
                                applySdkSignerFromImport(content.iotaSdkSignerImport!);
                                MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
                                logger.info('SDK-Signer aus On-Chain-Vault-Import. Adresse: ' + MY_ADDR.slice(0, 14) + '…');
                            }
                            break;
                        } catch (e) {
                            const msg = String((e as Error)?.message || e || '');
                            logger.warn(
                                'On-Chain-Vault-Entschlüsselung fehlgeschlagen: ' +
                                    (msg || 'unbekannter Fehler') +
                                    '. API bleibt gesperrt – erneut /api/unlock (oder nach Timeout CLI).'
                            );
                            clearWalletPassword();
                            pw = await awaitWalletPasswordAfterVaultFailureUi();
                        }
                    }
                } else {
                    try {
                        const content = await loadVaultFromChainPayload(enc, walletPassword);
                        myKeys = content.keys;
                        vaultStateRef.current = {
                            keys: content.keys,
                            notes: content.notes,
                            vaultNotes: content.vaultNotes,
                            personalSecrets: content.personalSecrets ?? [],
                        };
                        if (CFG.SIGNER === 'sdk' && (content.iotaSdkSignerImport || '').trim()) {
                            applySdkSignerFromImport(content.iotaSdkSignerImport!);
                            MY_ADDR = process.env.MY_ADDRESS || CFG.MY_ADDRESS;
                            logger.info('SDK-Signer aus On-Chain-Vault-Import. Adresse: ' + MY_ADDR.slice(0, 14) + '…');
                        }
                    } catch (e) {
                        const msg = String((e as Error)?.message || e || '');
                        logger.error(
                            'On-Chain-Vault-Entschlüsselung fehlgeschlagen: ' +
                                (msg || 'unbekannter Fehler') +
                                '. Bei Headless: WALLET_PASSWORD in .env prüfen.'
                        );
                        process.exit(1);
                    }
                }
                usedKeysFromVault = true;
                logger.info('Keys aus On-Chain-Vault geladen (kein lokales VAULT_FILE).');
            } else {
                myKeys = await generateKeyPair(true);
                vaultStateRef.current = { keys: myKeys, notes: '', vaultNotes: [], personalSecrets: [] };
            }
        } else {
            myKeys = await generateKeyPair(true);
            vaultStateRef.current = { keys: myKeys, notes: '', vaultNotes: [], personalSecrets: [] };
        }

        if (!CFG.PACKAGE_ID) {
            logger.warn('PACKAGE_ID fehlt. Befehl: /set-package-id 0x... oder in .env / .morgendrot-package-id eintragen.');
        }

        if (CFG.SETTLEMENT_QUEUE_ENABLED) {
            const { startSettlementWorker } = await import('./settlement-queue.js');
            startSettlementWorker();
        }

        const sessionState = { peerMap: null as Map<string, PeerState> | null, connecting: false };
        const getMyAddress = () => process.env.MY_ADDRESS || CFG.MY_ADDRESS;

        const {
            setCommandHandler,
            setSessionStatus,
            setPurgeAfterLieferungHandler,
            setVaultPersonalSecretsBridge,
            setVaultNotesBridge,
        } = await import('./api-server.js');
        const { appendAuditEvent } = await import('./audit-log.js');
        const { tryRestoreHandshakeSessionFromVault } = await import('./messenger-nest/messenger-connect.js');
        setSessionStatus({ connected: false, hasKeys: true, connectedAddresses: [] });
        if (vaultStateRef.current?.keys && walletPassword) {
            const n = await tryRestoreHandshakeSessionFromVault(
                vaultPath,
                walletPassword,
                getMyAddress(),
                vaultStateRef.current.keys.privateKey,
                sessionState,
                setSessionStatus
            );
            if (n > 0) logger.info(`API-Start: ${n} Partner aus Handshake-Cache (§ H.23-Ratchet: später eigenes State-Layout).`);
        }
        if (isRebasedStorageEnabled() && CFG.ENABLE_PURGE) {
            setPurgeAfterLieferungHandler(async (purges) => {
                let count = 0;
                const addr = getMyAddress();
                for (const p of purges) {
                    const recipient = (p.recipient || addr || '').trim();
                    const sender = (p.sender || '').trim();
                    const nonce = BigInt(String(p.nonce ?? 0));
                    if (!recipient || !sender || !sender.startsWith('0x')) continue;
                    await purgeMessage(recipient, sender, nonce);
                    appendAuditEvent({
                        type: 'purge',
                        device: sender.slice(0, 14),
                        message: `Purge ${recipient.slice(0, 8)}… ← ${sender.slice(0, 8)}… nonce=${nonce}`,
                    });
                    count++;
                }
                return { ok: true, message: `${count} Nachricht(en) gepurged.`, count };
            });
        }
        const messengerCommandHandler = createMessengerCommandHandler({
            getMyAddress,
            vaultStateRef,
            sessionState,
            useVault,
            vaultPath,
            setSessionStatus,
        });
        setCommandHandler(messengerCommandHandler);

        if (vaultBootstrapBypass && CFG.SIGNER === 'sdk') {
            const phrase = (getSessionIotaMnemonic() || '').trim();
            if (phrase && vaultStateRef.current?.keys) {
                try {
                    await saveVaultLocal(
                        vaultStateRef.current.keys,
                        walletPassword,
                        vaultPath,
                        '',
                        phrase,
                        [],
                        []
                    );
                    if (CFG.PACKAGE_ID) writeVaultPackageId(vaultPath, CFG.PACKAGE_ID);
                    logger.info(
                        vaultBootstrapBypass === 'signerRecover'
                            ? 'Vault mit Seed neu verschlüsselt — beim nächsten Start reicht das neue Passwort unter „Tresor öffnen“.'
                            : 'Neuer Vault mit Seed gespeichert.'
                    );
                } catch (e) {
                    logger.warn(
                        'Vault-Neuspeichern nach Profil-Anlage fehlgeschlagen: ' +
                            String((e as Error)?.message || e)
                    );
                }
            }
        }

        setVaultPersonalSecretsBridge({
            getEntries: () =>
                vaultStateRef.current?.keys ? (vaultStateRef.current.personalSecrets ?? []) : null,
            setEntries: async (entries, opts) => {
                if (!vaultStateRef.current?.keys) {
                    return { ok: false, error: 'Tresor gesperrt (keine Keys im RAM).' };
                }
                const sanitized = sanitizePersonalSecrets(entries);
                vaultStateRef.current = {
                    keys: vaultStateRef.current.keys,
                    notes: vaultStateRef.current.notes,
                    vaultNotes: vaultStateRef.current.vaultNotes,
                    personalSecrets: sanitized,
                };
                if (opts?.persistLocal) {
                    const pw = getWalletPassword();
                    if (!pw) return { ok: false, error: 'Kein Wallet-Passwort – zuerst entsperren.' };
                    const savePath = CFG.VAULT_FILE || '.morgendrot-vault';
                    try {
                        await saveVaultLocal(
                            vaultStateRef.current.keys,
                            pw,
                            savePath,
                            vaultStateRef.current.notes,
                            undefined,
                            sanitized,
                            vaultStateRef.current.vaultNotes
                        );
                        if (CFG.PACKAGE_ID) writeVaultPackageId(savePath, CFG.PACKAGE_ID);
                        if (CFG.STREAMS_ANCHOR_ID) await writeVaultAnchorId(savePath, CFG.STREAMS_ANCHOR_ID, pw);
                        return { ok: true, message: 'Mein Safe in Vault-Datei gespeichert.' };
                    } catch (e) {
                        return { ok: false, error: String((e as Error)?.message ?? e) };
                    }
                }
                return { ok: true, message: 'Safe nur im RAM aktualisiert.' };
            },
        });

        setVaultNotesBridge({
            getNotes: () =>
                vaultStateRef.current?.keys ? (vaultStateRef.current.vaultNotes ?? []) : null,
            setNotes: async (notes, opts) => {
                if (!vaultStateRef.current?.keys) {
                    return { ok: false, error: 'Tresor gesperrt (keine Keys im RAM).' };
                }
                const sanitized = sanitizeVaultNotes(notes);
                const legacyNotes = vaultNotesToLegacyString(sanitized);
                vaultStateRef.current = {
                    keys: vaultStateRef.current.keys,
                    notes: legacyNotes,
                    vaultNotes: sanitized,
                    personalSecrets: vaultStateRef.current.personalSecrets ?? [],
                };
                if (opts?.persistLocal) {
                    const pw = getWalletPassword();
                    if (!pw) return { ok: false, error: 'Kein Wallet-Passwort – zuerst entsperren.' };
                    const savePath = CFG.VAULT_FILE || '.morgendrot-vault';
                    try {
                        await saveVaultLocal(
                            vaultStateRef.current.keys,
                            pw,
                            savePath,
                            legacyNotes,
                            undefined,
                            vaultStateRef.current.personalSecrets ?? [],
                            sanitized
                        );
                        if (CFG.PACKAGE_ID) writeVaultPackageId(savePath, CFG.PACKAGE_ID);
                        if (CFG.STREAMS_ANCHOR_ID) await writeVaultAnchorId(savePath, CFG.STREAMS_ANCHOR_ID, pw);
                        return { ok: true, message: 'Notizen in Vault-Datei gespeichert.' };
                    } catch (e) {
                        return { ok: false, error: String((e as Error)?.message ?? e) };
                    }
                }
                return { ok: true, message: 'Notizen nur im RAM aktualisiert.' };
            },
        });

        /** Wie innerer Chat-Loop: /-Befehle an denselben Handler wie /api/command (vor /connect nötig z. B. für /vault-load). */
        async function dispatchSlashLine(msgTrim: string): Promise<'exit' | 'handled' | 'not-slash'> {
            if (!msgTrim.startsWith('/')) return 'not-slash';
            const parts = msgTrim.split(/\s+/);
            const c0 = parts[0] ?? '';
            let c = c0.startsWith('/') ? c0.toLowerCase() : '/' + c0.toLowerCase();
            let a = parts.slice(1);
            if (c === '/inbox' && a.length === 0) a = ['20'];
            const r = await messengerCommandHandler(c, a, {});
            logCommandResultForTerminal(r as Record<string, unknown>);
            if (vaultStateRef.current?.keys) myKeys = vaultStateRef.current.keys;
            if (c === '/exit') return 'exit';
            return 'handled';
        }

        rl = readline.createInterface({ input, output });
        if (CFG.ENABLE_CHAIN_ANCHOR && MY_ADDR) {
            const { startAnchorLoop } = await import('./chain-anchor.js');
            startAnchorLoop(MY_ADDR, getWalletPassword());
        }
        if (CFG.ROLE === 'boss' && CFG.GAS_STATION_ENABLED && CFG.WORKER_ADDRESSES.length > 0) {
            const { runGasStationCheck } = await import('./gas-station.js');
            let gasStationRunning = false;
            setInterval(async () => {
                if (gasStationRunning) return;
                gasStationRunning = true;
                try {
                    await runGasStationCheck(MY_ADDR!, getWalletPassword);
                } catch (e) {
                    logger.warn('Gas Station: ' + (e as Error)?.message);
                } finally {
                    gasStationRunning = false;
                }
            }, CFG.GAS_STATION_CHECK_MS);
            logger.info('Gas Station: Prüfung alle ' + Math.round(CFG.GAS_STATION_CHECK_MS / 1000) + ' s');
        }
        console.log(HELP_START);

        while (true) {
            let line: string;
            try {
                line = await rl.question('> ');
            } catch (e: any) {
                if (shuttingDown || String(e?.message || '').includes('Aborted with Ctrl+C')) break;
                throw e;
            }
            const trimmed = line.trim();
            if (!trimmed) continue;

            const sendHandshakeMatch = trimmed.match(/send\s+handshake\s+to\s+(0x[a-fA-F0-9]+)/i);
            const handshakeAddr = sendHandshakeMatch?.[1];

            const isHandshakeCmd = trimmed.startsWith('/handshake');
            const isConnectCmd = trimmed.startsWith('/connect');
            const isSetPkg = trimmed.startsWith('/set-package-id');
            const isExit = trimmed === '/exit' || trimmed.toLowerCase() === 'exit';
            const isHelp = trimmed === '/help';

            if (isExit) break;
            if (isHelp) {
                console.log(HELP_START);
                continue;
            }

            const isSendPlain = trimmed.startsWith('/send-plain');
            if (isSendPlain) {
                const rest = trimmed.replace(/^\/send-plain\s+/i, '').trim();
                const firstToken = rest.split(/\s+/)[0] ?? '';
                const addrs = firstToken.split(',').map((s) => s.trim()).filter((s) => /^0x[a-fA-F0-9]{64}$/.test(s));
                const text = firstToken.length < rest.length ? rest.slice(firstToken.length).trim() : '(leer)';
                if (addrs.length === 0) {
                    logger.warn(
                        'Verwendung: /send-plain 0x... [, 0x...] <Text> (eine oder mehrere Adressen, Komma-getrennt, danach Text). Kein Handshake nötig.'
                    );
                    continue;
                }
                try {
                    // CLI /send-plain: bewusst Legacy-Event-Pfad (schnell); UI/API nutzt messagingPersistenceMode.
                    for (const addr of addrs) await sendPlaintextOnly(addr, text, { forceLegacyPlaintext: true });
                    logger.info(
                        addrs.length > 1
                            ? `Klartext an ${addrs.length} Empfänger gesendet.`
                            : `Klartext an ${addrs[0].slice(0, 12)}… gesendet. Im Explorer als PlaintextMessage sichtbar.`
                    );
                } catch (e: any) {
                    logger.error('Klartext senden fehlgeschlagen: ' + (e?.message || e));
                }
                continue;
            }

            if (isSetPkg) {
                const id = trimmed.replace(/^\/set-package-id\s*/i, '').trim();
                if (id) {
                    (CFG as { PACKAGE_ID: string }).PACKAGE_ID = id;
                    savePackageIdToFile(id);
                    logger.info('PACKAGE_ID gesetzt und in .morgendrot-package-id gespeichert.');
                } else logger.warn('Verwendung: /set-package-id 0x...');
                continue;
            }

            if (isHandshakeCmd || handshakeAddr) {
                const addr = handshakeAddr ?? trimmed.replace(/^\/handshake\s*/i, '').trim();
                if (!addr || !addr.startsWith('0x')) {
                    logger.warn('Verwendung: /handshake 0x... oder "send handshake to 0x..."');
                    continue;
                }
                try {
                    const k = vaultStateRef.current?.keys ?? myKeys;
                    await sendHandshake(addr, k.pubRaw);
                    savePartnerToFile(addr);
                    logger.info(`Handshake an ${addr} gesendet. (Partner in .morgendrot-partner gespeichert.)`);
                } catch (e: any) {
                    logger.error('Handshake senden fehlgeschlagen: ' + (e?.message || e));
                }
                continue;
            }

            if (isConnectCmd) {
                const connectArg = trimmed.replace(/^\/connect\s*/i, '').trim();
                const addrs =
                    connectArg && connectArg.startsWith('0x')
                        ? [connectArg]
                        : getConnectAddresses().filter((a) => a && a.startsWith('0x'));
                if (addrs.length === 0) {
                    logger.warn(
                        'Verwendung: /connect 0x... oder PARTNER_ADDRESSES/KOMMANDANT_ADDRESSES/WORKER_ADDRESSES in .env setzen.'
                    );
                    continue;
                }
                const k = vaultStateRef.current?.keys ?? myKeys;
                const peerMap = await runConnectLogic(MY_ADDR, k, addrs);
                console.log(`\n\x1b[36mKanal zu ${peerMap.size} Partner(n) etabliert!\x1b[0m`);
                const firstPeer = peerMap.values().next().value;
                if (firstPeer && normalizeAddress(firstPeer.address) === normalizeAddress(MY_ADDR)) {
                    logger.warn(
                        '\x1b[33mMY_ADDRESS ist gleich der Partner-Adresse! (z. B. gleiche .env auf zwei Instanzen.) Deine gesendeten Nachrichten erscheinen als sender=recipient; die andere Seite erhält sie nicht. Setze MY_ADDRESS in .env auf DEINE eigene Adresse.\x1b[0m'
                    );
                }

                if (useVault && !usedKeysFromVault) {
                    const saveYes = await rl.question('Keys in lokalen Vault speichern? (j/n): ');
                    if (saveYes.trim().toLowerCase() === 'j') {
                        await saveVaultLocal(
                            k,
                            getWalletPassword() || walletPassword,
                            vaultPath,
                            vaultStateRef.current?.notes ?? '',
                            undefined,
                            vaultStateRef.current?.personalSecrets ?? [],
                            vaultStateRef.current?.vaultNotes ?? []
                        );
                        if (CFG.PACKAGE_ID) writeVaultPackageId(vaultPath, CFG.PACKAGE_ID);
                        logger.info(`Vault gespeichert unter ${vaultPath}.`);
                    }
                }

                if (CFG.ENABLE_LISTENER) {
                    const fp = peerMap.values().next().value;
                    if (peerMap.size === 1 && fp) watchHandshakeUpdates(MY_ADDR, fp);
                    listenForMessages(MY_ADDR, peerMap, k.privateKey);
                } else {
                    logger.info('Listener aus (ENABLE_LISTENER=false). Keine eingehenden Nachrichten.');
                }
                console.log('--- CHAT BEREIT ---');
                console.log(HELP_CHAT);

                sessionState.peerMap = peerMap;
                const { setSessionStatus } = await import('./api-server.js');
                setSessionStatus({ connected: true, partnerCount: peerMap.size, connectedAddresses: Array.from(peerMap.keys()) });

                while (true) {
                    let message: string;
                    try {
                        message = await rl.question('> ');
                    } catch (e: any) {
                        if (shuttingDown || String(e?.message || '').includes('Aborted with Ctrl+C')) break;
                        throw e;
                    }
                    const msgTrim = message.trim();
                    if (!msgTrim) continue;
                    if (msgTrim.toLowerCase() === 'exit' || msgTrim === '/exit') break;

                    if (CFG.ENABLE_FETCH_COMMAND) {
                        const fetchMatch =
                            msgTrim.match(/^\/fetch\s+(\d+)(?:\s+(0x[a-fA-F0-9]+))?$/i) ??
                            msgTrim.match(/^hole\s+letzten\s+(\d+)(?:\s+nachrichten?)?$/i);
                        if (fetchMatch) {
                            const n = Math.min(100, Math.max(1, parseInt(fetchMatch[1], 10) || 10));
                            const senderArg = fetchMatch[2];
                            const args = senderArg ? [String(n), senderArg] : [String(n)];
                            const r = await messengerCommandHandler('/fetch', args, {});
                            logCommandResultForTerminal(r as Record<string, unknown>);
                            if (vaultStateRef.current?.keys) myKeys = vaultStateRef.current.keys;
                            continue;
                        }
                    }

                    if (msgTrim.startsWith('/')) {
                        const parts = msgTrim.split(/\s+/);
                        const c0 = parts[0] ?? '';
                        let c = c0.startsWith('/') ? c0.toLowerCase() : '/' + c0.toLowerCase();
                        let a = parts.slice(1);
                        if (c === '/inbox' && a.length === 0) a = ['20'];
                        const r = await messengerCommandHandler(c, a, {});
                        logCommandResultForTerminal(r as Record<string, unknown>);
                        if (vaultStateRef.current?.keys) myKeys = vaultStateRef.current.keys;
                        if (c === '/exit') break;
                        continue;
                    }

                    try {
                        const kSend = vaultStateRef.current?.keys ?? myKeys;
                        for (const p of peerMap.values()) {
                            await sendEncryptedMessage(p.address, message, p.pubKeyRaw, kSend.privateKey);
                        }
                        if (peerMap.size > 1) logger.info(`An ${peerMap.size} Partner gesendet.`);
                    } catch (e: any) {
                        logger.error('Senden fehlgeschlagen: ' + (e?.message || e));
                    }
                }
                sessionState.peerMap = null;
                const { setSessionStatus: ss } = await import('./api-server.js');
                ss({ connected: false, hasKeys: true, connectedAddresses: [] });
                try {
                    rl?.close();
                } catch {}
                process.exit(0);
            }

            const outerSlash = await dispatchSlashLine(trimmed);
            if (outerSlash === 'exit') break;
            if (outerSlash === 'handled') continue;

            logger.warn('Unbekannter Befehl. /help');
        }
        try {
            rl?.close();
        } catch {}
        process.exit(0);
    } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes('Aborted with Ctrl+C')) {
            logger.info('Beendet.');
            process.exit(0);
        }
        logger.error('Fehler in main: ' + msg);
    }
}

main().catch((err) => console.error('Fataler Fehler beim Start:', err));
