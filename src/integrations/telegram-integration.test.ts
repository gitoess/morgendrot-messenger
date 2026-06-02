import { describe, expect, it } from 'vitest';
import {
    buildTelegramAlarmWebhookUrl,
    extractTelegramBotUserIdFromToken,
    formatTelegramApiErrorHint,
    formatTelegramAlarmText,
    formatTelegramNotifyText,
    isTelegramChatIdLikelyBotSelf,
    isValidTelegramBotToken,
    isValidTelegramChatId,
    maskTelegramBotToken,
    truncateTelegramMessagePreview,
} from './telegram-integration.js';

describe('telegram-integration', () => {
    it('maskTelegramBotToken hides secret middle', () => {
        expect(maskTelegramBotToken('123456789:AAHabcdefghijklmnopqrstuvwxyz')).toMatch(/^123456789:AAH/);
        expect(maskTelegramBotToken('123456789:AAHabcdefghijklmnopqrstuvwxyz')).toContain('…');
    });

    it('validates bot token format', () => {
        expect(isValidTelegramBotToken('123:ABCDEFGHIJKLMNOPQRSTUVWXYZabcd')).toBe(true);
        expect(isValidTelegramBotToken('bad')).toBe(false);
    });

    it('validates chat id', () => {
        expect(isValidTelegramChatId('1156058618')).toBe(true);
        expect(isValidTelegramChatId('-100123')).toBe(true);
        expect(isValidTelegramChatId('abc')).toBe(false);
    });

    it('builds alarm webhook url', () => {
        expect(buildTelegramAlarmWebhookUrl('http://127.0.0.1:8787/')).toBe(
            'http://127.0.0.1:8787/morgendrot-telegram/alarm'
        );
    });

    it('formats notify text', () => {
        const text = formatTelegramNotifyText('Partner B', 'Hallo Welt');
        expect(text).toContain('📩');
        expect(text).toContain('Partner B');
        expect(text).toContain('Hallo');
    });

    it('truncates preview', () => {
        const long = 'a'.repeat(300);
        expect(truncateTelegramMessagePreview(long).length).toBeLessThanOrEqual(200);
    });

    it('formats alarm text', () => {
        const text = formatTelegramAlarmText({
            device: 'DEV',
            message: 'Test',
            level: 2,
            ts: 0,
        });
        expect(text).toContain('L2');
        expect(text).toContain('DEV');
        expect(text).toContain('Test');
    });

    it('extractTelegramBotUserIdFromToken', () => {
        expect(extractTelegramBotUserIdFromToken('123456789:AAHabc')).toBe('123456789');
        expect(isTelegramChatIdLikelyBotSelf('123456789:AAHabc', '123456789')).toBe(true);
        expect(isTelegramChatIdLikelyBotSelf('123456789:AAHabc', '987654321')).toBe(false);
    });

    it('formatTelegramApiErrorHint for bot-self chat id', () => {
        const hint = formatTelegramApiErrorHint(
            403,
            '{"description":"Forbidden: the bot can\'t send messages to the bot"}'
        );
        expect(hint).toMatch(/Bot-ID/);
        expect(hint).toMatch(/userinfobot/);
    });
});
