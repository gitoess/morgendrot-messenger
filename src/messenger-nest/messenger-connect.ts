/**
 * Kammer „Connect“: Handshake-Warten, Peer-Map aufbauen (Terminal + API teilen dieselbe Logik).
 */
import { logger } from '../logger.js';
import { CFG, savePartnerToFile } from '../config.js';
import {
    getHandshakeFromMailbox,
    findPeerHandshakeFrom,
    findPeerHandshake,
    findAnyIncomingMailboxHandshake,
} from '../chain-access.js';
import { normalizeAddress } from '../utils.js';
import type { PeerState } from './peer-state.js';
import { sendHandshake } from './messenger-chain-wrap.js';
import { loadHandshakeCache } from '../vault-local.js';
import { restoreSessionKeysFromVault } from './messenger-session-keys-state.js';
import { listenForMessages } from './messenger-listener.js';

/** Nach /vault-load: gespeicherte Partner aus `.handshakes`-Cache — kein erneutes /connect nötig. */
export async function restorePeerMapFromHandshakeCache(
    vaultPath: string,
    password: string
): Promise<Map<string, PeerState>> {
    const cached = await loadHandshakeCache(vaultPath, password);
    const pm = new Map<string, PeerState>();
    for (const [addr, e] of cached) {
        const n = normalizeAddress(addr);
        pm.set(n, {
            address: addr,
            pubKeyRaw: e.pubKeyRaw,
            handshakeNonce: e.handshakeNonce,
        });
    }
    return pm;
}

export function applyRestoredPeerMapToSession(
    pm: Map<string, PeerState>,
    myAddress: string,
    privateKey: CryptoKey,
    sessionState: { peerMap: Map<string, PeerState> | null; connecting: boolean },
    setSessionStatus: (s: Record<string, unknown>) => void
): void {
    if (pm.size === 0 || sessionState.peerMap?.size) return;
    sessionState.peerMap = pm;
    setSessionStatus({
        connected: true,
        partnerCount: pm.size,
        connectedAddresses: Array.from(pm.keys()),
    });
    if (CFG.ENABLE_LISTENER) {
        const firstPeer = pm.values().next().value;
        if (pm.size === 1 && firstPeer) watchHandshakeUpdates(myAddress, firstPeer);
        listenForMessages(myAddress, pm, privateKey);
    }
    logger.info(`Handshake-Cache: ${pm.size} Partner wiederhergestellt (ohne erneutes /connect).`);
}

/** Nach Vault-Entsperren / API-Start: `.handshakes` → peerMap (v1; § H.23 Double Ratchet später separates State-Layout). */
export async function tryRestoreHandshakeSessionFromVault(
    vaultPath: string,
    password: string,
    myAddress: string,
    privateKey: CryptoKey | undefined,
    sessionState: { peerMap: Map<string, PeerState> | null; connecting: boolean },
    setSessionStatus: (s: Record<string, unknown>) => void
): Promise<number> {
    if (!privateKey || !password.trim() || !vaultPath.trim()) return 0;
    try {
        const pm = await restorePeerMapFromHandshakeCache(vaultPath, password);
        if (pm.size === 0) return 0;
        await restoreSessionKeysFromVault(vaultPath, password, pm);
        applyRestoredPeerMapToSession(pm, myAddress, privateKey, sessionState, setSessionStatus);
        return pm.size;
    } catch {
        return 0;
    }
}

export async function watchHandshakeUpdates(myAddress: string, peer: PeerState) {
    while (true) {
        try {
            const latest =
                (await getHandshakeFromMailbox(myAddress, peer.address)) ??
                (await findPeerHandshakeFrom(myAddress, peer.address));
            if (latest && latest.nonce > peer.handshakeNonce) {
                peer.pubKeyRaw = latest.pubKeyRaw;
                peer.handshakeNonce = latest.nonce;
                logger.info(`Handshake aktualisiert von ${peer.address} (nonce=${peer.handshakeNonce}).`);
            }
        } catch {}
        await new Promise((r) => setTimeout(r, CFG.HANDSHAKE_REFRESH_MS));
    }
}

export async function runConnectLogic(
    myAddress: string,
    myKeys: { pubRaw: Uint8Array; privateKey: CryptoKey },
    addrs: string[]
): Promise<Map<string, PeerState>> {
    const peerMap = new Map<string, PeerState>();
    for (const partnerAddr of addrs) {
        let incoming: { pubKeyRaw: Uint8Array; sender: string; nonce: bigint } | null = null;
        let handshakeSent = false;
        logger.info(
            `Warte auf Handshake von ${partnerAddr.slice(0, 14)}… (${addrs.indexOf(partnerAddr) + 1}/${addrs.length})`
        );
        while (!incoming) {
            incoming =
                (await getHandshakeFromMailbox(myAddress, partnerAddr)) ??
                (await findPeerHandshakeFrom(myAddress, partnerAddr)) ??
                (addrs.length === 1 ? await findPeerHandshake(myAddress) : null);
            if (incoming && addrs.length > 1 && normalizeAddress(incoming.sender) !== normalizeAddress(partnerAddr))
                incoming = null;
            if (!incoming) {
                if (!handshakeSent) {
                    await sendHandshake(partnerAddr, myKeys.pubRaw);
                    handshakeSent = true;
                }
                process.stdout.write('.');
                await new Promise((r) => setTimeout(r, CFG.HANDSHAKE_REFRESH_MS));
            }
        }
        if (!handshakeSent) {
            logger.info(`Handshake von ${incoming.sender.slice(0, 12)}…. Sende Antwort...`);
            await sendHandshake(incoming.sender, myKeys.pubRaw);
        }
        peerMap.set(incoming.sender, {
            address: incoming.sender,
            pubKeyRaw: incoming.pubKeyRaw,
            handshakeNonce: incoming.nonce ?? 0n,
        });
        savePartnerToFile(incoming.sender);
    }
    return peerMap;
}

/** Nach Geheimnis-Peering (Partner hat Handshake gesendet): ersten eingehenden Handshake annehmen ohne Partneradresse zu kennen. */
export async function runConnectAcceptFirstIncoming(
    myAddress: string,
    myKeys: { pubRaw: Uint8Array; privateKey: CryptoKey },
    timeoutMs: number
): Promise<Map<string, PeerState>> {
    const peerMap = new Map<string, PeerState>();
    const deadline = Date.now() + timeoutMs;
    const me = normalizeAddress(myAddress);
    let incoming: { pubKeyRaw: Uint8Array; sender: string; nonce: bigint } | null = null;
    while (!incoming && Date.now() < deadline) {
        incoming =
            (await findAnyIncomingMailboxHandshake(myAddress)) ?? (await findPeerHandshake(myAddress));
        if (incoming && normalizeAddress(incoming.sender) === me) incoming = null;
        if (!incoming) {
            if (typeof process.stdout?.write === 'function') process.stdout.write('.');
            await new Promise((r) => setTimeout(r, CFG.HANDSHAKE_REFRESH_MS));
        }
    }
    if (!incoming) {
        throw new Error(`Kein eingehender Handshake innerhalb ${Math.round(timeoutMs / 1000)}s (PAIRING_WAIT_TIMEOUT_MS).`);
    }
    logger.info(`Eingehender Handshake von ${incoming.sender.slice(0, 12)}… (Geheimnis-Peering).`);
    await sendHandshake(incoming.sender, myKeys.pubRaw);
    peerMap.set(incoming.sender, {
        address: incoming.sender,
        pubKeyRaw: incoming.pubKeyRaw,
        handshakeNonce: incoming.nonce ?? 0n,
    });
    savePartnerToFile(incoming.sender);
    return peerMap;
}
