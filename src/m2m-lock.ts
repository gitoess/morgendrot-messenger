/**
 * M2M Lock (Application Layer): Tür/Schloss – hört auf verschlüsselte Befehle,
 * prüft AccessKey-NFT des Senders, führt "open" aus.
 * Nutzt: Crypto Layer, Chain Access (hasValidAccessKey), Messaging (Discovery + Listener).
 * Replay-Schutz: persistente Nonce pro Sender (REPLAY_STATE_FILE).
 * Hardware: OPEN_COMMAND / OPEN_URL bei Öffnung.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';
import { CFG, getEffectiveAuthorizedSenders } from './config.js';
import { getClient, hasValidAccessKey, isChainReachable, getVaultFromChain, getOpenWordsFromChain, queryIncomingPayments, minIotaToMist, mistToDisplayIota } from './chain-access.js';
import { loadVaultLocal, loadVaultFromChainPayload, vaultFileExists, readVaultPackageId } from './vault-local.js';
import { readPasswordMasked } from './read-password.js';
import { loadReplayState, saveReplayState, acceptAndUpdate, type ReplayState } from './replay-state.js';
import { generateKeyPair, deriveSharedSecret, deriveAesGcmKey, decryptMessage } from './crypto-layer.js';
import { loadOpenWordsFromFile } from './read-command-list.js';
import { getStreamsAdapter } from './streams-adapter.js';
import { normalizeAddress, toEventBytes } from './utils.js';
import { startHeartbeatLoop } from './monitoring.js';
const client = getClient();

function senderAllowed(sender: string): boolean {
    const authorized = getEffectiveAuthorizedSenders();
    if (authorized.length === 0) return true;
    const n = normalizeAddress(sender);
    return authorized.some((a) => normalizeAddress(a) === n);
}

/** Prüft, ob Sender für Broadcast-Pinnwand autorisiert ist. */
function broadcastSenderAllowed(sender: string): boolean {
    if (CFG.BROADCAST_AUTHORIZED_SENDERS.length === 0) return false;
    const n = normalizeAddress(sender);
    return CFG.BROADCAST_AUTHORIZED_SENDERS.some((a) => normalizeAddress(a) === n);
}

/** AccessKey-Cache für Offline-OPEN: sender -> validUntil (ms). */
const accessKeyCache = new Map<string, number>();

/** Prüft AccessKey on-chain; bei Erfolg wird gecacht. Bei Offline + OFFLINE_OPEN_ENABLED: Cache nutzen. */
async function hasValidAccessKeyOrCached(sender: string, lockAddress: string): Promise<boolean> {
    const online = await isChainReachable();
    if (online) {
        const valid = await hasValidAccessKey(client, CFG.PACKAGE_ID, sender, lockAddress);
        if (valid && CFG.OFFLINE_OPEN_ENABLED) {
            accessKeyCache.set(normalizeAddress(sender), Date.now() + CFG.OFFLINE_CACHE_TTL_MS);
        }
        return valid;
    }
    if (!CFG.OFFLINE_OPEN_ENABLED) return false;
    const now = Date.now();
    const validUntil = accessKeyCache.get(normalizeAddress(sender));
    if (validUntil == null || now > validUntil) return false;
    return true;
}

type PeerInfo = { pubKeyRaw: Uint8Array; nonce: bigint };

/** Sammelt alle Handshakes, die an lockAddress gerichtet sind (von beliebigen Sendern). */
async function collectHandshakesToLock(lockAddress: string): Promise<Map<string, PeerInfo>> {
    const map = new Map<string, PeerInfo>();
    try {
        const events = await client.queryEvents({
            query: { MoveModule: { package: CFG.PACKAGE_ID, module: 'messaging' } },
            limit: 100,
            order: 'descending',
        });
        for (const e of events.data as Array<{ type?: string; parsedJson?: { sender?: string; recipient?: string; pub_key?: number[]; nonce?: number } }>) {
            if (!e.type?.endsWith('::messaging::EcdhInit')) continue;
            const d = e.parsedJson;
            if (normalizeAddress(d?.recipient) !== normalizeAddress(lockAddress) || !d?.sender) continue;
            if (map.has(d.sender)) continue; // neueste zuerst, ältere überspringen
            map.set(d.sender, {
                pubKeyRaw: new Uint8Array(d.pub_key ?? []),
                nonce: BigInt(d.nonce ?? 0),
            });
        }
    } catch (err) {
        logger.warn('collectHandshakesToLock: ' + (err as Error)?.message);
    }
    return map;
}

/** Sendet Status/Bestätigung auf Streams-Kanal (letzte Meile). Nutzt konfigurierten Adapter (Stub oder Bridge). */
function publishOpenViaStreams(sender: string): void {
    if (!CFG.OPEN_STREAMS_ENABLED || !CFG.STREAMS_ANCHOR_ID) return;
    const payload = JSON.stringify({ status: 'OPEN_GRANTED', sender: sender.slice(0, 12) + '…', ts: Date.now() });
    getStreamsAdapter().publish(CFG.STREAMS_ANCHOR_ID, payload).catch((e) => logger.warn('Streams publish: ' + (e as Error)?.message));
}

/**
 * Führt Hardware-Aktion aus: OPEN_COMMAND (spawn), OPEN_URL (GET), optional Streams (letzte Meile).
 * Siehe docs/STREAMS-INTEGRATION.md. Kein shell=true → kein Command-Injection.
 */
function executeOpenAction(sender: string): void {
    if (!CFG.ENABLE_HARDWARE_OPEN) return;
    if (CFG.OPEN_COMMAND) {
        const parts = CFG.OPEN_COMMAND.trim().split(/\s+/).filter(Boolean);
        const [cmd, ...args] = parts;
        if (cmd) {
            const child = spawn(cmd, args, { stdio: 'ignore', shell: false, env: { ...process.env, OPEN_SENDER: sender } });
            child.on('error', (e) => logger.warn('OPEN_COMMAND Fehler: ' + (e as Error)?.message));
            child.on('exit', (code) => { if (code !== 0) logger.warn('OPEN_COMMAND exit code: ' + code); });
        }
    }
    if (CFG.OPEN_URL) {
        fetch(CFG.OPEN_URL, { method: 'GET' }).catch((e) => logger.warn('OPEN_URL Fehler: ' + (e as Error)?.message));
    }
    publishOpenViaStreams(sender);
}

function loadProcessedPaymentDigests(statePath: string): Set<string> {
    if (!statePath) return new Set();
    try {
        const s = fs.readFileSync(statePath, 'utf-8');
        return new Set(s.split('\n').map((d) => d.trim()).filter(Boolean));
    } catch {
        return new Set();
    }
}

function saveProcessedPaymentDigest(statePath: string, digest: string): void {
    if (!statePath || !digest) return;
    try {
        fs.appendFileSync(statePath, digest + '\n', 'utf-8');
        try { fs.chmodSync(statePath, 0o600); } catch {} // Nur Eigentümer lesbar/schreibbar (Unix)
    } catch (e) {
        logger.warn('Payment-Trigger: State-Datei nicht schreibbar: ' + (e as Error)?.message);
    }
}

/** Polling-Loop: Eingehende Zahlungen an lockAddress prüfen; bei Betrag >= MIN (ggf. + Memo-Code) → OPEN. */
async function runPaymentTriggerLoop(lockAddress: string): Promise<void> {
    const minMist = minIotaToMist(CFG.PAYMENT_TRIGGER_MIN_IOTA);
    const requireMemo = CFG.PAYMENT_TRIGGER_REQUIRE_MEMO?.trim() || '';
    const statePath = CFG.PAYMENT_TRIGGER_STATE_FILE || '';
    const processed = loadProcessedPaymentDigests(statePath);
    if (statePath) logger.info('Zahlungs-Trigger: State aus ' + statePath + ' geladen (' + processed.size + ' Digests).');
    if (requireMemo) logger.info('Zahlungs-Trigger: Memo muss enthalten: "' + requireMemo + '"');

    while (true) {
        try {
            const list = await queryIncomingPayments(client, lockAddress, 20);
            for (const { digest, amountMist, memo } of list) {
                if (processed.has(digest)) continue;
                if (BigInt(amountMist) < minMist) continue;
                if (requireMemo && (!memo || !memo.includes(requireMemo))) continue;
                logger.info(`\x1b[32mZahlungs-Trigger: ${mistToDisplayIota(amountMist)} IOTA an Lock – führe OPEN aus (TX ${digest.slice(0, 12)}…).\x1b[0m`);
                executeOpenAction('payment:' + digest);
                processed.add(digest);
                saveProcessedPaymentDigest(statePath, digest);
            }
        } catch (e) {
            logger.warn('Payment-Trigger: ' + (e as Error)?.message);
        }
        await new Promise((r) => setTimeout(r, CFG.PAYMENT_TRIGGER_POLL_MS));
    }
}

/** Offline-Queue: Liest lokale Datei (eine JSON-Zeile pro Befehl). Format: {"sender":"0x...","cmd":"open","nonce":123}. */
async function runOfflineQueueLoop(
    queuePath: string,
    lockAddress: string,
    openWords: string[],
    replayStatePath: string
): Promise<void> {
    let state = replayStatePath ? await loadReplayState(replayStatePath) : {};
    while (true) {
        try {
            const content = fs.readFileSync(queuePath, 'utf-8');
            const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
            for (const line of lines) {
                try {
                    const obj = JSON.parse(line) as { sender?: string; cmd?: string; nonce?: number };
                    const sender = obj?.sender;
                    const cmd = (obj?.cmd ?? '').trim().toLowerCase();
                    const nonce = BigInt(obj?.nonce ?? 0);
                    if (!sender || !cmd) continue;
                    if (openWords.length > 0 && !openWords.includes(cmd)) continue;
                    const { accepted, newState } = acceptAndUpdate(state, sender, nonce);
                    if (!accepted) continue;
                    state = newState;
                    if (replayStatePath) await saveReplayState(replayStatePath, state);
                    if (!CFG.ENABLE_AUTO_EXECUTE) continue;
                    if (!senderAllowed(sender)) continue;
                    const valid = await hasValidAccessKeyOrCached(sender, lockAddress);
                    if (valid) {
                        logger.info(`\x1b[32mOPEN GRANTED [Offline-Queue] – Sender ${sender.slice(0, 10)}….\x1b[0m`);
                        executeOpenAction(sender);
                    }
                } catch {
                    // einzelne Zeile ungültig
                }
            }
        } catch {
            // Datei nicht lesbar
        }
        await new Promise((r) => setTimeout(r, 3000));
    }
}

/** Streams-Listener: Empfängt Nachrichten über konfigurierten Adapter (Bridge oder Stub). */
function runStreamsListenLoop(
    lockAddress: string,
    openWords: string[],
    replayStatePath: string
): void {
    if (!CFG.STREAMS_LISTEN_ENABLED || !CFG.STREAMS_ANCHOR_ID) return;
    let state: ReplayState = {};
    let processNext = Promise.resolve<void>(undefined);
    (async () => {
        if (replayStatePath) state = await loadReplayState(replayStatePath);
        getStreamsAdapter().startListening(CFG.STREAMS_ANCHOR_ID, (msg) => {
            processNext = processNext.then(async () => {
                const sender = msg.sender ?? '';
                const cmd = (msg.payload ?? '').trim().toLowerCase();
                const nonce = BigInt(msg.nonce ?? msg.ts ?? Date.now());
                if (!sender) return;
                if (openWords.length > 0 && !openWords.includes(cmd)) return;
                const { accepted, newState } = acceptAndUpdate(state, sender, nonce);
                if (!accepted) return;
                state = newState;
                if (replayStatePath) await saveReplayState(replayStatePath, state);
                if (!CFG.ENABLE_AUTO_EXECUTE) return;
                if (!senderAllowed(sender)) return;
                const valid = await hasValidAccessKeyOrCached(sender, lockAddress);
                if (valid) {
                    logger.info(`\x1b[32mOPEN GRANTED [Streams] – Sender ${sender.slice(0, 10)}….\x1b[0m`);
                    executeOpenAction(sender);
                }
            });
        });
    })();
}

/** Liest Nachrichten an lockAddress, entschlüsselt mit peerMap; bei Treffer in openWords + gültigem AccessKey + Replay-OK → onOpen(sender). */
async function listenForOpenCommands(
    lockAddress: string,
    openWords: string[],
    peerMap: Map<string, PeerInfo>,
    myPrivKey: CryptoKey,
    replayState: ReplayState,
    replayStatePath: string,
    onOpen: (sender: string) => void
) {
    const seenKeys = new Set<string>();
    let state = replayState;

    while (true) {
        try {
            const events = await client.queryEvents({
                query: { MoveModule: { package: CFG.PACKAGE_ID, module: 'messaging' } },
                limit: 20,
                order: 'descending',
            });
            const msgs = (events.data as Array<{ type?: string; parsedJson?: Record<string, unknown> }>).filter(
                (e) =>
                    e.type?.endsWith('::messaging::EncryptedMessage') &&
                    normalizeAddress(e.parsedJson?.recipient as string) === normalizeAddress(lockAddress)
            );
            const plainMsgs = (CFG.ENABLE_PLAINTEXT_CHANNEL || CFG.ENABLE_BROADCAST_PINNWAND)
                ? (events.data as Array<{ type?: string; parsedJson?: Record<string, unknown> }>).filter((e) => {
                      if (!e.type?.endsWith('::messaging::PlaintextMessage')) return false;
                      const recv = normalizeAddress(e.parsedJson?.recipient as string);
                      if (normalizeAddress(lockAddress) === recv) return true;
                      if (CFG.ENABLE_BROADCAST_PINNWAND && CFG.BROADCAST_PINNWAND_ADDRESS && normalizeAddress(CFG.BROADCAST_PINNWAND_ADDRESS) === recv) return true;
                      return false;
                  })
                : [];
            for (const msg of msgs) {
                const d = msg.parsedJson as { sender?: string; nonce?: number; ciphertext?: number[]; iv?: number[]; tag?: number[] };
                const sender = d?.sender;
                if (!sender) continue;
                const key = `${sender}:${d.nonce}`;
                if (seenKeys.has(key)) continue;
                seenKeys.add(key);

                const peer = peerMap.get(sender);
                if (!peer) continue;
                try {
                    const sharedSecret = await deriveSharedSecret(myPrivKey, peer.pubKeyRaw);
                    const aesKey = await deriveAesGcmKey(sharedSecret);
                    const combined = new Uint8Array([...(d.ciphertext ?? []), ...(d.tag ?? [])]);
                    const decrypted = await decryptMessage(
                        aesKey,
                        Buffer.from(new Uint8Array(d.iv ?? [])).toString('base64'),
                        Buffer.from(combined).toString('base64')
                    );
                    const cmd = decrypted.trim().toLowerCase();
                    if (openWords.length > 0 && openWords.includes(cmd)) {
                        const nonce = BigInt(d.nonce ?? 0);
                        const { accepted, newState } = acceptAndUpdate(state, sender, nonce);
                        if (!accepted) {
                            logger.warn(`OPEN abgelehnt (Replay) – Sender ${sender.slice(0, 10)}… nonce ${String(nonce)} bereits verwendet.`);
                            continue;
                        }
                        state = newState;
                        if (replayStatePath) await saveReplayState(replayStatePath, state);

                        if (!CFG.ENABLE_AUTO_EXECUTE) {
                            logger.info(`OPEN von ${sender.slice(0, 10)}… (nicht ausgeführt – ENABLE_AUTO_EXECUTE=false).`);
                            continue;
                        }
                        if (!senderAllowed(sender)) {
                            logger.warn(`OPEN verweigert – ${sender.slice(0, 10)}… nicht in AUTHORIZED_SENDERS.`);
                            continue;
                        }
                        const valid = await hasValidAccessKeyOrCached(sender, lockAddress);
                        if (valid) {
                            logger.info(`\x1b[32mOPEN GRANTED – Sender ${sender.slice(0, 10)}… hat gültigen AccessKey.\x1b[0m`);
                            executeOpenAction(sender);
                            onOpen(sender);
                        } else {
                            logger.warn(`OPEN verweigert – ${sender.slice(0, 10)}… hat keinen gültigen AccessKey für dieses Schloss.`);
                        }
                    }
                } catch {
                    // Decrypt fehlgeschlagen (falscher Key etc.)
                }
            }
            for (const msg of plainMsgs) {
                const d = msg.parsedJson as { sender?: string; recipient?: string; nonce?: number; text?: number[] | string };
                const sender = d?.sender;
                if (!sender) continue;
                const isBroadcast = CFG.ENABLE_BROADCAST_PINNWAND && normalizeAddress(d?.recipient as string) === normalizeAddress(CFG.BROADCAST_PINNWAND_ADDRESS);
                const key = isBroadcast ? `broadcast:${sender}:${d.nonce}` : `plain:${sender}:${d.nonce}`;
                if (seenKeys.has(key)) continue;
                seenKeys.add(key);
                const textBytes = toEventBytes(d.text);
                const cmd = (textBytes.length > 0 ? new TextDecoder().decode(textBytes) : '').trim().toLowerCase();
                if (openWords.length === 0 || !openWords.includes(cmd)) continue;
                const nonce = BigInt(d.nonce ?? 0);
                const { accepted, newState } = acceptAndUpdate(state, sender, nonce);
                if (!accepted) {
                    logger.warn(`OPEN abgelehnt (Replay) – ${isBroadcast ? 'Pinnwand' : 'Klartext'} von ${sender.slice(0, 10)}… nonce ${String(nonce)} bereits verwendet.`);
                    continue;
                }
                state = newState;
                if (replayStatePath) await saveReplayState(replayStatePath, state);
                if (!CFG.ENABLE_AUTO_EXECUTE) {
                    logger.info(`OPEN [${isBroadcast ? 'Pinnwand' : 'Klartext'}] von ${sender.slice(0, 10)}… (nicht ausgeführt – ENABLE_AUTO_EXECUTE=false).`);
                    continue;
                }
                const allowed = isBroadcast ? broadcastSenderAllowed(sender) : senderAllowed(sender);
                if (!allowed) {
                    logger.warn(`OPEN verweigert – ${sender.slice(0, 10)}… nicht in ${isBroadcast ? 'BROADCAST_AUTHORIZED_SENDERS' : 'AUTHORIZED_SENDERS'}.`);
                    continue;
                }
                const valid = await hasValidAccessKeyOrCached(sender, lockAddress);
                if (valid) {
                    logger.info(`\x1b[32mOPEN GRANTED [${isBroadcast ? 'Pinnwand' : 'Klartext'}] – Sender ${sender.slice(0, 10)}… hat gültigen AccessKey.\x1b[0m`);
                    executeOpenAction(sender);
                    onOpen(sender);
                } else {
                    logger.warn(`OPEN verweigert – ${sender.slice(0, 10)}… hat keinen gültigen AccessKey für dieses Schloss.`);
                }
            }
        } catch (e) {
            logger.warn('listenForOpenCommands: ' + (e as Error)?.message);
        }
        await new Promise((r) => setTimeout(r, CFG.LOCK_COMMAND_POLL_MS));
    }
}

/**
 * Lock-Modus: Diese Instanz ist das Schloss (MY_ADDRESS = LOCK_ID).
 * Key-Holder senden Handshake an LOCK_ID, dann verschlüsselt "open".
 * Prüfung: Sender muss gültiges AccessKey-NFT für LOCK_ID besitzen.
 */
export async function runLockMode(): Promise<void> {
    const lockId = CFG.LOCK_ID || process.env.MY_ADDRESS || CFG.MY_ADDRESS;
    if (!lockId) {
        logger.error('LOCK_ID oder MY_ADDRESS fehlt für Lock-Modus.');
        process.exit(1);
    }

    const vaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
    const hasLocalVaultFile = vaultFileExists(vaultPath);
    let myKeys: { privateKey: CryptoKey; pubRaw: Uint8Array };

    // Passwort: Headless aus WALLET_PASSWORD (Env), sonst Terminal
    const walletPassword = process.env.WALLET_PASSWORD || await readPasswordMasked('Wallet-Passwort (IOTA Rebased): ');

    if (hasLocalVaultFile) {
        myKeys = await loadVaultLocal(walletPassword, vaultPath);
        logger.info('Schloss-Keys aus lokalem Vault geladen.');
        const vaultPkg = readVaultPackageId(vaultPath);
        if (vaultPkg && CFG.PACKAGE_ID && normalizeAddress(vaultPkg) !== normalizeAddress(CFG.PACKAGE_ID)) {
            logger.warn(`Vault wurde mit Package ${vaultPkg.slice(0, 18)}… gespeichert; aktuelle PACKAGE_ID weicht ab.`);
        }
    } else if (CFG.VAULT_REGISTRY_ID && CFG.PACKAGE_ID) {
        const enc = await getVaultFromChain(client, CFG.VAULT_REGISTRY_ID, CFG.PACKAGE_ID, lockId);
        if (enc && enc.length > 0) {
            const vaultContent = await loadVaultFromChainPayload(enc, walletPassword);
            myKeys = vaultContent.keys;
            logger.info('Schloss-Keys aus On-Chain-Vault geladen (kein lokales VAULT_FILE).');
        } else {
            myKeys = await generateKeyPair(true);
            logger.info('Neue Schloss-Keys erzeugt (kein Vault – bei Neustart neue Keys).');
        }
    } else {
        myKeys = await generateKeyPair(true);
        logger.info('Neue Schloss-Keys erzeugt (ohne Vault – bei Neustart neue Keys).');
    }

    // Öffnen-Wörter: (1) On-Chain, (2) AES-Datei, (3) ENV
    let openWords: string[];
    if (CFG.COMMAND_REGISTRY_ID && CFG.PACKAGE_ID) {
        const chainWords = await getOpenWordsFromChain(client, CFG.COMMAND_REGISTRY_ID, CFG.PACKAGE_ID, lockId);
        if (chainWords && chainWords.length > 0) {
            openWords = chainWords;
            logger.info('Öffnen-Wörter aus On-Chain (CommandRegistry) geladen: ' + openWords.join(', '));
        } else {
            openWords = CFG.OPEN_COMMAND_WORDS.length ? [...CFG.OPEN_COMMAND_WORDS] : ['open', 'öffnen'];
        }
    } else if (CFG.OPEN_COMMAND_LIST_FILE && CFG.OPEN_COMMAND_LIST_KEY) {
        try {
            openWords = loadOpenWordsFromFile(CFG.OPEN_COMMAND_LIST_FILE, CFG.OPEN_COMMAND_LIST_KEY);
            logger.info('Öffnen-Wörter aus AES-Datei geladen: ' + openWords.join(', '));
        } catch (e) {
            logger.warn('OPEN_COMMAND_LIST_FILE konnte nicht gelesen werden: ' + (e as Error)?.message);
            openWords = CFG.OPEN_COMMAND_WORDS.length ? [...CFG.OPEN_COMMAND_WORDS] : ['open', 'öffnen'];
        }
    } else {
        openWords = CFG.OPEN_COMMAND_WORDS.length ? [...CFG.OPEN_COMMAND_WORDS] : ['open', 'öffnen'];
    }

    if (CFG.ENABLE_BROADCAST_PINNWAND) {
        if (!CFG.BROADCAST_PINNWAND_ADDRESS || CFG.BROADCAST_AUTHORIZED_SENDERS.length === 0) {
            logger.warn('ENABLE_BROADCAST_PINNWAND=true erfordert BROADCAST_PINNWAND_ADDRESS und BROADCAST_AUTHORIZED_SENDERS (nicht leer). Pinnwand deaktiviert.');
            (CFG as { ENABLE_BROADCAST_PINNWAND: boolean }).ENABLE_BROADCAST_PINNWAND = false;
        } else {
            logger.info(`Broadcast-Pinnwand aktiv: ${CFG.BROADCAST_PINNWAND_ADDRESS.slice(0, 12)}…, ${CFG.BROADCAST_AUTHORIZED_SENDERS.length} autorisierte Sender.`);
        }
    }
    logger.info(`Schloss aktiv: ${lockId}. Öffnen-Befehle: ${openWords.join(', ')}. Warte auf Handshakes und Befehle von Key-Haltern.`);
    const peerMap = await collectHandshakesToLock(lockId);
    logger.info(`${peerMap.size} Handshake(s) für dieses Schloss gefunden.`);

    // PeerMap periodisch aktualisieren (neue Key-Halter können später Handshake senden)
    setInterval(async () => {
        const fresh = await collectHandshakesToLock(lockId);
        for (const [addr, info] of fresh) {
            if (!peerMap.has(addr)) peerMap.set(addr, info);
        }
    }, CFG.LOCK_PEER_REFRESH_MS);

    const replayStatePath = CFG.ENABLE_REPLAY_PROTECTION ? (CFG.REPLAY_STATE_FILE || '') : '';
    const replayState = replayStatePath ? await loadReplayState(replayStatePath) : {};
    if (replayStatePath) logger.info('Replay-Schutz aktiv: ' + replayStatePath);

    if (!CFG.ENABLE_LISTENER) {
        logger.info('Listener aus (ENABLE_LISTENER=false). Keine OPEN-Befehle. Beenden mit Ctrl+C.');
        while (true) await new Promise((r) => setTimeout(r, 60_000));
    }

    if (CFG.PAYMENT_TRIGGER_ENABLED && (CFG.OPEN_COMMAND || CFG.OPEN_URL)) {
        logger.info('Zahlungs-Trigger aktiv: Mindestbetrag ' + (CFG.PAYMENT_TRIGGER_MIN_IOTA || 'beliebig') + ' IOTA, Poll alle ' + CFG.PAYMENT_TRIGGER_POLL_MS + ' ms.');
        runPaymentTriggerLoop(lockId).catch((e) => logger.warn('Payment-Trigger Loop: ' + (e as Error)?.message));
    }

    if (CFG.OFFLINE_QUEUE_FILE) {
        const queuePath = path.resolve(process.cwd(), CFG.OFFLINE_QUEUE_FILE);
        logger.info('Offline-Queue aktiv: ' + queuePath);
        runOfflineQueueLoop(queuePath, lockId, openWords, replayStatePath).catch((e) => logger.warn('Offline-Queue Loop: ' + (e as Error)?.message));
    }

    if (CFG.STREAMS_LISTEN_ENABLED && CFG.STREAMS_ANCHOR_ID) {
        logger.info('Streams-Listener aktiv: Anchor ' + CFG.STREAMS_ANCHOR_ID.slice(0, 12) + '…');
        runStreamsListenLoop(lockId, openWords, replayStatePath);
    }

    if (CFG.ENABLE_HEARTBEAT && CFG.STREAMS_ANCHOR_ID) {
        startHeartbeatLoop(lockId);
    }

    listenForOpenCommands(lockId, openWords, peerMap, myKeys.privateKey, replayState, replayStatePath, (sender) => {
        logger.info(`[M2M] Türöffnung ausgeführt (Sender: ${sender.slice(0, 10)}…).`);
    });
}

// --- Test-Helfer für Offline-Cache (run-offline-open-test.ts) ---
export function setOfflineCacheForTest(sender: string, validUntilMs: number): void {
    accessKeyCache.set(normalizeAddress(sender), validUntilMs);
}
export function getOfflineCacheSizeForTest(): number {
    return accessKeyCache.size;
}
/** Prüft nur den Cache (kein Chain-Call): ob sender gültig bis validUntilMs > now. */
export function isOfflineCacheHitForTest(sender: string): boolean {
    const validUntil = accessKeyCache.get(normalizeAddress(sender));
    return validUntil != null && Date.now() < validUntil;
}
