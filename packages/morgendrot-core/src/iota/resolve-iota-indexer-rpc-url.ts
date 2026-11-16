/**
 * Explorer-Indexer-URL aus Fullnode-RPC ableiten.
 * `api.*.iota.cafe` kennt `FromOrToAddress` oft nicht — `indexer.*.iota.cafe` schon
 * (volle Adress-Activity inkl. alter Messaging-TXs).
 */
export function resolveIotaIndexerRpcUrl(rpcUrl: string): string | undefined {
  const raw = rpcUrl.trim().replace(/\/+$/, '')
  if (!raw) return undefined
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host === 'api.testnet.iota.cafe') {
      u.hostname = 'indexer.testnet.iota.cafe'
      return u.toString().replace(/\/+$/, '')
    }
    if (host === 'api.mainnet.iota.cafe') {
      u.hostname = 'indexer.mainnet.iota.cafe'
      return u.toString().replace(/\/+$/, '')
    }
    if (host.startsWith('api.')) {
      u.hostname = `indexer.${host.slice(4)}`
      return u.toString().replace(/\/+$/, '')
    }
    if (host.startsWith('indexer.')) return raw
  } catch {
    return undefined
  }
  return undefined
}
