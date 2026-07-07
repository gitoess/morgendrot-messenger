/**
 * Status-/Meta-Routen: /api/status, /api/help, IDs, Presets, Chain-Erreichbarkeit.
 */
import type http from 'node:http';
import {
    CFG,
    getConnectAddresses,
    getHierarchyPermissions,
    getInboxUnionIdsForStatus,
    getRuntimeConfigKeys,
    getRuntimeConfigSources,
    getSignerConfigSource,
    getWalletDerivationPathConfigSource,
    refreshIdentityCfgFromDotenv,
    resolveDeploymentProfile,
    resolveSimpleMode,
    resolveTransportProfile,
    resolveUiMode,
    resolveHandoffLabel,
    isIotaTransportUiEnabled,
    readRuntimeConfigRaw,
    readPackageIdHistory,
    readPackageIdHints,
    setEnvKey,
    type HierarchyPermissions,
} from '../../config.js';
import {
    getMessengerCreditsSnapshot,
    getPackageIdsForOwner,
    isChainReachable,
} from '../../chain-access.js';
import {
    fetchWalletNativeBalancesForAddress,
    resolveBossWalletAddressForBalance,
} from '../wallet-native-balances.js';
import { getMessagingMoveFeatures } from '../../move-package-features.js';
import { getClient } from '../../chain-access.js';
import { resolveUpgradeCapId } from '../../move-package-deploy.js';
import { HELP_START, HELP_CHAT, HELP_UI_INTRO } from '../../wallet-bridge.js';
import { vaultFileExists } from '../../vault-local.js';
import { inferNetworkFromRpcUrl } from '../../vault-onchain-preflight.js';
import { HEARTBEAT_INTERVAL_PRESETS_MS, isAllowedHeartbeatIntervalMs } from '../../shared/heartbeat-presets.js';
import {
    readCapabilitiesOverrideFromRuntimeRaw,
    resolveMessengerCapabilities,
} from '../../shared/messenger-capabilities-matrix.js';
import { mask, rpcUrlLabel } from '../http-middleware.js';
import { collectLanIpv4Hosts, buildLanInstallUrlPair } from '../../lib/lan-install-urls.js';
import type { ApiStatus } from '../../api-server.js';
import type { ApiRouteContext, SendJsonFn } from './api-route-types.js';

export async function handleStatusRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string,
    cors: Record<string, string>,
    sendJson: SendJsonFn,
    ctx: ApiRouteContext
): Promise<boolean> {
    if (url === '/api/status' && req.method === 'GET') {
        const envRefresh = refreshIdentityCfgFromDotenv();
        const custom = { ...(ctx.getStatus?.() ?? {}), ...ctx.getSessionStatus() };
        const perms = getHierarchyPermissions(CFG.ROLE);
        const capabilities = resolveMessengerCapabilities({
            roleId: CFG.ROLE_ID,
            simpleMode: CFG.SIMPLE_MODE ?? resolveSimpleMode(CFG.ROLE),
            transportProfile: CFG.TRANSPORT_PROFILE ?? resolveTransportProfile(CFG.ROLE),
            hierarchyRole: CFG.ROLE,
            override: readCapabilitiesOverrideFromRuntimeRaw(readRuntimeConfigRaw()),
        });
        const vaultFileResolved = (CFG.VAULT_FILE || '').trim() || '.morgendrot-vault';
        const mailboxIdTrim = (CFG.MAILBOX_ID || '').trim();
        const inboxUnion = getInboxUnionIdsForStatus();
        const mailboxConfigured = Boolean(mailboxIdTrim && /^0x[a-fA-F0-9]{64}$/i.test(mailboxIdTrim));
        const packageTrim = (CFG.PACKAGE_ID || '').trim();
        const configHints: string[] = [];
        if (CFG.MAILBOX_STORE_PLAINTEXT && !mailboxConfigured) {
            configHints.push(
                'MAILBOX_STORE_PLAINTEXT ist aktiv, aber MAILBOX_ID fehlt oder ist keine gültige Objekt-ID (0x + 64 Hex).'
            );
        }
        if (mailboxIdTrim && packageTrim && mailboxIdTrim.toLowerCase() === packageTrim.toLowerCase()) {
            configHints.push('MAILBOX_ID entspricht PACKAGE_ID — Mailbox-Aufrufe schlagen fehl („move package passed“).');
        }
        if (envRefresh.mailboxIdChanged) {
            configHints.push(
                'MAILBOX_ID wurde aus .env nachgeladen (ohne Neustart). Posteingang einmal „Aktualisieren“.'
            );
        }
        if (inboxUnion.mailboxIds.length > 1) {
            configHints.push(
                `Posteingang-Mailbox-Union: ${inboxUnion.mailboxIds.length} IDs (aktiv + .morgendrot-mailbox-id-history).`
            );
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
        if (CFG.USE_MAILBOX && mailboxConfigured && !CFG.MAILBOX_STORE_PLAINTEXT) {
            configHints.push(
                'Klartext in der Mailbox: MAILBOX_STORE_PLAINTEXT ist aus — in .env auf true, in der Messenger-Transport-Card (Boss) oder unter „.env anpassen“ aktivieren; sonst „Flüchtig (Event)“ für Klartext wählen.'
            );
        }
        if (!CFG.USE_MAILBOX && mailboxConfigured) {
            configHints.push(
                'USE_MAILBOX ist aus — Persistent (Mailbox) für Klartext/Verschlüsselt scheitert. USE_MAILBOX=true setzen oder in der UI „Flüchtig (Event)“ wählen.'
            );
        }
        let messengerCredits: { balance: string; maxBalance: string } | null | undefined;
        let messengerCreditsFetchFailed: boolean | undefined;
        const credLooksValid =
            credRaw && /^0x[a-fA-F0-9]{64}$/i.test(credRaw) && credRaw.toLowerCase() !== packageTrim.toLowerCase();
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
        let walletNativeIotaBalanceTestnet: { mist: string; displayIota: string } | undefined;
        let walletNativeIotaBalanceMainnet: { mist: string; displayIota: string } | undefined;
        let walletNativeIotaBalanceTestnetFetchFailed: boolean | undefined;
        let walletNativeIotaBalanceMainnetFetchFailed: boolean | undefined;
        let walletNativeIotaBalanceNetwork: 'testnet' | 'mainnet' | undefined;
        {
            const myAddr = resolveBossWalletAddressForBalance();
            if (myAddr && /^0x[a-fA-F0-9]{64}$/i.test(myAddr)) {
                const balances = await fetchWalletNativeBalancesForAddress(myAddr);
                walletNativeIotaBalance = balances.walletNativeIotaBalance;
                walletNativeIotaBalanceFetchFailed = balances.walletNativeIotaBalanceFetchFailed;
                walletNativeIotaBalanceNetwork = balances.walletNativeIotaBalanceNetwork;
                walletNativeIotaBalanceTestnet = balances.walletNativeIotaBalanceTestnet ?? undefined;
                walletNativeIotaBalanceMainnet = balances.walletNativeIotaBalanceMainnet ?? undefined;
                walletNativeIotaBalanceTestnetFetchFailed =
                    balances.walletNativeIotaBalanceTestnetFetchFailed;
                walletNativeIotaBalanceMainnetFetchFailed =
                    balances.walletNativeIotaBalanceMainnetFetchFailed;
            }
        }
        const lastVaultOnchainSuccessAt = ctx.getLastVaultOnchainAt();
        const lastVaultLocalSaveAt = ctx.getLastVaultLocalSaveAt();
        const vaultNetwork = inferNetworkFromRpcUrl(CFG.RPC_URL || '');
        const defaultTtlDays = Number(CFG.DEFAULT_TTL_DAYS ?? 30n);
        const vaultRegTrim = (CFG.VAULT_REGISTRY_ID || '').trim();
        const cmdRegTrim = (CFG.COMMAND_REGISTRY_ID || '').trim();
        let moveFeatures:
            | {
                  teamBroadcastStore: boolean;
                  teamBroadcastPurge: boolean;
                  privateMailboxPurge: boolean;
                  probed: boolean;
                  error?: string;
              }
            | undefined;
        if (packageTrim && /^0x[a-fA-F0-9]{64}$/i.test(packageTrim)) {
            try {
                moveFeatures = await getMessagingMoveFeatures(packageTrim);
            } catch {
                moveFeatures = undefined;
            }
        }
        const upgradeCapFromEnv = (CFG.UPGRADE_CAP_ID || '').trim();
        let upgradeCapId: string | undefined =
            upgradeCapFromEnv && /^0x[a-fA-F0-9]{64}$/i.test(upgradeCapFromEnv) ? upgradeCapFromEnv : undefined;
        let upgradeCapResolvedFromChain = false;
        if (!upgradeCapId && packageTrim && /^0x[a-fA-F0-9]{64}$/i.test(packageTrim)) {
            const owner = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
            if (owner && /^0x[a-fA-F0-9]{64}$/i.test(owner)) {
                try {
                    const found = await resolveUpgradeCapId({
                        client: getClient(),
                        packageId: packageTrim,
                        ownerAddress: owner,
                    });
                    if (found) {
                        upgradeCapId = found;
                        upgradeCapResolvedFromChain = true;
                    }
                } catch {
                    /* optional */
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
            locked: !!ctx.getResolvePassword(),
            connected: custom.connected ?? false,
            hasKeys: custom.hasKeys,
            myAddress: custom.myAddress ?? (CFG.MY_ADDRESS ? mask(CFG.MY_ADDRESS) : undefined),
            myAddressFull: (() => {
                const raw = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
                return raw || undefined;
            })(),
            bossAddress: (() => {
                const raw = (CFG.BOSS_ADDRESS || '').trim();
                return /^0x[a-fA-F0-9]{64}$/i.test(raw) ? raw : undefined;
            })(),
            partnerAddress: custom.partnerAddress ?? (CFG.PARTNER_ADDRESS ? mask(CFG.PARTNER_ADDRESS) : undefined),
            partnerCount: custom.partnerCount,
            connectedAddresses: custom.connectedAddresses,
            plaintextMode: CFG.ENABLE_PLAINTEXT_CHANNEL,
            mailboxStorePlaintext: CFG.MAILBOX_STORE_PLAINTEXT,
            role: CFG.ROLE,
            roleId: CFG.ROLE_ID,
            capabilities,
            permissions: perms,
            deploymentProfile: CFG.DEPLOYMENT_PROFILE ?? resolveDeploymentProfile(CFG.ROLE),
            transportProfile: CFG.TRANSPORT_PROFILE ?? resolveTransportProfile(CFG.ROLE),
            simpleMode: CFG.SIMPLE_MODE ?? resolveSimpleMode(CFG.ROLE),
            uiMode: resolveUiMode(CFG.ROLE),
            iotaTransportUiEnabled: isIotaTransportUiEnabled(CFG.TRANSPORT_PROFILE),
            streams: {
                active: !!(CFG.STREAMS_BRIDGE_URL && CFG.STREAMS_ANCHOR_ID),
                anchorId: CFG.STREAMS_ANCHOR_ID ? mask(CFG.STREAMS_ANCHOR_ID, 12) : undefined,
                anchorIdFull: CFG.STREAMS_ANCHOR_ID || '',
            },
            heartbeat: {
                enabled: CFG.ENABLE_HEARTBEAT,
                intervalMs: CFG.HEARTBEAT_INTERVAL_MS,
                streamsReady: !!(CFG.STREAMS_BRIDGE_URL && CFG.STREAMS_ANCHOR_ID),
                presetsMinutes: HEARTBEAT_INTERVAL_PRESETS_MS.map((ms) => ms / 60_000),
                intervalMatchesPreset: isAllowedHeartbeatIntervalMs(CFG.HEARTBEAT_INTERVAL_MS),
            },
            vaultStatus: {
                hasLocal: vaultFileExists(vaultFileResolved),
                network: vaultNetwork,
                ...(lastVaultOnchainSuccessAt != null && { lastSavedToChainAt: lastVaultOnchainSuccessAt }),
                ...(lastVaultLocalSaveAt != null && { lastLocalSavedAt: lastVaultLocalSaveAt }),
            },
            uiVariant: CFG.UI_VARIANT === 'messenger' ? 'messenger' : 'full',
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
            ...(walletNativeIotaBalanceNetwork && { walletNativeIotaBalanceNetwork }),
            ...(walletNativeIotaBalanceTestnet !== undefined && { walletNativeIotaBalanceTestnet }),
            ...(walletNativeIotaBalanceMainnet !== undefined && { walletNativeIotaBalanceMainnet }),
            ...(walletNativeIotaBalanceTestnetFetchFailed && {
                walletNativeIotaBalanceTestnetFetchFailed: true,
            }),
            ...(walletNativeIotaBalanceMainnetFetchFailed && {
                walletNativeIotaBalanceMainnetFetchFailed: true,
            }),
            ...(configHints.length > 0 && { configHints }),
            rpcUrlLabel: rpcUrlLabel(CFG.RPC_URL || ''),
            rpcSocksProxyActive: Boolean((CFG.RPC_SOCKS_PROXY || '').trim()),
            rpcHttpProxyActive: Boolean((CFG.RPC_HTTP_PROXY || '').trim()),
            apiListenPort: ctx.getActualApiPort(),
            dashboardPort: CFG.UI_PORT,
            compactImageEncode: true,
            loraProgressiveEncode: true,
            ...(packageTrim ? { packageId: packageTrim } : {}),
            ...(CFG.HANDOFF_LABEL?.trim() ? { handoffLabel: CFG.HANDOFF_LABEL.trim() } : {}),
            ...(mailboxConfigured && mailboxIdTrim
                ? { mailboxId: mailboxIdTrim, mailboxIdMasked: mask(mailboxIdTrim) }
                : {}),
            inboxUnionPackageIds: inboxUnion.packageIds,
            inboxUnionMailboxIds: inboxUnion.mailboxIds,
            einsatzConfig: {
                editionLabel: 'Standard (Purge + Rebate)',
                defaultTtlDays: Number.isFinite(defaultTtlDays) ? defaultTtlDays : 30,
                enablePurge: CFG.ENABLE_PURGE,
                ...(vaultRegTrim && /^0x[a-fA-F0-9]{64}$/i.test(vaultRegTrim)
                    ? { vaultRegistryId: vaultRegTrim, vaultRegistryIdMasked: mask(vaultRegTrim) }
                    : {}),
                ...(cmdRegTrim && /^0x[a-fA-F0-9]{64}$/i.test(cmdRegTrim)
                    ? { commandRegistryId: cmdRegTrim, commandRegistryIdMasked: mask(cmdRegTrim) }
                    : {}),
                ...(CFG.EINSATZ_MANIFEST_REGISTRY_ID &&
                /^0x[a-fA-F0-9]{64}$/i.test(CFG.EINSATZ_MANIFEST_REGISTRY_ID.trim())
                    ? {
                          einsatzManifestRegistryId: CFG.EINSATZ_MANIFEST_REGISTRY_ID.trim(),
                          einsatzManifestRegistryIdMasked: mask(CFG.EINSATZ_MANIFEST_REGISTRY_ID.trim()),
                      }
                    : {}),
                ...(CFG.MAINNET_RPC_URL?.trim()
                    ? {
                          mainnetRpcUrlLabel: rpcUrlLabel(CFG.MAINNET_RPC_URL.trim()),
                          ...(CFG.ROLE === 'boss' || CFG.ROLE === 'kommandant'
                              ? { mainnetRpcUrl: CFG.MAINNET_RPC_URL.trim() }
                              : {}),
                      }
                    : {}),
                ...(CFG.MAINNET_PACKAGE_ID &&
                /^0x[a-fA-F0-9]{64}$/i.test(CFG.MAINNET_PACKAGE_ID.trim())
                    ? {
                          mainnetPackageId: CFG.MAINNET_PACKAGE_ID.trim(),
                          mainnetPackageIdMasked: mask(CFG.MAINNET_PACKAGE_ID.trim()),
                      }
                    : {}),
                ...(moveFeatures ? { moveFeatures } : {}),
                upgradeCapConfigured: !!upgradeCapId,
                ...(upgradeCapId
                    ? {
                          upgradeCapId,
                          upgradeCapIdMasked: mask(upgradeCapId),
                          upgradeCapResolvedFromChain,
                      }
                    : {}),
                deployModeHint: upgradeCapId
                    ? 'upgrade-fähig (npm run upgrade:move-package)'
                    : 'nur Neu-Publish (UpgradeCap fehlt)',
            },
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
        return true;
    }

    if (url === '/api/help' && req.method === 'GET') {
        const session = ctx.getSessionStatus();
        const helpText = HELP_UI_INTRO + (session.connected ? HELP_CHAT : HELP_START);
        sendJson(res, 200, { ok: true, helpText }, cors);
        return true;
    }

    if (url === '/api/lan-install-urls' && req.method === 'GET') {
        try {
            const hosts = collectLanIpv4Hosts();
            sendJson(
                res,
                200,
                {
                    ok: true,
                    hosts,
                    uiPort: CFG.UI_PORT,
                    apiPort: CFG.API_PORT,
                    pairs: hosts.map((h) => buildLanInstallUrlPair(h, CFG.UI_PORT, CFG.API_PORT)),
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/current-ids' && req.method === 'GET') {
        try {
            sendJson(
                res,
                200,
                {
                    ok: true,
                    myAddress: CFG.MY_ADDRESS || '',
                    packageId: CFG.PACKAGE_ID || '',
                    mailboxId: CFG.MAILBOX_ID || '',
                    commandRegistryId: CFG.COMMAND_REGISTRY_ID || '',
                    vaultRegistryId: CFG.VAULT_REGISTRY_ID || '',
                    upgradeCapId: CFG.UPGRADE_CAP_ID || '',
                    streamsAnchorId: CFG.STREAMS_ANCHOR_ID || '',
                    streamsBridgeUrl: CFG.STREAMS_BRIDGE_URL || '',
                    rpcUrl: (CFG.RPC_URL || '').trim(),
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url.startsWith('/api/package-id-history') && req.method === 'GET') {
        try {
            const wantDiscovered = /[?&]discovered=true/i.test(url);
            const current = (CFG.PACKAGE_ID || '').trim();
            const history = [...readPackageIdHistory()];
            const hints = readPackageIdHints();
            const mainnetPkg = (CFG.MAINNET_PACKAGE_ID || '').trim();
            if (mainnetPkg && /^0x[a-fA-F0-9]{64}$/i.test(mainnetPkg)) {
                const curLower = current.toLowerCase();
                if (!history.some((h) => h.toLowerCase() === mainnetPkg.toLowerCase()) && curLower !== mainnetPkg.toLowerCase()) {
                    history.push(mainnetPkg);
                }
            }
            let discovered: string[] = [];
            if (wantDiscovered) {
                const owner = (CFG.MY_ADDRESS || '').trim();
                if (/^0x[a-fA-F0-9]{64}$/i.test(owner)) {
                    try {
                        discovered = await getPackageIdsForOwner(owner);
                    } catch {
                        discovered = [];
                    }
                }
            }
            sendJson(
                res,
                200,
                {
                    ok: true,
                    current,
                    history,
                    discovered,
                    hints,
                },
                cors
            );
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
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
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/connect-addresses' && req.method === 'GET') {
        try {
            const addresses = getConnectAddresses();
            sendJson(res, 200, { ok: true, addresses }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    if (url === '/api/chain-reachable' && req.method === 'GET') {
        try {
            const reachable = await isChainReachable();
            sendJson(res, 200, { ok: true, reachable }, cors);
        } catch (e: unknown) {
            sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
        }
        return true;
    }

    /** Boss-Einsatz-Parameter in Server-.env (TTL, Purge) — Block „Bestehende Geräte“. */
    if (url === '/api/einsatz-config-apply' && req.method === 'POST') {
        if (CFG.ROLE !== 'boss' && CFG.ROLE !== 'kommandant') {
            sendJson(res, 403, { ok: false, error: 'Nur Boss oder Kommandant.' }, cors);
            return true;
        }
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}') as Record<string, unknown>;
                const applied: string[] = [];
                const errors: string[] = [];
                if (data.defaultTtlDays != null && data.defaultTtlDays !== '') {
                    const n = Number(data.defaultTtlDays);
                    if (!Number.isFinite(n) || n < 0 || n > 3650) {
                        errors.push('defaultTtlDays: 0–3650');
                    } else {
                        const v = String(Math.floor(n));
                        (CFG as { DEFAULT_TTL_DAYS: bigint }).DEFAULT_TTL_DAYS = BigInt(Math.floor(n));
                        process.env.DEFAULT_TTL_DAYS = v;
                        const r = setEnvKey('DEFAULT_TTL_DAYS', v);
                        if (r.ok) applied.push(`DEFAULT_TTL_DAYS=${v}`);
                        else errors.push(r.error || 'DEFAULT_TTL_DAYS');
                    }
                }
                if (data.enablePurge !== undefined && data.enablePurge !== null) {
                    const on =
                        data.enablePurge === true ||
                        data.enablePurge === 'true' ||
                        data.enablePurge === 1 ||
                        data.enablePurge === '1';
                    (CFG as { ENABLE_PURGE: boolean }).ENABLE_PURGE = on;
                    process.env.ENABLE_PURGE = on ? 'true' : 'false';
                    const r = setEnvKey('ENABLE_PURGE', on ? 'true' : 'false');
                    if (r.ok) applied.push(`ENABLE_PURGE=${on}`);
                    else errors.push(r.error || 'ENABLE_PURGE');
                }
                if (!applied.length && !errors.length) {
                    sendJson(res, 400, { ok: false, error: 'Keine Parameter (defaultTtlDays, enablePurge).' }, cors);
                    return;
                }
                sendJson(
                    res,
                    200,
                    {
                        ok: errors.length === 0,
                        applied,
                        errors: errors.length ? errors : undefined,
                        message: applied.length ? `Server-.env: ${applied.join(', ')}` : undefined,
                    },
                    cors
                );
            } catch (e: unknown) {
                sendJson(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }, cors);
            }
        });
        return true;
    }

    return false;
}
