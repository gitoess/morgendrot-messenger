/**
 * Lädt `.morgendrot-globals-ids.json` — Testnet + Mainnet Lab-Profile.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const FALLBACK = {
  testnet: {
    rpcUrl: 'https://api.testnet.iota.cafe',
    packageId: '0xcf409a0387de039a707d1916afeb16f17a22969a0735e8cfeeaaf5b5fa3d811f',
    mailboxId: '0xcf231121f32227f8c55d30454c0ca90955d33b220a26a988d496085bace7fcaf',
  },
  mainnet: {
    rpcUrl: 'https://api.mainnet.iota.cafe',
    packageId: '0xb58808d193dd06d4e09381ed56d2d06bbe2a1e64c1d94ca97f7df7c5308ea7fe',
    mailboxId: '0x9f288abc3d8c8794dd401d9dfb8393f0b0cba3852580a20e9141741ae0779760',
  },
}

export function loadChainGlobals() {
  try {
    const raw = readFileSync(join(ROOT, '.morgendrot-globals-ids.json'), 'utf8')
    const j = JSON.parse(raw)
    const testnet = {
      rpcUrl: j.testnet?.rpcUrl || j.rpcUrl || FALLBACK.testnet.rpcUrl,
      packageId: j.testnet?.packageId || j.packageId || FALLBACK.testnet.packageId,
      mailboxId: j.testnet?.mailboxId || j.mailboxId || FALLBACK.testnet.mailboxId,
    }
    const mainnet = {
      rpcUrl: j.mainnet?.rpcUrl || FALLBACK.mainnet.rpcUrl,
      packageId: j.mainnet?.packageId || FALLBACK.mainnet.packageId,
      mailboxId: j.mainnet?.mailboxId || FALLBACK.mainnet.mailboxId,
    }
    return { testnet, mainnet, raw: j }
  } catch {
    return { testnet: { ...FALLBACK.testnet }, mainnet: { ...FALLBACK.mainnet }, raw: null }
  }
}

export function chainEnvFromGlobals() {
  const g = loadChainGlobals()
  return {
    SOLO_TESTNET_PACKAGE_ID: g.testnet.packageId,
    SOLO_TESTNET_MAILBOX_ID: g.testnet.mailboxId,
    SOLO_TESTNET_RPC_URL: g.testnet.rpcUrl,
    SOLO_MAINNET_PACKAGE_ID: g.mainnet.packageId,
    SOLO_MAINNET_MAILBOX_ID: g.mainnet.mailboxId,
    SOLO_MAINNET_RPC_URL: g.mainnet.rpcUrl,
    // Legacy aliases (testnet)
    SOLO_PACKAGE_ID: g.testnet.packageId,
    SOLO_MAILBOX_ID: g.testnet.mailboxId,
    SOLO_RPC_URL: g.testnet.rpcUrl,
  }
}
