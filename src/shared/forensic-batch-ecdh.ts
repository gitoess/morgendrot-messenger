/**
 * § H.33e — ECDH-Material für verschlüsseltes Boss-Batch (Self-Archiv an MY_ADDRESS).
 */
import { CFG } from '../config.js'
import { getClient, getVaultFromChain } from '../chain-access.js'
import {
    loadVaultContent,
    loadVaultFromChainPayload,
    resolveVaultFilePathForSession,
    vaultFileExists,
    type VaultKeys,
} from '../vault-local.js'
import { getWalletPassword } from '../messenger-nest/messenger-session-password.js'

export type ForensicEcdhMaterial = {
    ecdhPrivateKey: CryptoKey
    peerPubRaw: Uint8Array
}

async function loadVaultKeysFromSession(): Promise<VaultKeys | { error: string }> {
    const pw = getWalletPassword()
    if (!pw) {
        return { error: 'Tresor gesperrt — Boss-API entsperren (Wallet-Passwort in Session).' }
    }
    const vaultPath = resolveVaultFilePathForSession(CFG.VAULT_FILE || undefined)
    if (vaultFileExists(vaultPath)) {
        try {
            const content = await loadVaultContent(pw, vaultPath)
            return content.keys
        } catch {
            return { error: 'Lokaler Vault konnte nicht geladen werden (Passwort/Datei).' }
        }
    }
    const myAddr = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim()
    if (CFG.VAULT_REGISTRY_ID && CFG.PACKAGE_ID && /^0x[a-fA-F0-9]{64}$/i.test(myAddr)) {
        try {
            const enc = await getVaultFromChain(
                getClient(),
                CFG.VAULT_REGISTRY_ID,
                CFG.PACKAGE_ID,
                myAddr
            )
            if (!enc?.length) return { error: 'On-Chain-Vault leer oder nicht gefunden.' }
            const content = await loadVaultFromChainPayload(enc, pw)
            return content.keys
        } catch {
            return { error: 'On-Chain-Vault konnte nicht entschlüsselt werden.' }
        }
    }
    return { error: 'Kein Vault (lokal oder on-chain) — ECDH-Keys fehlen.' }
}

/** Self-Archiv: Peer-Pubkey = eigenes Vault-Pubkey (wie PWA `ensureSelfForensicEcdhMaterial`). */
export async function loadForensicBatchEcdhMaterialForSelfArchive(
    archiveRecipient: string
): Promise<{ ok: true; material: ForensicEcdhMaterial } | { ok: false; error: string }> {
    const recipient = archiveRecipient.trim().toLowerCase()
    const myAddr = (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(recipient)) {
        return { ok: false, error: 'Archiv-Empfänger ungültig.' }
    }
    if (recipient !== myAddr) {
        return {
            ok: false,
            error: 'Boss verschlüsseltes Batch aktuell nur für Self-Archiv (MY_ADDRESS).',
        }
    }
    const keys = await loadVaultKeysFromSession()
    if ('error' in keys) return { ok: false, error: keys.error }
    return {
        ok: true,
        material: { ecdhPrivateKey: keys.privateKey, peerPubRaw: keys.pubRaw },
    }
}
