/**
 * Gemeinsame Typen für extrahierte Messenger-CLI-Befehle.
 */
import type { CommandApiOptions } from '../command-api-options.js';
import type { PeerState } from '../peer-state.js';

export type CommandHandlerResult = {
    ok: boolean;
    message?: string;
    [key: string]: unknown;
};

export type MessengerCommandContext = {
    cmd: string;
    args: string[];
    opts?: CommandApiOptions;
    myAddress: string;
    keys: { privateKey: CryptoKey; pubRaw: Uint8Array } | null;
    peerMap: Map<string, PeerState> | null;
    sessionState: { peerMap: Map<string, PeerState> | null; connecting: boolean };
};
