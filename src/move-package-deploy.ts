/**
 * Move-Package publish / upgrade (IOTA-CLI) + UpgradeCap-Auflösung.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IotaClient } from '@iota/iota-sdk/client';
import { CFG, savePackageIdToFile, setEnvKey } from './config.js';

const HEX64 = /^0x[a-fA-F0-9]{64}$/i;

export type MovePackagePublishResult = {
    packageId: string;
    upgradeCapId?: string;
};

export type MovePackageUpgradeResult = {
    /** Gleiche Package-ID wie vor dem Upgrade (In-Place). */
    packageId: string;
};

function extractPublishFromObjectChanges(changes: unknown[]): MovePackagePublishResult | null {
    let packageId: string | undefined;
    let upgradeCapId: string | undefined;
    for (const raw of changes) {
        if (!raw || typeof raw !== 'object') continue;
        const c = raw as Record<string, unknown>;
        if (c.type === 'published' && typeof c.packageId === 'string' && HEX64.test(c.packageId)) {
            packageId = c.packageId;
        }
        const objectType = String(c.objectType ?? '');
        if (
            objectType.toLowerCase().includes('::package::upgradecap') &&
            typeof c.objectId === 'string' &&
            HEX64.test(c.objectId)
        ) {
            upgradeCapId = c.objectId;
        }
    }
    if (!packageId) return null;
    return { packageId, upgradeCapId };
}

/** Parst `iota client publish --json` oder Text-Fallback. */
export function parsePublishCliOutput(stdout: string): MovePackagePublishResult {
    const trimmed = stdout.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            const changes =
                (Array.isArray(parsed.objectChanges) ? parsed.objectChanges : null) ??
                (Array.isArray((parsed.effects as { objectChanges?: unknown[] } | undefined)?.objectChanges)
                    ? (parsed.effects as { objectChanges: unknown[] }).objectChanges
                    : null);
            if (changes?.length) {
                const fromChanges = extractPublishFromObjectChanges(changes);
                if (fromChanges) return fromChanges;
            }
            const pkgFromRoot = typeof parsed.packageId === 'string' ? parsed.packageId : undefined;
            if (pkgFromRoot && HEX64.test(pkgFromRoot)) {
                return { packageId: pkgFromRoot };
            }
        } catch {
            /* Text-Fallback unten */
        }
    }
    const packageIdLine = /Package(?:ID)?\s*:\s*(0x[a-fA-F0-9]{64})/i.exec(stdout);
    if (packageIdLine) {
        const capLine =
            /UpgradeCap[^0x]*(0x[a-fA-F0-9]{64})/i.exec(stdout) ??
            /objectId["\s:]+(0x[a-fA-F0-9]{64})[^]*UpgradeCap/i.exec(stdout);
        return {
            packageId: packageIdLine[1]!,
            upgradeCapId: capLine?.[1],
        };
    }
    const publishedBlock = /Published\s+Objects[\s\S]*?(0x[a-fA-F0-9]{64})/i.exec(stdout);
    if (publishedBlock) {
        return { packageId: publishedBlock[1]! };
    }
    const allHex = stdout.match(/0x[a-fA-F0-9]{64}/g);
    if (allHex && allHex.length > 0) {
        return { packageId: allHex[allHex.length - 1]! };
    }
    throw new Error('Package-ID in Publish-Ausgabe nicht gefunden.');
}

function parseUpgradeCliOutput(stdout: string, expectedPackageId: string): MovePackageUpgradeResult {
    const trimmed = stdout.trim();
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            const changes = Array.isArray(parsed.objectChanges) ? parsed.objectChanges : [];
            for (const raw of changes) {
                if (!raw || typeof raw !== 'object') continue;
                const c = raw as Record<string, unknown>;
                if (c.type === 'published' && typeof c.packageId === 'string' && HEX64.test(c.packageId)) {
                    return { packageId: c.packageId };
                }
            }
        } catch {
            /* fallback */
        }
    }
    const pkgLine = /Package(?:ID)?\s*:\s*(0x[a-fA-F0-9]{64})/i.exec(stdout);
    if (pkgLine) return { packageId: pkgLine[1]! };
    if (HEX64.test(expectedPackageId)) return { packageId: expectedPackageId };
    throw new Error('Upgrade-Ausgabe: Package-ID nicht erkannt.');
}

async function runIotaCli(args: string[], cwd?: string): Promise<string> {
    const workDir = cwd ?? process.cwd();
    const child = spawn('iota', args, { shell: false, env: process.env, cwd: workDir });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
        stdout += d;
    });
    child.stderr?.on('data', (d) => {
        stderr += d;
    });
    await new Promise<void>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                const out = (stderr || stdout).trim();
                reject(new Error(`iota ${args[0]} ${args[1] ?? ''} exit ${code}: ${out.slice(0, 400)}${out.length > 400 ? '…' : ''}`));
            } else resolve();
        });
    });
    return stdout;
}

async function prepareMoveLock(cwd: string): Promise<void> {
    const lockPath = path.join(cwd, 'Move.lock');
    try {
        await fs.unlink(lockPath);
    } catch {
        /* optional */
    }
}

/** Move-Package publizieren (neue PACKAGE_ID). Nutzt aktives IOTA-CLI-Env. */
export async function publishPackageCli(packageDir?: string): Promise<MovePackagePublishResult> {
    const cwd = packageDir ? path.resolve(process.cwd(), packageDir) : process.cwd();
    await prepareMoveLock(cwd);
    const stdout = await runIotaCli(['client', 'publish', '--json'], cwd);
    return parsePublishCliOutput(stdout);
}

export type GlobalsCreatedIds = {
    vaultRegistryId: string;
    mailboxId: string;
    commandRegistryId: string;
};

/** Parst GlobalsCreated aus `iota client call … create_globals --json`. */
export function parseGlobalsCreatedFromCliOutput(stdout: string): GlobalsCreatedIds {
    const pickId = (v: unknown): string | undefined => {
        if (typeof v === 'string' && HEX64.test(v.trim())) return v.trim();
        if (v && typeof v === 'object' && typeof (v as { id?: string }).id === 'string') {
            const id = (v as { id: string }).id.trim();
            if (HEX64.test(id)) return id;
        }
        return undefined;
    };
    const trimmed = stdout.trim();
    const tryJson = (raw: string): GlobalsCreatedIds | null => {
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const events =
                (Array.isArray(parsed.events) ? parsed.events : null) ??
                (Array.isArray((parsed.transactionBlock as { events?: unknown[] } | undefined)?.events)
                    ? (parsed.transactionBlock as { events: unknown[] }).events
                    : null);
            for (const ev of events ?? []) {
                if (!ev || typeof ev !== 'object') continue;
                const e = ev as { type?: string; parsedJson?: Record<string, unknown> };
                if (!String(e.type ?? '').includes('GlobalsCreated')) continue;
                const pj = e.parsedJson ?? {};
                const vaultRegistryId = pickId(pj.vault_registry_id);
                const mailboxId = pickId(pj.mailbox_id);
                const commandRegistryId = pickId(pj.command_registry_id);
                if (vaultRegistryId && mailboxId && commandRegistryId) {
                    return { vaultRegistryId, mailboxId, commandRegistryId };
                }
            }
        } catch {
            /* fallback */
        }
        return null;
    };
    const fromJson = tryJson(trimmed);
    if (fromJson) return fromJson;
    const jsonStart = trimmed.indexOf('{');
    if (jsonStart >= 0) {
        const fromSlice = tryJson(trimmed.slice(jsonStart));
        if (fromSlice) return fromSlice;
    }
    throw new Error('GlobalsCreated-Event in CLI-Ausgabe nicht gefunden.');
}

async function readActiveIotaCliEnv(): Promise<string | null> {
    try {
        const out = (await runIotaCli(['client', 'active-env'])).trim();
        return out || null;
    } catch {
        return null;
    }
}

/** Temporäres CLI-Env für RPC (z. B. Mainnet-Deploy), danach wiederherstellen. */
export async function withTemporaryIotaCliRpc<T>(rpcUrl: string, fn: () => Promise<T>): Promise<T> {
    const rpc = rpcUrl.trim();
    if (!/^https?:\/\//i.test(rpc)) {
        throw new Error('RPC-URL muss mit http:// oder https:// beginnen.');
    }
    const previousEnv = await readActiveIotaCliEnv();
    const alias = `_mrg_deploy_${Date.now()}`;
    try {
        await runIotaCli(['client', 'new-env', '--alias', alias, '--rpc', rpc]);
        await runIotaCli(['client', 'switch', '--env', alias]);
        return await fn();
    } finally {
        if (previousEnv?.trim()) {
            try {
                await runIotaCli(['client', 'switch', '--env', previousEnv.trim()]);
            } catch {
                /* ignore restore errors */
            }
        }
    }
}

/** create_globals auf der aktiven CLI-Kette (Env muss passende RPC nutzen). */
export async function createGlobalsCli(packageId: string): Promise<GlobalsCreatedIds> {
    const pkg = packageId.trim();
    if (!HEX64.test(pkg)) throw new Error('Package-ID: 0x + 64 Hex erforderlich.');
    const stdout = await runIotaCli([
        'client',
        'call',
        '--package',
        pkg,
        '--module',
        'messaging',
        '--function',
        'create_globals',
        '--gas-budget',
        '50000000',
        '--json',
    ]);
    return parseGlobalsCreatedFromCliOutput(stdout);
}

export function applyMainnetPublishResultToEnv(result: MovePackagePublishResult): {
    envMainnetPackageOk: boolean;
    envMainnetPackageError?: string;
} {
    (CFG as { MAINNET_PACKAGE_ID?: string }).MAINNET_PACKAGE_ID = result.packageId;
    process.env.MAINNET_PACKAGE_ID = result.packageId;
    const envMainnet = setEnvKey('MAINNET_PACKAGE_ID', result.packageId);
    return {
        envMainnetPackageOk: envMainnet.ok,
        envMainnetPackageError: envMainnet.error,
    };
}

/** Mainnet: publish + create_globals — Testnet PACKAGE_ID / MAILBOX_ID bleiben unberührt. */
export async function deployMainnetMovePackage(opts: {
    rpcUrl: string;
    packageDir?: string;
    skipCreateGlobals?: boolean;
}): Promise<{
    packageId: string;
    upgradeCapId?: string;
    mailboxId?: string;
    vaultRegistryId?: string;
    commandRegistryId?: string;
    mainnetRpcUrl: string;
    envMainnetPackageOk: boolean;
    envMainnetRpcOk: boolean;
    message: string;
}> {
    const rpcUrl = opts.rpcUrl.trim();
    const packageDir = opts.packageDir?.trim() || 'move-test';
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const moveDir = path.join(rootDir, packageDir);
    try {
        await fs.access(moveDir);
    } catch {
        throw new Error(`Move-Ordner ${packageDir} fehlt auf diesem PC.`);
    }

    const publish = await withTemporaryIotaCliRpc(rpcUrl, () => publishPackageCli(packageDir));
    const envPkg = applyMainnetPublishResultToEnv(publish);
    (CFG as { MAINNET_RPC_URL?: string }).MAINNET_RPC_URL = rpcUrl;
    process.env.MAINNET_RPC_URL = rpcUrl;
    const envRpc = setEnvKey('MAINNET_RPC_URL', rpcUrl);

    let globals: GlobalsCreatedIds | undefined;
    if (!opts.skipCreateGlobals) {
        globals = await withTemporaryIotaCliRpc(rpcUrl, () => createGlobalsCli(publish.packageId));
    }

    const parts = [
        `Mainnet-Package: ${publish.packageId.slice(0, 10)}…`,
        globals?.mailboxId ? `Postfach: ${globals.mailboxId.slice(0, 10)}…` : null,
        'Testnet-IDs unverändert.',
    ].filter(Boolean);

    return {
        packageId: publish.packageId,
        upgradeCapId: publish.upgradeCapId,
        mailboxId: globals?.mailboxId,
        vaultRegistryId: globals?.vaultRegistryId,
        commandRegistryId: globals?.commandRegistryId,
        mainnetRpcUrl: rpcUrl,
        envMainnetPackageOk: envPkg.envMainnetPackageOk,
        envMainnetRpcOk: envRpc.ok,
        message: parts.join(' '),
    };
}

/** Move-Package upgraden (gleiche PACKAGE_ID, Mailbox-IDs bleiben). */
export async function upgradePackageCli(
    upgradeCapId: string,
    packageDir?: string
): Promise<MovePackageUpgradeResult> {
    const cap = upgradeCapId.trim();
    if (!HEX64.test(cap)) throw new Error('UPGRADE_CAP_ID: 0x + 64 Hex erforderlich.');
    const cwd = packageDir ? path.resolve(process.cwd(), packageDir) : process.cwd();
    await prepareMoveLock(cwd);
    const expectedPkg = (CFG.PACKAGE_ID || '').trim();
    const stdout = await runIotaCli(['client', 'upgrade', '--upgrade-capability', cap, '--json'], cwd);
    return parseUpgradeCliOutput(stdout, expectedPkg);
}

/** UpgradeCap-Object für ein Package in der Wallet suchen (CLI-Wallet / MY_ADDRESS). */
export async function findUpgradeCapForPackage(
    client: IotaClient,
    packageId: string,
    ownerAddress: string
): Promise<string | null> {
    const owner = ownerAddress.trim();
    const pkg = packageId.trim().toLowerCase();
    if (!HEX64.test(owner) || !HEX64.test(packageId)) return null;
    let cursor: string | null | undefined = undefined;
    for (let page = 0; page < 24; page++) {
        const res = (await client.getOwnedObjects({
            owner,
            cursor: cursor ?? undefined,
            limit: 50,
            options: { showType: true, showContent: true },
        } as Parameters<IotaClient['getOwnedObjects']>[0])) as {
            data?: Array<{
                data?: {
                    objectId?: string;
                    type?: string;
                    content?: { fields?: { package?: string } };
                };
            }>;
            hasNextPage?: boolean;
            nextCursor?: string | null;
        };
        for (const item of res.data ?? []) {
            const typeStr = String(item.data?.type ?? '').toLowerCase();
            if (!typeStr.includes('::package::upgradecap')) continue;
            const capPkg = String(item.data?.content?.fields?.package ?? '').toLowerCase();
            if (capPkg && capPkg !== pkg) continue;
            const oid = String(item.data?.objectId ?? '').trim();
            if (HEX64.test(oid)) return oid;
        }
        if (!res.hasNextPage || !res.nextCursor) break;
        cursor = res.nextCursor;
    }
    return null;
}

export function applyPublishResultToEnv(result: MovePackagePublishResult): {
    envPackageOk: boolean;
    envCapOk: boolean;
    envPackageError?: string;
    envCapError?: string;
} {
    (CFG as { PACKAGE_ID: string }).PACKAGE_ID = result.packageId;
    process.env.PACKAGE_ID = result.packageId;
    savePackageIdToFile(result.packageId);
    const envPackage = setEnvKey('PACKAGE_ID', result.packageId);
    let envCapOk = true;
    let envCapError: string | undefined;
    if (result.upgradeCapId && HEX64.test(result.upgradeCapId)) {
        (CFG as { UPGRADE_CAP_ID?: string }).UPGRADE_CAP_ID = result.upgradeCapId;
        process.env.UPGRADE_CAP_ID = result.upgradeCapId;
        const envCap = setEnvKey('UPGRADE_CAP_ID', result.upgradeCapId);
        envCapOk = envCap.ok;
        envCapError = envCap.error;
    }
    return {
        envPackageOk: envPackage.ok,
        envCapOk,
        envPackageError: envPackage.error,
        envCapError,
    };
}

export async function resolveUpgradeCapId(opts?: {
    client?: IotaClient;
    packageId?: string;
    ownerAddress?: string;
}): Promise<string | null> {
    const fromEnv = (CFG.UPGRADE_CAP_ID || process.env.UPGRADE_CAP_ID || '').trim();
    if (HEX64.test(fromEnv)) return fromEnv;
    const pkg = (opts?.packageId || CFG.PACKAGE_ID || '').trim();
    const owner = (opts?.ownerAddress || CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
    if (!opts?.client || !HEX64.test(pkg) || !HEX64.test(owner)) return null;
    return findUpgradeCapForPackage(opts.client, pkg, owner);
}
