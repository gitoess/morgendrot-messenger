/**
 * Vor /vault-onchain: Package/Registry auf dem konfigurierten RPC prüfen + Netzwerk ableiten.
 */
import { CFG } from './config.js';
import { getClient, getVaultFromChain } from './chain-access.js';
import { einsatzChainModeSourceNetwork, parseEinsatzChainMode, EINSATZ_CHAIN_MODE_ENV_KEY } from './shared/einsatz-chain-mode.js';

export type VaultOnchainPreflight = {
    ok: boolean;
    network: 'testnet' | 'mainnet' | 'unknown';
    rpcUrl: string;
    packageId: string;
    vaultRegistryId: string;
    myAddress: string;
    packageExists: boolean;
    registryExists: boolean;
    vaultOnChain: boolean;
    issues: string[];
    hints: string[];
};

function hex64(id: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/i.test(String(id || '').trim());
}

export function inferNetworkFromRpcUrl(rpcUrl: string): 'testnet' | 'mainnet' | 'unknown' {
    const u = rpcUrl.trim().toLowerCase();
    if (!u) return 'unknown';
    if (u.includes('testnet')) return 'testnet';
    if (u.includes('mainnet') || u.includes('iota.cafe')) return 'mainnet';
    const mode = parseEinsatzChainMode(process.env[EINSATZ_CHAIN_MODE_ENV_KEY]);
    return einsatzChainModeSourceNetwork(mode, rpcUrl);
}

async function objectExists(objectId: string): Promise<boolean> {
    if (!hex64(objectId)) return false;
    try {
        const res = await getClient().getObject({
            id: objectId.trim(),
            options: { showType: true },
        } as Parameters<ReturnType<typeof getClient>['getObject']>[0]);
        return Boolean((res as { data?: unknown })?.data);
    } catch {
        return false;
    }
}

async function packageExists(packageId: string): Promise<boolean> {
    if (!hex64(packageId)) return false;
    try {
        const res = await getClient().getObject({
            id: packageId.trim(),
            options: { showType: true },
        } as Parameters<ReturnType<typeof getClient>['getObject']>[0]);
        const t = String((res as { data?: { type?: string } })?.data?.type ?? '');
        return t.includes('Package') || t.includes('package');
    } catch {
        return false;
    }
}

export async function runVaultOnchainPreflight(myAddress: string): Promise<VaultOnchainPreflight> {
    const rpcUrl = (CFG.RPC_URL || '').trim();
    const packageId = (CFG.PACKAGE_ID || '').trim();
    const vaultRegistryId = (CFG.VAULT_REGISTRY_ID || '').trim();
    const addr = String(myAddress || '').trim();
    const network = inferNetworkFromRpcUrl(rpcUrl);
    const issues: string[] = [];
    const hints: string[] = [];

    if (!rpcUrl) {
        issues.push('RPC_URL fehlt in .env — Fullnode-URL setzen (z. B. https://api.testnet.iota.cafe).');
    }
    if (!hex64(packageId)) {
        issues.push('PACKAGE_ID fehlt oder ungültig — aus Move-Deploy / .morgendrot-package-id übernehmen.');
    }
    if (!hex64(vaultRegistryId)) {
        issues.push(
            'VAULT_REGISTRY_ID fehlt — nach create_globals aus dem Deploy-Event in .env eintragen.'
        );
    }
    if (!hex64(addr)) {
        issues.push('MY_ADDRESS fehlt — Wallet-Adresse setzen.');
    }

    let packageOk = false;
    let registryOk = false;
    let vaultOnChain = false;

    if (hex64(packageId)) {
        packageOk = await packageExists(packageId);
        if (!packageOk) {
            issues.push(
                `Package existiert auf ${network !== 'unknown' ? network : 'RPC'} nicht: ${packageId.slice(0, 10)}… — falsches Netz oder veraltetes Deploy.`
            );
            hints.push(
                'Prüfe RPC_URL (Testnet vs. Mainnet) und PACKAGE_ID aus dem letzten Move-Deploy auf demselben Netz.'
            );
        }
    }

    if (hex64(vaultRegistryId)) {
        registryOk = await objectExists(vaultRegistryId);
        if (!registryOk) {
            issues.push('VAULT_REGISTRY_ID nicht auf der Chain gefunden — Registry aus create_globals prüfen.');
        }
    }

    if (hex64(vaultRegistryId) && hex64(packageId) && hex64(addr) && registryOk && packageOk) {
        try {
            const enc = await getVaultFromChain(getClient(), vaultRegistryId, packageId, addr);
            vaultOnChain = Boolean(enc && enc.length > 0);
        } catch {
            vaultOnChain = false;
        }
        if (!vaultOnChain) {
            hints.push('Noch kein On-Chain-Vault — nach erfolgreichem Speichern kann „Von Chain laden“ genutzt werden.');
        }
    }

    if (network === 'testnet') {
        hints.push('Aktives Netz: Testnet (aus RPC_URL erkannt).');
    } else if (network === 'mainnet') {
        hints.push('Aktives Netz: Mainnet (aus RPC_URL erkannt).');
    }

    return {
        ok: issues.length === 0,
        network,
        rpcUrl,
        packageId,
        vaultRegistryId,
        myAddress: addr,
        packageExists: packageOk,
        registryExists: registryOk,
        vaultOnChain,
        issues,
        hints,
    };
}
