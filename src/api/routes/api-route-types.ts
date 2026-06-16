/**
 * Gemeinsame Typen für extrahierte API-Routen (`api-server.ts` Dispatcher).
 */
import type http from 'node:http';
import type { ApiStatus } from '../../api-server.js';
import type { CommandApiOptions } from '../../messenger-nest/command-api-options.js';

export type SendJsonFn = (
    res: http.ServerResponse,
    status: number,
    data: object,
    cors?: Record<string, string>
) => void;

export type CommandHandlerFn = (
    cmd: string,
    args: string[],
    options?: CommandApiOptions
) => Promise<{ ok: boolean; message?: string; [key: string]: unknown }>;

export type PurgeAfterLieferungFn = (
    purges: Array<{ sender: string; recipient: string; nonce: string | number }>
) => Promise<{ ok: boolean; message?: string; count?: number }>;

export type GetStatusFn = () => Partial<ApiStatus>;

export type ApiRouteContext = {
    getStatus?: GetStatusFn;
    getSessionStatus: () => Partial<ApiStatus>;
    getResolvePassword: () => ((pw: string) => void) | null;
    getCommandHandler: () => CommandHandlerFn | null;
    getPurgeAfterLieferungHandler: () => PurgeAfterLieferungFn | null;
    getLastVaultOnchainAt: () => number | undefined;
    setLastVaultOnchainAt: (at: number | undefined) => void;
    getLastVaultLocalSaveAt: () => number | undefined;
    setLastVaultLocalSaveAt: (at: number | undefined) => void;
    getActualApiPort: () => number;
};
