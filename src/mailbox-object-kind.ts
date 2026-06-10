/**
 * On-chain Typ: PrivateMailbox vs. shared Mailbox (Server / Team).
 */
import { CFG } from './config.js';

const HEX64 = /^0x[a-fA-F0-9]{64}$/i;

export async function isPrivateMailboxObjectOnChain(objectId: string): Promise<boolean> {
    const oid = objectId.trim();
    if (!HEX64.test(oid)) return false;
    const pkg = (CFG.PACKAGE_ID || '').trim().toLowerCase();
    if (!pkg) return false;
    const { getClient } = await import('./chain-access.js');
    const client = getClient();
    const objRes = await client.getObject({
        id: oid,
        options: { showType: true },
    } as Parameters<typeof client.getObject>[0]);
    const typeStr = String((objRes as { data?: { type?: string } })?.data?.type ?? '').toLowerCase();
    return typeStr.includes(`${pkg}::messaging::privatemailbox`);
}
