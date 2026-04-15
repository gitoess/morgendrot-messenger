import { IotaClient, IotaHTTPTransport } from '@iota/iota-sdk/client'
import { sanitizeDirectIotaRpcUrl } from './sanitize-rpc-url'

export type DirectIotaFetch = typeof fetch

export type CreateDirectIotaClientOptions = {
  rpcUrl: string
  /**
   * Defaults to `globalThis.fetch` (browser / modern Node).
   * Inject in tests or for timeouts / custom TLS.
   */
  fetchImpl?: DirectIotaFetch
}

/**
 * **Handy-first:** `IotaClient` that talks **only** to the given fullnode — no Morgendrot `/api` relay.
 */
export function createDirectIotaClient(options: CreateDirectIotaClientOptions): IotaClient {
  const url = sanitizeDirectIotaRpcUrl(options.rpcUrl)
  const fetchFn = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  return new IotaClient({
    transport: new IotaHTTPTransport({ url, fetch: fetchFn }),
  })
}
