import { executeCommand } from '@/frontend/lib/api/execute-command'

/** Package-ID in `.morgendrot-package-id` schreiben (wie Terminal `/set-package-id`). */
export const setPackageIdCommand = (packageId0x: string) =>
  executeCommand('/set-package-id', [packageId0x.trim()])

export const startHandshake = (partner: string) => executeCommand('/handshake', [partner])

export const connect = (address?: string) =>
  executeCommand('/connect', address ? [address] : [])

export async function findPeerHandshake(peer?: string): Promise<{
  ok: boolean
  found?: boolean
  sender?: string
  nonce?: string
  peerPubRawBase64?: string
  error?: string
}> {
  const q = peer && /^0x[a-fA-F0-9]{64}$/.test(peer.trim()) ? `?peer=${encodeURIComponent(peer.trim())}` : ''
  const r = await fetch('/api/find-peer-handshake' + q)
  const j = (await r.json()) as {
    ok?: boolean
    found?: boolean
    sender?: string
    nonce?: string
    peerPubRawBase64?: string
    error?: string
  }
  return {
    ok: j.ok === true,
    found: j.found === true,
    sender: typeof j.sender === 'string' ? j.sender : undefined,
    nonce: typeof j.nonce === 'string' ? j.nonce : undefined,
    peerPubRawBase64: typeof j.peerPubRawBase64 === 'string' ? j.peerPubRawBase64 : undefined,
    error: typeof j.error === 'string' ? j.error : undefined,
  }
}
