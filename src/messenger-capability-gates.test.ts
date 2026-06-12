import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./config.js', () => ({
    CFG: { ROLE_ID: 12, ROLE: 'messenger', SIMPLE_MODE: true, TRANSPORT_PROFILE: 'mesh-first' },
    readRuntimeConfigRaw: vi.fn(() => ({})),
    resolveSimpleMode: () => true,
    resolveTransportProfile: () => 'mesh-first' as const,
}));

import { readRuntimeConfigRaw } from './config.js';
import {
    canTransportWriteActive,
    denyMessengerSendCommand,
    denyMessengerReadCommand,
} from './messenger-capability-gates.js';

describe('messenger-capability-gates (server)', () => {
    beforeEach(() => {
        vi.mocked(readRuntimeConfigRaw).mockReturnValue({});
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('ROLE_ID 12 ohne Override: IOTA/LoRa senden blockiert', () => {
        expect(canTransportWriteActive('iota')).toBe(false);
        expect(canTransportWriteActive('lora')).toBe(false);
        expect(denyMessengerSendCommand('/send')?.ok).toBe(false);
        expect(denyMessengerSendCommand('/mesh-build-v2')?.ok).toBe(false);
    });

    it('Override: LoRa schreiben erlaubt', () => {
        vi.mocked(readRuntimeConfigRaw).mockReturnValue({
            messengerCapabilities: {
                transport: {
                    lora: { read: true, write: true },
                    telegram: { read: true, write: false },
                    iota: { read: false, write: false },
                    ble: { read: true, write: false },
                    streams: { read: true, write: false },
                },
            },
        });
        expect(canTransportWriteActive('lora')).toBe(true);
        expect(denyMessengerSendCommand('/mesh-build-v2')).toBeNull();
        expect(denyMessengerSendCommand('/send')?.ok).toBe(false);
    });

    it('mesh-decrypt braucht LoRa-Lesen', () => {
        vi.mocked(readRuntimeConfigRaw).mockReturnValue({
            messengerCapabilities: {
                transport: {
                    lora: { read: false, write: false },
                    telegram: { read: true, write: false },
                    iota: { read: true, write: false },
                    ble: { read: true, write: false },
                    streams: { read: true, write: false },
                },
            },
        });
        expect(denyMessengerReadCommand('/mesh-decrypt-v2')?.ok).toBe(false);
    });
});
