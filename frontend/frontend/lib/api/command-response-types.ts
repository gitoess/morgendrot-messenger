/**
 * Legacy-Formen für Dashboard-/Projekt-Komponenten (`frontend/components/*`),
 * die früher `frontend/lib/api.ts` importierten — jetzt über Barrel `@/frontend/lib/api`.
 */

export type CommandResponse = {
  ok: boolean
  message?: string
  error?: string
  messages?: Array<{
    sender: string
    text: string
    isPlain?: boolean
    nonce?: number
  }>
  data?: unknown
}

export type StatusResponse = {
  ok?: boolean
  backendRunning?: boolean
  connected?: boolean
  address?: string
  myAddress?: string
  packageId?: string
  network?: string
  rpcUrlLabel?: string
  version?: string
  error?: string
}
