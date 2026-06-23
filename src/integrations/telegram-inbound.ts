/**
 * Eingehende Telegram-Nachrichten (§ H.26 B2): Webhook-Payload oder getUpdates (Long Polling).
 */
import { readRuntimeConfigRaw } from '../config.js';
import { loadContactDirectory } from '../contact-labels.js';
import { logger } from '../logger.js';
import {
    appendTelegramJournalEntry,
    resolveContactKeyByTelegramChatId,
} from './telegram-journal.js';
import {
    maskPackageIdForTelegramStatus,
    tryHandleTelegramBotCommand,
} from './telegram-bot-commands.js';

export type TelegramInboundMode = 'off' | 'longPoll' | 'webhook';

let inboundPollRunning = false;

export function setTelegramInboundPollRunning(active: boolean): void {
    inboundPollRunning = active;
}

export function isTelegramInboundPollRunning(): boolean {
    return inboundPollRunning;
}

export function normalizeTelegramInboundMode(raw: unknown): TelegramInboundMode {
    const v = String(raw ?? '').trim();
    if (v === 'longPoll' || v === 'webhook') return v;
    return 'off';
}

/** Chat-IDs aus Telefonbuch (telegramChatId + tg:-Schlüssel). */
/** Konfigurierte Einsatz-Alarmgruppe (B4b) — Eingang ohne Telefonbuch-Eintrag. */
export function readEinsatzGroupInboundChatId(): string | null {
    try {
        const integrations = readRuntimeConfigRaw()?.integrations as Record<string, unknown> | undefined;
        const tg = integrations?.telegram as Record<string, unknown> | undefined;
        if (tg?.einsatzGroupAlarmEnabled !== true) return null;
        const id = String(tg.einsatzGroupChatId ?? '').trim();
        if (!id || !/^-?\d{1,20}$/.test(id)) return null;
        return id;
    } catch {
        return null;
    }
}

export function getPhonebookTelegramChatIds(): Set<string> {
    const set = new Set<string>();
    const dir = loadContactDirectory();
    for (const [key, e] of Object.entries(dir)) {
        const tg = e.telegramChatId?.trim();
        if (tg && /^-?\d{1,20}$/.test(tg)) set.add(tg);
        if (key.startsWith('tg:')) {
            const id = key.slice(3);
            if (id) set.add(id);
        }
    }
    return set;
}

export function isInboundTelegramChatAllowed(chatId: string): boolean {
    const id = chatId.trim();
    if (!/^-?\d{1,20}$/.test(id)) return false;
    if (getPhonebookTelegramChatIds().has(id)) return true;
    const einsatz = readEinsatzGroupInboundChatId();
    return Boolean(einsatz && einsatz === id);
}

export function parseTelegramUpdateMessage(update: unknown): {
    chatId: string;
    text: string;
    fromLabel: string;
    updateId: number;
    date?: number;
} | null {
    if (!update || typeof update !== 'object' || Array.isArray(update)) return null;
    const u = update as Record<string, unknown>;
    const updateId = typeof u.update_id === 'number' ? u.update_id : Number(u.update_id);
    if (!Number.isFinite(updateId)) return null;
    const msg = u.message;
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
    const m = msg as Record<string, unknown>;
    const chat = m.chat;
    if (!chat || typeof chat !== 'object' || Array.isArray(chat)) return null;
    const chatId = String((chat as Record<string, unknown>).id ?? '').trim();
    const text = String(m.text ?? m.caption ?? '').trim();
    if (!chatId || !text) return null;
    const from = m.from;
    let fromLabel = 'Telegram';
    if (from && typeof from === 'object' && !Array.isArray(from)) {
        const f = from as Record<string, unknown>;
        const name = [f.first_name, f.last_name].filter((x) => typeof x === 'string' && x.trim()).join(' ');
        fromLabel = name || String(f.username ?? 'Telegram');
    }
    const date = typeof m.date === 'number' ? m.date * 1000 : undefined;
    return { chatId, text, fromLabel, updateId, date };
}


async function buildTelegramBotCommandDeps(): Promise<Parameters<typeof tryHandleTelegramBotCommand>[1]> {
    const { CFG } = await import('../config.js');
    const { readTelegramIntegrationConfig, sendTelegramMessage } = await import('./telegram-integration.js');
    const tgCfg = readTelegramIntegrationConfig();
    const adminId = tgCfg?.adminChatId?.trim() ?? '';

    return {
        isChatAllowed: (id) => {
            const c = id.trim();
            if (isInboundTelegramChatAllowed(c)) return true;
            return Boolean(adminId && adminId === c);
        },
        getBotToken: () => tgCfg?.botToken?.trim() || null,
        buildStatusContext: () => ({
            role: String(CFG.ROLE || '—'),
            handoffLabel: String(CFG.HANDOFF_LABEL || '').trim() || '—',
            packageIdMasked: maskPackageIdForTelegramStatus(String(CFG.PACKAGE_ID || '')),
            apiPort: Number(CFG.API_PORT) || 0,
            uiPort: Number(CFG.UI_PORT) || 0,
            botConfigured: Boolean(tgCfg?.botToken?.trim()),
            monitorAlarmsEnabled: tgCfg?.enabled === true,
            inboundMode: tgCfg?.inboundMode ?? 'off',
            inboundPollActive: isTelegramInboundPollRunning(),
        }),
        sendMessage: sendTelegramMessage,
    };
}

/** Webhook-Body (ein Update) oder einzelnes Update-Objekt. */
export async function ingestTelegramInboundUpdate(
    update: unknown
): Promise<{ stored: boolean; reason?: string; commandReply?: boolean }> {
    const parsed = parseTelegramUpdateMessage(update);
    if (!parsed) return { stored: false, reason: 'ignored' };

    const cmdResult = await tryHandleTelegramBotCommand(parsed, await buildTelegramBotCommandDeps());
    if (cmdResult.handled) {
        if (cmdResult.error) {
            logger.warn(`Telegram Bot-Kommando: ${cmdResult.error}`);
        } else {
            logger.info(`Telegram Bot-Kommando beantwortet (Chat ${parsed.chatId}).`);
        }
        return { stored: false, commandReply: true, reason: cmdResult.error ? 'command_reply_failed' : 'command' };
    }

    if (!isInboundTelegramChatAllowed(parsed.chatId)) {
        logger.info(
            `Telegram Eingang ignoriert (Chat ${parsed.chatId} nicht im Telefonbuch — Partner-Chat-ID dort eintragen).`
        );
        return { stored: false, reason: 'chat_not_in_phonebook' };
    }
    const contactKey = resolveContactKeyByTelegramChatId(parsed.chatId);
    appendTelegramJournalEntry({
        direction: 'in',
        chatId: parsed.chatId,
        contactKey,
        text: parsed.text,
        senderLabel: parsed.fromLabel,
        ts: parsed.date ?? Date.now(),
    });
    return { stored: true };
}
