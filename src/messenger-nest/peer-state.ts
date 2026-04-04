/**
 * Peer-Zustand nach erfolgreichem Handshake (eine „Verbindung“ im Messenger).
 */
export type PeerState = {
    address: string;
    pubKeyRaw: Uint8Array;
    handshakeNonce: bigint;
};
