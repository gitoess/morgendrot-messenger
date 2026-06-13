/**
 * Mailbox-Lebenszyklus: private/team erstellen, private aufräumen/löschen.
 */
import { CFG, getHierarchyPermissions } from '../../config.js';
import {
    cleanupPrivateMailbox,
    createPrivateMailbox,
    createTeamMailbox,
    purgePrivateMailbox,
    getPrivateMailboxRebateCandidates,
    getClient,
    normalizeChainTxEffectStatus,
    explorerTxUrlFromDigest,
    parseMailboxCreatedIdsFromDigest,
    parseTxFailureReasonFromDigest,
    type SignAndExecuteOptions,
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

function resolveLifecycleSignOptions(myAddress: string, sponsorForSender?: string): SignAndExecuteOptions | undefined {
    const sender = (sponsorForSender || '').trim();
    const useSponsor = Boolean(
        sender && CFG.SPONSORED_TRANSACTION_ENABLED && CFG.SPONSOR_GAS_OWNER && sender !== myAddress
    );
    if (!useSponsor) return undefined;
    return {
        sponsorAddress: CFG.SPONSOR_GAS_OWNER!,
        sponsorPassword: getWalletPassword(),
    };
}

async function enrichCreatedMailboxIds(
    res: { status?: string; createdObjectIds?: string[]; digest?: string; gasSummary?: unknown } | undefined
): Promise<{ status?: string; createdObjectIds?: string[]; digest?: string; gasSummary?: unknown } | undefined> {
    if (!res) return res;
    if (res.createdObjectIds?.length) return res;
    const digest = res.digest?.trim();
    if (!digest) return res;
    const fromChain = await parseMailboxCreatedIdsFromDigest(getClient(), digest);
    if (!fromChain.length) return res;
    return { ...res, createdObjectIds: fromChain };
}

async function commandResultFromTx(
    res: { status?: string; createdObjectIds?: string[]; digest?: string; gasSummary?: unknown } | undefined,
    okMessage: string,
    opts?: { moveFunctionHint?: string }
): Promise<CommandHandlerResult> {
    const status = normalizeChainTxEffectStatus(res?.status);
    const digest = res?.digest?.trim();
    const hasObjects = (res?.createdObjectIds?.length ?? 0) > 0;

    if (hasObjects) {
        const out: CommandHandlerResult = { ok: true, message: okMessage };
        if (res?.createdObjectIds?.length) out.createdObjectIds = res.createdObjectIds;
        if (res?.createdObjectIds?.[0]) out.objectId = res.createdObjectIds[0];
        if (digest) out.digest = digest;
        if (res?.gasSummary) out.gasSummary = res.gasSummary as CommandHandlerResult['gasSummary'];
        return out;
    }

    if (status === 'failure') {
        let message = 'Transaktion fehlgeschlagen.';
        if (digest) {
            const reason = await parseTxFailureReasonFromDigest(getClient(), digest);
            if (reason && /function not found/i.test(reason)) {
                const fn = opts?.moveFunctionHint ?? 'Move-Funktion';
                message = `${fn} im Paket nicht gefunden — Move deployen (npm run deploy:move-package) und PACKAGE_ID in .env setzen. Explorer: ${explorerTxUrlFromDigest(digest)}`;
            } else if (reason) {
                message = `Transaktion fehlgeschlagen: ${reason} — Explorer: ${explorerTxUrlFromDigest(digest)}`;
            } else {
                message = `Transaktion fehlgeschlagen — im Explorer prüfen: ${explorerTxUrlFromDigest(digest)}`;
            }
        }
        const out: CommandHandlerResult = { ok: false, message };
        if (digest) out.digest = digest;
        return out;
    }

    const out: CommandHandlerResult = {
        ok: true,
        message: digest
            ? `${okMessage} Object-ID nicht automatisch gelesen — Explorer: ${explorerTxUrlFromDigest(digest)}`
            : okMessage,
    };
    if (digest) out.digest = digest;
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
    const signOptions = resolveLifecycleSignOptions(MY_ADDR, ctx.opts?.sponsorForSender);

    if (c === '/create-private-mailbox') {
        if (!CFG.PACKAGE_ID) return { ok: false, message: 'PACKAGE_ID fehlt.' };
        try {
            const res = await createPrivateMailbox(MY_ADDR, pw, signOptions);
            return await commandResultFromTx(await enrichCreatedMailboxIds(res), 'Private Mailbox on-chain erstellt.', {
                moveFunctionHint: 'create_private_mailbox',
            });
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
        if (!getHierarchyPermissions(CFG.ROLE).teamManage) {
            return {
                ok: false,
                message: 'Team-Mailbox erstellen nur für Kommandant oder Boss (Einsatz-Rolle).',
            };
        }
        if (!CFG.PACKAGE_ID) return { ok: false, message: 'PACKAGE_ID fehlt.' };
        try {
            const res = await createTeamMailbox(MY_ADDR, pw, signOptions);
            return await commandResultFromTx(await enrichCreatedMailboxIds(res), 'Team-Mailbox (Shared) on-chain erstellt.', {
                moveFunctionHint: 'create_team_mailbox',
            });
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
            const r = await cleanupPrivateMailbox(mbId, MY_ADDR, pw, signOptions);
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
            const res = await purgePrivateMailbox(mbId, MY_ADDR, pw, signOptions);
            return await commandResultFromTx(res, 'Private Mailbox on-chain gelöscht (Rebate).', {
                moveFunctionHint: 'purge_private_mailbox',
            });
        } catch (e) {
            return { ok: false, message: (e as Error)?.message || String(e) };
        }
    }

    return null;
}
