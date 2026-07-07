'use client'

/**
 * Lab-Referenz-Ketten (Testnet + Mainnet) — synchron mit `.morgendrot-globals-ids.json`.
 * Solo/Standalone: Testnet aktiv, Mainnet als zweites Profil (setupPlan both).
 */
import {
  DEFAULT_MAINNET_RPC_URL,
  DEFAULT_TESTNET_RPC_URL,
} from '@morgendrot/shared/einsatz-chain-mode'
import type { EinsatzNetworkProfileFields, EinsatzNetworkProfilesState } from '@/frontend/lib/einsatz-network-profiles'

export const LAB_TESTNET_CHAIN: EinsatzNetworkProfileFields = {
  rpcUrl: DEFAULT_TESTNET_RPC_URL,
  packageId: '0xcf409a0387de039a707d1916afeb16f17a22969a0735e8cfeeaaf5b5fa3d811f',
  mailboxId: '0xcf231121f32227f8c55d30454c0ca90955d33b220a26a988d496085bace7fcaf',
}

export const LAB_MAINNET_CHAIN: EinsatzNetworkProfileFields = {
  rpcUrl: DEFAULT_MAINNET_RPC_URL,
  packageId: '0xb58808d193dd06d4e09381ed56d2d06bbe2a1e64c1d94ca97f7df7c5308ea7fe',
  mailboxId: '0x9f288abc3d8c8794dd401d9dfb8393f0b0cba3852580a20e9141741ae0779760',
}

/** Testnet-Formular-Defaults für Solo-Wizard (env-Override möglich). */
export function labTestnetChainForSoloForm(): EinsatzNetworkProfileFields {
  const packageId =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SOLO_TESTNET_PACKAGE_ID
      ? String(process.env.NEXT_PUBLIC_SOLO_TESTNET_PACKAGE_ID).trim()
      : LAB_TESTNET_CHAIN.packageId
  const mailboxId =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SOLO_TESTNET_MAILBOX_ID
      ? String(process.env.NEXT_PUBLIC_SOLO_TESTNET_MAILBOX_ID).trim()
      : LAB_TESTNET_CHAIN.mailboxId
  return {
    rpcUrl: LAB_TESTNET_CHAIN.rpcUrl,
    packageId,
    mailboxId,
  }
}

export function buildLabDualNetworkProfilesState(
  testnet: EinsatzNetworkProfileFields,
  senderAddress?: string
): EinsatzNetworkProfilesState {
  void senderAddress
  return {
    active: 'testnet',
    setupPlan: 'both',
    setupPlanChosen: true,
    testnet: { ...testnet },
    mainnet: { ...LAB_MAINNET_CHAIN },
  }
}
