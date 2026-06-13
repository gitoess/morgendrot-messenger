/**
 * § H.26 B5 — Telegram-Bot-Kommandos `/help`, `/status` (Ops ohne UI).
 */
export type TelegramBotCommand = 'help' | 'status';

export type TelegramBotCommandContext = {
    role: string;
    handoffLabel: string;
    packageIdMasked: string;
    apiPort: number;
    uiPort: number;
    botConfigured: boolean;
    monitorAlarmsEnabled: boolean;
    inboundMode: string;
    inboundPollActive: boolean;
};

export type TelegramBotCommandDeps = {
    isChatAllowed: (chatId: string) => boolean;
    getBotToken: () => string | null;
    buildStatusContext: () => TelegramBotCommandContext;
    sendMessage: (botToken: string, chatId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
};

/** Erkennt `/help`, `/status` (optional `@BotName`, optional Argumente ignorieren). */
export function parseTelegramBotCommand(text: string): TelegramBotCommand | null {
    const first = (text.trim().split(/\s+/)[0] ?? '').toLowerCase();
    const base = first.replace(/@\w+$/, '');
    if (base === '/help') return 'help';
    if (base === '/status') return 'status';
    return null;
}

export function maskPackageIdForTelegramStatus(packageId: string): string {
    const p = packageId.trim();
    if (!p) return '—';
    if (p.length <= 14) return p;
    return `${p.slice(0, 8)}…${p.slice(-4)}`;
}

export function buildTelegramBotHelpText(): string {
    return (
        'Morgendrot Telegram-Bot (§ H.26)\n\n' +
        '/help — diese Hilfe\n' +
        '/status — Basis-Status (Rolle, Telegram-Modus, Package)\n\n' +
        'Normale Textnachrichten erscheinen im Morgendrot-Posteingang, wenn deine Chat-ID im Telefonbuch steht.'
    );
}

export function buildTelegramBotStatusText(ctx: TelegramBotCommandContext): string {
    const tgLine = ctx.botConfigured
        ? `Telegram: Bot ok, Eingang ${ctx.inboundMode}${ctx.inboundPollActive ? ' (Poll aktiv)' : ''}, Monitor ${ctx.monitorAlarmsEnabled ? 'an' : 'aus'}`
        : 'Telegram: nicht konfiguriert (kein Bot-Token)';
    return (
        'Morgendrot Status\n' +
        `Rolle: ${ctx.role || '—'}\n` +
        `${tgLine}\n` +
        `Handoff: ${ctx.handoffLabel || '—'}\n` +
        `Package: ${ctx.packageIdMasked}\n` +
        `API: ${ctx.apiPort} · UI: ${ctx.uiPort}`
    );
}

/** Antwortet auf Bot-Kommando; normale Nachrichten bleiben unberührt. */
export async function tryHandleTelegramBotCommand(
    parsed: { chatId: string; text: string },
    deps: TelegramBotCommandDeps
): Promise<{ handled: boolean; error?: string }> {
    const cmd = parseTelegramBotCommand(parsed.text);
    if (!cmd) return { handled: false };
    if (!deps.isChatAllowed(parsed.chatId)) return { handled: false };

    const token = deps.getBotToken()?.trim();
    if (!token) return { handled: false, error: 'bot_not_configured' };

    const reply =
        cmd === 'help' ? buildTelegramBotHelpText() : buildTelegramBotStatusText(deps.buildStatusContext());
    const sent = await deps.sendMessage(token, parsed.chatId, reply);
    if (!sent.ok) return { handled: true, error: sent.error || 'send_failed' };
    return { handled: true };
}
