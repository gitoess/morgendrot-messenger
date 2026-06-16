/**
 * Chain-Konfiguration für On-Chain-Vault aus lokalen Artefakten übernehmen + prüfen.
 */
import fs from 'fs';
import path from 'path';
import {
    CFG,
    savePackageIdToFile,
    setEnvKey,
    readPackageIdFromFile,
} from './config.js';
import { readVaultPackageId, vaultFileExists } from './vault-local.js';
import { runVaultOnchainPreflight, type VaultOnchainPreflight } from './vault-onchain-preflight.js';
import { normalizeAddress } from './utils.js';

const DEFAULT_TESTNET_RPC = 'https://api.testnet.iota.cafe';
const GLOBALS_IDS_FILE = process.env.GLOBALS_IDS_FILE || '.morgendrot-globals-ids.json';

function hex64(id: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/i.test(String(id || '').trim());
}

type StoredGlobalsIds = {
    vaultRegistryId?: string;
    mailboxId?: string;
    commandRegistryId?: string;
    packageId?: string;
    rpcUrl?: string;
    network?: string;
};

function readStoredGlobalsIds(): StoredGlobalsIds | null {
    try {
        const p = path.resolve(process.cwd(), GLOBALS_IDS_FILE);
        if (!fs.existsSync(p)) return null;
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as StoredGlobalsIds;
        return raw && typeof raw === 'object' ? raw : null;
    } catch {
        return null;
    }
}

export function writeStoredGlobalsIds(ids: StoredGlobalsIds): void {
    try {
        const p = path.resolve(process.cwd(), GLOBALS_IDS_FILE);
        fs.writeFileSync(p, JSON.stringify(ids, null, 2), 'utf-8');
    } catch {
        /* optional */
    }
}

export type VaultChainConfigSyncResult = {
    ok: boolean;
    applied: string[];
    skipped: string[];
    preflight: VaultOnchainPreflight;
};

export async function syncVaultChainConfig(
    myAddress: string,
    opts?: { apply?: boolean }
): Promise<VaultChainConfigSyncResult> {
    const apply = opts?.apply !== false;
    const applied: string[] = [];
    const skipped: string[] = [];

    const storedGlobals = readStoredGlobalsIds();
    const packageFromFile = readPackageIdFromFile()?.trim() || '';
    const vaultPath = (CFG.VAULT_FILE || '.morgendrot-vault').trim();
    const packageFromVault = vaultFileExists(vaultPath) ? readVaultPackageId(vaultPath)?.trim() || '' : '';

    let packageId = (CFG.PACKAGE_ID || process.env.PACKAGE_ID || '').trim();
    if (!hex64(packageId)) {
        const candidate = packageFromFile || packageFromVault || storedGlobals?.packageId?.trim() || '';
        if (hex64(candidate)) {
            if (apply) {
                savePackageIdToFile(candidate);
                setEnvKey('PACKAGE_ID', candidate);
            }
            packageId = candidate;
            applied.push(`PACKAGE_ID ← ${packageFromFile === candidate ? '.morgendrot-package-id' : packageFromVault === candidate ? 'Vault-Metadaten' : GLOBALS_IDS_FILE}`);
        } else {
            skipped.push('PACKAGE_ID fehlt (weder .env noch .morgendrot-package-id noch Vault-Metadaten)');
        }
    } else if (packageFromVault && hex64(packageFromVault) && normalizeAddress(packageFromVault) !== normalizeAddress(packageId)) {
        skipped.push(
            `PACKAGE_ID in .env (${packageId.slice(0, 10)}…) weicht von Vault-Metadaten ab (${packageFromVault.slice(0, 10)}…) — nicht automatisch überschrieben`
        );
    }

    let rpcUrl = (CFG.RPC_URL || process.env.RPC_URL || '').trim();
    if (!rpcUrl) {
        const candidate = storedGlobals?.rpcUrl?.trim() || DEFAULT_TESTNET_RPC;
        if (apply && candidate) {
            setEnvKey('RPC_URL', candidate);
        }
        rpcUrl = candidate;
        applied.push(`RPC_URL ← ${storedGlobals?.rpcUrl ? GLOBALS_IDS_FILE : 'Testnet-Default'}`);
    }

    let vaultRegistryId = (CFG.VAULT_REGISTRY_ID || process.env.VAULT_REGISTRY_ID || '').trim();
    if (!hex64(vaultRegistryId) && storedGlobals?.vaultRegistryId && hex64(storedGlobals.vaultRegistryId)) {
        if (apply) {
            setEnvKey('VAULT_REGISTRY_ID', storedGlobals.vaultRegistryId.trim());
        }
        vaultRegistryId = storedGlobals.vaultRegistryId.trim();
        applied.push(`VAULT_REGISTRY_ID ← ${GLOBALS_IDS_FILE}`);
    } else if (!hex64(vaultRegistryId)) {
        skipped.push(
            `VAULT_REGISTRY_ID fehlt — nach Move create_globals in .env eintragen oder ${GLOBALS_IDS_FILE} anlegen (Handoff/Deploy-Assistent)`
        );
    }

    if (storedGlobals?.mailboxId && hex64(storedGlobals.mailboxId) && !(CFG.MAILBOX_ID || '').trim()) {
        if (apply) {
            setEnvKey('MAILBOX_ID', storedGlobals.mailboxId.trim());
        }
        applied.push(`MAILBOX_ID ← ${GLOBALS_IDS_FILE}`);
    }

    const preflight = await runVaultOnchainPreflight(myAddress);
    const ok = preflight.ok || (applied.length > 0 && preflight.issues.length <= 1);

    return { ok, applied, skipped, preflight };
}
