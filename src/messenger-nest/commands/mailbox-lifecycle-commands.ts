/**
 * Mailbox-Lebenszyklus: private/team erstellen, private aufräumen/löschen.
 */
import { CFG } from '../../config.js';
import {
    cleanupPrivateMailbox,
    createPrivateMailbox,
    createTeamMailbox,
    purgePrivateMailbox,
    getPrivateMailboxRebateCandidates,
} from '../../chain-access.js';
import { getWalletPassword } from '../messenger-session-password.js';
import type { CommandHandlerResult, MessengerCommandContext } from './command-types.js';

const LIFECYCLE_COMMANDS = new Set([
    '/create-private-mailbox',
    '/create-team-mailbox',
    '/purge-private-mailbox',
    '/cleanup-private-mailbox',
    '/private-mailbox-contents',
]);

function commandResultFromTx(
    res: { status?: string; createdObjectIds?: string[]; digest?: string; gasSummary?: unknown } | undefined,
    okMessage: string
): CommandHandlerResult {
    if (res?.status === 'failure') return { ok: false, message: 'Transaktion fehlgeschlagen.' };
    const out: CommandHandlerResult = { ok: true, message: okMessage };
    if (res?.createdObjectIds?.length) out.createdObjectIds = res.createdObjectIds;
    if (res?.createdObjectIds?.[0]) out.objectId = res.createdObjectIds[0];
    if (res?.digest) out.digest = res.digest;
    if (res?.gasSummary) out.gasSummary = res.gasSummary as CommandHandlerResult['gasSummary'];
    return out;
}

export async function tryHandleMailboxLifecycleCommand(
    ctx: MessengerCommandContext
): Promise<CommandHandlerResult | null> {
    const c = ctx.cmd;
    if (!LIFECYCLE_COMMANDS.has(c)) return null;

    const MY_ADDR = ctx.myAddress;
    const pw = getWalletPassword();
    const sponsorOpts = ctx.opts?.sponsorForSender ? { sponsorForSender: ctx.opts.sponsorForSender } : undefined;

    if (c === '/create-private-mailbox') {
        if (!CFG.PACKAGE_ID) return { ok: false, message: 'PACKAGE_ID fehlt.' };
        try {
            const res = await createPrivateMailbox(MY_ADDR, pw, sponsorOpts);
            return commandResultFromTx(res, 'Private Mailbox on-chain erstellt.');
        } catch (e) {
            const msg = (e as Error)?.message || String(e);
            if (/create_private_mailbox|function not found|Could not resolve/i.test(msg)) {
                return {
                    ok: false,
                    message:
                        'create_private_mailbox im Paket nicht gefunden — Move deployen (npm run deploy:move-package) und PACKAGE_ID in .env setzen.',
                };
            }
            return { ok: false, message: msg };
        }
    }

    if (c === '/create-team-mailbox') {
        if (!CFG.PACKAGE_ID) return { ok: false, message: 'PACKAGE_ID fehlt.' };
        try {
            const res = await createTeamMailbox(MY_ADDR, pw, sponsorOpts);
            return commandResultFromTx(res, 'Team-Mailbox (Shared) on-chain erstellt.');
        } catch (e) {
            const msg = (e as Error)?.message || String(e);
            if (/create_team_mailbox|function not found|Could not resolve/i.test(msg)) {
                return {
                    ok: false,
                    message:
                        'create_team_mailbox im Paket nicht gefunden — Move deployen und PACKAGE_ID in .env setzen.',
                };
            }
            return { ok: false, message: msg };
        }
    }

    const mbId = String(ctx.args[0] ?? '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(mbId)) {
        return { ok: false, message: 'Object-ID nötig (0x + 64 Hex).' };
    }

    if (c === '/private-mailbox-contents') {
        try {
            const { handshakes, messages } = await getPrivateMailboxRebateCandidates(mbId, MY_ADDR);
            return {
                ok: true,
                message: `${handshakes.length} Handshake(s), ${messages.length} Nachricht(en).`,
                handshakeCount: handshakes.length,
                messageCount: messages.length,
            };
        } catch (e) {
            return { ok: false, message: (e as Error)?.message || String(e) };
        }
    }

    if (c === '/cleanup-private-mailbox') {
        try {
            const r = await cleanupPrivateMailbox(mbId, MY_ADDR, pw, sponsorOpts);
            return {
                ok: true,
                message: `Aufräumen: ${r.purgedHandshakes} Handshake(s), ${r.purgedMessages} Nachricht(en), ${r.transactions} TX.`,
                digest: r.digest,
                purgedHandshakes: r.purgedHandshakes,
                purgedMessages: r.purgedMessages,
                transactions: r.transactions,
            };
        } catch (e) {
            return { ok: false, message: (e as Error)?.message || String(e) };
        }
    }

    if (c === '/purge-private-mailbox') {
        try {
            const res = await purgePrivateMailbox(mbId, MY_ADDR, pw, sponsorOpts);
            return commandResultFromTx(res, 'Private Mailbox on-chain gelöscht (Rebate).');
        } catch (e) {
            return { ok: false, message: (e as Error)?.message || String(e) };
        }
    }

    return null;
}
