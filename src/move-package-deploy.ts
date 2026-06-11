/**
 * Move-Package publish / upgrade (IOTA-CLI) + UpgradeCap-Auflösung.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
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

async function runIotaCli(args: string[], cwd: string): Promise<string> {
    const child = spawn('iota', args, { shell: false, env: process.env, cwd });
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

/** Move-Package publizieren (neue PACKAGE_ID). */
export async function publishPackageCli(packageDir?: string): Promise<MovePackagePublishResult> {
    const cwd = packageDir ? path.resolve(process.cwd(), packageDir) : process.cwd();
    await prepareMoveLock(cwd);
    const stdout = await runIotaCli(['client', 'publish', '--json'], cwd);
    return parsePublishCliOutput(stdout);
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
