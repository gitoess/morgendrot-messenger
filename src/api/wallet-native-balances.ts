/**
 * Natives IOTA-Guthaben für Boss-Wallet — öffentliche Chain-Abfrage (kein Vault-Unlock nötig).
 */
import { CFG } from '../config.js';
import { getBalanceInMist, getBalanceInMistForRpc } from '../chain-access.js';
import { inferNetworkFromRpcUrl } from '../vault-onchain-preflight.js';
import { DEFAULT_MAINNET_RPC_URL, DEFAULT_TESTNET_RPC_URL } from '../shared/einsatz-chain-mode.js';
import { formatWalletNativeIotaForStatusUi } from './http-middleware.js';

export type WalletNativeBalanceUi = { mist: string; displayIota: string };

export type WalletNativeBalancesSnapshot = {
    walletNativeIotaBalance?: WalletNativeBalanceUi;
    walletNativeIotaBalanceFetchFailed?: boolean;
    walletNativeIotaBalanceNetwork?: 'testnet' | 'mainnet';
    walletNativeIotaBalanceTestnet?: WalletNativeBalanceUi | null;
    walletNativeIotaBalanceMainnet?: WalletNativeBalanceUi | null;
    walletNativeIotaBalanceTestnetFetchFailed?: boolean;
    walletNativeIotaBalanceMainnetFetchFailed?: boolean;
};

const ADDR_RE = /^0x[a-fA-F0-9]{64}$/i;

function toBalance(mist: bigint): WalletNativeBalanceUi {
    return {
        mist: mist.toString(),
        displayIota: formatWalletNativeIotaForStatusUi(mist),
    };
}

export function resolveBossWalletAddressForBalance(): string {
    return (CFG.MY_ADDRESS || process.env.MY_ADDRESS || '').trim();
}

export async function fetchWalletNativeBalancesForAddress(
    myAddr: string
): Promise<WalletNativeBalancesSnapshot> {
    const out: WalletNativeBalancesSnapshot = {};
    if (!myAddr || !ADDR_RE.test(myAddr)) return out;

    const activeRpc = (CFG.RPC_URL || '').trim();
    const activeNetRaw = inferNetworkFromRpcUrl(activeRpc);
    const activeNet: 'testnet' | 'mainnet' = activeNetRaw === 'mainnet' ? 'mainnet' : 'testnet';
    out.walletNativeIotaBalanceNetwork = activeNet;

    const mainnetRpc =
        (CFG.MAINNET_RPC_URL || '').trim() ||
        (activeNet === 'mainnet' ? activeRpc : DEFAULT_MAINNET_RPC_URL);
    const testnetRpc = activeNet === 'testnet' ? activeRpc : DEFAULT_TESTNET_RPC_URL;

    try {
        const mist = await getBalanceInMist(myAddr);
        const bal = toBalance(mist);
        out.walletNativeIotaBalance = bal;
        if (activeNet === 'testnet') out.walletNativeIotaBalanceTestnet = bal;
        else out.walletNativeIotaBalanceMainnet = bal;
    } catch {
        out.walletNativeIotaBalanceFetchFailed = true;
        if (activeNet === 'testnet') out.walletNativeIotaBalanceTestnetFetchFailed = true;
        else out.walletNativeIotaBalanceMainnetFetchFailed = true;
    }

    if (activeNet === 'testnet' && mainnetRpc && mainnetRpc !== activeRpc) {
        try {
            out.walletNativeIotaBalanceMainnet = toBalance(
                await getBalanceInMistForRpc(myAddr, mainnetRpc)
            );
        } catch {
            out.walletNativeIotaBalanceMainnetFetchFailed = true;
        }
    } else if (activeNet === 'mainnet' && testnetRpc && testnetRpc !== activeRpc) {
        try {
            out.walletNativeIotaBalanceTestnet = toBalance(
                await getBalanceInMistForRpc(myAddr, testnetRpc)
            );
        } catch {
            out.walletNativeIotaBalanceTestnetFetchFailed = true;
        }
    }

    return out;
}
