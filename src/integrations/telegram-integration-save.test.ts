import { describe, expect, it, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));

vi.mock('../config.js', () => ({
    CFG: { MONITOR_ALARM_WEBHOOK_URL: '' },
    readRuntimeConfigRaw: () => ({ ...store.data }),
    writeRuntimeConfigRaw: (d: Record<string, unknown>) => {
        store.data = { ...d };
        return { ok: true, path: '/tmp/runtime.json' };
    },
}));

vi.mock('./telegram-inbound.js', () => ({
    normalizeTelegramInboundMode: (m: unknown) =>
        m === 'longPoll' || m === 'webhook' ? m : 'off',
    isTelegramInboundPollRunning: () => false,
}));

import {
    readTelegramIntegrationConfig,
    saveTelegramIntegration,
} from './telegram-integration.js';

const VALID_TOKEN = '123456789:AAHabcdefghijklmnopqrstuvwxyz';

describe('saveTelegramIntegration', () => {
    beforeEach(() => {
        store.data = {};
    });

    it('speichert Bot-Token ohne Monitor-Schalter (Long Polling)', () => {
        const r = saveTelegramIntegration({
            enabled: false,
            botToken: VALID_TOKEN,
            adminChatId: '',
            inboundMode: 'longPoll',
        });
        expect(r.ok).toBe(true);
        expect(readTelegramIntegrationConfig()?.botToken).toBe(VALID_TOKEN);
        expect(readTelegramIntegrationConfig()?.enabled).toBe(false);
        expect(readTelegramIntegrationConfig()?.inboundMode).toBe('longPoll');
    });

    it('behält Token beim erneuten Speichern ohne erneute Eingabe', () => {
        saveTelegramIntegration({
            enabled: false,
            botToken: VALID_TOKEN,
            inboundMode: 'longPoll',
        });
        const r = saveTelegramIntegration({
            enabled: false,
            inboundMode: 'webhook',
        });
        expect(r.ok).toBe(true);
        expect(readTelegramIntegrationConfig()?.botToken).toBe(VALID_TOKEN);
        expect(readTelegramIntegrationConfig()?.inboundMode).toBe('webhook');
    });

    it('lehnt Monitor an ohne Chat-ID ab (nichts geschrieben)', () => {
        const r = saveTelegramIntegration({
            enabled: true,
            botToken: VALID_TOKEN,
            adminChatId: '',
        });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/Chat-ID/);
        expect(readTelegramIntegrationConfig()).toBeNull();
    });

    it('erhält lastUpdateId beim Speichern', () => {
        store.data = {
            integrations: {
                telegram: { lastUpdateId: 42, botToken: VALID_TOKEN, inboundMode: 'longPoll' },
            },
        };
        const r = saveTelegramIntegration({
            enabled: false,
            botToken: VALID_TOKEN,
            inboundMode: 'longPoll',
        });
        expect(r.ok).toBe(true);
        const raw = store.data.integrations as Record<string, unknown>;
        const tg = raw.telegram as Record<string, unknown>;
        expect(tg.lastUpdateId).toBe(42);
        expect(tg.botToken).toBe(VALID_TOKEN);
    });
});
