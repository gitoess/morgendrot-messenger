/**
 * Telegram-Integration (§ H.26 Phase A): Runtime-Config, Monitor-Webhook, Relay-POST.
 */
import { CFG, readRuntimeConfigRaw, writeRuntimeConfigRaw } from '../config.js';
import { getContactLabel, getContactTelegramChatId } from '../contact-labels.js';
import { normalizeTelegramInboundMode, type TelegramInboundMode } from './telegram-inbound.js';
import { isTelegramInboundPollRunning } from './telegram-inbound.js';

export type TelegramIntegrationConfig = {
    enabled: boolean;
    botToken: string;
    adminChatId: string;
    relayBaseUrl: string;
    relaySecret: string;
    inboundMode: TelegramInboundMode;
};

export type TelegramIntegrationPublic = {
    ok: true;
    enabled: boolean;
    botTokenConfigured: boolean;
    /** Vollständiger Token für lokale Einstellungs-UI (selbst gehostete Basis). */
    botToken: string;
    botTokenMasked: string;
    /** Numerische Bot-User-ID (Teil vor „:“ im Token) — nicht mit Chat-ID verwechseln. */
    botUserId: string;
    adminChatId: string;
    relayBaseUrl: string;
    relayReachable: boolean;
    monitorWebhookActive: boolean;
    inboundMode: TelegramInboundMode;
    inboundPollActive: boolean;
    /** B4b — Einsatz-Alarmgruppe (öffentliche Metadaten für Helfer „Ich“). */
    einsatzGroupChatId: string;
    einsatzGroupLabel: string;
    einsatzGroupInviteLink: string;
    einsatzGroupAlarmEnabled: boolean;
};

const DEFAULT_RELAY_BASE = 'http://127.0.0.1:8787';
const initialMonitorAlarmWebhookUrl = (process.env.MONITOR_ALARM_WEBHOOK_URL || '').trim();

function integrationsTelegramRaw(raw: Record<string, unknown>): Record<string, unknown> | undefined {
    const integrations = raw.integrations;
    if (!integrations || typeof integrations !== 'object' || Array.isArray(integrations)) return undefined;
    const tg = (integrations as Record<string, unknown>).telegram;
    if (!tg || typeof tg !== 'object' || Array.isArray(tg)) return undefined;
    return tg as Record<string, unknown>;
}

export function readTelegramIntegrationConfig(): TelegramIntegrationConfig | null {
    const tg = integrationsTelegramRaw(readRuntimeConfigRaw());
    if (!tg) return null;
    const botToken = String(tg.botToken ?? '').trim();
    const adminChatId = String(tg.adminChatId ?? '').trim();
    if (!botToken && !adminChatId && tg.enabled !== true) return null;
    return {
        enabled: tg.enabled === true,
        botToken,
        adminChatId,
        relayBaseUrl: String(tg.relayBaseUrl ?? DEFAULT_RELAY_BASE).trim() || DEFAULT_RELAY_BASE,
        relaySecret: String(tg.relaySecret ?? '').trim(),
        inboundMode: normalizeTelegramInboundMode(tg.inboundMode),
    };
}

export function maskTelegramBotToken(token: string): string {
    const t = token.trim();
    if (!t) return '';
    const colon = t.indexOf(':');
    if (colon < 1) return t.length <= 8 ? '****' : `${t.slice(0, 4)}…****`;
    const id = t.slice(0, colon);
    const secret = t.slice(colon + 1);
    const secretTail = secret.length > 4 ? secret.slice(-4) : secret;
    return `${id}:${secret.slice(0, Math.min(4, secret.length))}…${secretTail}`;
}

export function isValidTelegramBotToken(token: string): boolean {
    const t = token.trim();
    return /^\d+:[A-Za-z0-9_-]{20,}$/.test(t);
}

export function isValidTelegramChatId(chatId: string): boolean {
    const c = chatId.trim();
    return /^-?\d{1,20}$/.test(c);
}

/** Bot-User-ID — steht vor dem „:“ im Token (nicht als Chat-ID verwenden). */
export function extractTelegramBotUserIdFromToken(token: string): string | null {
    const t = token.trim();
    const colon = t.indexOf(':');
    if (colon < 1) return null;
    const id = t.slice(0, colon);
    return /^\d+$/.test(id) ? id : null;
}

export function isTelegramChatIdLikelyBotSelf(botToken: string, chatId: string): boolean {
    const botId = extractTelegramBotUserIdFromToken(botToken);
    const cid = chatId.trim();
    if (!botId || !cid) return false;
    return botId === cid;
}

export function formatTelegramApiErrorHint(httpStatus: number, rawBody: string): string {
    let description = rawBody;
    try {
        const j = JSON.parse(rawBody) as { description?: string };
        if (j.description) description = j.description;
    } catch {
        /* raw text */
    }
    const lower = description.toLowerCase();
    if (httpStatus === 403 && lower.includes("can't send messages to the bot")) {
        return (
            'Die Chat-ID ist die Bot-ID (Zahl vor „:“ im Token) — falsch. ' +
            'Deine persönliche Chat-ID von @userinfobot eintragen; Bot in Telegram öffnen und „Start“ tippen.'
        );
    }
    if (httpStatus === 403 && (lower.includes('bot was blocked') || lower.includes('blocked by the user'))) {
        return 'Bot in Telegram öffnen und „Start“ tippen (ggf. Blockierung aufheben).';
    }
    if (lower.includes('chat not found')) {
        return 'Chat-ID unbekannt — @userinfobot oder Bot-Start prüfen.';
    }
    return description.length > 220 ? `${description.slice(0, 220)}…` : description;
}

function normalizeRelayBaseUrl(url: string): string {
    const u = (url || DEFAULT_RELAY_BASE).trim() || DEFAULT_RELAY_BASE;
    try {
        const parsed = new URL(u);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Relay-URL muss http oder https sein.');
        }
        return parsed.origin;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(msg.includes('Relay') ? msg : `Ungültige Relay-URL: ${msg}`);
    }
}

export function buildTelegramAlarmWebhookUrl(relayBaseUrl: string): string {
    const base = normalizeRelayBaseUrl(relayBaseUrl);
    return `${base}/morgendrot-telegram/alarm`;
}

export function applyTelegramIntegrationToMonitorWebhook(): void {
    const cfg = readTelegramIntegrationConfig();
    if (cfg?.enabled && cfg.botToken && cfg.adminChatId) {
        CFG.MONITOR_ALARM_WEBHOOK_URL = buildTelegramAlarmWebhookUrl(cfg.relayBaseUrl);
        return;
    }
    CFG.MONITOR_ALARM_WEBHOOK_URL = initialMonitorAlarmWebhookUrl;
}

export function formatTelegramAlarmText(payload: {
    device?: string;
    message?: string;
    ts?: number;
    level?: number;
}): string {
    const device = payload.device || 'unbekanntes Gerät';
    const msg = payload.message || 'Kein Text';
    const level = payload.level ?? 1;
    const ts = payload.ts
        ? new Date(payload.ts).toLocaleString('de-DE')
        : new Date().toLocaleString('de-DE');
    return (
        `⚠️ Morgendrot Alarm L${level}\n` +
        `Gerät: ${device}\n` +
        `Zeit: ${ts}\n` +
        `Meldung: ${msg}`
    );
}

export async function sendTelegramMessage(
    botToken: string,
    chatId: string,
    text: string
): Promise<{ ok: boolean; error?: string }> {
    const tgUrl = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
    try {
        const resp = await fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId.trim(), text }),
        });
        if (!resp.ok) {
            const body = await resp.text();
            return { ok: false, error: formatTelegramApiErrorHint(resp.status, body) };
        }
        return { ok: true };
    } catch (e: unknown) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

function relayHeaders(relaySecret: string): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (relaySecret) h['X-Morgendrot-Relay-Secret'] = relaySecret;
    return h;
}

const RELAY_FETCH_TIMEOUT_MS = 3000;

export async function postTelegramAlarmViaRelay(
    cfg: TelegramIntegrationConfig,
    payload: { device?: string; message?: string; ts?: number; level?: number }
): Promise<{ ok: boolean; error?: string }> {
    const url = buildTelegramAlarmWebhookUrl(cfg.relayBaseUrl);
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), RELAY_FETCH_TIMEOUT_MS);
        const resp = await fetch(url, {
            method: 'POST',
            headers: relayHeaders(cfg.relaySecret),
            body: JSON.stringify(payload),
            signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!resp.ok) {
            const body = await resp.text();
            return { ok: false, error: `Relay HTTP ${resp.status}: ${body.slice(0, 200)}` };
        }
        return { ok: true };
    } catch (e: unknown) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

export async function probeTelegramRelay(relayBaseUrl: string, relaySecret: string): Promise<boolean> {
    const url = buildTelegramAlarmWebhookUrl(relayBaseUrl);
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);
        const resp = await fetch(url, {
            method: 'POST',
            headers: relayHeaders(relaySecret),
            body: JSON.stringify({ device: 'probe', message: 'ping', level: 1 }),
            signal: ctrl.signal,
        });
        clearTimeout(t);
        return resp.status < 500;
    } catch {
        return false;
    }
}

export function getTelegramIntegrationPublic(): TelegramIntegrationPublic {
    const cfg = readTelegramIntegrationConfig();
    const tgRaw = integrationsTelegramRaw(readRuntimeConfigRaw());
    const enabled = cfg?.enabled === true;
    const botToken = cfg?.botToken || '';
    const adminChatId = cfg?.adminChatId || '';
    const relayBaseUrl = cfg?.relayBaseUrl || DEFAULT_RELAY_BASE;
    const inboundMode = cfg?.inboundMode ?? 'off';
    const webhook = (CFG.MONITOR_ALARM_WEBHOOK_URL || '').trim();
    const expectedWebhook = buildTelegramAlarmWebhookUrl(relayBaseUrl);
    const botUserId = extractTelegramBotUserIdFromToken(botToken) || '';
    return {
        ok: true,
        enabled,
        botTokenConfigured: Boolean(botToken),
        botToken,
        botTokenMasked: botToken ? maskTelegramBotToken(botToken) : '',
        botUserId,
        adminChatId,
        relayBaseUrl,
        relayReachable: false,
        monitorWebhookActive: Boolean(webhook) && webhook === expectedWebhook,
        inboundMode,
        inboundPollActive: isTelegramInboundPollRunning(),
        einsatzGroupChatId: String(tgRaw?.einsatzGroupChatId ?? '').trim(),
        einsatzGroupLabel: String(tgRaw?.einsatzGroupLabel ?? '').trim(),
        einsatzGroupInviteLink: String(tgRaw?.einsatzGroupInviteLink ?? '').trim(),
        einsatzGroupAlarmEnabled: tgRaw?.einsatzGroupAlarmEnabled === true,
    };
}

export async function getTelegramIntegrationPublicAsync(): Promise<TelegramIntegrationPublic> {
    const base = getTelegramIntegrationPublic();
    const cfg = readTelegramIntegrationConfig();
    if (!cfg) return base;
    base.relayReachable = await probeTelegramRelay(cfg.relayBaseUrl, cfg.relaySecret);
    return base;
}

export type SaveTelegramIntegrationInput = {
    enabled?: boolean;
    botToken?: string;
    adminChatId?: string;
    relayBaseUrl?: string;
    inboundMode?: TelegramInboundMode;
    einsatzGroupChatId?: string;
    einsatzGroupLabel?: string;
    einsatzGroupInviteLink?: string;
    einsatzGroupAlarmEnabled?: boolean;
};

export function saveTelegramIntegration(input: SaveTelegramIntegrationInput): {
    ok: boolean;
    error?: string;
    public?: TelegramIntegrationPublic;
} {
    const prev = readTelegramIntegrationConfig();
    const enabled = input.enabled ?? prev?.enabled ?? false;
    const botTokenIn = String(input.botToken ?? '').trim();
    const botToken = botTokenIn || prev?.botToken || '';
    const adminChatId = String(input.adminChatId ?? prev?.adminChatId ?? '').trim();
    let relayBaseUrl = String(input.relayBaseUrl ?? prev?.relayBaseUrl ?? DEFAULT_RELAY_BASE).trim();
    try {
        relayBaseUrl = normalizeRelayBaseUrl(relayBaseUrl);
    } catch (e: unknown) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    const inboundMode = normalizeTelegramInboundMode(
        input.inboundMode ?? integrationsTelegramRaw(readRuntimeConfigRaw())?.inboundMode ?? prev?.inboundMode ?? 'off'
    );

    if (botToken && !isValidTelegramBotToken(botToken)) {
        return { ok: false, error: 'Bot-Token-Format ungültig (erwartet: Ziffern:Geheimnis von @BotFather).' };
    }

    if (inboundMode !== 'off' && !botToken) {
        return {
            ok: false,
            error: 'Bot-Token fehlt — für eingehende Partner-Antworten (Long Polling/Webhook) eintragen und speichern.',
        };
    }

    if (botToken && adminChatId && isTelegramChatIdLikelyBotSelf(botToken, adminChatId)) {
        return {
            ok: false,
            error:
                'Chat-ID ist die Bot-ID aus dem Token (Zahl vor „:“) — bitte deine persönliche Chat-ID von @userinfobot eintragen.',
        };
    }

    if (enabled) {
        if (!botToken) return { ok: false, error: 'Bot-Token fehlt (von @BotFather).' };
        if (!adminChatId) {
            return {
                ok: false,
                error: 'Admin-Chat-ID fehlt — für System-Alarme (Monitor) eintragen oder Schalter „System-Alarme“ aus lassen.',
            };
        }
        if (!isValidTelegramChatId(adminChatId)) {
            return { ok: false, error: 'Chat-ID muss numerisch sein (ggf. führendes Minus für Gruppen).' };
        }
    }

    const prevTgRaw = integrationsTelegramRaw(readRuntimeConfigRaw()) || {};
    const einsatzGroupChatIdIn =
        input.einsatzGroupChatId !== undefined
            ? String(input.einsatzGroupChatId).trim()
            : String(prevTgRaw.einsatzGroupChatId ?? '').trim();
    const einsatzGroupLabelIn =
        input.einsatzGroupLabel !== undefined
            ? String(input.einsatzGroupLabel).trim()
            : String(prevTgRaw.einsatzGroupLabel ?? '').trim();
    const einsatzGroupInviteLinkIn =
        input.einsatzGroupInviteLink !== undefined
            ? String(input.einsatzGroupInviteLink).trim()
            : String(prevTgRaw.einsatzGroupInviteLink ?? '').trim();
    const einsatzGroupAlarmEnabled =
        input.einsatzGroupAlarmEnabled !== undefined
            ? input.einsatzGroupAlarmEnabled === true
            : prevTgRaw.einsatzGroupAlarmEnabled === true;

    if (einsatzGroupInviteLinkIn && !/^https:\/\/t\.me\//i.test(einsatzGroupInviteLinkIn)) {
        return { ok: false, error: 'Einladungslink muss mit https://t.me/ beginnen.' };
    }
    if (einsatzGroupChatIdIn && !isValidTelegramChatId(einsatzGroupChatIdIn)) {
        return { ok: false, error: 'Gruppen-Chat-ID ungültig (numerisch, ggf. führendes Minus).' };
    }

    const merged = { ...readRuntimeConfigRaw() };
    const integrations =
        merged.integrations && typeof merged.integrations === 'object' && !Array.isArray(merged.integrations)
            ? { ...(merged.integrations as Record<string, unknown>) }
            : {};
    const prevTg = integrationsTelegramRaw(merged) || {};
    const relaySecret = String(prevTg.relaySecret ?? prev?.relaySecret ?? '').trim();

    integrations.telegram = {
        ...prevTg,
        enabled,
        relayBaseUrl,
        inboundMode,
        einsatzGroupChatId: einsatzGroupChatIdIn,
        einsatzGroupLabel: einsatzGroupLabelIn,
        einsatzGroupInviteLink: einsatzGroupInviteLinkIn,
        einsatzGroupAlarmEnabled,
        ...(botToken ? { botToken } : {}),
        ...(adminChatId ? { adminChatId } : {}),
        ...(relaySecret ? { relaySecret } : {}),
    };
    merged.integrations = integrations;

    const written = writeRuntimeConfigRaw(merged);
    if (!written.ok) return { ok: false, error: written.error };

    applyTelegramIntegrationToMonitorWebhook();
    return { ok: true, public: getTelegramIntegrationPublic() };
}

/** Handoff-Extras für `.morgendrot-handoff-extras.json` (B4b.2). */
export function buildHandoffExtrasFromTelegramConfig(): Record<string, unknown> | null {
    const pub = getTelegramIntegrationPublic();
    if (!pub.einsatzGroupAlarmEnabled || !pub.einsatzGroupInviteLink.trim()) return null;
    const group: Record<string, string> = {
        inviteLink: pub.einsatzGroupInviteLink.trim(),
    };
    if (pub.einsatzGroupLabel.trim()) group.label = pub.einsatzGroupLabel.trim();
    if (pub.einsatzGroupChatId.trim()) group.chatId = pub.einsatzGroupChatId.trim();
    return { telegramAlarmGroup: group };
}

export async function sendTelegramTestAlarm(): Promise<{ ok: boolean; error?: string; message?: string }> {
    const cfg = readTelegramIntegrationConfig();
    if (!cfg?.botToken || !cfg.adminChatId) {
        return {
            ok: false,
            error:
                'Token und Chat-ID fehlen. Schalter „Telegram-Alarme aktiv“ an, beides eintragen, Speichern — oder erneut Speichern mit neuem Token.',
        };
    }
    const payload = {
        device: 'TEST-DEVICE',
        message: 'Testalarm von Morgendrot (Integrationen)',
        ts: Date.now(),
        level: 1,
    };
    const text = formatTelegramAlarmText(payload);
    const direct = await sendTelegramMessage(cfg.botToken, cfg.adminChatId, text);
    if (direct.ok) {
        const viaRelay = await postTelegramAlarmViaRelay(cfg, payload);
        if (viaRelay.ok) {
            return {
                ok: true,
                message:
                    'Test-Nachricht in deiner Telegram-App (Chat mit dem Bot). Relay war auch erreichbar.',
            };
        }
        return {
            ok: true,
            message:
                'Test-Nachricht in deiner Telegram-App gesendet (direkt). Relay optional: npm run telegram-webhook',
        };
    }
    const viaRelay = await postTelegramAlarmViaRelay(cfg, payload);
    if (viaRelay.ok) {
        return {
            ok: true,
            message: 'Test über Relay — Nachricht in deiner Telegram-App prüfen.',
        };
    }
    let hint = direct.error || viaRelay.error || 'Unbekannter Fehler';
    if (/chat not found|bot was blocked|Forbidden|Bot-ID|@userinfobot/i.test(hint)) {
        if (!hint.includes('@userinfobot')) {
            hint += ' — Bot in Telegram öffnen und „Start“ tippen; persönliche Chat-ID von @userinfobot (nicht die Bot-Nummer aus dem Token).';
        }
    }
    return { ok: false, error: hint };
}

export function truncateTelegramMessagePreview(text: string, max = 200): string {
    const t = String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t) return 'Neue Morgendrot-Nachricht';
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

export function formatTelegramNotifyText(senderLabel: string, messagePreview: string): string {
    const from = (senderLabel || 'Morgendrot').trim().slice(0, 64) || 'Morgendrot';
    const preview = truncateTelegramMessagePreview(messagePreview);
    return `📩 Morgendrot\nVon: ${from}\n${preview}`;
}

export async function postTelegramNotifyViaRelay(
    cfg: TelegramIntegrationConfig,
    payload: { target_chat_id: string; message_preview: string; sender_label?: string }
): Promise<{ ok: boolean; error?: string }> {
    const base = normalizeRelayBaseUrl(cfg.relayBaseUrl);
    const url = `${base}/morgendrot-telegram/notify`;
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), RELAY_FETCH_TIMEOUT_MS);
        const resp = await fetch(url, {
            method: 'POST',
            headers: relayHeaders(cfg.relaySecret),
            body: JSON.stringify(payload),
            signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!resp.ok) {
            const body = await resp.text();
            return { ok: false, error: `Relay HTTP ${resp.status}: ${body.slice(0, 200)}` };
        }
        return { ok: true };
    } catch (e: unknown) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

export type TelegramContactNotifyInput = {
    recipientAddress: string;
    messagePreview: string;
    senderLabel?: string;
    /** Wenn gesetzt: Ziel-Chat-ID (Test), sonst aus Telefonbuch. */
    targetChatId?: string;
    /** Kein Journal — z. B. Hinweis nach IOTA-Send (Posteingang hat schon Mailbox-Zeile). */
    skipJournal?: boolean;
};

export type TelegramContactNotifyResult = {
    ok: boolean;
    delivered?: boolean;
    skipped?: string;
    error?: string;
};

export async function sendTelegramContactNotify(
    input: TelegramContactNotifyInput
): Promise<TelegramContactNotifyResult> {
    const cfg = readTelegramIntegrationConfig();
    if (!cfg?.botToken) {
        return { ok: true, skipped: 'Telegram-Bot nicht konfiguriert (Integrationen).' };
    }
    const targetChatId =
        (input.targetChatId && isValidTelegramChatId(input.targetChatId) ? input.targetChatId.trim() : '') ||
        getContactTelegramChatId(input.recipientAddress) ||
        '';
    if (!targetChatId) {
        return { ok: true, skipped: 'Keine Telegram Chat-ID für diesen Kontakt.' };
    }
    const preview = truncateTelegramMessagePreview(input.messagePreview);
    const senderLabel =
        (input.senderLabel || '').trim() ||
        getContactLabel(input.recipientAddress) ||
        'Morgendrot';
    const text = formatTelegramNotifyText(senderLabel, preview);

    const direct = await sendTelegramMessage(cfg.botToken, targetChatId, text);
    if (direct.ok) {
        if (!input.skipJournal) {
            const { appendTelegramJournalEntry } = await import('./telegram-journal.js');
            appendTelegramJournalEntry({
                direction: 'out',
                chatId: targetChatId,
                contactKey: input.recipientAddress,
                text: preview || text,
                senderLabel,
            });
        }
        return { ok: true, delivered: true };
    }

    const viaRelay = await postTelegramNotifyViaRelay(cfg, {
        target_chat_id: targetChatId,
        message_preview: preview,
        sender_label: senderLabel,
    });
    if (viaRelay.ok) {
        if (!input.skipJournal) {
            const { appendTelegramJournalEntry } = await import('./telegram-journal.js');
            appendTelegramJournalEntry({
                direction: 'out',
                chatId: targetChatId,
                contactKey: input.recipientAddress,
                text: preview || text,
                senderLabel,
            });
        }
        return { ok: true, delivered: true };
    }

    let hint = direct.error || viaRelay.error || 'Telegram-Zustellung fehlgeschlagen';
    if (/chat not found|bot was blocked|Forbidden/i.test(hint)) {
        hint += ' — Empfänger muss den Bot starten; Chat-ID prüfen.';
    }
    return { ok: false, error: hint };
}

export type TelegramEinsatzGroupEventType = 'sos' | 'team_update' | 'boss_alarm' | 'monitor';

export type TelegramEinsatzGroupHintInput = {
    eventType: TelegramEinsatzGroupEventType;
    seq?: number;
    tgSeq?: number;
    deviceLabel?: string;
    bossShort?: string;
    teamLabel?: string;
};

function readEinsatzGroupRuntimeFields(): {
    chatId: string;
    label: string;
    enabled: boolean;
} {
    const tg = integrationsTelegramRaw(readRuntimeConfigRaw());
    return {
        chatId: String(tg?.einsatzGroupChatId ?? '').trim(),
        label: String(tg?.einsatzGroupLabel ?? '').trim(),
        enabled: tg?.einsatzGroupAlarmEnabled === true,
    };
}

export function formatTelegramEinsatzGroupHintText(input: TelegramEinsatzGroupHintInput): string {
    const teamLabel = (input.teamLabel || 'Einsatz-Team').trim().slice(0, 48) || 'Einsatz-Team';
    const bossShort = (input.bossShort || 'Einsatzleitung').trim().slice(0, 24) || 'Einsatzleitung';
    const device = (input.deviceLabel || 'Gerät').trim().slice(0, 48) || 'Gerät';
    switch (input.eventType) {
        case 'sos':
            return `${teamLabel}: Hilferuf (${bossShort}). Details in Morgendrot öffnen — nicht 112.`;
        case 'team_update':
            return `${teamLabel}: Team-Update #${input.seq ?? '?'}. Bitte in Morgendrot bestätigen.`;
        case 'boss_alarm':
            return `${teamLabel}: Wichtiger Hinweis von Einsatzleitung. Morgendrot prüfen.`;
        case 'monitor':
            return `${teamLabel}: Systemalarm — ${device}. Morgendrot/Monitor prüfen.`;
        default:
            return `${teamLabel}: Morgendrot prüfen.`;
    }
}

export type TelegramEinsatzGroupHintResult = {
    ok: boolean;
    delivered?: boolean;
    skipped?: string;
    error?: string;
};

/** B4b — Kurz-Hinweis an Einsatz-Alarmgruppe (§6.5 Templates, kein Mnemonic/Link). */
export async function sendTelegramEinsatzGroupHint(
    input: TelegramEinsatzGroupHintInput
): Promise<TelegramEinsatzGroupHintResult> {
    const cfg = readTelegramIntegrationConfig();
    const group = readEinsatzGroupRuntimeFields();
    if (!group.enabled) {
        return { ok: true, skipped: 'Einsatz-Alarmgruppe ist deaktiviert.' };
    }
    if (!cfg?.botToken) {
        return { ok: true, skipped: 'Telegram-Bot nicht konfiguriert.' };
    }
    const chatId = group.chatId;
    if (!chatId || !isValidTelegramChatId(chatId)) {
        return { ok: true, skipped: 'Gruppen-Chat-ID fehlt oder ungültig (Einstellungen → Telegram).' };
    }
    const teamLabel = (input.teamLabel || group.label || 'Einsatz-Team').trim();
    const text = formatTelegramEinsatzGroupHintText({ ...input, teamLabel }).slice(0, 280);
    const direct = await sendTelegramMessage(cfg.botToken, chatId, text);
    if (direct.ok) {
        return { ok: true, delivered: true };
    }
    return { ok: false, error: direct.error || 'Gruppen-Hinweis fehlgeschlagen' };
}

export async function sendTelegramTestNotify(targetChatId: string): Promise<{
    ok: boolean;
    message?: string;
    error?: string;
}> {
    if (!isValidTelegramChatId(targetChatId)) {
        return { ok: false, error: 'Ungültige Ziel-Chat-ID.' };
    }
    const result = await sendTelegramContactNotify({
        recipientAddress: '0x' + '0'.repeat(64),
        messagePreview: 'Test-Hinweis von Morgendrot (Integrationen)',
        senderLabel: 'Morgendrot Test',
        targetChatId: targetChatId.trim(),
    });
    if (result.delivered) {
        return { ok: true, message: 'Test-Hinweis in Telegram beim Ziel-Chat gesendet.' };
    }
    if (result.skipped) return { ok: false, error: result.skipped };
    return { ok: false, error: result.error || 'Test fehlgeschlagen' };
}

/** Für scripts/telegram-webhook.ts — Runtime oder .env. */
export function loadTelegramRelayCredentials(): { token: string; chatId: string; relaySecret: string } | null {
    const cfg = readTelegramIntegrationConfig();
    if (cfg?.botToken && cfg.adminChatId) {
        return { token: cfg.botToken, chatId: cfg.adminChatId, relaySecret: cfg.relaySecret };
    }
    const token = (process.env.TG_BOT_TOKEN || '').trim();
    const chatId = (process.env.TG_CHAT_ID || '').trim();
    if (token && chatId) return { token, chatId, relaySecret: '' };
    return null;
}
