import { describe, expect, it, vi } from 'vitest';
import {
    buildTelegramBotHelpText,
    buildTelegramBotStatusText,
    maskPackageIdForTelegramStatus,
    parseTelegramBotCommand,
    tryHandleTelegramBotCommand,
} from './telegram-bot-commands.js';

describe('telegram-bot-commands', () => {
    it('parseTelegramBotCommand erkennt /help und /status', () => {
        expect(parseTelegramBotCommand('/help')).toBe('help');
        expect(parseTelegramBotCommand('/HELP@MyBot')).toBe('help');
        expect(parseTelegramBotCommand('/status extra')).toBe('status');
        expect(parseTelegramBotCommand('Hallo')).toBeNull();
    });

    it('buildTelegramBotHelpText enthält Kommandos', () => {
        expect(buildTelegramBotHelpText()).toContain('/status');
    });

    it('buildTelegramBotStatusText formatiert Kontext', () => {
        const t = buildTelegramBotStatusText({
            role: 'boss',
            handoffLabel: 'festival',
            packageIdMasked: '0xabcd…1234',
            apiPort: 3342,
            uiPort: 3341,
            botConfigured: true,
            monitorAlarmsEnabled: false,
            inboundMode: 'longPoll',
            inboundPollActive: true,
        });
        expect(t).toContain('Rolle: boss');
        expect(t).toContain('Poll aktiv');
        expect(t).toContain('Monitor aus');
    });

    it('maskPackageIdForTelegramStatus kürzt lange IDs', () => {
        const id = '0x' + 'a'.repeat(64);
        expect(maskPackageIdForTelegramStatus(id)).toBe('0xaaaaaa…aaaa');
    });

    it('tryHandleTelegramBotCommand antwortet bei erlaubtem Chat', async () => {
        const sendMessage = vi.fn(async () => ({ ok: true }));
        const r = await tryHandleTelegramBotCommand(
            { chatId: '123', text: '/help' },
            {
                isChatAllowed: (id) => id === '123',
                getBotToken: () => '1:token',
                buildStatusContext: () => ({
                    role: 'boss',
                    handoffLabel: '',
                    packageIdMasked: '—',
                    apiPort: 3342,
                    uiPort: 3341,
                    botConfigured: true,
                    monitorAlarmsEnabled: true,
                    inboundMode: 'longPoll',
                    inboundPollActive: false,
                }),
                sendMessage,
            }
        );
        expect(r.handled).toBe(true);
        expect(sendMessage).toHaveBeenCalledOnce();
    });

    it('tryHandleTelegramBotCommand ignoriert fremde Chats', async () => {
        const sendMessage = vi.fn(async () => ({ ok: true }));
        const r = await tryHandleTelegramBotCommand(
            { chatId: '999', text: '/status' },
            {
                isChatAllowed: () => false,
                getBotToken: () => '1:token',
                buildStatusContext: () => ({
                    role: 'boss',
                    handoffLabel: '',
                    packageIdMasked: '—',
                    apiPort: 3342,
                    uiPort: 3341,
                    botConfigured: false,
                    monitorAlarmsEnabled: false,
                    inboundMode: 'off',
                    inboundPollActive: false,
                }),
                sendMessage,
            }
        );
        expect(r.handled).toBe(false);
        expect(sendMessage).not.toHaveBeenCalled();
    });
});
