import { describe, expect, it } from 'vitest';
import {
    formatNetworkFetchError,
    formatRpcUrlForLog,
    formatTelegramApiTarget,
} from './network-fetch-error.js';

describe('network-fetch-error', () => {
    it('formats RPC URL without query secrets', () => {
        expect(formatRpcUrlForLog('https://api.testnet.iota.cafe/v1')).toBe('https://api.testnet.iota.cafe/v1');
        expect(formatRpcUrlForLog('')).toBe('(RPC nicht gesetzt)');
    });

    it('masks telegram API path', () => {
        expect(formatTelegramApiTarget('getUpdates')).toBe('https://api.telegram.org/bot…/getUpdates');
    });

    it('includes target and hint for generic fetch failed', () => {
        const line = formatNetworkFetchError(new Error('fetch failed'), {
            context: 'Listener-Loop Fehler',
            target: 'RPC https://api.testnet.iota.cafe',
        });
        expect(line).toContain('Listener-Loop Fehler');
        expect(line).toContain('fetch failed');
        expect(line).toContain('→ RPC https://api.testnet.iota.cafe');
        expect(line).toContain('Netzwerk prüfen');
    });
});
