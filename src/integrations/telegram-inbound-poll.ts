/**
 * Telegram Long Polling (§ H.26 B2) — ohne öffentliche URL / Tunnel.
 */
import { logger } from '../logger.js';
import { readRuntimeConfigRaw, writeRuntimeConfigRaw } from '../config.js';
import { formatNetworkFetchError, formatTelegramApiTarget } from '../network-fetch-error.js';
import {
    ingestTelegramInboundUpdate,
    normalizeTelegramInboundMode,
    setTelegramInboundPollRunning,
    type TelegramInboundMode,
} from './telegram-inbound.js';
import { readTelegramIntegrationConfig } from './telegram-integration.js';

const GET_UPDATES_TIMEOUT_SEC = 25;
const ERROR_BACKOFF_MS = 5000;

let pollAbort = false;
let pollGeneration = 0;
let webhookClearedForToken = '';

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function readLastUpdateId(): number {
    const tg = readRuntimeConfigRaw()?.integrations as Record<string, unknown> | undefined;
    const telegram = tg?.telegram;
    if (!telegram || typeof telegram !== 'object' || Array.isArray(telegram)) return 0;
    const n = Number((telegram as Record<string, unknown>).lastUpdateId);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function writeLastUpdateId(updateId: number): void {
    const merged = { ...readRuntimeConfigRaw() };
    const integrations =
        merged.integrations && typeof merged.integrations === 'object' && !Array.isArray(merged.integrations)
            ? { ...(merged.integrations as Record<string, unknown>) }
            : {};
    const prevTg =
        integrations.telegram && typeof integrations.telegram === 'object' && !Array.isArray(integrations.telegram)
            ? { ...(integrations.telegram as Record<string, unknown>) }
            : {};
    prevTg.lastUpdateId = updateId;
    integrations.telegram = prevTg;
    merged.integrations = integrations;
    writeRuntimeConfigRaw(merged);
}

export async function telegramDeleteWebhook(botToken: string): Promise<{ ok: boolean; error?: string }> {
    const url = `https://api.telegram.org/bot${botToken.trim()}/deleteWebhook?drop_pending_updates=false`;
    try {
        const resp = await fetch(url, { method: 'POST' });
        const body = (await resp.json().catch(() => ({}))) as { ok?: boolean; description?: string };
        if (!resp.ok || body.ok === false) {
            return { ok: false, error: body.description || `HTTP ${resp.status}` };
        }
        return { ok: true };
    } catch (e: unknown) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

type TelegramUpdate = { update_id: number; [key: string]: unknown };

async function telegramGetUpdates(
    botToken: string,
    offset: number,
    timeoutSec: number
): Promise<{ ok: boolean; updates?: TelegramUpdate[]; error?: string }> {
    const params = new URLSearchParams({
        offset: String(offset),
        timeout: String(timeoutSec),
        allowed_updates: JSON.stringify(['message']),
    });
    const url = `https://api.telegram.org/bot${botToken.trim()}/getUpdates?${params}`;
    try {
        const resp = await fetch(url, { method: 'GET' });
        const body = (await resp.json()) as {
            ok?: boolean;
            result?: TelegramUpdate[];
            description?: string;
        };
        if (!resp.ok || body.ok === false) {
            return { ok: false, error: body.description || `HTTP ${resp.status}` };
        }
        return { ok: true, updates: Array.isArray(body.result) ? body.result : [] };
    } catch (e: unknown) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

async function pollLoop(generation: number): Promise<void> {
    setTelegramInboundPollRunning(true);
    let offset = readLastUpdateId() + 1;
    try {
    while (!pollAbort && generation === pollGeneration) {
        const cfg = readTelegramIntegrationConfig();
        const mode = normalizeTelegramInboundMode(cfg?.inboundMode);
        if (mode !== 'longPoll' || !cfg?.botToken) {
            await sleep(ERROR_BACKOFF_MS);
            continue;
        }
        const token = cfg.botToken.trim();
        if (webhookClearedForToken !== token) {
            const del = await telegramDeleteWebhook(token);
            if (del.ok) {
                webhookClearedForToken = token;
                logger.info('Telegram: Webhook entfernt — Long Polling aktiv.');
            } else {
                logger.warn(
                    formatNetworkFetchError(del.error || 'fehlgeschlagen', {
                        context: 'Telegram deleteWebhook',
                        target: formatTelegramApiTarget('deleteWebhook'),
                        hint: 'api.telegram.org erreichbar? (Firewall/VPN/Proxy)',
                    })
                );
            }
        }
        const res = await telegramGetUpdates(token, offset, GET_UPDATES_TIMEOUT_SEC);
        if (!res.ok) {
            logger.warn(
                formatNetworkFetchError(res.error || 'fehlgeschlagen', {
                    context: 'Telegram getUpdates',
                    target: formatTelegramApiTarget('getUpdates'),
                    hint: 'api.telegram.org erreichbar? (Firewall/VPN/Proxy)',
                })
            );
            await sleep(ERROR_BACKOFF_MS);
            continue;
        }
        for (const upd of res.updates ?? []) {
            if (typeof upd.update_id === 'number' && upd.update_id >= offset) {
                offset = upd.update_id + 1;
            }
            const ingested = await ingestTelegramInboundUpdate(upd);
            if (ingested.stored) {
                logger.info(`Telegram Eingang (Poll): Chat ${String((upd as { message?: { chat?: { id?: number } } }).message?.chat?.id ?? '?')}`);
            } else if (ingested.commandReply) {
                logger.info(`Telegram Bot-Kommando (Poll): Chat ${String((upd as { message?: { chat?: { id?: number } } }).message?.chat?.id ?? '?')}`);
            }
        }
        if (offset > 1) writeLastUpdateId(offset - 1);
    }
    } finally {
        setTelegramInboundPollRunning(false);
    }
}

export function stopTelegramInboundPoll(): void {
    pollAbort = true;
    pollGeneration++;
    webhookClearedForToken = '';
}

export function startTelegramInboundPoll(): void {
    pollAbort = false;
    const gen = ++pollGeneration;
    void pollLoop(gen).catch((e) => {
        logger.error(`Telegram Poll beendet: ${e instanceof Error ? e.message : String(e)}`);
    });
}

export function restartTelegramInbound(): void {
    stopTelegramInboundPoll();
    const cfg = readTelegramIntegrationConfig();
    const mode: TelegramInboundMode = normalizeTelegramInboundMode(cfg?.inboundMode);
    if (mode === 'longPoll' && cfg?.botToken) {
        pollAbort = false;
        startTelegramInboundPoll();
        logger.info('Telegram Long Polling gestartet (Telefonbuch-Chat-IDs).');
    } else if (mode === 'webhook') {
        logger.info('Telegram Eingang: Webhook-Modus (Long Polling aus).');
    }
}
