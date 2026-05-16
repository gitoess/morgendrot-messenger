/**
 * API-Server für Morgendrot UI.
 * LOGIK: Nur Interface – leitet /api/command an wallet-bridge weiter. Move-Funktionen liegen in chain-access; Säule 1–4 werden hier nicht interpretiert, nur durchgereicht.
 * Stellt REST-Endpoints bereit (Status, Befehle, Abfragen). Läuft nur bei ENABLE_UI=true im Messenger-Modus.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
    CFG,
    getConfigDisplay,
    getConnectAddresses,
    setEnvKey,
    setRuntimeConfigKey,
    assignDeviceRoleInEnv,
    savePackageIdToFile,
    readPackageIdHistory,
    readPackageIdHints,
    savePackageIdHint,
    readStreamsAnchorIdHistory,
    seedStreamsAnchorHistoryFromKnownFiles,
    dedupeStreamAnchorIds,
    getHierarchyPermissions,
    isHierarchyConfigKey,
    type HierarchyPermissions,
    buildDeviceEnv,
    buildDeviceJson,
    buildQrPayload,
    buildIdentityHeader,
    generateDeviceSecret,
    type DeviceProvisionParams,
    buildMessengerExportEnv,
    buildMessengerExportJson,
    resolveMessengerExportPackageId,
    buildStandaloneSmartphoneHandoffEnv,
    buildStandaloneSmartphoneHandoffReadme,
    getSignerConfigSource,
    getWalletDerivationPathConfigSource,
    getRuntimeConfigKeys,
    getRuntimeConfigSources,
} from './config.js';
import { parseAndValidateInitialProfile } from './initial-profile-provision.js';
import { parseEinsatzRoleTemplates, loadEinsatzRoleTemplates, saveEinsatzRoleTemplates } from './einsatz-role-templates.js';
import {
    findPeerHandshake,
    findPeerHandshakeFrom,
    listIncomingHandshakeOffers,
    isChainReachable,
    hasValidTicket,
    getOwnedTickets,
    getOwnedAccessKeys,
    getAllOwnedObjects,
    getMailboxRebateCandidates,
    getClient,
    getVaultFromChain,
    generateNewAddressCli,
    publishPackageCli,
    buildHandshakeTransaction,
    signAndExecute,
    getReferenceGasPrice,
    getPackageIdsForOwner,
    extractPackageIdsFromOwnedObjects,
    getOwnedObjectsDebug,
    resetRpcClient,
    getActiveRpcUrl,
    getRpcCandidateCount,
    getEffectiveRpcUrlLabel,
    mintMessengerCreditsBatchForRecipients,
    getMessengerCreditsSnapshot,
    getBalanceInMist,
    MESSAGING_MAX_PLAINTEXT_UTF8_BYTES,
    MOVE_MAX_PURE_VECTOR_U8_BYTES,
} from './chain-access.js';
import { handleShopApi } from './api/shop/handle-shop-api.js';
import { normalizeAddress } from './utils.js';
import { HELP_START, HELP_CHAT, HELP_UI_INTRO, getWalletPassword } from './wallet-bridge.js';
import { logger } from './logger.js';
import { getMonitorStatus } from './monitoring.js';
import { exportAuditCsv, exportAuditPdfStream, appendAuditEvent, readAuditEvents } from './audit-log.js';
import { runGasStationCheck } from './gas-station.js';
import { verifyTinyHmac, processTinyMessage } from './tiny-gateway.js';
import { extractCompactImageBase64FromWire } from './compact-image-wire-extract.js';
import { fuseLoraProgressiveJpegsSharp, prepareImageForLoRaRobust } from './lora-progressive-image.js';
import archiver from 'archiver';
import { HEARTBEAT_INTERVAL_PRESETS_MS, isAllowedHeartbeatIntervalMs } from './shared/heartbeat-presets.js';
import {
    vaultFileExists,
    loadVaultLocal,
    loadVaultContent,
    loadVaultFromChainPayload,
    purgeInboxCache,
    sanitizePersonalSecrets,
    type PersonalSecretEntry,
} from './vault-local.js';
import { applySdkSignerFromImport } from './messenger-nest/sdk-signer-import.js';
import {
    saveContactLabel,
    saveContactMeshFields,
    loadContactDirectory,
    getContactByMeshNodeId,
    getContactByBleUuid,
    getContactLabel,
    applyInitialProfileToContacts,
} from './contact-labels.js';
import { VaultImagePipeline } from './vault-image-pipeline.js';
import { MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES } from './messenger-media-limits.js';
import { transcodeBrowserAudioToMessengerOpus } from './messenger-audio-opus-encode.js';
import { consumeClaimTokenOnce } from './voucher-claim-state.js';
import {
    corsHeaders,
    sendJson,
    handleCorsPreflightIfOptions,
    normalizeApiRequestPath,
    mask,
    rpcUrlLabel,
    formatWalletNativeIotaForStatusUi,
    markdownToHtml,
    tryServeLiteUiGet,
    sendUnmatchedRouteResponse,
} from './api/http-middleware.js';
import {
    resolveProvisionIdempotencyKey,
    provisionRequestFingerprint,
    tryProvisionIdempotentReplayOrConflict,
    saveProvisionIdempotencySuccess,
    withProvisionDeviceIdempotencyLock,
} from './provision-idempotency-state.js';

/** Nach erfolgreichem /vault-onchain: Zeitstempel für Sync-Status („Auf Chain gesichert“). */
let lastVaultOnchainSuccessAt: number | undefined;

export type ApiStatus = {
    backendRunning: boolean;
    connected: boolean;
    hasKeys?: boolean;
    myAddress?: string;
    partnerAddress?: string;
    partnerCount?: number;
    /** Adressen der aktuell verbundenen Partner (peerMap) – für „An:“ nur diese anzeigen. */
    connectedAddresses?: string[];
    /** ENABLE_PLAINTEXT_CHANNEL – für UI Statuszeile „Modus: Klartext / Verschlüsselt“. */
    plaintextMode?: boolean;
    /** Tresor: Listen-Ansicht (Zusammenfassung) + Sync-Status (Punkt 5 Marktreife). */
    vaultStatus?: {
        hasLocal: boolean;
        lastSavedToChainAt?: number;
    };
    /** Lite-UI: full oder messenger (nur Nachrichten-Fluss). */
    uiVariant?: 'full' | 'messenger';
    /** standalone = klassischer Messenger; sales = Kunden-Bundle (Schatten-Seed / Sweep). */
    messengerEdition?: 'standalone' | 'sales';
    /** MAILBOX_STORE_PLAINTEXT: Klartext zusätzlich in Mailbox speichern (purgebar). */
    mailboxStorePlaintext?: boolean;
    /** USE_MAILBOX: true = Move speichert in Mailbox-Objekt; false = Event-Pfad (queryEvents). */
    useMailbox?: boolean;
    /** MAILBOX_ID gesetzt und 0x+64Hex (sonst kann Mailbox-Modus nicht greifen). */
    mailboxConfigured?: boolean;
    mailboxIdMasked?: string;
    /** M3: Pinnwand-Konfiguration (ohne Geheimnisse außer freigegebener Broadcast-Adresse). */
    broadcastPinnwand?: {
        enabled: boolean;
        address?: string;
        authorizedSenders?: string[];
        myAddressAuthorized?: boolean;
    };
    /** cli | sdk | remote – UI zeigt ggf. Mnemonic-Feld beim Entsperren. */
    signer?: string;
    /** MESSENGER_CREDITS_OBJECT_ID syntaktisch gültig und ≠ PACKAGE_ID. */
    messengerCreditsConfigured?: boolean;
    /** Wenn konfiguriert: Balance/Cap vom Objekt (sonst null). */
    messengerCredits?: { balance: string; maxBalance: string } | null;
    /** true: ID konfiguriert, aber Objekt nicht lesbar (RPC/Falsches Objekt). */
    messengerCreditsFetchFailed?: boolean;
    /** Konfigurations-Widersprüche / Hinweise (keine Secrets). */
    configHints?: string[];
    /** Kurzdarstellung RPC_URL (Host/Pfad) für Einstellungen / Setup. */
    rpcUrlLabel?: string;
    /** PACKAGE_ID aus .env (lokale Admin-UI; wie /api/current-ids). */
    packageId?: string;
    /** RPC läuft über SOCKS5 (z. B. Tor) – keine URL, nur Flag für UI. */
    rpcSocksProxyActive?: boolean;
    /** RPC läuft über HTTP(S)-Proxy. */
    rpcHttpProxyActive?: boolean;
    /** Nach Unlock: natives IOTA-Guthaben von MY_ADDRESS (MIST + Anzeige), per RPC. */
    walletNativeIotaBalance?: { mist: string; displayIota: string } | null;
    /** true: Adresse vorhanden, Saldo-Abfrage an RPC fehlgeschlagen. */
    walletNativeIotaBalanceFetchFailed?: boolean;
};

type GetStatusFn = () => Partial<ApiStatus>;
export type { CommandApiOptions } from './messenger-nest/command-api-options.js';
import type { CommandApiOptions } from './messenger-nest/command-api-options.js';
type CommandHandlerFn = (cmd: string, args: string[], options?: CommandApiOptions) => Promise<{ ok: boolean; message?: string }>;
type PurgeAfterLieferungFn = (purges: Array<{ sender: string; recipient: string; nonce: string | number }>) => Promise<{ ok: boolean; message?: string; count?: number }>;

/** Stub, damit /api/command nie 503 liefert – wird durch echten Handler nach Wallet-Entsperren ersetzt. */
const _stubCommandHandler: CommandHandlerFn = async () => ({
    ok: false,
    error: 'Bitte zuerst Wallet entsperren (Passwort eingeben). Danach Befehle nutzbar.',
});
let _commandHandler: CommandHandlerFn | null = _stubCommandHandler;
let _purgeAfterLieferungHandler: PurgeAfterLieferungFn | null = null;

/** Rate-Limit für /api/command: pro IP, Fenster 1 Minute. */
const commandRateLimitByIp = new Map<string, { count: number; resetAt: number }>();
function checkCommandRateLimit(ip: string): boolean {
    const limit = CFG.API_RATE_LIMIT_COMMANDS_PER_MINUTE;
    if (limit <= 0) return true;
    const now = Date.now();
    const entry = commandRateLimitByIp.get(ip);
    if (!entry) return true;
    if (now >= entry.resetAt) return true;
    return entry.count < limit;
}
function recordCommandRateLimit(ip: string): void {
    const limit = CFG.API_RATE_LIMIT_COMMANDS_PER_MINUTE;
    if (limit <= 0) return;
    const now = Date.now();
    const windowMs = 60_000;
    let entry = commandRateLimitByIp.get(ip);
    if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        commandRateLimitByIp.set(ip, entry);
    }
    entry.count++;
}

/** Rate-Limit für POST /api/voucher-claim (öffentlich, wenn aktiviert). */
const voucherClaimRateLimitByIp = new Map<string, { count: number; resetAt: number }>();
function checkVoucherClaimRateLimit(ip: string): boolean {
    const limit = CFG.VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE;
    if (limit <= 0) return true;
    const now = Date.now();
    const entry = voucherClaimRateLimitByIp.get(ip);
    if (!entry) return true;
    if (now >= entry.resetAt) return true;
    return entry.count < limit;
}
function recordVoucherClaimRateLimit(ip: string): void {
    const limit = CFG.VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE;
    if (limit <= 0) return;
    const now = Date.now();
    const windowMs = 60_000;
    let entry = voucherClaimRateLimitByIp.get(ip);
    if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        voucherClaimRateLimitByIp.set(ip, entry);
    }
    entry.count++;
}

/** Welches Hierarchie-Recht braucht dieser Befehl? null = kein Recht nötig (z. B. /help, /fetch, /list-keys). */
function getRequiredPermissionForCommand(cmd: string): 'keyIssue' | 'revokeDown' | 'commandDown' | null {
    const c = (cmd || '').trim().toLowerCase();
    if (['/create-key', '/create-keys', '/create-key-and-notify', '/create-ticket', '/create-tickets'].includes(c)) return 'keyIssue';
    if (['/purge-key', '/emergency-purge-key', '/purge-handshake', '/purge-msg', '/emergency-purge', '/purge-ticket', '/emergency-purge-ticket'].includes(c)) return 'revokeDown';
    // Peer-Messaging / Peering ist keine Hierarchie „nach unten“ – Arbeiter & Messenger dürfen Handshake/Senden/Pairing.
    if (['/transfer-coins'].includes(c)) return 'commandDown';
    return null;
}

export function setPurgeAfterLieferungHandler(handler: PurgeAfterLieferungFn | null): void {
    _purgeAfterLieferungHandler = handler;
}
let _sessionStatus: Partial<ApiStatus> = {};
let _resolvePassword: ((pw: string) => void) | null = null;

export function setCommandHandler(handler: CommandHandlerFn | null): void {
    _commandHandler = handler;
}

/** Optional: Zugriff auf „Mein Safe“ (personalSecrets) im entsperrten Vault-RAM. Setzt wallet-bridge nach Init. */
export type VaultPersonalSecretsBridge = {
    getEntries: () => PersonalSecretEntry[] | null;
    setEntries: (
        entries: PersonalSecretEntry[],
        opts?: { persistLocal?: boolean }
    ) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

let _vaultPersonalSecretsBridge: VaultPersonalSecretsBridge | null = null;

export function setVaultPersonalSecretsBridge(b: VaultPersonalSecretsBridge | null): void {
    _vaultPersonalSecretsBridge = b;
}

/** Setzt Callback für Passwort aus UI. Wird von wallet-bridge aufgerufen, bevor UI startet. */
export function setPasswordResolver(resolve: (pw: string) => void): void {
    _resolvePassword = resolve;
}

export function setSessionStatus(status: Partial<ApiStatus>): void {
    _sessionStatus = status;
}

/** Tatsächlich gebundener API-Port (nach tryListen). Damit die UI den richtigen Port in index.html einsetzt. */
let _actualApiPort: number = 0;
export function getActualApiPort(): number {
    return _actualApiPort || CFG.API_PORT;
}

export function startApiServer(getStatus?: GetStatusFn): http.Server | null {
    const port = CFG.API_PORT;

    const server = http.createServer(async (req, res) => {
        const cors = corsHeaders(req);
        if (handleCorsPreflightIfOptions(req, res, cors)) return;

        const url = normalizeApiRequestPath(req.url || '/');

        const shopHandled = await handleShopApi(req, res, url, cors, sendJson);
        if (shopHandled) return;

        /** Öffentlicher Claim-Token-Schritt (Idempotenz); Burn/Mint folgt später im selben Flow. */
        if (url === '/api/voucher-claim' && req.method === 'POST') {
            if (!CFG.ENABLE_VOUCHER_CLAIM_API) {
                sendJson(res, 404, { ok: false, error: 'Voucher-Claim-API ist deaktiviert (ENABLE_VOUCHER_CLAIM_API=false).' }, cors);
                return;
            }
            const ip = (req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
            if (CFG.VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE > 0 && !checkVoucherClaimRateLimit(ip)) {
                sendJson(res, 429, { ok: false, error: 'Rate-Limit überschritten (VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE).' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}') as { claimToken?: string };
                    const claimToken = String(data.claimToken ?? '').trim();
                    if (!claimToken) {
                        sendJson(res, 400, { ok: false, error: 'claimToken fehlt (JSON-Body).' }, cors);
                        return;
                    }
                    const result = await consumeClaimTokenOnce(claimToken);
                    if (CFG.VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE > 0) recordVoucherClaimRateLimit(ip);
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            status: result.status,
                            claimKeyPrefix: result.claimKeyPrefix,
                            consumedAt: result.consumedAt,
                            note: 'Nur Idempotenz-Schicht. Burn/Mint/Provisioning noch anbinden — siehe docs/API-VOUCHER-CLAIM-SPEC.md',
                        },
                        cors
                    );
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    sendJson(res, 400, { ok: false, error: msg }, cors);
                }
            });
            return;
        }

        if (url === '/api/status' && req.method === 'GET') {
            const custom = { ...(getStatus?.() ?? {}), ..._sessionStatus };
            const perms = getHierarchyPermissions(CFG.ROLE);
            const vaultFileResolved = (CFG.VAULT_FILE || '').trim() || '.morgendrot-vault';
            const mailboxIdTrim = (CFG.MAILBOX_ID || '').trim();
            const mailboxConfigured = Boolean(mailboxIdTrim && /^0x[a-fA-F0-9]{64}$/i.test(mailboxIdTrim));
            const packageTrim = (CFG.PACKAGE_ID || '').trim();
            const configHints: string[] = [];
            if (CFG.MAILBOX_STORE_PLAINTEXT && !mailboxConfigured) {
                configHints.push(
                    'MAILBOX_STORE_PLAINTEXT ist aktiv, aber MAILBOX_ID fehlt oder ist keine gültige Objekt-ID (0x + 64 Hex).'
                );
            }
            if (
                mailboxIdTrim &&
                packageTrim &&
                mailboxIdTrim.toLowerCase() === packageTrim.toLowerCase()
            ) {
                configHints.push('MAILBOX_ID entspricht PACKAGE_ID — Mailbox-Aufrufe schlagen fehl („move package passed“).');
            }
            const credRaw = (CFG.MESSENGER_CREDITS_OBJECT_ID || '').trim();
            if (credRaw && !/^0x[a-fA-F0-9]{64}$/i.test(credRaw)) {
                configHints.push('MESSENGER_CREDITS_OBJECT_ID ist kein gültiges 0x+64-Hex-Format.');
            }
            if (credRaw && packageTrim && credRaw.toLowerCase() === packageTrim.toLowerCase()) {
                configHints.push('MESSENGER_CREDITS_OBJECT_ID darf nicht die PACKAGE_ID sein.');
            }
            if (CFG.MAILBOX_STORE_PLAINTEXT && (!packageTrim || !/^0x[a-fA-F0-9]{64}$/i.test(packageTrim))) {
                configHints.push(
                    'MAILBOX_STORE_PLAINTEXT: gültige PACKAGE_ID (0x+64 Hex) und deploytes Move mit store_plaintext_message_*_stored nötig.'
                );
            }
            let messengerCredits: { balance: string; maxBalance: string } | null | undefined;
            let messengerCreditsFetchFailed: boolean | undefined;
            const credLooksValid = credRaw && /^0x[a-fA-F0-9]{64}$/i.test(credRaw) && credRaw.toLowerCase() !== packageTrim.toLowerCase();
            if (credLooksValid) {
                try {
                    const snap = await getMessengerCreditsSnapshot();
                    if (snap) messengerCredits = { balance: snap.balance, maxBalance: snap.maxBalance };
                    else {
                        messengerCredits = null;
                        messengerCreditsFetchFailed = true;
                    }
                } catch {
                    messengerCredits = null;
                    messengerCreditsFetchFailed = true;
                }
            }
            let walletNativeIotaBalance: { mist: string; displayIota: string } | undefined;
            let walletNativeIotaBalanceFetchFailed: boolean | undefined;
            if (!_resolvePassword) {
                const myAddr = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
                if (myAddr && /^0x[a-fA-F0-9]{64}$/i.test(myAddr)) {
                    try {
                        const mist = await getBalanceInMist(myAddr);
                        walletNativeIotaBalance = {
                            mist: mist.toString(),
                            displayIota: formatWalletNativeIotaForStatusUi(mist),
                        };
                    } catch {
                        walletNativeIotaBalanceFetchFailed = true;
                    }
                }
            }
            const status: ApiStatus & {
                locked?: boolean;
                role?: string;
                roleId?: number;
                permissions?: HierarchyPermissions;
                streams?: { active: boolean; anchorId?: string; anchorIdFull?: string };
                heartbeat?: {
                    enabled: boolean;
                    intervalMs: number;
                    streamsReady: boolean;
                    presetsMinutes?: number[];
                    intervalMatchesPreset?: boolean;
                };
                /** Volle eigene Adresse (nur lokal/vertraut) – zum Kopieren für Explorer; myAddress bleibt maskiert. */
                myAddressFull?: string;
                serveLiteUiStatic?: boolean;
                apiListenPort?: number;
                dashboardPort?: number;
                compactImageEncode?: boolean;
                loraProgressiveEncode?: boolean;
                signerConfigSource?: 'env' | 'runtime';
                walletDerivationPathConfigSource?: 'env' | 'runtime';
                useMailboxConfigSource?: 'env' | 'runtime';
                mailboxStorePlaintextConfigSource?: 'env' | 'runtime';
                enablePlaintextChannelConfigSource?: 'env' | 'runtime';
                runtimeConfigKeys?: string[];
            } = {
                backendRunning: true,
                locked: !!_resolvePassword,
                connected: custom.connected ?? false,
                hasKeys: custom.hasKeys,
                myAddress: custom.myAddress ?? (CFG.MY_ADDRESS ? mask(CFG.MY_ADDRESS) : undefined),
                /** Wie /api/current-ids – nach SDK-Unlock oft erst in process.env gesetzt. */
                myAddressFull: (() => {
                    const raw = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
                    return raw || undefined;
                })(),
                partnerAddress: custom.partnerAddress ?? (CFG.PARTNER_ADDRESS ? mask(CFG.PARTNER_ADDRESS) : undefined),
                partnerCount: custom.partnerCount,
                connectedAddresses: custom.connectedAddresses,
                plaintextMode: CFG.ENABLE_PLAINTEXT_CHANNEL,
                mailboxStorePlaintext: CFG.MAILBOX_STORE_PLAINTEXT,
                role: CFG.ROLE,
                roleId: CFG.ROLE_ID,
                permissions: perms,
                streams: {
                    active: !!(CFG.STREAMS_BRIDGE_URL && CFG.STREAMS_ANCHOR_ID),
                    anchorId: CFG.STREAMS_ANCHOR_ID ? mask(CFG.STREAMS_ANCHOR_ID, 12) : undefined,
                    anchorIdFull: CFG.STREAMS_ANCHOR_ID || '',
                },
                /** Messenger-UI: Puls an Basis (Streams), ohne neue Endpoints. */
                heartbeat: {
                    enabled: CFG.ENABLE_HEARTBEAT,
                    intervalMs: CFG.HEARTBEAT_INTERVAL_MS,
                    streamsReady: !!(CFG.STREAMS_BRIDGE_URL && CFG.STREAMS_ANCHOR_ID),
                    presetsMinutes: HEARTBEAT_INTERVAL_PRESETS_MS.map((ms) => ms / 60_000),
                    intervalMatchesPreset: isAllowedHeartbeatIntervalMs(CFG.HEARTBEAT_INTERVAL_MS),
                },
                vaultStatus: {
                    hasLocal: vaultFileExists(vaultFileResolved),
                    ...(lastVaultOnchainSuccessAt != null && { lastSavedToChainAt: lastVaultOnchainSuccessAt }),
                },
                uiVariant: CFG.UI_VARIANT === 'messenger' ? 'messenger' : 'full',
                /** false: am API-Port keine statische ui/index.html (nur Next unter UI_PORT). */
                serveLiteUiStatic: CFG.SERVE_LITE_UI_STATIC,
                messengerEdition: CFG.MESSENGER_EDITION,
                useMailbox: CFG.USE_MAILBOX,
                mailboxConfigured,
                signer: CFG.SIGNER,
                signerConfigSource: getSignerConfigSource(),
                walletDerivationPathConfigSource: getWalletDerivationPathConfigSource(),
                useMailboxConfigSource: getRuntimeConfigSources().useMailbox,
                mailboxStorePlaintextConfigSource: getRuntimeConfigSources().mailboxStorePlaintext,
                enablePlaintextChannelConfigSource: getRuntimeConfigSources().enablePlaintextChannel,
                runtimeConfigKeys: getRuntimeConfigKeys(),
                messengerCreditsConfigured: !!credLooksValid,
                ...(messengerCredits !== undefined && { messengerCredits }),
                ...(messengerCreditsFetchFailed && { messengerCreditsFetchFailed: true }),
                ...(walletNativeIotaBalance !== undefined && { walletNativeIotaBalance }),
                ...(walletNativeIotaBalanceFetchFailed && { walletNativeIotaBalanceFetchFailed: true }),
                ...(configHints.length > 0 && { configHints }),
                rpcUrlLabel: rpcUrlLabel(CFG.RPC_URL || ''),
                rpcSocksProxyActive: Boolean((CFG.RPC_SOCKS_PROXY || '').trim()),
                rpcHttpProxyActive: Boolean((CFG.RPC_HTTP_PROXY || '').trim()),
                /** Tatsächlich gebundener Port (nach EADDRINUSE-Ausweich). Next-Rewrite: MORGENDROT_API_INTERNAL_URL anpassen. */
                apiListenPort: getActualApiPort(),
                /** Next.js-Dashboard (Sendepfad Auto/Online/Funk, ChatMessageBody) – aus .env UI_PORT. */
                dashboardPort: CFG.UI_PORT,
                compactImageEncode: true,
                loraProgressiveEncode: true,
                ...(packageTrim ? { packageId: packageTrim } : {}),
                ...(mailboxConfigured && mailboxIdTrim ? { mailboxIdMasked: mask(mailboxIdTrim) } : {}),
                ...(CFG.ENABLE_BROADCAST_PINNWAND
                    ? {
                          broadcastPinnwand: {
                              enabled: true,
                              address: (CFG.BROADCAST_PINNWAND_ADDRESS || '').trim() || undefined,
                              authorizedSenders: (CFG.BROADCAST_AUTHORIZED_SENDERS || []).map((a) => a.trim()).filter(Boolean),
                              myAddressAuthorized: (() => {
                                  const me = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim().toLowerCase();
                                  if (!me) return false;
                                  const allowed = CFG.BROADCAST_AUTHORIZED_SENDERS || [];
                                  if (allowed.length === 0) return true;
                                  return allowed.some((s) => s.trim().toLowerCase() === me);
                              })(),
                          },
                      }
                    : { broadcastPinnwand: { enabled: false } }),
            };
            sendJson(res, 200, status, cors);
            return;
        }

        if (url === '/api/current-ids' && req.method === 'GET') {
            try {
                sendJson(res, 200, {
                    ok: true,
                    myAddress: CFG.MY_ADDRESS || '',
                    packageId: CFG.PACKAGE_ID || '',
                    mailboxId: CFG.MAILBOX_ID || '',
                    commandRegistryId: CFG.COMMAND_REGISTRY_ID || '',
                    vaultRegistryId: CFG.VAULT_REGISTRY_ID || '',
                    streamsAnchorId: CFG.STREAMS_ANCHOR_ID || '',
                    streamsBridgeUrl: CFG.STREAMS_BRIDGE_URL || '',
                }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/messenger-presets' && req.method === 'GET') {
            try {
                const pkg = (CFG.LITE_PRESET_PACKAGE_ID || '').trim();
                const rpcFallback = (CFG.LITE_PRESET_RPC_URL || CFG.RPC_URL || '').trim();
                const hasLite = /^0x[a-fA-F0-9]{64}$/.test(pkg);
                sendJson(
                    res,
                    200,
                    {
                        ok: true,
                        litePackageId: hasLite ? pkg : '',
                        liteRpcUrl: rpcFallback,
                        hasLitePackagePreset: hasLite,
                        pairingFindMaxCandidates: CFG.PAIRING_FIND_MAX_CANDIDATES,
                        pairingFindMaxDecryptAttempts: CFG.PAIRING_FIND_MAX_DECRYPT_ATTEMPTS,
                    },
                    cors
                );
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        /** Bibliothek der 64 Rollen-Profile: Liste (nur Metadaten). */
        if (url === '/api/profiles' && req.method === 'GET') {
            try {
                const profilesDir = path.join(process.cwd(), 'profiles');
                if (!fs.existsSync(profilesDir)) {
                    sendJson(res, 200, { ok: true, profiles: [] }, cors);
                    return;
                }
                const list: { id: string; ROLE_ID: number; BIT_MASK: string; DESCRIPTION: string; UI_HINTS: string[]; role: string }[] = [];
                for (let i = 0; i < 64; i++) {
                    const id = 'id-' + String(i).padStart(2, '0');
                    const templatePath = path.join(profilesDir, id, 'template.json');
                    if (!fs.existsSync(templatePath)) continue;
                    const raw = fs.readFileSync(templatePath, 'utf8');
                    const t = JSON.parse(raw) as { ROLE_ID?: number; BIT_MASK?: string; DESCRIPTION?: string; UI_HINTS?: string[]; role?: string };
                    list.push({
                        id,
                        ROLE_ID: t.ROLE_ID ?? i,
                        BIT_MASK: t.BIT_MASK ?? '',
                        DESCRIPTION: t.DESCRIPTION ?? '',
                        UI_HINTS: Array.isArray(t.UI_HINTS) ? t.UI_HINTS : [],
                        role: t.role ?? 'arbeiter',
                    });
                }
                sendJson(res, 200, { ok: true, profiles: list }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        /** Einzelnes Profil-Template laden (z. B. /api/profiles/id-14). */
        const profileIdMatch = url?.match(/^\/api\/profiles\/(id-\d{2})$/);
        if (profileIdMatch && req.method === 'GET') {
            try {
                const profileId = profileIdMatch[1];
                const templatePath = path.join(process.cwd(), 'profiles', profileId, 'template.json');
                if (!fs.existsSync(templatePath)) {
                    sendJson(res, 404, { ok: false, error: 'Profil nicht gefunden: ' + profileId }, cors);
                    return;
                }
                const raw = fs.readFileSync(templatePath, 'utf8');
                const template = JSON.parse(raw) as Record<string, unknown>;
                sendJson(res, 200, { ok: true, profileId, template }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        /** Export: Profil-Ordner als ZIP (template.json + config.json + optional .env). */
        if (url === '/api/provision-export-zip' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const profileId = String(data.profileId || '').trim();
                    if (!/^id-\d{2}$/.test(profileId)) {
                        sendJson(res, 400, { ok: false, error: 'profileId (id-00 … id-63) erforderlich.' }, cors);
                        return;
                    }
                    const templatePath = path.join(process.cwd(), 'profiles', profileId, 'template.json');
                    if (!fs.existsSync(templatePath)) {
                        sendJson(res, 404, { ok: false, error: 'Profil nicht gefunden: ' + profileId }, cors);
                        return;
                    }
                    const envContent = typeof data.envContent === 'string' ? data.envContent : '';
                    const jsonConfig = data.jsonConfig != null ? data.jsonConfig : {};
                    const archive = archiver('zip', { zlib: { level: 9 } });
                    res.writeHead(200, {
                        ...cors,
                        'Content-Type': 'application/zip',
                        'Content-Disposition': 'attachment; filename="profil-' + profileId + '.zip"',
                    });
                    archive.pipe(res);
                    archive.append(fs.createReadStream(templatePath), { name: profileId + '/template.json' });
                    archive.append(JSON.stringify(jsonConfig, null, 2), { name: profileId + '/config.json' });
                    if (envContent) archive.append(envContent, { name: profileId + '/.env' });
                    const readmeDeviceTxt =
                        'Morgendrot – Geräte-Ordner (Export)\n' +
                        '====================================\n\n' +
                        '1) Vollständiges Morgendrot-Repo auf das Gerät kopieren (nicht nur diese 3 Dateien).\n' +
                        '2) .env ins Repo-Root legen (oder Pfad beim Start setzen).\n' +
                        '3) Auf dem Boss-PC: BOSS_SIGNER_PUBLIC_URL in .env = http://<Boss-LAN-IP>:3340/sign\n' +
                        '   und npm run boss-signer starten.\n' +
                        '4) Auf dem Gerät: npm install && npm run start:headless\n\n' +
                        'Hinweis: Nur .env wird von Node gelesen; config.json ist Referenz (Wizard).\n';
                    archive.append(Buffer.from(readmeDeviceTxt, 'utf8'), { name: profileId + '/README-GERAET.txt' });
                    archive.finalize();
                    archive.on('error', (err: Error) => {
                        try { res.end(); } catch {}
                        logger.warn('provision-export-zip: ' + (err?.message || err));
                    });
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        const PROVISION_VAULT_FILE = path.join(process.cwd(), '.morgendrot-provisioning-vault.json');
        type ProvisionVaultEntry = { profileId: string; deviceName: string; address: string; jsonConfig: Record<string, unknown>; envContentSafe?: string; savedAt: string };
        function readProvisionVault(): ProvisionVaultEntry[] {
            try {
                if (!fs.existsSync(PROVISION_VAULT_FILE)) return [];
                const raw = fs.readFileSync(PROVISION_VAULT_FILE, 'utf8');
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr : [];
            } catch {
                return [];
            }
        }
        function writeProvisionVault(entries: ProvisionVaultEntry[]): void {
            fs.writeFileSync(PROVISION_VAULT_FILE, JSON.stringify(entries, null, 2), 'utf8');
        }
        /** Optionaler Vault: Liste der gespeicherten Provisioning-Einträge (offline für Boss). */
        if (url === '/api/provision-vault' && req.method === 'GET') {
            try {
                if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'messenger') {
                    sendJson(res, 403, { ok: false, error: 'Nur Boss/Messenger darf Vault lesen.' }, cors);
                    return;
                }
                const entries = readProvisionVault();
                sendJson(res, 200, { ok: true, entries }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }
        /** Optionaler Vault: Aktuelles Provisioning-Ergebnis speichern (ohne Secret Key). Optional versendbar an Kommandant (Export ohne Mnemonic). */
        if (url === '/api/provision-save-vault' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                try {
                    if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'messenger') {
                        sendJson(res, 403, { ok: false, error: 'Nur Boss darf in Provisioning-Vault speichern.' }, cors);
                        return;
                    }
                    const data = JSON.parse(body || '{}');
                    const profileId = String(data.profileId || '').trim();
                    const deviceName = String(data.deviceName || '').trim();
                    const address = String(data.address || '').trim();
                    const jsonConfig = data.jsonConfig && typeof data.jsonConfig === 'object' ? data.jsonConfig as Record<string, unknown> : {};
                    let envContentSafe: string | undefined;
                    if (typeof data.envContent === 'string') {
                        envContentSafe = data.envContent.replace(/\n?WALLET_MNEMONIC=.*/g, '\n# WALLET_MNEMONIC=[REDACTED]').replace(/\n?# SECURITY:.*\n?/g, '\n');
                    }
                    const entries = readProvisionVault();
                    entries.push({
                        profileId: profileId || 'id-00',
                        deviceName,
                        address,
                        jsonConfig,
                        envContentSafe,
                        savedAt: new Date().toISOString(),
                    });
                    writeProvisionVault(entries);
                    sendJson(res, 200, { ok: true, message: 'Im Vault gespeichert (offline). Für Kommandant: Export ohne Secrets nutzen.' }, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        /** Liste aller kopierbaren IDs/Adressen (Anchor, Package, Mailbox, …) – vollständig, für Copy-Popup. Enthält alle genutzten/konfigurierten Werte. */
        if (url === '/api/copyable-ids' && req.method === 'GET') {
            try {
                const connectedAddrs = getConnectAddresses();
                const ids: { key: string; label: string; value: string }[] = [
                    { key: 'MY_ADDRESS', label: 'Meine Adresse', value: CFG.MY_ADDRESS || '' },
                    { key: 'PACKAGE_ID', label: 'Package-ID', value: CFG.PACKAGE_ID || '' },
                    { key: 'RPC_URL', label: 'RPC-URL', value: CFG.RPC_URL || '' },
                    { key: 'STREAMS_ANCHOR_ID', label: 'Streams Anchor-ID', value: CFG.STREAMS_ANCHOR_ID || '' },
                    { key: 'STREAMS_BRIDGE_URL', label: 'Streams Bridge-URL', value: CFG.STREAMS_BRIDGE_URL || '' },
                    ...(CFG.ENABLE_FACTORY_IO
                        ? [
                              { key: 'FACTORY_IO_URL', label: 'Factory I/O Web-API-URL', value: CFG.FACTORY_IO_URL || '' },
                              {
                                  key: 'FACTORY_IO_POLL_MS',
                                  label: 'Factory I/O Feeder Poll (ms)',
                                  value: String(CFG.FACTORY_IO_POLL_MS),
                              },
                          ]
                        : []),
                    { key: 'VAULT_REGISTRY_ID', label: 'Vault Registry-ID', value: CFG.VAULT_REGISTRY_ID || '' },
                    { key: 'MAILBOX_ID', label: 'Mailbox-ID', value: CFG.MAILBOX_ID || '' },
                    { key: 'COMMAND_REGISTRY_ID', label: 'Command Registry-ID', value: CFG.COMMAND_REGISTRY_ID || '' },
                    { key: 'BOSS_ADDRESS', label: 'Boss-Adresse', value: CFG.BOSS_ADDRESS || '' },
                    { key: 'PARTNER_ADDRESS', label: 'Partner-Adresse', value: CFG.PARTNER_ADDRESS || '' },
                    { key: 'LOCK_ID', label: 'Lock-ID', value: CFG.LOCK_ID || '' },
                    {
                        key: 'CONNECTED_ADDRESSES',
                        label: 'Verbundene Adressen',
                        value: connectedAddrs.length ? connectedAddrs.join(', ') : '',
                    },
                ];
                sendJson(res, 200, { ok: true, ids }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/package-id-history' && req.method === 'GET') {
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const includeDiscovered = u.searchParams.get('discovered') !== 'false';
                const debugOwned = u.searchParams.get('debug') === '1';
                const current = CFG.PACKAGE_ID || '';
                const history = readPackageIdHistory().filter((id) => id.toLowerCase() !== current.toLowerCase());
                let discovered: string[] = [];
                let debugOwnedPayload: Awaited<ReturnType<typeof getOwnedObjectsDebug>> | undefined;
                if (includeDiscovered && CFG.MY_ADDRESS && /^0x[a-fA-F0-9]{64}$/.test(CFG.MY_ADDRESS)) {
                    try {
                        const client = getClient();
                        discovered = await Promise.race([
                            getPackageIdsForOwner(client, CFG.MY_ADDRESS, 100),
                            new Promise<string[]>((r) => setTimeout(() => r([]), 12000)),
                        ]);
                        if (discovered.length === 0) {
                            const owned = await Promise.race([
                                getAllOwnedObjects(client, CFG.MY_ADDRESS, null, 500),
                                new Promise<import('./chain-access.js').OwnedObjectSummary[]>((r) => setTimeout(() => r([]), 12000)),
                            ]);
                            discovered = extractPackageIdsFromOwnedObjects(owned);
                        }
                        if (debugOwned) {
                            debugOwnedPayload = await getOwnedObjectsDebug(client, CFG.MY_ADDRESS, 50);
                        }
                    } catch {
                        // ignore
                    }
                }
                const hints = readPackageIdHints();
                const payload: Record<string, unknown> = { ok: true, current, history, discovered, hints };
                if (debugOwnedPayload !== undefined) payload.debugOwnedObjects = debugOwnedPayload;
                sendJson(res, 200, payload, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }
        if (url === '/api/debug/owned-objects' && req.method === 'GET') {
            try {
                if (!CFG.MY_ADDRESS || !/^0x[a-fA-F0-9]{64}$/.test(CFG.MY_ADDRESS)) {
                    sendJson(res, 400, { ok: false, error: 'MY_ADDRESS nicht gesetzt oder ungültig' }, cors);
                    return;
                }
                const u = new URL(req.url || '', 'http://localhost');
                const max = Math.min(parseInt(u.searchParams.get('max') || '50', 10) || 50, 100);
                const client = getClient();
                const debugPayload = await getOwnedObjectsDebug(client, CFG.MY_ADDRESS, max);
                sendJson(res, 200, { ok: true, myAddress: CFG.MY_ADDRESS.slice(0, 18) + '…', ...debugPayload }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }
        if (url === '/api/streams-publish' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    if (!_commandHandler) {
                        sendJson(res, 400, { ok: false, error: 'Wallet entsperren, dann erneut versuchen.' }, cors);
                        return;
                    }
                    const data = JSON.parse(body || '{}');
                    const anchorId = String(data.anchorId ?? '').trim();
                    const payload =
                        typeof data.payload === 'string'
                            ? data.payload
                            : JSON.stringify(data.payload ?? {});
                    if (!/^0x[a-fA-F0-9]{64}$/i.test(anchorId)) {
                        sendJson(res, 400, { ok: false, error: 'anchorId: 0x + 64 Hex nötig.' }, cors);
                        return;
                    }
                    const bridgeUrl = (CFG.STREAMS_BRIDGE_URL || '').trim().replace(/\/$/, '');
                    if (!bridgeUrl.startsWith('http://') && !bridgeUrl.startsWith('https://')) {
                        sendJson(res, 400, { ok: false, error: 'STREAMS_BRIDGE_URL fehlt oder ungültig.' }, cors);
                        return;
                    }
                    const { getStreamsAdapter } = await import('./streams-adapter.js');
                    await getStreamsAdapter().publish(anchorId, payload);
                    sendJson(res, 200, { ok: true, message: 'An Streams-Anchor gesendet.' }, cors);
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/streams-anchor-history' && req.method === 'GET') {
            (async () => {
                try {
                    seedStreamsAnchorHistoryFromKnownFiles();
                    const historyFromFile = readStreamsAnchorIdHistory();
                    let bridgeAnchors: string[] = [];
                    const urlsToTry: string[] = [];
                    const u = (CFG.STREAMS_BRIDGE_URL || '').trim().replace(/\/$/, '');
                    if (u && (u.startsWith('http://') || u.startsWith('https://'))) urlsToTry.push(u);
                    try {
                        const parsed = new URL(u || 'http://127.0.0.1');
                        const host = parsed.hostname || '127.0.0.1';
                        const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
                        if (port === 3342 || port === 3343 || urlsToTry.length === 0) {
                            urlsToTry.push(`http://${host}:3443`, `http://${host}:9343`);
                        }
                    } catch {
                        if (urlsToTry.length === 0) urlsToTry.push('http://127.0.0.1:3443', 'http://127.0.0.1:9343');
                    }
                    for (const baseUrl of [...new Set(urlsToTry)]) {
                        try {
                            const fr = await fetch(`${baseUrl}?list=1`, { signal: AbortSignal.timeout(4000) });
                            if (fr.ok) {
                                const data = await fr.json() as { anchors?: string[] };
                                if (Array.isArray(data?.anchors)) { bridgeAnchors = data.anchors; break; }
                            }
                        } catch { /* nächste URL */ }
                    }
                    const display = getConfigDisplay();
                    const row = display.find((r) => (r.envKey || r.key) === 'STREAMS_ANCHOR_ID');
                    const raw = (row?.value ?? '').trim();
                    const current = raw === '(leer)' ? '' : raw;
                    const merged = dedupeStreamAnchorIds([...bridgeAnchors, ...historyFromFile].filter(Boolean));
                    const curNorm = current.trim().toLowerCase();
                    const history = curNorm
                        ? merged.filter((id) => id.trim().toLowerCase() !== curNorm)
                        : merged;
                    sendJson(res, 200, { ok: true, current, history }, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            })();
            return;
        }

        if (url === '/api/package-id-hints' && req.method === 'GET') {
            try {
                const hints = readPackageIdHints();
                sendJson(res, 200, { ok: true, hints }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/package-id-hints' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const packageId = String(data.packageId ?? '').trim();
                    if (!packageId || !/^0x[a-fA-F0-9]{64}$/.test(packageId)) {
                        sendJson(res, 400, { ok: false, error: 'packageId (0x + 64 Hex) erforderlich' }, cors);
                        return;
                    }
                    const hint = {
                        label: data.label != null ? String(data.label).trim() : undefined,
                        peer: data.peer != null ? String(data.peer).trim() : undefined,
                        note: data.note != null ? String(data.note).trim() : undefined,
                    };
                    savePackageIdHint(packageId, hint);
                    sendJson(res, 200, { ok: true, hints: readPackageIdHints() }, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/config' && req.method === 'GET') {
            try {
                const config = getConfigDisplay();
                sendJson(
                    res,
                    200,
                    {
                        ok: true,
                        config,
                        messengerMeta: {
                            networkTrustTier: CFG.NETWORK_TRUST_TIER,
                            rpcCandidateCount: getRpcCandidateCount(),
                            activeRpcUrl: getEffectiveRpcUrlLabel(),
                            rpcHttpProxySet: Boolean((CFG.RPC_HTTP_PROXY || '').trim()),
                            rpcSocksProxySet: Boolean((CFG.RPC_SOCKS_PROXY || '').trim()),
                            enableHdContactAddresses: CFG.ENABLE_HD_CONTACT_ADDRESSES,
                            messengerEdition: CFG.MESSENGER_EDITION,
                            verifiedIotaNamePackageIds: [...CFG.VERIFIED_IOTA_NAME_PACKAGE_IDS],
                        },
                    },
                    cors
                );
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url.startsWith('/api/doc') && req.method === 'GET') {
            let docBaseName = '';
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const raw = (u.searchParams.get('name') || '').trim();
                const name = /^[a-zA-Z0-9_.-]+\.md$/.test(raw) ? raw : '';
                docBaseName = name;
                if (!name) {
                    sendJson(res, 400, { ok: false, error: 'name=xxx.md erforderlich (nur A-Za-z0-9_.-)' }, cors);
                    return;
                }
                const __dirname = path.dirname(fileURLToPath(import.meta.url));
                const docPath = path.resolve(__dirname, '..', 'docs', path.basename(name));
                const rel = path.relative(path.resolve(__dirname, '..', 'docs'), docPath);
                if (rel.startsWith('..') || path.isAbsolute(rel)) {
                    sendJson(res, 403, { ok: false, error: 'Forbidden' }, cors);
                    return;
                }
                const md = fs.readFileSync(docPath, 'utf-8');
                const html = markdownToHtml(md);
                sendJson(res, 200, { ok: true, html }, cors);
            } catch (e: any) {
                if (e?.code === 'ENOENT') {
                    sendJson(res, 404, { ok: false, error: 'Anleitung nicht gefunden: ' + path.basename(docBaseName || 'unknown.md') }, cors);
                } else {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            }
            return;
        }

        if (url === '/api/connect-addresses' && req.method === 'GET') {
            try {
                const addresses = getConnectAddresses();
                sendJson(res, 200, { ok: true, addresses }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/chain-reachable' && req.method === 'GET') {
            try {
                const reachable = await isChainReachable();
                sendJson(res, 200, { ok: true, reachable }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url.startsWith('/api/iota-name-lookup') && req.method === 'GET') {
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const name = (u.searchParams.get('name') || '').trim();
                if (!name) {
                    sendJson(res, 400, { ok: false, error: 'Query ?name= erforderlich (z. B. beispiel.iota).' }, cors);
                    return;
                }
                const { iotaNamesLookup, registrationNftMatchesAllowedPackages } = await import('./iota-names-lookup.js');
                const rec = await iotaNamesLookup(CFG.RPC_URL, name);
                const allow = CFG.VERIFIED_IOTA_NAME_PACKAGE_IDS;
                let registrationNftVerified: boolean | undefined;
                let registrationNftType: string | undefined;
                if (allow.length > 0) {
                    const m = await registrationNftMatchesAllowedPackages(getClient(), rec.nftId, allow);
                    registrationNftVerified = m.matches;
                    registrationNftType = m.objectType;
                }
                sendJson(
                    res,
                    200,
                    {
                        ok: true,
                        name,
                        nftId: rec.nftId,
                        targetAddress: rec.targetAddress,
                        expirationTimestampMs: rec.expirationTimestampMs,
                        registrationNftVerified,
                        registrationNftType,
                    },
                    cors
                );
            } catch (e: unknown) {
                sendJson(res, 502, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
            return;
        }

        if (url === '/api/rpc-rotate' && req.method === 'POST') {
            try {
                resetRpcClient('next');
                const reachable = await isChainReachable();
                sendJson(
                    res,
                    200,
                    {
                        ok: true,
                        rpcUrl: getActiveRpcUrl(),
                        reachable,
                        rpcCandidateCount: getRpcCandidateCount(),
                        warning:
                            'Öffentliche RPCs können Logs führen. Stufe 2: RPC_HTTP_PROXY setzen; Stufe 3: eigener Node.',
                    },
                    cors
                );
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
            return;
        }

        if (url === '/api/shadow-sweep' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}') as { shadowMnemonic?: string; mnemonic?: string };
                    const mnemonic = String(data.shadowMnemonic ?? data.mnemonic ?? '').trim();
                    if (!mnemonic) {
                        sendJson(res, 400, { ok: false, error: 'shadowMnemonic fehlt (12+ Wörter).' }, cors);
                        return;
                    }
                    const { executeShadowSweep } = await import('./shadow-sweep.js');
                    const result = await executeShadowSweep(getClient(), mnemonic);
                    if (!result.ok) {
                        sendJson(res, 400, result, cors);
                        return;
                    }
                    sendJson(
                        res,
                        200,
                        {
                            ...result,
                            securityNote:
                                'Mnemonic und Secret nur über localhost/API auf 127.0.0.1 senden. Secret sofort im Tresor sichern; nicht erneut abrufbar.',
                        },
                        cors
                    );
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/config' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const key = String(data.key || '').trim();
                    const value = String(data.value ?? '');
                    if (!key) {
                        sendJson(res, 400, { ok: false, error: 'key fehlt' }, cors);
                        return;
                    }
                    const role = CFG.ROLE;
                    const allowTestRoleOverride = process.env.ALLOW_TEST_ROLE_OVERRIDE === 'true' || process.env.ALLOW_TEST_ROLE_OVERRIDE === '1';
                    if (role === 'boss' || role === 'kommandant' || role === 'arbeiter') {
                        const perms = getHierarchyPermissions(role);
                        if (isHierarchyConfigKey(key)) {
                            if (!allowTestRoleOverride && !perms.hierarchyChange) {
                                sendJson(res, 403, { ok: false, error: 'Nur Boss darf Hierarchie (ROLE, BOSS_ADDRESS, …) ändern.' }, cors);
                                return;
                            }
                        } else {
                            if (!perms.configChange) {
                                sendJson(res, 403, { ok: false, error: 'Konfiguration darf nur der Boss ändern.' }, cors);
                                return;
                            }
                        }
                    } else if (isHierarchyConfigKey(key) && !(process.env.ALLOW_TEST_ROLE_OVERRIDE === 'true' || process.env.ALLOW_TEST_ROLE_OVERRIDE === '1')) {
                        sendJson(res, 403, { ok: false, error: 'Hierarchie (ROLE, …) nur als Boss/Kommandant/Arbeiter änderbar. Für Test: .env um ALLOW_TEST_ROLE_OVERRIDE=true ergänzen, Backend neu starten.' }, cors);
                        return;
                    }
                    const normalized = key.toUpperCase();
                    const result =
                        normalized === 'SIGNER' ||
                        normalized === 'WALLET_DERIVATION_PATH' ||
                        normalized === 'USE_MAILBOX' ||
                        normalized === 'MAILBOX_STORE_PLAINTEXT' ||
                        normalized === 'ENABLE_PLAINTEXT_CHANNEL'
                            ? setRuntimeConfigKey(normalized, value)
                            : setEnvKey(key, value);
                    sendJson(res, 200, result, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/help' && req.method === 'GET') {
            const helpText =
                HELP_UI_INTRO + (_sessionStatus.connected ? HELP_CHAT : HELP_START);
            sendJson(res, 200, { ok: true, helpText }, cors);
            return;
        }

        if (url === '/api/contact-labels' && req.method === 'GET') {
            try {
                const { loadContactLabels } = await import('./contact-labels.js');
                sendJson(
                    res,
                    200,
                    { ok: true, labels: loadContactLabels(), directory: loadContactDirectory() },
                    cors
                );
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
            return;
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
            return;
        }

        if (url === '/api/mesh-contact-lookup' && req.method === 'GET') {
            try {
                const q = new URL(req.url || '', 'http://x');
                const nodeId = String(q.searchParams.get('nodeId') ?? '').trim();
                if (!nodeId) {
                    sendJson(res, 400, { ok: false, error: 'nodeId fehlt' }, cors);
                    return;
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
            return;
        }

        if (url === '/api/mesh-contact-lookup-ble' && req.method === 'GET') {
            try {
                const q = new URL(req.url || '', 'http://x');
                const uuid = String(q.searchParams.get('uuid') ?? '').trim();
                if (!uuid) {
                    sendJson(res, 400, { ok: false, error: 'uuid fehlt' }, cors);
                    return;
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
            return;
        }

        if (url === '/api/contact-mesh-export-encrypted' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const password = String(data.password ?? '');
                    if (password.length < 8) {
                        sendJson(res, 400, { ok: false, error: 'Passwort mindestens 8 Zeichen.' }, cors);
                        return;
                    }
                    const { exportEncryptedContactMesh } = await import('./contact-mesh-sync.js');
                    const bundle = exportEncryptedContactMesh(password);
                    sendJson(res, 200, { ok: true, bundle }, cors);
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/contact-mesh-import-encrypted' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
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
                    const { importEncryptedContactMesh } = await import('./contact-mesh-sync.js');
                    const { merged } = importEncryptedContactMesh(password, bundle);
                    sendJson(res, 200, { ok: true, merged, message: `${merged} Kontakt(e) zusammengeführt.` }, cors);
                } catch (e: unknown) {
                    sendJson(res, 400, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/contact-label' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const address = String(data.address ?? '').trim();
                    if (!/^0x[a-fA-F0-9]{64}$/.test(address)) {
                        sendJson(res, 400, { ok: false, error: 'address muss 0x + 64 Hex sein.' }, cors);
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
                        });
                    } else if (
                        data.meshNodeId !== undefined ||
                        data.meshPublicKeyHex !== undefined ||
                        data.bleUuid !== undefined ||
                        data.mailboxObjectId !== undefined
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
                        });
                    }
                    sendJson(res, 200, { ok: true, message: 'Kontakt gespeichert.' }, cors);
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        if (url.startsWith('/api/find-peer-handshake') && req.method === 'GET') {
            try {
                const myAddr = CFG.MY_ADDRESS;
                if (!myAddr) {
                    sendJson(res, 400, { ok: false, error: 'MY_ADDRESS nicht gesetzt' }, cors);
                    return;
                }
                const u = new URL(req.url || '', 'http://localhost');
                const peer = String(u.searchParams.get('peer') || '').trim();
                const result = /^0x[a-fA-F0-9]{64}$/.test(peer)
                    ? await findPeerHandshakeFrom(myAddr, peer)
                    : await findPeerHandshake(myAddr);
                if (!result) {
                    sendJson(res, 200, { ok: true, found: false, message: 'Kein Handshake gefunden' }, cors);
                    return;
                }
                sendJson(res, 200, {
                    ok: true,
                    found: true,
                    sender: result.sender,
                    nonce: String(result.nonce),
                    peerPubRawBase64: Buffer.from(result.pubKeyRaw).toString('base64'),
                }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/pending-handshakes' && req.method === 'GET') {
            try {
                const myAddr = CFG.MY_ADDRESS;
                if (!myAddr) {
                    sendJson(res, 400, { ok: false, error: 'MY_ADDRESS nicht gesetzt' }, cors);
                    return;
                }
                const offers = await listIncomingHandshakeOffers(myAddr, { limit: 25 });
                sendJson(res, 200, { ok: true, offers }, cors);
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
            return;
        }

        if (url.startsWith('/api/has-valid-ticket') && req.method === 'GET') {
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
                const eventId = u.searchParams.get('eventId')?.trim();
                if (!owner || !eventId) {
                    sendJson(res, 400, { ok: false, error: 'owner und eventId als Query-Parameter nötig' }, cors);
                    return;
                }
                const client = getClient();
                const valid = await hasValidTicket(client, CFG.PACKAGE_ID, owner, eventId);
                sendJson(res, 200, { ok: true, valid }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url.startsWith('/api/list-tickets') && req.method === 'GET') {
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
                if (!owner) {
                    sendJson(res, 400, { ok: false, error: 'owner als Query-Parameter oder MY_ADDRESS nötig' }, cors);
                    return;
                }
                const client = getClient();
                const tickets = await getOwnedTickets(client, CFG.PACKAGE_ID, owner);
                sendJson(res, 200, { ok: true, tickets }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url.startsWith('/api/list-keys') && req.method === 'GET') {
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
                if (!owner) {
                    sendJson(res, 400, { ok: false, error: 'owner als Query-Parameter oder MY_ADDRESS nötig' }, cors);
                    return;
                }
                const client = getClient();
                const keys = await getOwnedAccessKeys(client, CFG.PACKAGE_ID, owner);
                sendJson(res, 200, { ok: true, keys }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/owned-objects' && req.method === 'GET') {
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
                if (!owner || !/^0x[a-fA-F0-9]{64}$/.test(owner)) {
                    sendJson(res, 400, { ok: false, error: 'owner als Query-Parameter (0x + 64 Hex) oder MY_ADDRESS nötig' }, cors);
                    return;
                }
                const client = getClient();
                const ourPackageId = (CFG.PACKAGE_ID?.trim() || null);
                const objects = await getAllOwnedObjects(client, owner, ourPackageId);
                sendJson(res, 200, { ok: true, owner, objects }, cors);
            } catch (e: any) {
                const msg = String(e?.message || e);
                sendJson(res, 500, { ok: false, error: msg }, cors);
            }
            return;
        }

        if (url === '/api/rebate-candidates' && req.method === 'GET') {
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const owner = u.searchParams.get('owner')?.trim() || CFG.MY_ADDRESS;
                const packageIdParam = u.searchParams.get('packageId')?.trim();
                const packageId = packageIdParam && /^0x[a-fA-F0-9]{64}$/.test(packageIdParam)
                    ? packageIdParam
                    : (CFG.PACKAGE_ID?.trim() || '');
                if (!owner) {
                    sendJson(res, 400, { ok: false, error: 'owner als Query-Parameter oder MY_ADDRESS nötig' }, cors);
                    return;
                }
                if (!/^0x[a-fA-F0-9]{64}$/.test(owner)) {
                    sendJson(res, 400, { ok: false, error: 'owner muss 0x gefolgt von 64 Hex-Zeichen sein' }, cors);
                    return;
                }
                if (!packageId) {
                    sendJson(res, 400, { ok: false, error: 'PACKAGE_ID fehlt. Im Feld „Package-ID“ eintragen oder zuerst /set-package-id setzen.' }, cors);
                    return;
                }
                const client = getClient();
                const timeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
                    Promise.race([p, new Promise<T>(r => setTimeout(() => r(fallback), ms))]);
                const [keys, tickets, mailbox] = await Promise.all([
                    timeout(getOwnedAccessKeys(client, packageId, owner), 15000, []),
                    timeout(getOwnedTickets(client, packageId, owner), 15000, []),
                    CFG.MAILBOX_ID
                        ? timeout(getMailboxRebateCandidates(owner), 15000, { handshakes: [], messages: [] })
                        : Promise.resolve({ handshakes: [] as any[], messages: [] as any[] }),
                ]);
                sendJson(res, 200, {
                    ok: true,
                    owner,
                    packageId,
                    keys,
                    tickets,
                    mailboxHandshakes: mailbox.handshakes,
                    mailboxMessages: mailbox.messages,
                }, cors);
            } catch (e: any) {
                const msg = String(e?.message || e);
                sendJson(res, 500, { ok: false, error: msg }, cors);
            }
            return;
        }

        if (url === '/api/reference-gas-price' && req.method === 'GET') {
            try {
                const price = await Promise.race([
                    getReferenceGasPrice(),
                    new Promise<bigint>((_, rej) => setTimeout(() => rej(new Error('RPC-Timeout (10s)')), 10000)),
                ]);
                sendJson(res, 200, { ok: true, referenceGasPrice: String(price), unit: 'NANOS' }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/unlock' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const password = String(data.password ?? '');
                    if (!_resolvePassword) {
                        const err =
                            _commandHandler == null
                                ? 'Backend hat noch keinen Befehls-Handler (Start noch nicht fertig oder falscher Modus, z. B. Schloss-Loop). Seite neu laden, .env prüfen (ROLE=arbeiter nur mit LOCK_ID = Schloss; ohne LOCK_ID = Messenger).'
                                : 'Bereits entsperrt';
                        sendJson(res, 400, { ok: false, error: err }, cors);
                        return;
                    }
                    if (!password) {
                        sendJson(res, 400, { ok: false, error: 'Passwort fehlt' }, cors);
                        return;
                    }
                    const vaultPath = CFG.VAULT_FILE || '.morgendrot-vault';
                    let vaultChecked = false;
                    const signerPost = String(data.sdkSignerImport ?? data.secretKey ?? data.mnemonic ?? '').trim();
                    let sdkSignerReady = CFG.SIGNER !== 'sdk';

                    if (vaultFileExists(vaultPath)) {
                        try {
                            if (CFG.SIGNER === 'sdk') {
                                const content = await loadVaultContent(password, vaultPath);
                                vaultChecked = true;
                                const fromVault = (content.iotaSdkSignerImport || '').trim();
                                try {
                                    if (fromVault) {
                                        applySdkSignerFromImport(fromVault);
                                        sdkSignerReady = true;
                                    } else if (signerPost) {
                                        applySdkSignerFromImport(signerPost);
                                        sdkSignerReady = true;
                                    } else {
                                        sendJson(res, 400, {
                                            ok: false,
                                            code: 'SIGNER_IMPORT_REQUIRED',
                                            error:
                                                'SIGNER=sdk: In diesem Vault ist kein gespeicherter Signer-Import (weder Mnemonic noch Bech32-Secret). Trage im Formular ein: 12–24 Wörter ODER den Secret-Key (Bech32 wie von generate-mnemonic) ODER 64 Hex-Zeichen. Danach optional unter Tresor „mit speichern“.',
                                        }, cors);
                                        return;
                                    }
                                } catch (e: any) {
                                    sendJson(res, 400, { ok: false, error: String(e?.message || e) }, cors);
                                    return;
                                }
                            } else {
                                await loadVaultLocal(password, vaultPath);
                                vaultChecked = true;
                            }
                        } catch {
                            sendJson(
                                res,
                                400,
                                {
                                    ok: false,
                                    error: 'Falsches Passwort oder beschädigter Vault (lokale Datei lässt sich nicht entschlüsseln).',
                                },
                                cors
                            );
                            return;
                        }
                    } else if (CFG.VAULT_REGISTRY_ID && CFG.PACKAGE_ID) {
                        const myAddr = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
                        if (myAddr && /^0x[a-fA-F0-9]{64}$/i.test(myAddr)) {
                            try {
                                const enc = await getVaultFromChain(
                                    getClient(),
                                    CFG.VAULT_REGISTRY_ID,
                                    CFG.PACKAGE_ID,
                                    myAddr
                                );
                                if (enc && enc.length > 0) {
                                    if (CFG.SIGNER === 'sdk') {
                                        const content = await loadVaultFromChainPayload(enc, password);
                                        vaultChecked = true;
                                        const fromVault = (content.iotaSdkSignerImport || '').trim();
                                        try {
                                            if (fromVault) {
                                                applySdkSignerFromImport(fromVault);
                                                sdkSignerReady = true;
                                            } else if (signerPost) {
                                                applySdkSignerFromImport(signerPost);
                                                sdkSignerReady = true;
                                            } else {
                                                sendJson(res, 400, {
                                                    ok: false,
                                                    code: 'SIGNER_IMPORT_REQUIRED',
                                                    error:
                                                        'SIGNER=sdk: On-Chain-Vault ohne Signer-Import – Mnemonic oder Bech32-Secret im Formular eintragen.',
                                                }, cors);
                                                return;
                                            }
                                        } catch (e: any) {
                                            sendJson(res, 400, { ok: false, error: String(e?.message || e) }, cors);
                                            return;
                                        }
                                    } else {
                                        await loadVaultFromChainPayload(enc, password);
                                        vaultChecked = true;
                                    }
                                }
                            } catch {
                                sendJson(res, 400, {
                                    ok: false,
                                    error: 'Falsches Passwort, On-Chain-Vault nicht lesbar oder RPC-Fehler (MY_ADDRESS / PACKAGE_ID prüfen).',
                                }, cors);
                                return;
                            }
                        }
                    }
                    if (CFG.SIGNER === 'sdk' && !sdkSignerReady) {
                        if (!signerPost) {
                            sendJson(res, 400, {
                                ok: false,
                                code: 'SIGNER_IMPORT_REQUIRED',
                                error:
                                    'SIGNER=sdk: Ohne Vault mit gespeichertem Import bitte Mnemonic (12+ Wörter) oder IOTA-Bech32-Secret (Ausgabe generate-mnemonic) oder 64 Hex-Bytes eintragen. Alternative: SIGNER=cli mit IOTA-Wallet.',
                            }, cors);
                            return;
                        }
                        try {
                            applySdkSignerFromImport(signerPost);
                        } catch (e: any) {
                            sendJson(res, 400, { ok: false, error: String(e?.message || e) }, cors);
                            return;
                        }
                    }
                    const resolve = _resolvePassword;
                    _resolvePassword = null;
                    resolve(password);
                    const okMessage = vaultChecked
                        ? 'Passwort korrekt – Vault entschlüsselt.'
                        : 'Entsperrt. Hinweis: Es wurde kein lokaler Vault und kein On-Chain-Vault mit Daten gefunden – das Passwort konnte nicht gegen einen Vault geprüft werden.';
                    sendJson(res, 200, { ok: true, message: okMessage, vaultVerified: vaultChecked }, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        /** KeePass-ähnlicher Safe: Einträge nur im entsperrten Backend-RAM; optional sofort in Vault-Datei schreiben. */
        if (url === '/api/vault-personal-secrets' && req.method === 'GET') {
            try {
                if (!_vaultPersonalSecretsBridge) {
                    sendJson(res, 503, { ok: false, error: 'Safe-API nicht initialisiert.' }, cors);
                    return;
                }
                const entries = _vaultPersonalSecretsBridge.getEntries();
                if (entries === null) {
                    sendJson(res, 200, { ok: true, unlocked: false, entries: [] }, cors);
                    return;
                }
                sendJson(res, 200, { ok: true, unlocked: true, entries }, cors);
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
            return;
        }

        if (url === '/api/vault-personal-secrets' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    if (!_vaultPersonalSecretsBridge) {
                        sendJson(res, 503, { ok: false, error: 'Safe-API nicht initialisiert.' }, cors);
                        return;
                    }
                    const data = JSON.parse(body || '{}') as { entries?: unknown; persistLocal?: boolean };
                    const sanitized = sanitizePersonalSecrets(data.entries);
                    const result = await _vaultPersonalSecretsBridge.setEntries(sanitized, {
                        persistLocal: data.persistLocal === true,
                    });
                    if (!result.ok) {
                        sendJson(res, 400, { ok: false, error: result.error || 'Fehler' }, cors);
                        return;
                    }
                    sendJson(res, 200, { ok: true, message: result.message, entries: sanitized }, cors);
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        /** Lokaler Klartext-Chat-Cache (verschlüsselte Datei .inbox.enc neben dem Vault) – ohne Wallet nötig. */
        if (url === '/api/clear-local-history' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    let shred = true;
                    try {
                        const data = JSON.parse(body || '{}');
                        if (data.shred === false) shred = false;
                    } catch {
                        /* leerer Body → Standard shred */
                    }
                    const vp = CFG.VAULT_FILE || '.morgendrot-vault';
                    purgeInboxCache(vp, { shred });
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            message: shred
                                ? 'Lokaler Inbox-Cache geschreddert und entfernt.'
                                : 'Lokale Inbox-Datei gelöscht.',
                        },
                        cors
                    );
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        /**
         * Luma+Chroma-Pipeline (sharp) → `MORG_COMPACT_IMG_V1` für **IOTA/Online**.
         * LoRa/Meshtastic: eigene progressive Ziele – siehe `src/morgendrot-image-transport-policy.ts`.
         */
        if (url === '/api/compact-image-encode' && req.method === 'POST') {
            const MAX_BODY = 28 * 1024 * 1024;
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
                if (body.length > MAX_BODY) {
                    body = '';
                    req.destroy();
                }
            });
            req.on('end', async () => {
                try {
                    // Kein Wallet nötig: reine Bildpipeline (sharp); Signatur passiert erst bei /send.
                    const data = JSON.parse(body || '{}');
                    const rawB64 = typeof data.imageBase64 === 'string' ? data.imageBase64 : '';
                    const m = rawB64.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
                    const b64 = (m ? m[1] : rawB64).replace(/\s/g, '');
                    if (!b64) {
                        sendJson(res, 400, { ok: false, error: 'imageBase64 fehlt (Data-URL oder rohes Base64).' }, cors);
                        return;
                    }
                    let raw: Buffer;
                    try {
                        raw = Buffer.from(b64, 'base64');
                    } catch {
                        sendJson(res, 400, { ok: false, error: 'Ungültiges Base64.' }, cors);
                        return;
                    }
                    if (raw.length < 32 || raw.length > 24 * 1024 * 1024) {
                        sendJson(res, 400, { ok: false, error: 'Bildgröße ungültig (32 B … 24 MB).' }, cors);
                        return;
                    }
                    const WIRE_PREFIX = '[[MORG_COMPACT_IMG_V1:';
                    const WIRE_SUFFIX = ']]';
                    const fit = data.fitLuma !== false;
                    if (fit) {
                        const mp = Number(data.maxPlaintextBytes);
                        /** Netto-Blob ≤ MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES (IOTA/Online, MORG_COMPACT_IMG_V1). */
                        const maxBlob =
                            Number.isFinite(mp) && mp >= 4000 && mp <= MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES
                                ? Math.floor(mp)
                                : MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES;
                        const r = await VaultImagePipeline.encodeToPlaintextBlobFitChain(raw, maxBlob);
                        if (r.plaintext.length > maxBlob) {
                            sendJson(
                                res,
                                500,
                                {
                                    ok: false,
                                    error: `Encoder liefert ${r.plaintext.length} B Blob > Limit ${maxBlob}. Backend/Sharp prüfen.`,
                                },
                                cors
                            );
                            return;
                        }
                        const b64 = r.plaintext.toString('base64');
                        const wireLen = WIRE_PREFIX.length + b64.length + WIRE_SUFFIX.length;
                        if (wireLen > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
                            sendJson(
                                res,
                                500,
                                {
                                    ok: false,
                                    error: `Intern: Wire ${wireLen} B UTF-8 > ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES}; Encoder/Limit prüfen.`,
                                },
                                cors
                            );
                            return;
                        }
                        sendJson(
                            res,
                            200,
                            {
                                ok: true,
                                blobBase64: b64,
                                lumaBytes: r.lumaWebpBytes,
                                chromaBytes: r.chromaPngBytes,
                                totalBytes: r.plaintext.length,
                                sha256Hex: r.originalSha256.toString('hex'),
                                usedQuality: r.usedQuality,
                                usedMaxDim: r.usedMaxDim,
                                chromaW: r.chromaW,
                                chromaH: r.chromaH,
                                wireUtf8Approx: wireLen,
                            },
                            cors
                        );
                    } else {
                        const q = Number(data.lumaQuality);
                        const lq = Number.isFinite(q) && q >= 1 && q <= 100 ? q : 78;
                        const r = await VaultImagePipeline.encodeToPlaintextBlob(raw, { lumaQuality: lq });
                        const b64 = r.plaintext.toString('base64');
                        if (WIRE_PREFIX.length + b64.length + WIRE_SUFFIX.length > MESSAGING_MAX_PLAINTEXT_UTF8_BYTES) {
                            sendJson(
                                res,
                                413,
                                {
                                    ok: false,
                                    error:
                                        `Blob zu groß für Messenger (UTF-8-Wire max. ${MESSAGING_MAX_PLAINTEXT_UTF8_BYTES} B; Move pure arg ${MOVE_MAX_PURE_VECTOR_U8_BYTES} B). fitLuma=true (Standard) nutzen.`,
                                    totalBytes: r.plaintext.length,
                                },
                                cors
                            );
                            return;
                        }
                        sendJson(
                            res,
                            200,
                            {
                                ok: true,
                                blobBase64: b64,
                                lumaBytes: r.lumaWebpBytes,
                                chromaBytes: r.chromaPngBytes,
                                totalBytes: r.plaintext.length,
                                sha256Hex: r.originalSha256.toString('hex'),
                                usedQuality: lq,
                            },
                            cors
                        );
                    }
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        /**
         * LoRa/Mesh: zweiphasig Luma+Chroma (JPEG, harte Byte-Budgets) – **nicht** IOTA `MORG_COMPACT_IMG_V1`.
         * POST JSON: { imageBase64 }
         */
        if (url === '/api/lora-progressive-encode' && req.method === 'POST') {
            const MAX_BODY = 28 * 1024 * 1024;
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
                if (body.length > MAX_BODY) {
                    body = '';
                    req.destroy();
                }
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const rawB64 = typeof data.imageBase64 === 'string' ? data.imageBase64 : '';
                    const m = rawB64.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
                    const b64 = (m ? m[1] : rawB64).replace(/\s/g, '');
                    if (!b64) {
                        sendJson(res, 400, { ok: false, error: 'imageBase64 fehlt (Data-URL oder rohes Base64).' }, cors);
                        return;
                    }
                    let raw: Buffer;
                    try {
                        raw = Buffer.from(b64, 'base64');
                    } catch {
                        sendJson(res, 400, { ok: false, error: 'Ungültiges Base64.' }, cors);
                        return;
                    }
                    if (raw.length < 32 || raw.length > 24 * 1024 * 1024) {
                        sendJson(res, 400, { ok: false, error: 'Bildgröße ungültig (32 B … 24 MB).' }, cors);
                        return;
                    }
                    const r = await prepareImageForLoRaRobust(raw);
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            messageId: r.messageId,
                            lumaWire: r.lumaWire,
                            chromaWire: r.chromaWire,
                            lumaJpegBytes: r.lumaJpegBytes,
                            chromaJpegBytes: r.chromaJpegBytes,
                            lumaWireUtf8Bytes: r.lumaWireUtf8Bytes,
                            chromaWireUtf8Bytes: r.chromaWireUtf8Bytes,
                        },
                        cors
                    );
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        /**
         * IOTA-Kompaktblob (`MORG_COMPACT_IMG_V1`-Netto, wie im Composer) → LoRa LUMA+Chroma-Wires (nach Umschalten auf „funk“).
         * POST JSON: { compactBlobBase64 } — kein Wallet.
         */
        if (url === '/api/compact-blob-to-lora-wires' && req.method === 'POST') {
            const MAX_BODY = 6 * 1024 * 1024;
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
                if (body.length > MAX_BODY) {
                    body = '';
                    req.destroy();
                }
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const rawB64 = typeof data.compactBlobBase64 === 'string' ? data.compactBlobBase64 : '';
                    const b64 = rawB64.replace(/\s/g, '');
                    if (!b64) {
                        sendJson(res, 400, { ok: false, error: 'compactBlobBase64 fehlt.' }, cors);
                        return;
                    }
                    let blob: Buffer;
                    try {
                        blob = Buffer.from(b64, 'base64');
                    } catch {
                        sendJson(res, 400, { ok: false, error: 'Ungültiges Base64.' }, cors);
                        return;
                    }
                    /** Online-Kompakt kann bei XL-Presets deutlich über 11,8 KiB liegen (siehe `encodeToPlaintextBlobFitChain`). */
                    if (blob.length < 16 || blob.length > 120_000) {
                        sendJson(
                            res,
                            400,
                            { ok: false, error: 'Kompakt-Blob-Länge ungültig (IOTA-Bild-Anhang erwartet).' },
                            cors
                        );
                        return;
                    }
                    const png = await VaultImagePipeline.reconstructBlendToPng(blob);
                    const r = await prepareImageForLoRaRobust(png);
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            messageId: r.messageId,
                            lumaWire: r.lumaWire,
                            chromaWire: r.chromaWire,
                            lumaJpegBytes: r.lumaJpegBytes,
                            chromaJpegBytes: r.chromaJpegBytes,
                            lumaWireUtf8Bytes: r.lumaWireUtf8Bytes,
                            chromaWireUtf8Bytes: r.chromaWireUtf8Bytes,
                        },
                        cors
                    );
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        /**
         * Messenger: Browser-MediaRecorder (WebM/…) → Ogg/Opus (8 kHz Mono, voip, libopus). Braucht **ffmpeg** im PATH.
         * POST JSON: { audioBase64, mimeType? } — kein Wallet.
         */
        if (url === '/api/messenger-audio-to-opus' && req.method === 'POST') {
            const MAX_BODY = 8 * 1024 * 1024;
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
                if (body.length > MAX_BODY) {
                    body = '';
                    req.destroy();
                }
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const rawB64 = typeof data.audioBase64 === 'string' ? data.audioBase64 : '';
                    const m = rawB64.match(/^data:audio\/[\w+.-]+;base64,(.+)$/i);
                    const b64 = (m ? m[1] : rawB64).replace(/\s/g, '');
                    if (!b64) {
                        sendJson(res, 400, { ok: false, error: 'audioBase64 fehlt (Data-URL oder rohes Base64).' }, cors);
                        return;
                    }
                    let raw: Buffer;
                    try {
                        raw = Buffer.from(b64, 'base64');
                    } catch {
                        sendJson(res, 400, { ok: false, error: 'Ungültiges Base64.' }, cors);
                        return;
                    }
                    const mimeType = typeof data.mimeType === 'string' ? data.mimeType : 'audio/webm';
                    const { opus } = await transcodeBrowserAudioToMessengerOpus(raw, mimeType);
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            opusBase64: opus.toString('base64'),
                            bytes: opus.length,
                        },
                        cors
                    );
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        /**
         * LoRa-Empfänger: Luma+Chroma-JPEG → ein JPEG (sharp `composite` blend `over`). Kein Wallet.
         * POST JSON: { lumaJpegBase64, chromaJpegBase64 } (roh oder data-URL)
         */
        if (url === '/api/lora-progressive-fuse' && req.method === 'POST') {
            const MAX_BODY = 2 * 1024 * 1024;
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
                if (body.length > MAX_BODY) {
                    body = '';
                    req.destroy();
                }
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const strip = (s: string) => {
                        const t = typeof s === 'string' ? s : '';
                        const m = t.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
                        return (m ? m[1] : t).replace(/\s/g, '');
                    };
                    const lb = strip(data.lumaJpegBase64 ?? '');
                    const cb = strip(data.chromaJpegBase64 ?? '');
                    if (!lb || !cb) {
                        sendJson(res, 400, { ok: false, error: 'lumaJpegBase64 und chromaJpegBase64 nötig.' }, cors);
                        return;
                    }
                    let lumaBuf: Buffer;
                    let chromaBuf: Buffer;
                    try {
                        lumaBuf = Buffer.from(lb, 'base64');
                        chromaBuf = Buffer.from(cb, 'base64');
                    } catch {
                        sendJson(res, 400, { ok: false, error: 'Ungültiges Base64.' }, cors);
                        return;
                    }
                    if (lumaBuf.length < 16 || chromaBuf.length < 16 || lumaBuf.length > 6 * 1024 * 1024 || chromaBuf.length > 512 * 1024) {
                        sendJson(res, 400, { ok: false, error: 'JPEG-Größe außerhalb des erlaubten Bereichs.' }, cors);
                        return;
                    }
                    const fused = await fuseLoraProgressiveJpegsSharp(lumaBuf, chromaBuf);
                    sendJson(
                        res,
                        200,
                        { ok: true, fusedJpegBase64: fused.toString('base64') },
                        cors
                    );
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        /** Kompaktes Bild (MORG_COMPACT_IMG_V1-Wire) → PNG für Lite-UI-Vorschau (Sharp, kein Wallet). */
        if (url === '/api/compact-image-preview' && req.method === 'POST') {
            const MAX_BODY = 512 * 1024;
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
                if (body.length > MAX_BODY) {
                    body = '';
                    req.destroy();
                }
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const rawWire = typeof data.wire === 'string' ? data.wire : '';
                    const b64 = extractCompactImageBase64FromWire(rawWire);
                    if (!b64) {
                        sendJson(res, 400, {
                            ok: false,
                            error: 'Kein gültiges MORG_COMPACT_IMG_V1-Wire (Marker/]]/JSON-Hülle prüfen).',
                        }, cors);
                        return;
                    }
                    let blob: Buffer;
                    try {
                        blob = Buffer.from(b64, 'base64');
                    } catch {
                        sendJson(res, 400, { ok: false, error: 'Ungültiges Base64 im Bild-Wire.' }, cors);
                        return;
                    }
                    if (blob.length < 16) {
                        sendJson(res, 400, { ok: false, error: 'Blob zu kurz.' }, cors);
                        return;
                    }
                    const png = await VaultImagePipeline.reconstructBlendToPng(blob);
                    sendJson(
                        res,
                        200,
                        { ok: true, pngBase64: png.toString('base64'), mime: 'image/png' },
                        cors
                    );
                } catch (e: unknown) {
                    sendJson(res, 400, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/restart' && req.method === 'POST') {
            try {
                const child = spawn(process.argv[0], process.argv.slice(1), {
                    detached: true,
                    stdio: 'ignore',
                    cwd: process.cwd(),
                    env: process.env,
                });
                child.unref();
                sendJson(res, 200, { ok: true, message: 'Neustart wird ausgeführt…' }, cors);
                setTimeout(() => process.exit(0), 500);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url.startsWith('/api/monitor-status') && req.method === 'GET') {
            try {
                const status = getMonitorStatus();
                sendJson(res, 200, { ok: true, devices: status }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/gas-station-check' && req.method === 'POST') {
            if (CFG.ROLE !== 'boss' || !CFG.GAS_STATION_ENABLED) {
                sendJson(res, 403, { ok: false, error: 'Nur im Boss-Modus mit GAS_STATION_ENABLED' }, cors);
                return;
            }
            const bossAddress = CFG.MY_ADDRESS?.trim();
            if (!bossAddress) {
                sendJson(res, 400, { ok: false, error: 'MY_ADDRESS fehlt (Wallet nicht geladen)' }, cors);
                return;
            }
            runGasStationCheck(bossAddress, getWalletPassword)
                .then((result) => sendJson(res, 200, { ok: true, ...result }, cors))
                .catch((e: any) => sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors));
            return;
        }

        if (url === '/api/audit-events' && req.method === 'GET') {
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const limit = Math.min(500, Math.max(1, parseInt(u.searchParams.get('limit') || '100', 10) || 100));
                const events = readAuditEvents(limit);
                sendJson(res, 200, { ok: true, events }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url.startsWith('/api/audit-export') && req.method === 'GET') {
            try {
                const u = new URL(req.url || '', 'http://localhost');
                const format = u.searchParams.get('format') || 'csv';
                const limit = Math.min(50000, Math.max(1, parseInt(u.searchParams.get('limit') || '10000', 10) || 10000));
                if (format === 'csv') {
                    const csv = exportAuditCsv(limit);
                    res.writeHead(200, {
                        'Content-Type': 'text/csv; charset=utf-8',
                        'Content-Disposition': 'attachment; filename="audit-export.csv"',
                        ...cors,
                    });
                    res.end('\uFEFF' + csv); // BOM für Excel
                } else if (format === 'pdf') {
                    const stream = await exportAuditPdfStream(limit);
                    res.writeHead(200, {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': 'attachment; filename="audit-export.pdf"',
                        ...cors,
                    });
                    stream.pipe(res);
                } else {
                    sendJson(res, 400, { ok: false, error: 'format=csv oder format=pdf' }, cors);
                }
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/purge-after-lieferung' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const purges = Array.isArray(data.purges) ? data.purges : [];
                    if (purges.length === 0) {
                        sendJson(res, 400, { ok: false, error: 'purges: [{ sender, recipient, nonce }] erforderlich' }, cors);
                        return;
                    }
                    if (!_purgeAfterLieferungHandler) {
                        sendJson(res, 503, { ok: false, error: 'Purge nur im Messenger-Modus mit Wallet verfügbar.' }, cors);
                        return;
                    }
                    _purgeAfterLieferungHandler(purges).then((result) => {
                        sendJson(res, 200, result, cors);
                    }).catch((e: any) => {
                        sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                    });
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/generate-address' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const password = typeof data.password === 'string' ? data.password : undefined;
                    const address = await generateNewAddressCli(password);
                    sendJson(res, 200, { ok: true, address }, cors);
                } catch (e: any) {
                    const msg = String(e?.message || e);
                    sendJson(res, 200, { ok: false, error: msg }, cors);
                }
            });
            return;
        }

        if (url === '/api/generate-mnemonic' && req.method === 'POST') {
            if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'messenger') {
                sendJson(res, 403, { ok: false, error: 'Nur Boss darf Mnemonics generieren.' }, cors);
                return;
            }
            try {
                const { Ed25519Keypair } = await import('@iota/iota-sdk/keypairs/ed25519');
                const keypair = new Ed25519Keypair();
                let address = String(keypair.getPublicKey().toIotaAddress() || '').trim();
                if (address && !/^0x/i.test(address)) address = '0x' + address;
                const exportedKey = keypair.getSecretKey();
                sendJson(res, 200, { ok: true, address, secretKey: exportedKey, note: 'Keypair generiert. Adresse + Secret sicher aufbewahren.' }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/einsatz-role-templates' && req.method === 'GET') {
            if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'messenger') {
                sendJson(res, 403, { ok: false, error: 'Nur Boss/Werkstatt.' }, cors);
                return;
            }
            sendJson(res, 200, { ok: true, templates: loadEinsatzRoleTemplates() }, cors);
            return;
        }

        if (url === '/api/einsatz-role-templates' && req.method === 'POST') {
            if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'messenger') {
                sendJson(res, 403, { ok: false, error: 'Nur Boss/Werkstatt.' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const v = parseEinsatzRoleTemplates(data);
                    if (!v.ok) {
                        sendJson(res, 400, { ok: false, error: v.error }, cors);
                        return;
                    }
                    saveEinsatzRoleTemplates(v.templates);
                    sendJson(res, 200, { ok: true, templates: v.templates, message: 'Einsatz-Templates gespeichert.' }, cors);
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/provision-device' && req.method === 'POST') {
            if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'messenger') {
                sendJson(res, 403, { ok: false, error: 'Nur Boss darf Geräte provisionieren.' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}') as Record<string, unknown>;
                    const idemResolved = resolveProvisionIdempotencyKey(req.headers['idempotency-key'], data);
                    if (idemResolved.error) {
                        sendJson(res, 400, { ok: false, error: idemResolved.error }, cors);
                        return;
                    }
                    const idemKey = idemResolved.key;
                    const idemFp = idemKey ? provisionRequestFingerprint(data) : null;

                    const runProvision = (): void => {
                        const role = data.role as string;
                        const allowedRoles = ['kommandant', 'arbeiter', 'lock', 'monitor', 'waerter', 'user'];
                        if (!allowedRoles.includes(role)) {
                            sendJson(res, 400, { ok: false, error: 'role muss einer von: ' + allowedRoles.join(', ') + ' sein.' }, cors);
                            return;
                        }
                        let initialProfile: DeviceProvisionParams['initialProfile'];
                        if (data.initialProfile !== undefined && data.initialProfile !== null) {
                            const v = parseAndValidateInitialProfile(data.initialProfile);
                            if (!v.ok) {
                                sendJson(res, 400, { ok: false, error: v.error }, cors);
                                return;
                            }
                            initialProfile = v.profile;
                        }
                        const hardwareType = (data.hardwareType as string) || 'desktop';
                        const isTiny = hardwareType === 'tiny';
                        const deviceSecret =
                            isTiny && (data.deviceSecret === true || data.generateDeviceSecret)
                                ? generateDeviceSecret()
                                : ((data.deviceSecret as string | undefined) || undefined);
                        const params: DeviceProvisionParams = {
                            role: role as DeviceProvisionParams['role'],
                            roleId: role === 'waerter' ? 14 : (parseInt(String(data.roleId)) || (role === 'monitor' ? 12 : 14)),
                            deviceName: (data.deviceName as string) || '',
                            address: (data.address as string) || '',
                            mnemonic: (data.mnemonic as string) || '',
                            bossAddress: (data.bossAddress as string) || CFG.MY_ADDRESS || '',
                            kommandantAddresses: (data.kommandantAddresses as string[] | undefined) || [],
                            workerAddresses: (data.workerAddresses as string[] | undefined) || [],
                            packageId: (data.packageId as string) || CFG.PACKAGE_ID || '',
                            rpcUrl: (data.rpcUrl as string) || CFG.RPC_URL || '',
                            lockId: (data.lockId as string) || '',
                            openCommand: (data.openCommand as string) || '',
                            closeCommand: (data.closeCommand as string) || '',
                            heartbeatIntervalMs: parseInt(String(data.heartbeatIntervalMs)) || 30000,
                            enableHeartbeat: data.enableHeartbeat === true || data.enableHeartbeat === 'true',
                            signer: (data.signer as DeviceProvisionParams['signer']) || 'cli',
                            remoteSigner: (data.remoteSigner as string) || '',
                            streamsAnchorId: (data.streamsAnchorId as string) || CFG.STREAMS_ANCHOR_ID || '',
                            streamsBridgeUrl: (data.streamsBridgeUrl as string) || CFG.STREAMS_BRIDGE_URL || '',
                            monitorDevices: Array.isArray(data.monitorDevices)
                                ? (data.monitorDevices as string[])
                                : data.monitorDevices
                                  ? [String(data.monitorDevices)]
                                  : [],
                            mailboxId: (data.mailboxId as string) || CFG.MAILBOX_ID || '',
                            commandRegistryId: (data.commandRegistryId as string) || CFG.COMMAND_REGISTRY_ID || '',
                            sponsorGasOwner: (data.sponsorGasOwner as string) || CFG.MY_ADDRESS || '',
                            enableUi: data.enableUi !== false && hardwareType === 'desktop',
                            hardwareType: hardwareType as DeviceProvisionParams['hardwareType'],
                            gatewayUrl: (data.gatewayUrl as string) || '',
                            deviceSecret,
                            ticketOrKeyObjectId: (data.ticketOrKeyObjectId as string) || (data.ticketObjectId as string) || '',
                            ...(initialProfile ? { initialProfile } : {}),
                        };
                        /** Plug-and-play: IoT-Gateway ohne Mnemonic → Boss signiert (kein iota-CLI auf dem Pi nötig). */
                        const isGateway = hardwareType === 'gateway';
                        const seedless = !params.mnemonic;
                        const remoteDefaultRoles = ['arbeiter', 'lock', 'kommandant', 'monitor'];
                        if (isGateway && seedless && remoteDefaultRoles.includes(role)) {
                            params.signer = 'remote';
                            const pub = (process.env.BOSS_SIGNER_PUBLIC_URL || '').trim();
                            if (pub && !String(params.remoteSigner || '').trim()) {
                                params.remoteSigner = pub;
                            }
                        }
                        const envContent = buildDeviceEnv(params);
                        const jsonConfig = buildDeviceJson(params);
                        const qrPayload =
                            role === 'user' && params.ticketOrKeyObjectId
                                ? params.ticketOrKeyObjectId
                                : buildQrPayload(params);
                        let identityHeader: string | undefined;
                        if (isTiny && (params.deviceSecret || params.gatewayUrl || params.deviceName)) {
                            identityHeader = buildIdentityHeader(params);
                        }
                        const explorerBase = (process.env.EXPLORER_BASE_URL || 'https://explorer.iota.org/object').replace(
                            /\/$/,
                            ''
                        );
                        const explorerLink =
                            role === 'user' && params.ticketOrKeyObjectId
                                ? `${explorerBase}/${params.ticketOrKeyObjectId}`
                                : undefined;

                        const hierarchyProvisionRoles = new Set([
                            'kommandant',
                            'arbeiter',
                            'lock',
                            'monitor',
                            'waerter',
                            'boss',
                            'messenger',
                        ]);
                        if (params.address && hierarchyProvisionRoles.has(role)) {
                            const reg = assignDeviceRoleInEnv(params.address, role);
                            if (!reg.ok) {
                                sendJson(
                                    res,
                                    400,
                                    {
                                        ok: false,
                                        error: reg.error || 'DEVICE_ROLES / Listen konnten nicht aktualisiert werden.',
                                    },
                                    cors
                                );
                                return;
                            }
                        }

                        const successPayload: Record<string, unknown> = {
                            ok: true,
                            envContent,
                            jsonConfig,
                            qrPayload,
                            ...(initialProfile ? { initialProfile } : {}),
                            ...(identityHeader ? { identityHeader } : {}),
                            ...(explorerLink ? { explorerLink } : {}),
                            ...(deviceSecret ? { deviceSecretForGateway: deviceSecret } : {}),
                        };
                        if (idemKey && idemFp) {
                            saveProvisionIdempotencySuccess(idemKey, idemFp, successPayload);
                        }
                        sendJson(res, 200, successPayload, cors);
                    };

                    if (idemKey && idemFp) {
                        await withProvisionDeviceIdempotencyLock(async () => {
                            const idem = tryProvisionIdempotentReplayOrConflict(idemKey, idemFp);
                            if (idem.kind === 'replay') {
                                sendJson(res, 200, { ...idem.response, idempotentReplay: true }, cors);
                                return;
                            }
                            if (idem.kind === 'conflict') {
                                sendJson(
                                    res,
                                    409,
                                    {
                                        ok: false,
                                        error:
                                            'Idempotency-Key wurde bereits mit anderem Anfrageinhalt verwendet. Neuen Key erzeugen oder denselben Body senden.',
                                        code: 'IDEMPOTENCY_KEY_REUSE',
                                    },
                                    cors
                                );
                                return;
                            }
                            runProvision();
                        });
                    } else {
                        runProvision();
                    }
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        /**
         * Messenger-Stapel: eigene .env pro Einheit (ohne Arbeiter-Provisioning), optional Boss DEVICE_ROLES.
         * Schreibt exports/messenger-shipments/<runId>/u001/… + boss-only/manifest.json (Geheimnisse nur dort).
         * Optional: einzeln direkt ins Bundle (count=1, writeToEditionBundle).
         */
        if (url === '/api/messenger-export-batch' && req.method === 'POST') {
            if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'kommandant') {
                sendJson(res, 403, { ok: false, error: 'Nur Boss oder Kommandant.' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}') as Record<string, unknown>;
                    const edition: 'standalone' | 'sales' = data.edition === 'sales' ? 'sales' : 'standalone';
                    /** Obergrenze pro Lauf: verhindert extreme Laufzeiten/RPC-Last; große Mengen in mehreren Läufen. */
                    const count = Math.max(1, Math.min(2500, parseInt(String(data.count), 10) || 1));
                    const writeToEditionBundle = data.writeToEditionBundle === true || data.writeToEditionBundle === 'true';
                    if (writeToEditionBundle && count !== 1) {
                        sendJson(res, 400, { ok: false, error: 'writeToEditionBundle nur mit count=1.' }, cors);
                        return;
                    }
                    const registerAddresses = data.registerAddresses !== false && data.registerAddresses !== 'false';
                    const pkgRes = resolveMessengerExportPackageId({
                        source: data.packageSource === 'custom' ? 'custom' : data.packageSource === 'history' ? 'history' : 'boss',
                        customPackageId: String(data.customPackageId || '').trim(),
                        historyFromNewest: parseInt(String(data.historyFromNewest ?? 0), 10) || 0,
                    });
                    if (!pkgRes.ok) {
                        sendJson(res, 400, { ok: false, error: pkgRes.error }, cors);
                        return;
                    }
                    const rpcUrl = String(data.rpcUrl || CFG.RPC_URL || '').trim() || 'https://api.testnet.iota.cafe';
                    const bossAddress = String(data.bossAddress || CFG.MY_ADDRESS || '').trim();
                    if (!/^0x[a-fA-F0-9]{64}$/i.test(bossAddress)) {
                        sendJson(res, 400, { ok: false, error: 'bossAddress / Boss MY_ADDRESS: 0x+64Hex nötig.' }, cors);
                        return;
                    }
                    const signerRaw = String(data.signer || 'sdk').toLowerCase();
                    const signer = signerRaw === 'cli' || signerRaw === 'remote' ? signerRaw : 'sdk';
                    const remoteSignerUrl = String(data.remoteSignerUrl || CFG.BOSS_SIGNER_PUBLIC_URL || '').trim();
                    const namePrefix = String(data.namePrefix || 'Messenger').replace(/[^\wäöüÄÖÜß .\-]/gi, '').slice(0, 48) || 'Messenger';
                    const roleId = Math.max(0, Math.min(63, parseInt(String(data.roleId ?? 14), 10) || 14));
                    const mailboxId = String(data.mailboxId || CFG.MAILBOX_ID || '').trim();
                    const exportMailboxStorePlaintext =
                        data.mailboxStorePlaintext === true || data.mailboxStorePlaintext === 'true';
                    const ttlRaw = data.exportTtlDays ?? data.defaultTtlDays;
                    let exportTtlDays: number | undefined;
                    if (ttlRaw !== undefined && ttlRaw !== null && String(ttlRaw).trim() !== '') {
                        const n = parseInt(String(ttlRaw), 10);
                        if (Number.isFinite(n) && n >= 0 && n <= 3650) exportTtlDays = n;
                    }
                    const mintMessengerCredits =
                        data.mintMessengerCredits === true ||
                        data.mintMessengerCredits === 'true' ||
                        data.mintCredits === true ||
                        data.mintCredits === 'true';
                    if (mintMessengerCredits && edition !== 'sales') {
                        sendJson(res, 400, {
                            ok: false,
                            error:
                                'Messenger-Credits (NFT) nur bei Edition „Verkauf“ (sales). Standalone/Free: kein Boss-Mint – eigene .env ohne vorgefertigtes Credits-Objekt.',
                        }, cors);
                        return;
                    }

                    const u64FromBody = (n: unknown, fallback: number): bigint => {
                        const x =
                            typeof n === 'bigint'
                                ? Number(n)
                                : typeof n === 'number'
                                  ? n
                                  : parseInt(String(n ?? '').trim(), 10);
                        if (!Number.isFinite(x) || x < 0) return BigInt(fallback);
                        return BigInt(Math.min(Math.floor(x), Number.MAX_SAFE_INTEGER));
                    };

                    const { Ed25519Keypair } = await import('@iota/iota-sdk/keypairs/ed25519');
                    const repoRoot = process.cwd();
                    const runId =
                        String(data.runId || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) ||
                        `batch-${new Date().toISOString().replace(/[:.]/g, '-')}`;

                    type UnitOut = {
                        index: number;
                        address: string;
                        deviceName: string;
                        directory?: string;
                        envRel?: string;
                    };
                    const units: UnitOut[] = [];
                    const bossSecrets: Array<{ index: number; address: string; signerImport: string; deviceName: string }> = [];

                    if (writeToEditionBundle) {
                        const sub = edition === 'sales' ? 'Morgendrot-Messenger-verkauf' : 'Morgendrot-Messenger-standalone';
                        const exportsRoot = path.resolve(repoRoot, 'exports', sub);
                        const marker = path.join(exportsRoot, 'src', 'start-with-secrets.ts');
                        if (!fs.existsSync(marker)) {
                            sendJson(res, 400, {
                                ok: false,
                                error: `Ordner exports/${sub} ohne Code – zuerst npm run bundle:messenger.`,
                            }, cors);
                            return;
                        }
                        const kp = new Ed25519Keypair();
                        let address = String(kp.getPublicKey().toIotaAddress() || '').trim();
                        if (address && !/^0x/i.test(address)) address = '0x' + address;
                        const signerImport = String(kp.getSecretKey() || '').trim();
                        const addrNorm = normalizeAddress(address);
                        let creditsObjectId: string | undefined;
                        if (mintMessengerCredits) {
                            const pwBody = String(data.bossWalletPassword || '').trim();
                            const pw = pwBody || getWalletPassword() || '';
                            if (!pw) {
                                sendJson(res, 400, {
                                    ok: false,
                                    error:
                                        'Messenger-Credits minten: Boss-Wallet-Passwort angeben oder Session entsperren (gleiche Maschine wie Boss-API).',
                                }, cors);
                                return;
                            }
                            const initialB = u64FromBody(data.creditsInitialBalance, 100);
                            let maxB = u64FromBody(data.creditsMaxBalance, 1000);
                            if (maxB < initialB) maxB = initialB;
                            const refillHours = Math.max(
                                0,
                                Math.min(87600, parseFloat(String(data.creditsRefillIntervalHours ?? 24)) || 0)
                            );
                            const refillIntervalMs = BigInt(Math.round(refillHours * 3600000));
                            const refillAmount = u64FromBody(data.creditsRefillAmount, 10);
                            const costEcdh = u64FromBody(data.creditsCostEcdhInit, 1);
                            const costMsg = u64FromBody(data.creditsCostStoreMessage, 1);
                            const credMap = await mintMessengerCreditsBatchForRecipients(
                                normalizeAddress(bossAddress),
                                [addrNorm],
                                {
                                    initialBalance: initialB,
                                    maxBalance: maxB,
                                    refillIntervalMs,
                                    refillAmount,
                                    costEcdhInit: costEcdh,
                                    costStoreMessage: costMsg,
                                },
                                pw
                            );
                            creditsObjectId = credMap.get(addrNorm);
                            if (!creditsObjectId) {
                                sendJson(res, 500, { ok: false, error: 'Messenger-Credits: keine Objekt-ID aus Chain-Events.' }, cors);
                                return;
                            }
                        }
                        const params = {
                            deviceName: `${namePrefix}-1`,
                            address,
                            packageId: pkgRes.packageId,
                            rpcUrl,
                            bossAddress,
                            edition,
                            signer: signer as 'sdk' | 'cli' | 'remote',
                            remoteSignerUrl: signer === 'remote' ? remoteSignerUrl : undefined,
                            roleId,
                            mailboxId: mailboxId && /^0x[a-fA-F0-9]{64}$/i.test(mailboxId) ? mailboxId : undefined,
                            creditsObjectId,
                            mailboxStorePlaintext: exportMailboxStorePlaintext || undefined,
                            exportTtlDays,
                        };
                        let envContent: string;
                        try {
                            envContent = buildMessengerExportEnv(params);
                        } catch (e: any) {
                            sendJson(res, 400, { ok: false, error: String(e?.message || e) }, cors);
                            return;
                        }
                        const jsonConfig = buildMessengerExportJson(params);
                        fs.mkdirSync(exportsRoot, { recursive: true });
                        fs.writeFileSync(path.join(exportsRoot, '.env'), envContent + (envContent.endsWith('\n') ? '' : '\n'), 'utf-8');
                        fs.writeFileSync(path.join(exportsRoot, 'config.json'), JSON.stringify(jsonConfig, null, 2) + '\n', 'utf-8');
                        const bossOnly = path.join(exportsRoot, 'boss-only');
                        fs.mkdirSync(bossOnly, { recursive: true });
                        fs.writeFileSync(
                            path.join(bossOnly, 'signer-import-u001.txt'),
                            `${signerImport}\n`,
                            'utf-8'
                        );
                        fs.writeFileSync(
                            path.join(bossOnly, 'README-BOSS.txt'),
                            [
                                'NUR FÜR DEN BOSS – nicht an Kunden.',
                                'signer-import-u001.txt = Bech32/Export für SIGNER=sdk (im Messenger unter Entsperren einfügen).',
                                'Kunde erhält nur die .env im Ordnerroot (ohne diese Dateien), wenn ihr boss-only/ vor ZIP entfernt.',
                                '',
                            ].join('\n'),
                            'utf-8'
                        );
                        if (registerAddresses) {
                            const reg = assignDeviceRoleInEnv(address, 'messenger');
                            if (!reg.ok) {
                                sendJson(res, 400, { ok: false, error: reg.error || 'DEVICE_ROLES' }, cors);
                                return;
                            }
                        }
                        sendJson(
                            res,
                            200,
                            {
                                ok: true,
                                message: `Messenger-.env nach exports/${sub}/ geschrieben. Geheimnis nur unter boss-only/.`,
                                runId,
                                edition,
                                units: [{ index: 1, address, deviceName: params.deviceName, directory: `exports/${sub}` }],
                            },
                            cors
                        );
                        return;
                    }

                    const shipRoot = path.resolve(repoRoot, 'exports', 'messenger-shipments', runId);
                    const bossDir = path.join(shipRoot, 'boss-only');
                    fs.mkdirSync(bossDir, { recursive: true });

                    type GenUnit = {
                        index: number;
                        address: string;
                        addressNorm: string;
                        signerImport: string;
                        deviceName: string;
                    };
                    const generated: GenUnit[] = [];
                    for (let i = 1; i <= count; i++) {
                        const kp = new Ed25519Keypair();
                        let address = String(kp.getPublicKey().toIotaAddress() || '').trim();
                        if (address && !/^0x/i.test(address)) address = '0x' + address;
                        const signerImport = String(kp.getSecretKey() || '').trim();
                        const deviceName = `${namePrefix}-${i}`;
                        generated.push({
                            index: i,
                            address,
                            addressNorm: normalizeAddress(address),
                            signerImport,
                            deviceName,
                        });
                    }

                    let creditsByAddress = new Map<string, string>();
                    if (mintMessengerCredits) {
                        const pwBody = String(data.bossWalletPassword || '').trim();
                        const pw = pwBody || getWalletPassword() || '';
                        if (!pw) {
                            sendJson(res, 400, {
                                ok: false,
                                error:
                                    'Messenger-Credits minten: Boss-Wallet-Passwort angeben oder Session entsperren (gleiche Maschine wie Boss-API).',
                            }, cors);
                            return;
                        }
                        const initialB = u64FromBody(data.creditsInitialBalance, 100);
                        let maxB = u64FromBody(data.creditsMaxBalance, 1000);
                        if (maxB < initialB) maxB = initialB;
                        const refillHours = Math.max(
                            0,
                            Math.min(87600, parseFloat(String(data.creditsRefillIntervalHours ?? 24)) || 0)
                        );
                        const refillIntervalMs = BigInt(Math.round(refillHours * 3600000));
                        const refillAmount = u64FromBody(data.creditsRefillAmount, 10);
                        const costEcdh = u64FromBody(data.creditsCostEcdhInit, 1);
                        const costMsg = u64FromBody(data.creditsCostStoreMessage, 1);
                        try {
                            creditsByAddress = await mintMessengerCreditsBatchForRecipients(
                                normalizeAddress(bossAddress),
                                generated.map((g) => g.addressNorm),
                                {
                                    initialBalance: initialB,
                                    maxBalance: maxB,
                                    refillIntervalMs,
                                    refillAmount,
                                    costEcdhInit: costEcdh,
                                    costStoreMessage: costMsg,
                                },
                                pw
                            );
                        } catch (mintErr: any) {
                            sendJson(res, 500, { ok: false, error: String(mintErr?.message || mintErr) }, cors);
                            return;
                        }
                    }

                    for (const g of generated) {
                        const i = g.index;
                        const creditsObjectId = creditsByAddress.get(g.addressNorm);
                        if (mintMessengerCredits && !creditsObjectId) {
                            sendJson(res, 500, {
                                ok: false,
                                error: `Messenger-Credits: keine Objekt-ID für Einheit ${i} (${g.addressNorm.slice(0, 12)}…).`,
                            }, cors);
                            return;
                        }
                        const params = {
                            deviceName: g.deviceName,
                            address: g.address,
                            packageId: pkgRes.packageId,
                            rpcUrl,
                            bossAddress,
                            edition,
                            signer: signer as 'sdk' | 'cli' | 'remote',
                            remoteSignerUrl: signer === 'remote' ? remoteSignerUrl : undefined,
                            roleId,
                            mailboxId: mailboxId && /^0x[a-fA-F0-9]{64}$/i.test(mailboxId) ? mailboxId : undefined,
                            creditsObjectId,
                            mailboxStorePlaintext: exportMailboxStorePlaintext || undefined,
                            exportTtlDays,
                        };
                        let envContent: string;
                        try {
                            envContent = buildMessengerExportEnv(params);
                        } catch (e: any) {
                            sendJson(res, 400, { ok: false, error: `Einheit ${i}: ${String(e?.message || e)}` }, cors);
                            return;
                        }
                        const jsonConfig = buildMessengerExportJson(params);
                        const udir = path.join(shipRoot, `u${String(i).padStart(3, '0')}`);
                        fs.mkdirSync(udir, { recursive: true });
                        fs.writeFileSync(path.join(udir, '.env'), envContent + (envContent.endsWith('\n') ? '' : '\n'), 'utf-8');
                        fs.writeFileSync(path.join(udir, 'config.json'), JSON.stringify(jsonConfig, null, 2) + '\n', 'utf-8');
                        fs.writeFileSync(
                            path.join(udir, 'LIESMICH-KUNDE.txt'),
                            [
                                'Morgendrot Messenger – Kundenpaket (nur Metadaten).',
                                '1) Den kompletten Programmordner von eurem Anbieter erhalten (npm install dort).',
                                '2) Diese .env und config.json in DEN Ordner legen (ersetzen).',
                                '3) npm start – im Browser entsperren: Code aus eurem Lieferdokument (nicht per E-Mail/WhatsApp).',
                                edition === 'sales' ? '4) Verkaufs-Messenger: ggf. Setup → Schatten-Sweep wie angeleitet.' : '',
                                mintMessengerCredits
                                    ? '5) Messenger-Credits: nur mit MAILBOX_ID + USE_MAILBOX + deployedem Package (store_*_with_credits).'
                                    : '',
                                '',
                            ]
                                .filter(Boolean)
                                .join('\n'),
                            'utf-8'
                        );
                        fs.writeFileSync(path.join(bossDir, `signer-import-u${String(i).padStart(3, '0')}.txt`), g.signerImport + '\n', 'utf-8');
                        bossSecrets.push({
                            index: i,
                            address: g.address,
                            signerImport: g.signerImport,
                            deviceName: g.deviceName,
                        });
                        units.push({
                            index: i,
                            address: g.address,
                            deviceName: g.deviceName,
                            directory: path.join('exports', 'messenger-shipments', runId, `u${String(i).padStart(3, '0')}`),
                        });

                        if (registerAddresses) {
                            const reg = assignDeviceRoleInEnv(g.address, 'messenger');
                            if (!reg.ok) {
                                sendJson(res, 400, { ok: false, error: `Einheit ${i}: ${reg.error || 'DEVICE_ROLES'}` }, cors);
                                return;
                            }
                        }
                    }

                    fs.writeFileSync(
                        path.join(bossDir, 'manifest.json'),
                        JSON.stringify(
                            {
                                runId,
                                edition,
                                packageId: pkgRes.packageId,
                                rpcUrl,
                                bossAddress,
                                signer,
                                mintMessengerCredits,
                                createdAt: new Date().toISOString(),
                                units: bossSecrets.map((b) => ({
                                    index: b.index,
                                    address: b.address,
                                    deviceName: b.deviceName,
                                    signerImport: b.signerImport,
                                    ...(mintMessengerCredits
                                        ? { messengerCreditsObjectId: creditsByAddress.get(normalizeAddress(b.address)) }
                                        : {}),
                                })),
                            },
                            null,
                            2
                        ) + '\n',
                        'utf-8'
                    );
                    fs.writeFileSync(
                        path.join(shipRoot, 'README.txt'),
                        [
                            'Stapel-Export Messenger',
                            `- Run: ${runId}`,
                            `- Einheiten: ${count} (u001 …)`,
                            `- boss-only/: manifest.json + signer-import-*.txt – VERTRAULICH`,
                            '- Pro verkaufbarem Ordner: npm run assemble:messenger-units (siehe package.json) oder Bundle manuell kopieren.',
                            '',
                        ].join('\n'),
                        'utf-8'
                    );

                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            message: `${count} Messenger-Einheiten unter exports/messenger-shipments/${runId}/. Geheimnisse nur boss-only/.`,
                            runId,
                            edition,
                            packageId: pkgRes.packageId,
                            directory: path.join('exports', 'messenger-shipments', runId),
                            units,
                        },
                        cors
                    );
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        /**
         * Roadmap § H.7: ZIP mit vorgefüllter Handoff-.env (ohne Secrets) + Kurz-README für das Standalone-Smartphone-Bundle.
         * Bundle selbst: npm run bundle:standalone-smartphone (nicht Teil dieses ZIP).
         */
        if (url === '/api/standalone-smartphone-handoff-zip' && req.method === 'POST') {
            if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'kommandant') {
                sendJson(res, 403, { ok: false, error: 'Nur Boss oder Kommandant.' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}') as Record<string, unknown>;
                    const pkgRes = resolveMessengerExportPackageId({
                        source: data.packageSource === 'custom' ? 'custom' : data.packageSource === 'history' ? 'history' : 'boss',
                        customPackageId: String(data.customPackageId || '').trim(),
                        historyFromNewest: parseInt(String(data.historyFromNewest ?? 0), 10) || 0,
                    });
                    if (!pkgRes.ok) {
                        sendJson(res, 400, { ok: false, error: pkgRes.error }, cors);
                        return;
                    }
                    const rpcUrl = String(data.rpcUrl || CFG.RPC_URL || '').trim() || 'https://api.testnet.iota.cafe';
                    const bossAddress = String(data.bossAddress || CFG.MY_ADDRESS || '').trim();
                    if (!/^0x[a-fA-F0-9]{64}$/i.test(bossAddress)) {
                        sendJson(res, 400, { ok: false, error: 'bossAddress / Boss MY_ADDRESS: 0x+64Hex nötig.' }, cors);
                        return;
                    }
                    const partnerAddresses = String(data.partnerAddresses ?? data.partners ?? '').trim();
                    const mailboxIdField = Object.prototype.hasOwnProperty.call(data, 'mailboxId')
                        ? String(data.mailboxId ?? '').trim()
                        : String(CFG.MAILBOX_ID || '').trim();
                    const commandRegistryId = String(data.commandRegistryId ?? '').trim();
                    const vaultRegistryId = String(data.vaultRegistryId ?? '').trim();
                    const nextPublicDirectIotaRpcUrl = String(data.nextPublicDirectIotaRpcUrl ?? '').trim();
                    const handoffLabel = String(data.handoffLabel ?? data.label ?? '').trim();
                    let envContent: string;
                    try {
                        envContent = buildStandaloneSmartphoneHandoffEnv({
                            rpcUrl,
                            packageId: pkgRes.packageId,
                            bossAddress,
                            partnerAddresses: partnerAddresses || undefined,
                            mailboxId: mailboxIdField || undefined,
                            commandRegistryId: commandRegistryId || undefined,
                            vaultRegistryId: vaultRegistryId || undefined,
                            nextPublicDirectIotaRpcUrl: nextPublicDirectIotaRpcUrl || undefined,
                        });
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        sendJson(res, 400, { ok: false, error: msg }, cors);
                        return;
                    }
                    const createdAtIso = new Date().toISOString();
                    const readme = buildStandaloneSmartphoneHandoffReadme({
                        handoffLabel,
                        createdAtIso,
                        packageId: pkgRes.packageId,
                        rpcUrl,
                        bossAddress: normalizeAddress(bossAddress),
                    });
                    const slug =
                        (handoffLabel || 'handoff').replace(/[^\wäöüÄÖÜß.-]/gi, '_').slice(0, 48) || 'handoff';
                    const day = createdAtIso.slice(0, 10).replace(/-/g, '');
                    const archive = archiver('zip', { zlib: { level: 9 } });
                    res.writeHead(200, {
                        ...cors,
                        'Content-Type': 'application/zip',
                        'Content-Disposition': `attachment; filename="morgendrot-standalone-handoff-${slug}-${day}.zip"`,
                    });
                    archive.pipe(res);
                    archive.append(envContent + (envContent.endsWith('\n') ? '' : '\n'), {
                        name: 'morgendrot-standalone-handoff.env',
                    });
                    archive.append(Buffer.from(readme, 'utf8'), { name: 'README-HANDOFF.txt' });
                    archive.finalize();
                    archive.on('error', (err: Error) => {
                        try {
                            res.end();
                        } catch {}
                        logger.warn('standalone-smartphone-handoff-zip: ' + (err?.message || err));
                    });
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    sendJson(res, 500, { ok: false, error: msg }, cors);
                }
            });
            return;
        }

        /** Schreibt Provisionierungs-Dateien in exports/… (Raspi oder Messenger-Standalone, letzterer braucht vorher npm run bundle:messenger). */
        if (url === '/api/export-provision-bundle' && req.method === 'POST') {
            if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'kommandant') {
                sendJson(res, 403, { ok: false, error: 'Nur Boss oder Kommandant dürfen in Projektordner exportieren.' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const variant = String(data.variant || '').trim().toLowerCase();
                    const dirNames: Record<string, string> = {
                        headless: 'Morgendrot-Raspi-headless',
                        'lite-ui': 'Morgendrot-Raspi-lite-ui',
                        liteui: 'Morgendrot-Raspi-lite-ui',
                        messenger: 'Morgendrot-Messenger-standalone',
                        'messenger-standalone': 'Morgendrot-Messenger-standalone',
                        'messenger-sales': 'Morgendrot-Messenger-verkauf',
                        messengersales: 'Morgendrot-Messenger-verkauf',
                    };
                    const sub = dirNames[variant];
                    if (!sub) {
                        sendJson(
                            res,
                            400,
                            {
                                ok: false,
                                error:
                                    'variant: headless, lite-ui, messenger | messenger-standalone | messenger-sales',
                            },
                            cors
                        );
                        return;
                    }
                    const exportsRoot = path.resolve(process.cwd(), 'exports', sub);
                    const isMessengerVariant =
                        variant === 'messenger' ||
                        variant === 'messenger-standalone' ||
                        variant === 'messenger-sales' ||
                        variant === 'messengersales';
                    if (isMessengerVariant) {
                        const marker = path.join(exportsRoot, 'src', 'start-with-secrets.ts');
                        if (!fs.existsSync(marker)) {
                            sendJson(res, 400, {
                                ok: false,
                                error:
                                    'Messenger-Ordner ohne Code. Im Hauptrepo einmal ausführen: npm run bundle:messenger – danach erneut exportieren.',
                            }, cors);
                            return;
                        }
                    }
                    const envContent = String(data.envContent ?? '').trim();
                    if (!envContent) {
                        sendJson(res, 400, { ok: false, error: 'envContent fehlt – zuerst Gerät provisionieren.' }, cors);
                        return;
                    }
                    const jsonConfig = data.jsonConfig != null && typeof data.jsonConfig === 'object' ? data.jsonConfig : {};
                    fs.mkdirSync(exportsRoot, { recursive: true });
                    let envOut = envContent + (envContent.endsWith('\n') ? '' : '\n');
                    if (isMessengerVariant) {
                        if (!/\bUI_VARIANT\s*=/.test(envOut)) envOut += 'UI_VARIANT=messenger\n';
                        if (!/\bENABLE_UI\s*=/.test(envOut)) envOut += 'ENABLE_UI=true\n';
                        const wantSales = variant === 'messenger-sales' || variant === 'messengersales';
                        const editionFromBody = String(data.messengerEdition || '').toLowerCase() === 'sales' ? 'sales' : '';
                        const edition = wantSales || editionFromBody === 'sales' ? 'sales' : 'standalone';
                        if (!/\bMESSENGER_EDITION\s*=/.test(envOut)) envOut += `MESSENGER_EDITION=${edition}\n`;
                    }
                    fs.writeFileSync(path.join(exportsRoot, '.env'), envOut, 'utf-8');
                    fs.writeFileSync(path.join(exportsRoot, 'config.json'), JSON.stringify(jsonConfig, null, 2) + '\n', 'utf-8');
                    const written: string[] = ['.env', 'config.json'];
                    const tpl = data.templateJson;
                    if (tpl != null && typeof tpl === 'object') {
                        const safeProf = String(data.profileId || 'profil').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'profil';
                        const tname = `template-${safeProf}.json`;
                        fs.writeFileSync(path.join(exportsRoot, tname), JSON.stringify(tpl, null, 2) + '\n', 'utf-8');
                        written.push(tname);
                    }
                    const rel = path.join('exports', sub);
                    sendJson(res, 200, {
                        ok: true,
                        message: isMessengerVariant
                            ? `Export nach ${rel}/ (.env/config). Lauffähig nach npm install (Bundle vorher: npm run bundle:messenger).`
                            : `Export nach ${rel}/ geschrieben (${written.join(', ')}). Raspi: vollständiges Repo oder angepasster Deploy-Ordner + npm ci && npm start.`,
                        directory: rel,
                        files: written,
                    }, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/tiny-message' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const deviceId = data.deviceId ?? data.device;
                    const payload = data.payload;
                    const timestamp = Number(data.timestamp) || 0;
                    const hmac = data.hmac ?? data.signature;
                    if (!deviceId || payload === undefined || !timestamp || !hmac) {
                        sendJson(res, 400, { ok: false, error: 'deviceId, payload, timestamp, hmac nötig.' }, cors);
                        return;
                    }
                    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
                    if (!verifyTinyHmac(deviceId, payloadStr, timestamp, hmac)) {
                        sendJson(res, 401, { ok: false, error: 'HMAC-Verifikation fehlgeschlagen.' }, cors);
                        return;
                    }
                    const payloadObj = typeof payload === 'object' ? payload : JSON.parse(payloadStr);
                    const result = processTinyMessage(deviceId, payloadObj);
                    sendJson(res, 200, result, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/import-config' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const map: Record<string, string> = {
                        r: 'ROLE', rid: 'ROLE_ID', a: 'MY_ADDRESS',
                        ba: 'BOSS_ADDRESS', pkg: 'PACKAGE_ID', rpc: 'RPC_URL',
                        lid: 'LOCK_ID',
                    };
                    let applied = 0;
                    for (const [short, envKey] of Object.entries(map)) {
                        if (data[short] != null) {
                            setEnvKey(envKey, String(data[short]));
                            applied++;
                        }
                    }
                    if (Array.isArray(data.ka) && data.ka.length) {
                        setEnvKey('KOMMANDANT_ADDRESSES', data.ka.join(','));
                        applied++;
                    }
                    if (Array.isArray(data.wa) && data.wa.length) {
                        setEnvKey('WORKER_ADDRESSES', data.wa.join(','));
                        applied++;
                    }
                    sendJson(res, 200, { ok: true, message: `${applied} Config-Werte importiert.` }, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/deploy-package' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const rawPath = typeof data.path === 'string' && data.path.trim() ? data.path.trim() : 'move-test';
                    const packageDir = path.basename(rawPath) || 'move-test';
                    if (packageDir !== rawPath || /[\\/]/.test(packageDir)) {
                        sendJson(res, 400, { ok: false, error: 'path darf nur einen einzelnen Ordner-Namen enthalten (z. B. move-test).' }, cors);
                        return;
                    }
                    const packageId = await publishPackageCli(packageDir);
                    (CFG as { PACKAGE_ID: string }).PACKAGE_ID = packageId;
                    process.env.PACKAGE_ID = packageId;
                    savePackageIdToFile(packageId);
                    const envResult = setEnvKey('PACKAGE_ID', packageId);
                    const message = envResult.ok
                        ? 'Package deployt. Package-ID gesetzt und in .env sowie .morgendrot-package-id gespeichert.'
                        : 'Package deployt. Package-ID gesetzt und in .morgendrot-package-id gespeichert. (.env: ' + (envResult.error || 'nicht aktualisiert') + ')';
                    sendJson(res, 200, { ok: true, packageId, message }, cors);
                } catch (e: any) {
                    const msg = String(e?.message || e);
                    sendJson(res, 200, { ok: false, error: msg }, cors);
                }
            });
            return;
        }

        if (url === '/api/start-boss-signer' && req.method === 'POST') {
            try {
                const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
                const scriptPath = path.join('scripts', 'boss-signer.ts');
                const child = spawn('npx', ['tsx', scriptPath], {
                    detached: true,
                    stdio: 'ignore',
                    cwd: rootDir,
                    env: { ...process.env, FORCE_COLOR: '0' },
                });
                child.unref();
                const port = process.env.PORT || '3340';
                sendJson(res, 200, { ok: true, message: 'Boss-Signer wird gestartet.', url: `http://127.0.0.1:${port}` }, cors);
            } catch (e: any) {
                sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
            }
            return;
        }

        if (url === '/api/boss-provision-handshake' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    const address = String(data.address || '').trim();
                    const partner = String(data.partner || '').trim();
                    const pubkey = String(data.pubkey || '').trim();
                    if (!address || !partner || !pubkey) {
                        sendJson(res, 400, { ok: false, error: 'address, partner und pubkey (Base64) erforderlich' }, cors);
                        return;
                    }
                    const pubKeyRaw = Buffer.from(pubkey, 'base64');
                    if (pubKeyRaw.length < 32) {
                        sendJson(res, 400, { ok: false, error: 'Pubkey (Base64) sollte mind. 32 Bytes ergeben' }, cors);
                        return;
                    }
                    const password = getWalletPassword();
                    if (!password) {
                        sendJson(res, 400, { ok: false, error: 'Bitte zuerst Wallet entsperren (z. B. /connect oder Entsperren in der UI).' }, cors);
                        return;
                    }
                    const client = getClient();
                    const txb = buildHandshakeTransaction(address, partner, new Uint8Array(pubKeyRaw));
                    const result = await signAndExecute(client, txb, address, password);
                    sendJson(res, 200, { ok: true, digest: result.digest }, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/command' && req.method === 'POST') {
            const ip = (req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
            if (CFG.API_RATE_LIMIT_COMMANDS_PER_MINUTE > 0 && !checkCommandRateLimit(ip)) {
                sendJson(res, 429, { ok: false, error: 'Rate-Limit überschritten (API_RATE_LIMIT_COMMANDS_PER_MINUTE).' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}');
                    let cmd = String(data.cmd ?? data.command ?? '').trim();
                    let args = Array.isArray(data.args) ? data.args.map(String) : [];
                    const userMessage = typeof data.userMessage === 'string' ? data.userMessage.trim() : '';
                    if (cmd === '/transfer-coins' && args.length < 2 && userMessage) {
                        const addr = userMessage.match(/0x[a-fA-F0-9]{64}/);
                        const num = userMessage.match(/(\d+(?:\.\d+)?)\s*(?:iota|miota|i)?/i) || userMessage.match(/(\d+(?:\.\d+)?)/);
                        if (addr && num) args = [addr[0], num[1]];
                    }
                    if (!cmd) {
                        sendJson(res, 400, { ok: false, error: 'cmd fehlt' }, cors);
                        return;
                    }
                    const role = CFG.ROLE;
                    if (role === 'boss' || role === 'kommandant' || role === 'arbeiter') {
                        const perms = getHierarchyPermissions(role);
                        const need = getRequiredPermissionForCommand(cmd);
                        if (need === 'keyIssue' && !perms.keyIssue) {
                            sendJson(res, 403, { ok: false, error: 'Schlüssel ausstellen darf nur der Boss.' }, cors);
                            return;
                        }
                        if (need === 'revokeDown' && !perms.revokeDown) {
                            sendJson(res, 403, { ok: false, error: 'Widerruf/Sperren: nur Boss oder Kommandant.' }, cors);
                            return;
                        }
                        if (need === 'commandDown' && !perms.commandDown) {
                            sendJson(res, 403, { ok: false, error: 'Befehl senden (Handshake/Send): nur Boss oder Kommandant.' }, cors);
                            return;
                        }
                    }
                    if (!_commandHandler) {
                        sendJson(res, 200, { ok: false, error: 'Bitte zuerst Wallet entsperren (Passwort eingeben).' }, cors);
                        return;
                    }
                    if (CFG.API_RATE_LIMIT_COMMANDS_PER_MINUTE > 0) recordCommandRateLimit(ip);
                    const commandApiOptions: CommandApiOptions = {};
                    if (data.sponsorForSender) commandApiOptions.sponsorForSender = String(data.sponsorForSender).trim();
                    if (data.silentFetch === true) commandApiOptions.silentFetch = true;
                    if (typeof data.shadowMnemonic === 'string' && data.shadowMnemonic.trim()) {
                        commandApiOptions.shadowMnemonic = data.shadowMnemonic.trim();
                    }
                    if (data.morgPkg != null && typeof data.morgPkg === 'object') {
                        commandApiOptions.morgPkg = data.morgPkg;
                    }
                    const mp = String(data.messagingPersistenceMode ?? '').trim().toLowerCase();
                    if (mp === 'mailbox' || mp === 'event') {
                        commandApiOptions.messagingPersistenceMode = mp as 'event' | 'mailbox';
                    }
                    const mbOverride = String(data.mailboxObjectId ?? '').trim();
                    if (mbOverride) commandApiOptions.mailboxObjectId = mbOverride;
                    const result = await _commandHandler(cmd, args, commandApiOptions);
                    if (cmd === '/vault-onchain' && result?.ok) lastVaultOnchainSuccessAt = Date.now();
                    if (cmd === '/vault-save' && result?.ok) lastVaultOnchainSuccessAt = undefined;
                    const out = result && typeof result === 'object' ? { ...result } : result;
                    const outRec = out && typeof out === 'object' ? (out as Record<string, unknown>) : null;
                    if (outRec && Array.isArray(outRec.createdObjectIds)) {
                        const ids = outRec.createdObjectIds as string[];
                        const explorerBase = (process.env.EXPLORER_BASE_URL || 'https://explorer.iota.org/object').replace(/\/$/, '');
                        const network = (CFG.RPC_URL || '').toLowerCase().includes('testnet') ? '?network=testnet' : '';
                        outRec.explorerLinks = ids.map((id) => `${explorerBase}/${id}${network}`);
                    }
                    if (outRec && typeof outRec.objectId === 'string' && outRec.objectId) {
                        const oid = outRec.objectId;
                        const explorerBase = (process.env.EXPLORER_BASE_URL || 'https://explorer.iota.org/object').replace(/\/$/, '');
                        const network = (CFG.RPC_URL || '').toLowerCase().includes('testnet') ? '?network=testnet' : '';
                        outRec.explorerLink = `${explorerBase}/${oid}${network}`;
                    }
                    sendJson(res, 200, outRec ?? out, cors);
                } catch (e: any) {
                    sendJson(res, 500, { ok: false, error: String(e?.message || e) }, cors);
                }
            });
            return;
        }

        if (tryServeLiteUiGet(req, res, url, cors)) return;

        sendUnmatchedRouteResponse(res, url, cors);
    });

    const maxAttempts = 5;

    async function killOldInstance(p: number): Promise<boolean> {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 1500);
            const r = await fetch(`http://127.0.0.1:${p}/api/status`, { signal: ctrl.signal });
            clearTimeout(timer);
            if (r.ok) {
                const d = (await r.json().catch(() => null)) as { backendRunning?: unknown } | null;
                if (d && d.backendRunning !== undefined) {
                    logger.info(`Alte Morgendrot-Instanz auf Port ${p} gefunden – stoppe sie…`);
                    const ctrl2 = new AbortController();
                    const t2 = setTimeout(() => ctrl2.abort(), 2000);
                    await fetch(`http://127.0.0.1:${p}/api/command`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ command: '/restart' }),
                        signal: ctrl2.signal,
                    }).catch(() => {});
                    clearTimeout(t2);
                    await new Promise(r => setTimeout(r, 1500));
                    return true;
                }
            }
        } catch {}
        return false;
    }

    function tryListen(p: number) {
        if (p > port + maxAttempts) {
            logger.error(`API-Port ${port}–${port + maxAttempts} belegt. Bitte alte Morgendrot-Prozesse beenden (z. B. im Task-Manager).`);
            return;
        }
        const onSuccess = () => {
            server.removeListener('error', onError);
            _actualApiPort = p;
            const gate = (CFG.PAIRING_GATE_NFT_OBJECT_ID || '').trim();
            if (gate && !/^0x[a-fA-F0-9]{64}$/i.test(gate)) {
                logger.warn(
                    'PAIRING_GATE_NFT_OBJECT_ID ist gesetzt aber kein gültiges 0x+64-Hex – Türsteher-Peering greift nicht zuverlässig; .env prüfen.'
                );
            }
            logger.info(
                CFG.SERVE_LITE_UI_STATIC
                    ? `Morgendrot API: http://127.0.0.1:${p}/api/status  Lite-UI: http://127.0.0.1:${p}/`
                    : `Morgendrot API: http://127.0.0.1:${p}/api/status  (Lite-UI aus — nur Next: http://127.0.0.1:${CFG.UI_PORT}/)`
            );
        };
        const onError = (err: NodeJS.ErrnoException) => {
            server.removeListener('error', onError);
            server.removeListener('listening', onSuccess);
            if (err.code === 'EADDRINUSE') {
                logger.warn(`API-Port ${p} belegt, versuche ${p + 1}…`);
                tryListen(p + 1);
            } else {
                logger.error('API-Server Fehler: ' + (err?.message || err));
            }
        };
        server.once('error', onError);
        server.once('listening', onSuccess);
        server.listen(p, '127.0.0.1');
    }

    const startListen = () => {
        tryListen(port);
    };
    if (CFG.API_KILL_PREVIOUS_INSTANCE) {
        killOldInstance(port)
            .then((killed) => {
                if (killed) logger.info('Alte Instanz beendet, starte auf bevorzugtem Port…');
                startListen();
            })
            .catch(() => startListen());
    } else {
        startListen();
    }

    return server;
}
