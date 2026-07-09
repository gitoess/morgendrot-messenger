import { describe, expect, it } from 'vitest';
import { resolveSendRecipientAndText } from './send-command-args.js';

const PEER_A = '0x' + 'aa'.repeat(32);
const PEER_B = '0x' + 'bb'.repeat(32);

describe('resolveSendRecipientAndText', () => {
    it('parst expliziten Empfänger', () => {
        const r = resolveSendRecipientAndText([PEER_A, 'Hallo', 'Welt'], [PEER_B]);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.recipient).toBe(PEER_A);
            expect(r.text).toBe('Hallo Welt');
        }
    });

    it('Legacy: ein Peer ohne Adresse im Arg', () => {
        const r = resolveSendRecipientAndText(['nur Text'], [PEER_A]);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.recipient).toBe(PEER_A);
            expect(r.text).toBe('nur Text');
        }
    });

    it('mehrere Peers ohne Empfänger → Fehler', () => {
        const r = resolveSendRecipientAndText(['Hallo'], [PEER_A, PEER_B]);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.message).toMatch(/Mehrere Partner/);
    });

    it('kein Peer → Fehler', () => {
        const r = resolveSendRecipientAndText(['Hallo'], []);
        expect(r.ok).toBe(false);
    });
});
