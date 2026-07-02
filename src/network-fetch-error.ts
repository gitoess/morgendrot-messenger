/** Log-freundliche Ziel-URL ohne Secrets (Host + Pfad). */
export function formatRpcUrlForLog(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return '(RPC nicht gesetzt)';
    try {
        const u = new URL(trimmed);
        const path = u.pathname && u.pathname !== '/' ? u.pathname : '';
        return `${u.protocol}//${u.host}${path}`;
    } catch {
        return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
    }
}

/** Telegram-Bot-API-Ziel ohne Token im Klartext. */
export function formatTelegramApiTarget(endpoint: 'getUpdates' | 'deleteWebhook'): string {
    return `https://api.telegram.org/bot…/${endpoint}`;
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function errorCauseSuffix(error: unknown): string {
    if (!(error instanceof Error) || !(error.cause instanceof Error)) return '';
    const causeMsg = error.cause.message.trim();
    return causeMsg ? ` (${causeMsg})` : '';
}

function defaultNetworkHint(message: string): string {
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network|timeout|UND_ERR|ETIMEDOUT/i.test(message)) {
        return 'Netzwerk prüfen (Internet, Firewall, VPN/Proxy)';
    }
    return '';
}

/** Kontext + Fehlertext + Ziel-URL für WARN-Logs. */
export function formatNetworkFetchError(
    error: unknown,
    opts: { context: string; target: string; hint?: string }
): string {
    const msg = errorMessage(error);
    const hint = opts.hint ?? defaultNetworkHint(msg);
    const hintPart = hint ? ` — ${hint}` : '';
    return `${opts.context}: ${msg}${errorCauseSuffix(error)} → ${opts.target}${hintPart}`;
}
