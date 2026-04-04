/**
 * Schatten-Seed → Main-Wallet: alle Coins (minus Gas-Reserve) und transferierbare Owned Objects in einer TX.
 * Erfordert SIGNER-unabhängige Signatur (signAndExecuteWithSigner).
 *
 * Gas: größtes Coin-Objekt = Gas-Zahlung, alle weiteren Coins per mergeCoins in dieses Objekt, dann split + transfer.
 * NFTs: Owned Objects ohne ::coin::Coin werden per transferObjects an Main übertragen (nicht transferierbare Typen werden übersprungen).
 *
 * Nach erfolgreichem Sweep: laufendes Backend behält bis zum Entsperren die alte MY_ADDRESS – Main-Secret (Bech32) in UI
 * ins SDK-Import-Feld / Unlock, oder Prozess mit gesetzter MY_ADDRESS neu starten.
 */
import { Transaction } from '@iota/iota-sdk/transactions';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import type { Signer } from '@iota/iota-sdk/cryptography';
import type { IotaClient } from '@iota/iota-sdk/client';
import { CFG } from './config.js';
import { normalizeAddress } from './utils.js';
import { signAndExecuteWithSigner } from './chain-access.js';
import { countMnemonicWords } from './messenger-nest/sdk-signer-import.js';

const COIN_TYPE_MARKER = '::coin::Coin';

type CoinRow = { objectId: string; version: string | number; digest: string; balance: bigint };

function normAddr(addr: string): string {
    const a = String(addr || '').trim();
    if (!a) return '';
    return /^0x/i.test(a) ? a.toLowerCase() : '0x' + a.toLowerCase();
}

async function fetchAllCoins(client: IotaClient, owner: string): Promise<CoinRow[]> {
    const out: CoinRow[] = [];
    let cursor: string | null | undefined = undefined;
    for (;;) {
        const res = (await client.getCoins({
            owner,
            limit: 100,
            ...(cursor ? { cursor } : {}),
        } as Parameters<IotaClient['getCoins']>[0])) as {
            data?: Array<{ coinObjectId?: string; version?: string | number; digest?: string; balance?: string }>;
            nextCursor?: string | null;
        };
        const data = res.data ?? [];
        for (const c of data) {
            if (!c.coinObjectId || !c.digest) continue;
            const bal = c.balance != null ? BigInt(String(c.balance)) : 0n;
            const v = c.version;
            const version =
                v !== undefined && v !== null ? (typeof v === 'number' ? v : parseInt(String(v), 10) || 0) : 0;
            out.push({ objectId: c.coinObjectId, version, digest: c.digest, balance: bal });
        }
        cursor = res.nextCursor ?? undefined;
        if (!cursor) break;
    }
    return out;
}

/** Owned Objects, die keine Coin-Objekte sind (NFTs etc.). */
async function fetchTransferableNonCoinIds(client: IotaClient, owner: string): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | null | undefined = undefined;
    for (;;) {
        const res = (await client.getOwnedObjects({
            owner,
            limit: 50,
            options: { showType: true },
            ...(cursor ? { cursor } : {}),
        } as Parameters<IotaClient['getOwnedObjects']>[0])) as {
            data?: Array<{ data?: { objectId?: string; type?: string }; objectId?: string }>;
            nextCursor?: string | null;
        };
        for (const item of res.data ?? []) {
            const d = item.data;
            const oid = d?.objectId ?? item.objectId;
            const typ = d?.type ?? '';
            if (!oid) continue;
            if (typ.includes(COIN_TYPE_MARKER)) continue;
            ids.push(oid);
        }
        cursor = res.nextCursor ?? undefined;
        if (!cursor) break;
    }
    return ids;
}

export type ShadowSweepResult = {
    ok: true;
    digest?: string;
    shadowAddress: string;
    mainAddress: string;
    /** Bech32 Secret Key – einmal sichern (Tresor), nicht erneut abrufbar. */
    mainSecretKey: string;
    transferredObjectCount: number;
    sentMistApprox: string;
    note?: string;
};

export type ShadowSweepError = { ok: false; error: string };

/**
 * Erzeugt neues Main-Keypair und sweep’t von Schatten-Mnemonic.
 * @param shadowMnemonic 12+ Wörter
 */
export async function executeShadowSweep(client: IotaClient, shadowMnemonic: string): Promise<ShadowSweepResult | ShadowSweepError> {
    const words = String(shadowMnemonic || '').trim();
    if (countMnemonicWords(words) < 12) {
        return { ok: false, error: 'Schatten-Mnemonic: mindestens 12 Wörter.' };
    }

    const shadowKp = Ed25519Keypair.deriveKeypair(words, CFG.WALLET_DERIVATION_PATH || undefined);
    const mainKp = new Ed25519Keypair();

    let shadowAddress = String(shadowKp.getPublicKey().toIotaAddress() || '').trim();
    if (shadowAddress && !/^0x/i.test(shadowAddress)) shadowAddress = '0x' + shadowAddress;
    shadowAddress = normAddr(shadowAddress);

    let mainAddress = String(mainKp.getPublicKey().toIotaAddress() || '').trim();
    if (mainAddress && !/^0x/i.test(mainAddress)) mainAddress = '0x' + mainAddress;
    mainAddress = normAddr(mainAddress);

    if (!/^0x[a-f0-9]{64}$/.test(shadowAddress) || !/^0x[a-f0-9]{64}$/.test(mainAddress)) {
        return { ok: false, error: 'Adressableitung fehlgeschlagen.' };
    }

    const coins = await fetchAllCoins(client, shadowAddress);
    if (coins.length === 0) {
        return { ok: false, error: 'Schatten-Adresse hat keine Coin-Objekte (0 Balance).' };
    }

    coins.sort((a, b) => (a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0));
    const gasReserve = CFG.SHADOW_SWEEP_GAS_RESERVE_MIST > 0n ? CFG.SHADOW_SWEEP_GAS_RESERVE_MIST : 55_000_000n;
    const totalBal = coins.reduce((s, c) => s + c.balance, 0n);
    if (totalBal <= gasReserve) {
        return {
            ok: false,
            error: `Guthaben zu gering für Sweep (gesamt ${totalBal} MIST, Reserve ${gasReserve} MIST).`,
        };
    }

    const sendAmount = totalBal - gasReserve;
    const gasCoin = coins[0];
    const mergeSources = coins.slice(1);

    const nftIds = await fetchTransferableNonCoinIds(client, shadowAddress);

    const txb = new Transaction();
    txb.setSender(shadowAddress);
    const gasBudgetNum = CFG.GAS_BUDGET != null && Number(CFG.GAS_BUDGET) > 0 ? Number(CFG.GAS_BUDGET) : 10_000_000;
    txb.setGasBudget(BigInt(Number.isNaN(gasBudgetNum) ? 10_000_000 : gasBudgetNum));
    txb.setGasPayment([
        { objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest },
    ]);

    for (const c of mergeSources) {
        txb.mergeCoins(txb.gas, [txb.object(c.objectId)]);
    }

    const [sentCoin] = txb.splitCoins(txb.gas, [sendAmount]);
    txb.transferObjects([sentCoin], mainAddress);

    for (const oid of nftIds) {
        try {
            txb.transferObjects([txb.object(oid)], mainAddress);
        } catch {
            /* Objekt evtl. nicht transferierbar – überspringen */
        }
    }

    const mainSecretKey = mainKp.getSecretKey();
    const signer = shadowKp as unknown as Signer;

    try {
        const { digest, status } = await signAndExecuteWithSigner(client, txb, signer, shadowAddress, {
            skipGasSetup: true,
        });
        if (status && status !== 'success') {
            return { ok: false, error: `Sweep-Transaktion: Status ${status}` };
        }
        return {
            ok: true,
            digest,
            shadowAddress,
            mainAddress,
            mainSecretKey,
            transferredObjectCount: nftIds.length + 1,
            sentMistApprox: sendAmount.toString(),
            note:
                nftIds.length === 0
                    ? undefined
                    : 'NFTs/Objekte mitübertragen, sofern transferierbar. Nicht transferierbare Typen ggf. manuell prüfen.',
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
    }
}
