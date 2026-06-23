import { describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../config.js')>();
    return {
        ...actual,
        readRuntimeConfigRaw: vi.fn(() => ({
            integrations: {
                telegram: {
                    einsatzGroupAlarmEnabled: true,
                    einsatzGroupChatId: '-100999',
                },
            },
        })),
    };
});

import {
    getPhonebookTelegramChatIds,
    isInboundTelegramChatAllowed,
    parseTelegramUpdateMessage,
    readEinsatzGroupInboundChatId,
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

    it('allows configured einsatz alarm group chat id', () => {
        expect(readEinsatzGroupInboundChatId()).toBe('-100999');
        expect(isInboundTelegramChatAllowed('-100999')).toBe(true);
        expect(isInboundTelegramChatAllowed('-100888')).toBe(false);
    });
});
