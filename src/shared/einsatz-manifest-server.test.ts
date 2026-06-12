import { describe, expect, it } from 'vitest';
import {
    einsatzIdUtf8ToMoveAddressSync,
    resolveServerEinsatzIdUtf8,
} from './einsatz-manifest-server.js';

describe('einsatz-manifest-server', () => {
    it('resolveServerEinsatzIdUtf8 nutzt Handoff-Label und Package-Prefix', () => {
        expect(
            resolveServerEinsatzIdUtf8({
                handoffLabel: 'festival',
                packageId: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
            })
        ).toBe('festival-0xabcdef01');
    });

    it('resolveServerEinsatzIdUtf8 bevorzugt Query-Override', () => {
        expect(
            resolveServerEinsatzIdUtf8({
                handoffLabel: 'festival',
                packageId: '0xabc',
                queryOverride: 'custom-id',
            })
        ).toBe('custom-id');
    });

    it('einsatzIdUtf8ToMoveAddressSync liefert 32-Byte-Hex-Adresse', () => {
        const addr = einsatzIdUtf8ToMoveAddressSync('einsatz-0xabcdef0');
        expect(addr).toMatch(/^0x[a-f0-9]{64}$/);
        expect(einsatzIdUtf8ToMoveAddressSync('einsatz-0xabcdef0')).toBe(addr);
    });
});
