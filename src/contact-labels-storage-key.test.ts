import { describe, expect, it } from 'vitest';
import { normalizeDirectoryKey, resolveContactStorageKey } from './contact-labels.js';

describe('resolveContactStorageKey', () => {
    const wallet = '0x' + 'a'.repeat(64);

    it('accepts IOTA wallet', () => {
        expect(resolveContactStorageKey(wallet)).toBe(wallet);
    });

    it('accepts telegram-only via chat id', () => {
        expect(resolveContactStorageKey('', '1156058618')).toBe('tg:1156058618');
    });

    it('accepts tg: directory key', () => {
        expect(normalizeDirectoryKey('tg:-1001234567890')).toBe('tg:-1001234567890');
    });

    it('rejects empty', () => {
        expect(resolveContactStorageKey('', '')).toBeNull();
    });
});
