import { describe, expect, it } from 'vitest';
import {
    getPhonebookTelegramChatIds,
    isInboundTelegramChatAllowed,
    parseTelegramUpdateMessage,
} from './telegram-inbound.js';

describe('telegram-inbound', () => {
    it('parses message update', () => {
        const p = parseTelegramUpdateMessage({
            update_id: 42,
            message: {
                message_id: 1,
                date: 1_700_000_000,
                chat: { id: 1156058618, type: 'private' },
                from: { first_name: 'Anna' },
                text: 'Hallo zurück',
            },
        });
        expect(p?.chatId).toBe('1156058618');
        expect(p?.text).toBe('Hallo zurück');
        expect(p?.updateId).toBe(42);
    });

    it('allows only phonebook chat ids', () => {
        const allowed = isInboundTelegramChatAllowed('999');
        expect(typeof allowed).toBe('boolean');
        expect(getPhonebookTelegramChatIds()).toBeInstanceOf(Set);
    });
});
