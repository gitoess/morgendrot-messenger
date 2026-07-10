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
    getConfigDisplayForWebApi,
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
    reconcileHandoffExportGlobals,
    resolveSimpleMode,
    resolveTransportProfile,
    getSignerConfigSource,
    getWalletDerivationPathConfigSource,
    getRuntimeConfigKeys,
    getRuntimeConfigSources,
} from './config.js';
import { applyHandoffEnvImport, previewHandoffEnvImport } from './handoff-env-import.js';
import { applyHandoffRuntimeConfigJson, HANDOFF_RUNTIME_CONFIG_FILENAME } from './handoff-runtime-import.js';
import {
    buildHandoffRuntimeConfigPayload,
    parseMessengerCapabilitiesOverride,
    type MessengerCapabilitiesMatrix,
} from './shared/messenger-capabilities-matrix.js';
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
    deployMainnetMovePackage,
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
import {
    applyPublishResultToEnv,
    applyGlobalsCreatedToEnv,
    createGlobalsCli,
    deployTestnetMovePackage,
    queryGlobalsCreatedForPackage,
    resolveUpgradeCapId,
    upgradePackageCli,
} from './move-package-deploy.js';
import { invalidateMessagingMoveFeaturesCache } from './move-package-features.js';
import { handleShopApi } from './api/shop/handle-shop-api.js';
import { normalizeAddress } from './utils.js';
import { HELP_START, HELP_CHAT, HELP_UI_INTRO, getWalletPassword } from './wallet-bridge.js';
import { logger } from './logger.js';
import { getMonitorStatus } from './monitoring.js';
import { exportAuditCsv, exportAuditPdfStream, appendAuditEvent, readAuditEvents } from './audit-log.js';
import { runGasStationCheck } from './gas-station.js';
import { verifyTinyHmac, processTinyMessage } from './tiny-gateway.js';
import { extractCompactImageBase64FromWire } from './compact-image-wire-extract.js';
import {
    fuseLoraProgressiveJpegsSharp,
    prepareImageForLoRaFluentRobust,
    prepareImageForLoRaRobust,
} from './lora-progressive-image.js';
import archiver from 'archiver';
import { HEARTBEAT_INTERVAL_PRESETS_MS, isAllowedHeartbeatIntervalMs } from './shared/heartbeat-presets.js';
import {
    vaultFileExists,
    resolveVaultFilePathForSession,
    loadVaultLocal,
    loadVaultContent,
    loadVaultFromChainPayload,
    purgeInboxCache,
    sanitizePersonalSecrets,
    sanitizeVaultNotes,
    vaultNotesToLegacyString,
    type PersonalSecretEntry,
    type VaultNoteEntry,
} from './vault-local.js';
import { applySdkSignerFromImport, isPlausibleSdkImport } from './messenger-nest/sdk-signer-import.js';
import { runVaultOnchainPreflight } from './vault-onchain-preflight.js';
import { syncVaultChainConfig } from './vault-sync-chain-config.js';
import { setWalletPassword } from './messenger-nest/messenger-session-password.js';
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
    markdownToHtml,
    tryServeLiteUiGet,
    sendUnmatchedRouteResponse,
} from './api/http-middleware.js';
import type { ApiRouteContext } from './api/routes/api-route-types.js';
import { handleCommandRoute } from './api/routes/handle-command-route.js';
import { handleContactRoutes } from './api/routes/handle-contact-routes.js';
import { handleRosterPendingRoutes } from './api/routes/handle-roster-pending-routes.js';
import { handleTeamSyncRoutes } from './api/routes/handle-team-sync-routes.js';
import { handleStatusRoutes } from './api/routes/handle-status-routes.js';
import { handleTelegramIntegrationRoutes } from './api/routes/handle-telegram-integration-routes.js';
import { handleEinsatzManifestRoutes } from './api/routes/handle-einsatz-manifest-routes.js';
import { handleForensicBatchRoutes } from './api/routes/handle-forensic-batch-routes.js';
import { handleBossWalletRoutes } from './api/routes/handle-boss-wallet-routes.js';
import { createIpRateLimiter, normalizeApiClientIp } from './api/routes/api-ip-rate-limit.js';
import {
    denyUnlessTrustedApiClient,
    denyUnlessTrustedForLanMutation,
    warnIfLanApiMissingAuthToken,
} from './api/routes/api-security.js';
import { startForensicBatchScheduler } from './shared/forensic-batch-scheduler.js';
import {
    applyTelegramIntegrationToMonitorWebhook,
    buildHandoffExtrasFromTelegramConfig,
} from './integrations/telegram-integration.js';
import { restartTelegramInbound } from './integrations/telegram-inbound-poll.js';
import {
    resolveProvisionIdempotencyKey,
    provisionRequestFingerprint,
    tryProvisionIdempotentReplayOrConflict,
    saveProvisionIdempotencySuccess,
    withProvisionDeviceIdempotencyLock,
} from './provision-idempotency-state.js';

/** Nach erfolgreichem /vault-onchain: Zeitstempel für Sync-Status („Auf Chain gesichert“). */
let lastVaultOnchainSuccessAt: number | undefined;
/** Nach erfolgreichem /vault-save oder persistLocal: lokale Änderung für Dirty-Hinweis. */
let lastVaultLocalSaveAt: number | undefined;
const unlockRateLimit = createIpRateLimiter(CFG.API_RATE_LIMIT_UNLOCK_PER_MINUTE);

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
        lastLocalSavedAt?: number;
        /** testnet | mainnet | unknown — aus RPC_URL abgeleitet */
        network?: 'testnet' | 'mainnet' | 'unknown';
    };
    /** Lite-UI: full oder messenger (nur Nachrichten-Fluss). */
    uiVariant?: 'full' | 'messenger';
    /** consumer = Privat/Prepper; einsatz = Organisation mit Stab. */
    deploymentProfile?: 'consumer' | 'einsatz';
    /** mesh-first = Einsatz-Default; iota-* = optionaler Notar (§ H.0-SIMPLE). */
    transportProfile?: 'mesh-first' | 'iota-anchored' | 'iota-full';
    /** Serverseitig erzwungener Simple Mode. */
    simpleMode?: boolean;
    /** simple | expert — abgeleitet aus SIMPLE_MODE. */
    uiMode?: 'simple' | 'expert';
    /** IOTA-UI (Banner, Relay) sichtbar. */
    iotaTransportUiEnabled?: boolean;
    /** Geräteklasse aus CFG.ROLE. */
    role?: string;
    roleId?: number;
    permissions?: import('./config.js').HierarchyPermissions;
    /** Rollen-Matrix für Messenger-UI (Handoff / Runtime). */
    capabilities?: MessengerCapabilitiesMatrix;
    /** standalone = klassischer Messenger; sales = Kunden-Bundle (Schatten-Seed / Sweep). */
    messengerEdition?: 'standalone' | 'sales';
    /** MAILBOX_STORE_PLAINTEXT: Klartext zusätzlich in Mailbox speichern (purgebar). */
    mailboxStorePlaintext?: boolean;
    /** USE_MAILBOX: true = Move speichert in Mailbox-Objekt; false = Event-Pfad (queryEvents). */
    useMailbox?: boolean;
    /** MAILBOX_ID gesetzt und 0x+64Hex (sonst kann Mailbox-Modus nicht greifen). */
    mailboxConfigured?: boolean;
    /** Volle Server-MAILBOX_ID (Einsatz-Postfach), wenn konfiguriert. */
    mailboxId?: string;
    mailboxIdMasked?: string;
    /** Posteingang-Union: alle Package-IDs (Events), die /inbox scannt. */
    inboxUnionPackageIds?: string[];
    /** Posteingang-Union: alle Mailbox-IDs (MsgKey), die /inbox scannt. */
    inboxUnionMailboxIds?: string[];
    /** Boss: Einsatz on-chain + Handoff-Parameter (ohne Secrets). */
    einsatzConfig?: {
        editionLabel: string;
        defaultTtlDays: number;
        enablePurge: boolean;
        vaultRegistryId?: string;
        vaultRegistryIdMasked?: string;
        commandRegistryId?: string;
        commandRegistryIdMasked?: string;
        moveFeatures?: {
            teamBroadcastStore: boolean;
            teamBroadcastPurge: boolean;
            privateMailboxPurge: boolean;
            probed: boolean;
            error?: string;
        };
        upgradeCapConfigured?: boolean;
        upgradeCapId?: string;
        upgradeCapIdMasked?: string;
        upgradeCapResolvedFromChain?: boolean;
        deployModeHint?: string;
    };
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

export function setPurgeAfterLieferungHandler(handler: PurgeAfterLieferungFn | null): void {
    _purgeAfterLieferungHandler = handler;
}
let _sessionStatus: Partial<ApiStatus> = {};
let _resolvePassword: ((pw: string) => void) | null = null;
export type VaultUnlockBypassMode = 'createNew' | 'signerRecover';
let _vaultUnlockBypass: VaultUnlockBypassMode | null = null;

export function setVaultUnlockBypass(mode: VaultUnlockBypassMode | null): void {
    _vaultUnlockBypass = mode;
}

/** Einmalig nach /api/unlock — wallet-bridge überspringt Entschlüsseln einer alten Vault-Datei. */
export function consumeVaultUnlockBypass(): VaultUnlockBypassMode | null {
    const mode = _vaultUnlockBypass;
    _vaultUnlockBypass = null;
    return mode;
}

export function setCommandHandler(handler: CommandHandlerFn | null): void {
    _commandHandler = handler;
}

/** true, sobald wallet-bridge den Messenger-Handler registriert hat (nicht mehr Stub). */
export function isMessengerCommandHandlerReady(): boolean {
    return _commandHandler !== null && _commandHandler !== _stubCommandHandler;
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

/** Optional: strukturierte Notizen (vaultNotes) im entsperrten Vault-RAM. */
export type VaultNotesBridge = {
    getNotes: () => VaultNoteEntry[] | null;
    setNotes: (
        notes: VaultNoteEntry[],
        opts?: { persistLocal?: boolean }
    ) => Promise<{ ok: boolean; error?: string; message?: string }>;
};

let _vaultNotesBridge: VaultNotesBridge | null = null;

export function setVaultNotesBridge(b: VaultNotesBridge | null): void {
    _vaultNotesBridge = b;
}

export function getLastVaultLocalSaveAt(): number | undefined {
    return lastVaultLocalSaveAt;
}

export function setLastVaultLocalSaveAt(at: number | undefined): void {
    lastVaultLocalSaveAt = at;
}

/** Setzt Callback für Passwort aus UI. Wird von wallet-bridge aufgerufen, bevor UI startet. */
export function setPasswordResolver(resolve: (pw: string) => void): void {
    _resolvePassword = resolve;
}

/** Nach /vault-lock: UI wieder auf „wartet auf Passwort“ (Entsperr-Dialog). */
export function requestUiVaultUnlock(): void {
    if (_resolvePassword) return;
    setPasswordResolver(() => {
        /* Erst-Start: resolve beendet wallet-bridge-Promise; Re-Lock: Keys kommen via /vault-load in /api/unlock. */
    });
}

export function setSessionStatus(status: Partial<ApiStatus>): void {
    _sessionStatus = { ..._sessionStatus, ...status };
}

/** Tatsächlich gebundener API-Port (nach tryListen). Damit die UI den richtigen Port in index.html einsetzt. */
let _actualApiPort: number = 0;
export function getActualApiPort(): number {
    return _actualApiPort || CFG.API_PORT;
}

export function startApiServer(getStatus?: GetStatusFn): http.Server | null {
    applyTelegramIntegrationToMonitorWebhook();
    restartTelegramInbound();
    const port = CFG.API_PORT;

    const routeCtx: ApiRouteContext = {
        getStatus,
        getSessionStatus: () => _sessionStatus,
        getResolvePassword: () => _resolvePassword,
        getCommandHandler: () => _commandHandler,
        getPurgeAfterLieferungHandler: () => _purgeAfterLieferungHandler,
        getLastVaultOnchainAt: () => lastVaultOnchainSuccessAt,
        setLastVaultOnchainAt: (t) => {
            lastVaultOnchainSuccessAt = t;
        },
        getLastVaultLocalSaveAt: () => lastVaultLocalSaveAt,
        setLastVaultLocalSaveAt: (t) => {
            lastVaultLocalSaveAt = t;
        },
        getActualApiPort,
    };

    const server = http.createServer(async (req, res) => {
        const cors = corsHeaders(req);
        if (handleCorsPreflightIfOptions(req, res, cors)) return;

        const url = normalizeApiRequestPath(req.url || '/');

        if (denyUnlessTrustedForLanMutation(req, res, url, cors, sendJson)) return;

        const shopHandled = await handleShopApi(req, res, url, cors, sendJson);
        if (shopHandled) return;

        if (await handleStatusRoutes(req, res, url, cors, sendJson, routeCtx)) return;
        if (await handleBossWalletRoutes(req, res, url, cors, sendJson)) return;
        if (await handleContactRoutes(req, res, url, cors, sendJson, routeCtx)) return;
        if (await handleRosterPendingRoutes(req, res, url, cors, sendJson)) return;
        if (await handleTeamSyncRoutes(req, res, url, cors, sendJson)) return;
        if (await handleTelegramIntegrationRoutes(req, res, url, cors, sendJson)) return;
        if (await handleEinsatzManifestRoutes(req, res, url, cors, sendJson)) return;
        if (await handleForensicBatchRoutes(req, res, url, cors, sendJson, routeCtx)) return;

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

        if (url === '/api/config' && req.method === 'GET') {
            try {
                sendJson(res, 200, { ok: true, config: getConfigDisplayForWebApi() }, cors);
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
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

        /** Helfer: Handoff-ZIP-Inhalt (.env) prüfen oder in lokale .env mergen — nur öffentliche Keys. */
        if (url === '/api/apply-handoff-env' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}') as {
                        envText?: string
                        runtimeConfigJson?: string
                        dryRun?: boolean
                    };
                    const envText = String(data.envText ?? '');
                    const runtimeConfigJson = String(data.runtimeConfigJson ?? '').trim();
                    if (!envText.trim()) {
                        sendJson(res, 400, { ok: false, error: 'envText fehlt' }, cors);
                        return;
                    }
                    if (envText.length > 256_000) {
                        sendJson(res, 400, { ok: false, error: 'envText zu groß' }, cors);
                        return;
                    }
                    const dryRun = data.dryRun !== false;
                    if (dryRun) {
                        const preview = previewHandoffEnvImport(envText);
                        sendJson(
                            res,
                            preview.ok ? 200 : 400,
                            {
                                ok: preview.ok,
                                summary: preview.summary,
                                errors: preview.errors,
                            },
                            cors
                        );
                        return;
                    }
                    const applied = applyHandoffEnvImport(envText);
                    let runtimeApplied = false;
                    let runtimeError: string | undefined;
                    if (applied.ok && runtimeConfigJson) {
                        const tp = CFG.TRANSPORT_PROFILE ?? resolveTransportProfile(CFG.ROLE);
                        const rr = applyHandoffRuntimeConfigJson(runtimeConfigJson, {
                            roleId: CFG.ROLE_ID,
                            simpleMode: CFG.SIMPLE_MODE ?? resolveSimpleMode(CFG.ROLE),
                            transportProfile: tp,
                            hierarchyRole: CFG.ROLE,
                        });
                        runtimeApplied = rr.ok;
                        runtimeError = rr.error;
                    }
                    sendJson(
                        res,
                        applied.ok && !runtimeError ? 200 : 400,
                        {
                            ok: applied.ok && !runtimeError,
                            applied: applied.applied,
                            errors: applied.errors,
                            runtimeApplied,
                            runtimeError,
                            requiresRestart: applied.requiresRestart,
                            requiresPageReload: applied.requiresPageReload,
                        },
                        cors
                    );
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
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
            const unlockIp = normalizeApiClientIp(req);
            if (CFG.API_RATE_LIMIT_UNLOCK_PER_MINUTE > 0 && !unlockRateLimit.check(unlockIp)) {
                sendJson(res, 429, { ok: false, error: 'Rate-Limit Entsperren überschritten.' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    if (CFG.API_RATE_LIMIT_UNLOCK_PER_MINUTE > 0) unlockRateLimit.record(unlockIp);
                    const data = JSON.parse(body || '{}');
                    const password = String(data.password ?? '');
                    const createNew = data.createNew === true;
                    if (createNew) {
                        setVaultUnlockBypass('createNew');
                    }
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
                    const vaultPath = resolveVaultFilePathForSession(CFG.VAULT_FILE || undefined);
                    const vaultLoadArgs: string[] = [password];
                    if (!createNew && vaultFileExists(vaultPath)) {
                        const def = CFG.VAULT_FILE || '.morgendrot-vault';
                        if (path.resolve(vaultPath) !== path.resolve(def) && path.basename(vaultPath) !== path.basename(def)) {
                            vaultLoadArgs.push(vaultPath);
                        }
                    }
                    let vaultChecked = false;
                    /** Wo das Passwort geprüft wurde — bestimmt den Sitzungs-Ladepfad nach dem Unlock. */
                    let vaultVerifiedSource: 'local' | 'chain' | 'none' = 'none';
                    const signerPost = String(data.sdkSignerImport ?? data.secretKey ?? data.mnemonic ?? '').trim();
                    let sdkSignerReady = CFG.SIGNER !== 'sdk';
                    /** Vault hatte bereits gespeicherten Signer-Import — sonst nach Unlock optional in Datei sichern. */
                    let vaultHadSdkSignerImport = false;
                    let sdkImportPersistedToVault = false;
                    let vaultRecoveredFromSigner = false;

                    if (!createNew && vaultFileExists(vaultPath)) {
                        try {
                            if (CFG.SIGNER === 'sdk') {
                                const content = await loadVaultContent(password, vaultPath);
                                vaultChecked = true;
                                vaultVerifiedSource = 'local';
                                const fromVault = (content.iotaSdkSignerImport || '').trim();
                                vaultHadSdkSignerImport = Boolean(fromVault);
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
                                vaultVerifiedSource = 'local';
                            }
                        } catch {
                            if (CFG.SIGNER === 'sdk' && signerPost && isPlausibleSdkImport(signerPost)) {
                                try {
                                    applySdkSignerFromImport(signerPost);
                                    sdkSignerReady = true;
                                    vaultRecoveredFromSigner = true;
                                    setVaultUnlockBypass('signerRecover');
                                } catch (e: any) {
                                    sendJson(
                                        res,
                                        400,
                                        {
                                            ok: false,
                                            error:
                                                `Vault-Passwort passt nicht zu ${path.resolve(vaultPath)} und der Seed-Import ist ungültig: ${String(e?.message || e)}`,
                                        },
                                        cors
                                    );
                                    return;
                                }
                            } else {
                                const vaultHint = signerPost
                                    ? ' Seed eingetragen? Unter „Seed importieren“ Mnemonic/Bech32-Secret einfügen — dann wird der Tresor mit neuem Passwort neu angelegt.'
                                    : ' Passwort vergessen? Unter „Seed importieren“ Mnemonic + neues Passwort — oder altes Passwort dieser Vault-Datei.';
                                sendJson(
                                    res,
                                    400,
                                    {
                                        ok: false,
                                        error:
                                            `Falsches Passwort oder beschädigter Vault (${path.resolve(vaultPath)}).${vaultHint}`,
                                    },
                                    cors
                                );
                                return;
                            }
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
                                        vaultVerifiedSource = 'chain';
                                        const fromVault = (content.iotaSdkSignerImport || '').trim();
                                        vaultHadSdkSignerImport = Boolean(fromVault);
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
                                        vaultVerifiedSource = 'chain';
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
                    setWalletPassword(password);
                    /**
                     * Erst-Entsperren: wallet-bridge wartet noch auf resolve(password) und lädt den Vault selbst
                     * (Command-Handler ist zu diesem Zeitpunkt noch der Stub → /vault-load würde fehlschlagen).
                     * Nach /vault-lock: Handler ist bereit → Keys per /vault-load in die Sitzung holen.
                     */
                    if (isMessengerCommandHandlerReady()) {
                        const handler = _commandHandler!;
                        let loadRes: { ok?: boolean; message?: string; error?: string };
                        if (!createNew && vaultFileExists(vaultPath) && !vaultRecoveredFromSigner) {
                            loadRes = (await handler('/vault-load', vaultLoadArgs, {})) as typeof loadRes;
                        } else if (vaultVerifiedSource === 'chain') {
                            loadRes = (await handler('/vault-load-from-chain', [password], {})) as typeof loadRes;
                        } else if (!vaultChecked) {
                            loadRes = { ok: true };
                        } else {
                            loadRes = {
                                ok: false,
                                message:
                                    'Vault-Passwort geprüft, aber Schlüssel nicht in die Sitzung geladen (weder lokale Datei noch On-Chain-Laden).',
                            };
                        }
                        if (!loadRes?.ok) {
                            const detail = String(loadRes?.message || loadRes?.error || '').trim();
                            sendJson(
                                res,
                                400,
                                {
                                    ok: false,
                                    error: detail || 'Tresor konnte nicht in die Sitzung geladen werden.',
                                },
                                cors
                            );
                            return;
                        }
                        if (
                            CFG.SIGNER === 'sdk' &&
                            signerPost &&
                            !vaultHadSdkSignerImport &&
                            (createNew || vaultFileExists(vaultPath))
                        ) {
                            const saveArgs = [password, '', vaultPath, 'includeIotaMnemonic'];
                            const saveRes = (await handler('/vault-save', saveArgs, {})) as {
                                ok?: boolean;
                                message?: string;
                            };
                            if (saveRes?.ok) sdkImportPersistedToVault = true;
                        }
                    }
                    const resolve = _resolvePassword;
                    _resolvePassword = null;
                    if (resolve) resolve(password);
                    let okMessage = vaultChecked
                        ? 'Passwort korrekt – Vault entschlüsselt.'
                        : vaultRecoveredFromSigner
                          ? 'Seed übernommen — Tresor wird mit deinem Passwort neu gespeichert (alte Datei wird überschrieben).'
                          : createNew
                          ? 'Neues Profil gestartet — Tresor wird mit deinem Passwort neu angelegt.'
                          : 'Entsperrt. Hinweis: Es wurde kein lokaler Vault und kein On-Chain-Vault mit Daten gefunden – das Passwort konnte nicht gegen einen Vault geprüft werden.';
                    if (CFG.SIGNER === 'sdk' && sdkImportPersistedToVault) {
                        okMessage +=
                            ' IOTA-Seed/Secret wurde in der Vault-Datei gespeichert — beim nächsten Mal reicht meist nur noch das Passwort unter „Tresor öffnen“.';
                    }
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

        if (url === '/api/vault-notes' && req.method === 'GET') {
            try {
                if (!_vaultNotesBridge) {
                    sendJson(res, 503, { ok: false, error: 'Notizen-API nicht initialisiert.' }, cors);
                    return;
                }
                const notes = _vaultNotesBridge.getNotes();
                if (notes === null) {
                    sendJson(res, 200, { ok: true, unlocked: false, notes: [] }, cors);
                    return;
                }
                sendJson(res, 200, { ok: true, unlocked: true, notes }, cors);
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
            return;
        }

        if (url === '/api/vault-notes' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    if (!_vaultNotesBridge) {
                        sendJson(res, 503, { ok: false, error: 'Notizen-API nicht initialisiert.' }, cors);
                        return;
                    }
                    const data = JSON.parse(body || '{}') as { notes?: unknown; persistLocal?: boolean };
                    const sanitized = sanitizeVaultNotes(data.notes);
                    const result = await _vaultNotesBridge.setNotes(sanitized, {
                        persistLocal: data.persistLocal === true,
                    });
                    if (!result.ok) {
                        sendJson(res, 400, { ok: false, error: result.error || 'Fehler' }, cors);
                        return;
                    }
                    if (data.persistLocal === true) setLastVaultLocalSaveAt(Date.now());
                    sendJson(res, 200, { ok: true, message: result.message, notes: sanitized }, cors);
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        if (url === '/api/vault-onchain-preflight' && req.method === 'GET') {
            try {
                const myAddr = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
                const pre = await runVaultOnchainPreflight(myAddr);
                sendJson(res, 200, { ok: pre.ok, preflight: pre }, cors);
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
            return;
        }

        if (url === '/api/vault-sync-chain-config' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}') as { apply?: boolean; dryRun?: boolean };
                    const myAddr = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
                    const sync = await syncVaultChainConfig(myAddr, {
                        apply: data.dryRun === true ? false : data.apply !== false,
                    });
                    sendJson(
                        res,
                        200,
                        {
                            ok: sync.preflight.ok || sync.applied.length > 0,
                            applied: sync.applied,
                            skipped: sync.skipped,
                            preflight: sync.preflight,
                        },
                        cors
                    );
                } catch (e: unknown) {
                    sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
                }
            });
            return;
        }

        /** Vault-Datei vom Browser hochladen → Server-Arbeitsverzeichnis (für /vault-load). */
        if (url === '/api/vault-import' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body || '{}') as { contentBase64?: string; filename?: string };
                    const b64 = String(data.contentBase64 ?? '').trim();
                    if (!b64) {
                        sendJson(res, 400, { ok: false, error: 'contentBase64 fehlt.' }, cors);
                        return;
                    }
                    let raw: Buffer;
                    try {
                        raw = Buffer.from(b64, 'base64');
                    } catch {
                        sendJson(res, 400, { ok: false, error: 'Ungültiges Base64.' }, cors);
                        return;
                    }
                    if (raw.length < 32) {
                        sendJson(res, 400, { ok: false, error: 'Datei zu kurz für eine Vault-Datei.' }, cors);
                        return;
                    }
                    if (raw.length > 12 * 1024 * 1024) {
                        sendJson(res, 400, { ok: false, error: 'Datei zu groß (max. 12 MB).' }, cors);
                        return;
                    }
                    let base = path.basename(String(data.filename ?? '').trim() || '.morgendrot-vault');
                    if (!base.startsWith('.morgendrot-vault')) {
                        base = '.morgendrot-vault';
                    }
                    if (base.length > 128) base = base.slice(0, 128);
                    const target = path.join(process.cwd(), base);
                    fs.writeFileSync(target, raw);
                    try {
                        fs.chmodSync(target, 0o600);
                    } catch {
                        /* Windows */
                    }
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            path: target,
                            message: `Vault-Datei übernommen: ${base} (${raw.length} Bytes). Mit „Laden“ in die Sitzung holen.`,
                        },
                        cors
                    );
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
                    const segmented =
                        data.segmented === true ||
                        data.segmented === 'true' ||
                        data.segmented === 1 ||
                        data.segmented === '1';
                    const maxTotalRaw =
                        typeof data.maxTotalBytes === 'number'
                            ? data.maxTotalBytes
                            : typeof data.maxTotalBytes === 'string'
                              ? parseInt(data.maxTotalBytes, 10)
                              : NaN;
                    const r = segmented
                        ? await prepareImageForLoRaFluentRobust(raw, {
                              maxTotalBytes: Number.isFinite(maxTotalRaw) ? maxTotalRaw : undefined,
                          })
                        : await prepareImageForLoRaRobust(raw);
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
                    const r = await prepareImageForLoRaFluentRobust(png);
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
            req.on('end', async () => {
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
                    const teamMailboxIds = String(data.teamMailboxIds ?? '').trim();
                    const commandRegistryId = String(data.commandRegistryId ?? '').trim();
                    const vaultRegistryId = String(data.vaultRegistryId ?? '').trim();
                    const nextPublicDirectIotaRpcUrl = String(data.nextPublicDirectIotaRpcUrl ?? '').trim();
                    const handoffLabel = String(data.handoffLabel ?? data.label ?? '').trim();
                    const messengerGroupHandoff = String(data.messengerGroupHandoff ?? '').trim();
                    const helperRoleRaw = String(data.helperRole ?? '').trim().toLowerCase();
                    const helperRole =
                        helperRoleRaw === 'arbeiter' || helperRoleRaw === 'kommandant' ? helperRoleRaw : 'messenger';
                    const roleIdParsed = parseInt(String(data.roleId ?? ''), 10);
                    const roleId = Number.isFinite(roleIdParsed) ? roleIdParsed : undefined;
                    const deploymentProfile = String(data.deploymentProfile ?? '').trim() || undefined;
                    const uiVariantRaw = String(data.uiVariant ?? '').trim().toLowerCase();
                    const uiVariant = uiVariantRaw === 'messenger' ? 'messenger' : uiVariantRaw === 'full' ? 'full' : undefined;
                    const transportProfileRaw = String(data.transportProfile ?? '').trim().toLowerCase();
                    const transportProfile =
                        transportProfileRaw === 'iota-anchored' || transportProfileRaw === 'iota-full'
                            ? transportProfileRaw
                            : transportProfileRaw === 'mesh-first'
                              ? 'mesh-first'
                              : undefined;
                    const simpleModeRaw = data.simpleMode;
                    const simpleMode =
                        simpleModeRaw === true || simpleModeRaw === 'true' || simpleModeRaw === 1 || simpleModeRaw === '1'
                            ? true
                            : simpleModeRaw === false || simpleModeRaw === 'false' || simpleModeRaw === 0 || simpleModeRaw === '0'
                              ? false
                              : undefined;
                    const ttlRaw = data.exportTtlDays ?? data.defaultTtlDays;
                    let exportTtlDays: number | undefined;
                    if (ttlRaw != null && ttlRaw !== '') {
                        const n = Number(ttlRaw);
                        if (Number.isFinite(n) && n >= 0 && n <= 3650) exportTtlDays = Math.floor(n);
                    }
                    if (exportTtlDays == null && CFG.DEFAULT_TTL_DAYS != null) {
                        const bossTtl = Number(CFG.DEFAULT_TTL_DAYS);
                        if (Number.isFinite(bossTtl) && bossTtl >= 0 && bossTtl <= 3650) exportTtlDays = Math.floor(bossTtl);
                    }
                    const exportEnablePurge =
                        data.exportEnablePurge === false ||
                        data.exportEnablePurge === 'false' ||
                        data.exportEnablePurge === 0 ||
                        data.exportEnablePurge === '0'
                            ? false
                            : data.exportEnablePurge === true ||
                                data.exportEnablePurge === 'true' ||
                                data.exportEnablePurge === 1 ||
                                data.exportEnablePurge === '1'
                              ? true
                              : CFG.ENABLE_PURGE;
                    let mailboxIdResolved = mailboxIdField;
                    let commandRegistryIdResolved = commandRegistryId;
                    let vaultRegistryIdResolved = vaultRegistryId;
                    let handoffGlobalsWarnings: string[] = [];
                    const strictGlobals =
                        data.strictGlobals === true ||
                        data.strictGlobals === 'true' ||
                        data.strictGlobals === 1 ||
                        data.strictGlobals === '1';
                    try {
                        const chainGlobals = await queryGlobalsCreatedForPackage({
                            rpcUrl,
                            packageId: pkgRes.packageId,
                        });
                        const recon = reconcileHandoffExportGlobals({
                            packageId: pkgRes.packageId,
                            mailboxId: mailboxIdField || undefined,
                            commandRegistryId: commandRegistryId || undefined,
                            vaultRegistryId: vaultRegistryId || undefined,
                            resolved: chainGlobals,
                            autoCorrect: !strictGlobals,
                        });
                        if (!recon.ok) {
                            sendJson(res, 400, { ok: false, error: recon.error }, cors);
                            return;
                        }
                        mailboxIdResolved = recon.mailboxId;
                        commandRegistryIdResolved = recon.commandRegistryId;
                        vaultRegistryIdResolved = recon.vaultRegistryId;
                        handoffGlobalsWarnings = recon.warnings;
                        if (handoffGlobalsWarnings.length) {
                            logger.warn(
                                'standalone-smartphone-handoff-zip globals: ' + handoffGlobalsWarnings.join(' ')
                            );
                        }
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        if (mailboxIdField || commandRegistryId || vaultRegistryId) {
                            sendJson(
                                res,
                                502,
                                {
                                    ok: false,
                                    error: `GlobalsCreated auf RPC nicht prüfbar: ${msg}`,
                                },
                                cors
                            );
                            return;
                        }
                        logger.warn('standalone-smartphone-handoff-zip: Globals-Query übersprungen: ' + msg);
                    }
                    let envContent: string;
                    let runtimeConfigContent: string;
                    try {
                        envContent = buildStandaloneSmartphoneHandoffEnv({
                            rpcUrl,
                            packageId: pkgRes.packageId,
                            bossAddress,
                            partnerAddresses: partnerAddresses || undefined,
                            mailboxId: mailboxIdResolved || undefined,
                            teamMailboxIds: teamMailboxIds || undefined,
                            commandRegistryId: commandRegistryIdResolved || undefined,
                            vaultRegistryId: vaultRegistryIdResolved || undefined,
                            nextPublicDirectIotaRpcUrl: nextPublicDirectIotaRpcUrl || undefined,
                            helperRole,
                            roleId,
                            deploymentProfile,
                            uiVariant,
                            transportProfile,
                            simpleMode,
                            handoffLabel: handoffLabel || undefined,
                            broadcastPinnwandEnabled: CFG.ENABLE_BROADCAST_PINNWAND,
                            broadcastPinnwandAddress: (CFG.BROADCAST_PINNWAND_ADDRESS || '').trim() || undefined,
                            messengerGroupHandoff: messengerGroupHandoff || undefined,
                            exportTtlDays,
                            exportEnablePurge,
                            einsatzChainMode: String(data.einsatzChainMode ?? '').trim() || undefined,
                            mainnetRpcUrl: String(data.mainnetRpcUrl ?? '').trim() || undefined,
                            apiAuthToken: (CFG.API_AUTH_TOKEN || '').trim() || undefined,
                        });
                        const resolvedRoleId =
                            roleId != null && Number.isFinite(roleId) ? roleId : 14;
                        const capOverride = parseMessengerCapabilitiesOverride(data.capabilitiesOverride);
                        runtimeConfigContent =
                            JSON.stringify(
                                buildHandoffRuntimeConfigPayload({
                                    roleId: resolvedRoleId,
                                    simpleMode,
                                    transportProfile: transportProfile ?? 'mesh-first',
                                    hierarchyRole: helperRole,
                                    override: capOverride ?? undefined,
                                }),
                                null,
                                2
                            ) + '\n';
                    } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        sendJson(res, 400, { ok: false, error: msg }, cors);
                        return;
                    }
                    const createdAtIso = new Date().toISOString();
                    const readmeExtra = String(data.readmeExtra ?? '').trim() || undefined;
                    const handoffExtras = buildHandoffExtrasFromTelegramConfig();
                    const handoffExtrasJson = handoffExtras ? `${JSON.stringify(handoffExtras, null, 2)}\n` : '';
                    const readme = buildStandaloneSmartphoneHandoffReadme({
                        handoffLabel,
                        createdAtIso,
                        packageId: pkgRes.packageId,
                        rpcUrl,
                        bossAddress: normalizeAddress(bossAddress),
                        helperRole,
                        teamMailboxIds: teamMailboxIds || undefined,
                        readmeExtra:
                            (readmeExtra ? `${readmeExtra}\n\n` : '') +
                            (handoffExtrasJson
                                ? 'Telegram-Alarmgruppe: siehe .morgendrot-handoff-extras.json (optional).'
                                : ''),
                    });
                    const slug =
                        (handoffLabel || 'handoff').replace(/[^\wäöüÄÖÜß.-]/gi, '_').slice(0, 48) || 'handoff';
                    const day = createdAtIso.slice(0, 10).replace(/-/g, '');
                    const format = String(data.format || '').trim().toLowerCase();
                    if (format === 'parts') {
                        sendJson(
                            res,
                            200,
                            {
                                ok: true,
                                envContent,
                                runtimeConfigContent,
                                readme,
                                handoffExtras: handoffExtras ?? undefined,
                                handoffLabel: handoffLabel || undefined,
                                createdAtIso,
                                packageId: pkgRes.packageId,
                                filenameBase: `morgendrot-standalone-handoff-${slug}-${day}`,
                                globalsWarnings: handoffGlobalsWarnings.length ? handoffGlobalsWarnings : undefined,
                            },
                            cors
                        );
                        return;
                    }
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
                    archive.append(runtimeConfigContent, { name: HANDOFF_RUNTIME_CONFIG_FILENAME });
                    if (handoffExtrasJson) {
                        archive.append(Buffer.from(handoffExtrasJson, 'utf8'), {
                            name: '.morgendrot-handoff-extras.json',
                        });
                    }
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
            if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'kommandant') {
                sendJson(res, 403, { ok: false, error: 'Nur Boss oder Kommandant.' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}') as {
                        path?: string;
                        createGlobals?: boolean;
                        forceGlobals?: boolean;
                    };
                    const rawPath = typeof data.path === 'string' && data.path.trim() ? data.path.trim() : 'move-test';
                    const packageDir = path.basename(rawPath) || 'move-test';
                    if (packageDir !== rawPath || /[\\/]/.test(packageDir)) {
                        sendJson(res, 400, { ok: false, error: 'path darf nur einen einzelnen Ordner-Namen enthalten (z. B. move-test).' }, cors);
                        return;
                    }
                    if (data.createGlobals === true) {
                        const result = await deployTestnetMovePackage({
                            packageDir,
                            createGlobals: true,
                            forceGlobals: data.forceGlobals === true,
                        });
                        sendJson(
                            res,
                            200,
                            {
                                ok: true,
                                packageId: result.packageId,
                                upgradeCapId: result.upgradeCapId,
                                mailboxId: result.mailboxId,
                                vaultRegistryId: result.vaultRegistryId,
                                commandRegistryId: result.commandRegistryId,
                                message:
                                    result.message ||
                                    'Package deployt. MAILBOX_ID und Registries in .env gespeichert.',
                            },
                            cors
                        );
                        return;
                    }
                    const result = await publishPackageCli(packageDir);
                    const applied = applyPublishResultToEnv(result);
                    const message =
                        (applied.envPackageOk
                            ? 'Package deployt. PACKAGE_ID in .env gespeichert.'
                            : 'Package deployt. (.env PACKAGE_ID: ' + (applied.envPackageError || 'nicht aktualisiert') + ')') +
                        (result.upgradeCapId && applied.envCapOk ? ' UPGRADE_CAP_ID gespeichert.' : '') +
                        ' Optional: POST /api/create-globals für MAILBOX_ID + Registries.';
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            packageId: result.packageId,
                            upgradeCapId: result.upgradeCapId,
                            message,
                        },
                        cors
                    );
                } catch (e: any) {
                    const msg = String(e?.message || e);
                    sendJson(res, 200, { ok: false, error: msg }, cors);
                }
            });
            return;
        }

        if (url === '/api/create-globals' && req.method === 'POST') {
            if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'kommandant') {
                sendJson(res, 403, { ok: false, error: 'Nur Boss oder Kommandant.' }, cors);
                return;
            }
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body || '{}') as { packageId?: string; force?: boolean };
                    const pkg = String(data.packageId || CFG.PACKAGE_ID || '').trim();
                    if (!/^0x[a-fA-F0-9]{64}$/i.test(pkg)) {
                        sendJson(res, 400, { ok: false, error: 'PACKAGE_ID fehlt oder ungültig.' }, cors);
                        return;
                    }
                    const existingMb = (CFG.MAILBOX_ID || process.env.MAILBOX_ID || '').trim();
                    if (existingMb && /^0x[a-fA-F0-9]{64}$/i.test(existingMb) && data.force !== true) {
                        sendJson(
                            res,
                            409,
                            {
                                ok: false,
                                error:
                                    'MAILBOX_ID bereits gesetzt — create_globals überschreibt Postfach/Registries. Nur bei neuem Package oder mit force:true.',
                            },
                            cors
                        );
                        return;
                    }
                    const globals = await createGlobalsCli(pkg);
                    const applied = applyGlobalsCreatedToEnv(globals);
                    if (applied.errors.length) {
                        sendJson(res, 500, { ok: false, error: applied.errors.join(' ') }, cors);
                        return;
                    }
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            packageId: pkg,
                            mailboxId: globals.mailboxId,
                            vaultRegistryId: globals.vaultRegistryId,
                            commandRegistryId: globals.commandRegistryId,
                            message:
                                'create_globals OK — MAILBOX_ID, VAULT_REGISTRY_ID und COMMAND_REGISTRY_ID in .env gespeichert.',
                        },
                        cors
                    );
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    sendJson(res, 200, { ok: false, error: msg }, cors);
                }
            });
            return;
        }

        if (url === '/api/deploy-mainnet-package' && req.method === 'POST') {
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
                    const rawPath = typeof data.path === 'string' && data.path.trim() ? data.path.trim() : 'move-test';
                    const packageDir = path.basename(rawPath) || 'move-test';
                    if (packageDir !== rawPath || /[\\/]/.test(packageDir)) {
                        sendJson(res, 400, { ok: false, error: 'path darf nur einen Ordner-Namen enthalten (z. B. move-test).' }, cors);
                        return;
                    }
                    const rpcFromBody = typeof data.rpcUrl === 'string' ? data.rpcUrl.trim() : '';
                    const rpcUrl =
                        rpcFromBody ||
                        (CFG.MAINNET_RPC_URL || '').trim() ||
                        'https://api.mainnet.iota.cafe';
                    const skipCreateGlobals = data.skipCreateGlobals === true;
                    const result = await deployMainnetMovePackage({ rpcUrl, packageDir, skipCreateGlobals });
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            ...result,
                        },
                        cors
                    );
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    sendJson(res, 200, { ok: false, error: msg }, cors);
                }
            });
            return;
        }

        /** In-Place Move-Upgrade (gleiche PACKAGE_ID) — nicht deploy-package. */
        if (url === '/api/upgrade-package' && req.method === 'POST') {
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
                    const rawPath = typeof data.path === 'string' && data.path.trim() ? data.path.trim() : 'move-test';
                    const packageDir = path.basename(rawPath) || 'move-test';
                    if (packageDir !== rawPath || /[\\/]/.test(packageDir)) {
                        sendJson(res, 400, { ok: false, error: 'path darf nur einen Ordner-Namen enthalten (z. B. move-test).' }, cors);
                        return;
                    }
                    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
                    const moveDir = path.join(rootDir, packageDir);
                    if (!fs.existsSync(moveDir)) {
                        sendJson(res, 400, {
                            ok: false,
                            error: `Move-Ordner ${packageDir} fehlt auf diesem PC (Dev-Setup nötig).`,
                        }, cors);
                        return;
                    }
                    const packageId = (CFG.PACKAGE_ID || '').trim();
                    if (!/^0x[a-fA-F0-9]{64}$/i.test(packageId)) {
                        sendJson(res, 400, { ok: false, error: 'PACKAGE_ID fehlt — zuerst deploy:move-package.' }, cors);
                        return;
                    }
                    const capOverride = String(data.upgradeCapId || data.upgradeCapability || '').trim();
                    let cap = /^0x[a-fA-F0-9]{64}$/i.test(capOverride) ? capOverride : '';
                    if (!cap) {
                        cap =
                            (await resolveUpgradeCapId({
                                client: getClient(),
                                packageId,
                                ownerAddress: CFG.MY_ADDRESS || process.env.MY_ADDRESS || '',
                            })) || '';
                    }
                    if (!/^0x[a-fA-F0-9]{64}$/i.test(cap)) {
                        sendJson(res, 400, {
                            ok: false,
                            error: 'UPGRADE_CAP_ID fehlt — nach Erst-Publish in .env oder Explorer notieren.',
                        }, cors);
                        return;
                    }
                    const result = await upgradePackageCli(cap, packageDir);
                    invalidateMessagingMoveFeaturesCache(result.packageId);
                    sendJson(
                        res,
                        200,
                        {
                            ok: true,
                            packageId: result.packageId,
                            message:
                                'Move-Package upgraded (gleiche PACKAGE_ID). Backend neu starten. Kein neues Handoff nötig.',
                        },
                        cors
                    );
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    sendJson(res, 200, { ok: false, error: msg }, cors);
                }
            });
            return;
        }

        if (url === '/api/start-boss-signer' && req.method === 'POST') {
            if (denyUnlessTrustedApiClient(req, res, cors, sendJson)) return;
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

        if (handleCommandRoute(req, res, url, cors, sendJson, routeCtx)) return;

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
            const bindHost = CFG.API_BIND_HOST || '127.0.0.1';
            const statusUrl =
                bindHost === '0.0.0.0'
                    ? `http://<PC-LAN-IP>:${p}/api/status (lauscht auf allen Interfaces)`
                    : `http://127.0.0.1:${p}/api/status`;
            logger.info(
                CFG.SERVE_LITE_UI_STATIC
                    ? `Morgendrot API: ${statusUrl}  Lite-UI: http://127.0.0.1:${p}/`
                    : `Morgendrot API: ${statusUrl}  (Lite-UI aus — nur Next: http://127.0.0.1:${CFG.UI_PORT}/)`
            );
            warnIfLanApiMissingAuthToken((msg) => logger.warn(msg));
            startForensicBatchScheduler();
        };
        const onError = (err: NodeJS.ErrnoException) => {
            server.removeListener('error', onError);
            server.removeListener('listening', onSuccess);
            if (err.code === 'EADDRINUSE') {
                if (process.env.MORGENDROT_DEV_STRICT_PORTS === '1') {
                    logger.error(
                        `API-Port ${p} belegt — kein Fallback (MORGENDROT_DEV_STRICT_PORTS). Bitte npm run dev:stop oder npm run dev:messenger:clean.`
                    );
                    process.exit(1);
                }
                logger.warn(`API-Port ${p} belegt, versuche ${p + 1}…`);
                tryListen(p + 1);
            } else {
                logger.error('API-Server Fehler: ' + (err?.message || err));
            }
        };
        server.once('error', onError);
        server.once('listening', onSuccess);
        server.listen(p, CFG.API_BIND_HOST || '127.0.0.1');
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
