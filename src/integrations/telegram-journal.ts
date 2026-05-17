/**
 * Lokales Telegram-Journal (§ H.26 Ergänzung) — kein IOTA-Chain-Ersatz.
 * Ausgang/Eingang nur für Telegram-Hinweise; Posteingang-Merge im Frontend.
 */
import fs from 'fs';
import path from 'path';
import { loadContactDirectory } from '../contact-labels.js';

const DEFAULT_FILE = '.morgendrot-telegram-journal.json';
const MAX_ENTRIES = 2000;

export type TelegramJournalDirection = 'in' | 'out';

export type TelegramJournalEntry = {
    id: string;
    direction: TelegramJournalDirection;
    chatId: string;
    /** Verzeichnis-Schlüssel: 0x… oder tg:<chatId> */
    contactKey: string;
    text: string;
    senderLabel?: string;
    ts: number;
};

type JournalFile = { entries: TelegramJournalEntry[] };

function filePath(): string {
    return path.resolve(process.cwd(), process.env.TELEGRAM_JOURNAL_FILE || DEFAULT_FILE);
}

function readFile(): JournalFile {
    try {
        const p = filePath();
        if (!fs.existsSync(p)) return { entries: [] };
        const j = JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
        if (!j || typeof j !== 'object' || !Array.isArray((j as JournalFile).entries)) {
            return { entries: [] };
        }
        return { entries: (j as JournalFile).entries };
    } catch {
        return { entries: [] };
    }
}

function writeFile(data: JournalFile): void {
    const trimmed = data.entries.slice(-MAX_ENTRIES);
    fs.writeFileSync(filePath(), JSON.stringify({ entries: trimmed }, null, 0), 'utf8');
}

export function resolveContactKeyByTelegramChatId(chatId: string): string {
    const id = chatId.trim();
    if (!id) return '';
    const tgKey = `tg:${id}`;
    const dir = loadContactDirectory();
    if (dir[tgKey]) return tgKey;
    for (const [key, e] of Object.entries(dir)) {
        if (e.telegramChatId?.trim() === id) return key;
    }
    return tgKey;
}

export function appendTelegramJournalEntry(input: {
    direction: TelegramJournalDirection;
    chatId: string;
    contactKey?: string;
    text: string;
    senderLabel?: string;
    ts?: number;
}): TelegramJournalEntry {
    const chatId = input.chatId.trim();
    const contactKey = (input.contactKey || resolveContactKeyByTelegramChatId(chatId)).trim() || `tg:${chatId}`;
    const entry: TelegramJournalEntry = {
        id: `tgj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        direction: input.direction,
        chatId,
        contactKey,
        text: (input.text || '').trim().slice(0, 4000) || '(leer)',
        ...(input.senderLabel?.trim() ? { senderLabel: input.senderLabel.trim().slice(0, 64) } : {}),
        ts: input.ts ?? Date.now(),
    };
    const data = readFile();
    data.entries.push(entry);
    writeFile(data);
    return entry;
}

export function listTelegramJournalEntries(opts: {
    contactKey?: string;
    chatId?: string;
    limit?: number;
}): TelegramJournalEntry[] {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
    const contactKey = (opts.contactKey || '').trim().toLowerCase();
    const chatId = (opts.chatId || '').trim();
    let entries = readFile().entries;
    if (contactKey) {
        entries = entries.filter((e) => e.contactKey.toLowerCase() === contactKey);
    } else if (chatId) {
        entries = entries.filter((e) => e.chatId === chatId);
    }
    return entries.sort((a, b) => b.ts - a.ts).slice(0, limit);
}
