import { executeCommand } from '@/frontend/lib/api/execute-command'

export type MeshV2Wire = { recipient: string; wireBase64: string; meshNonce: number }

export async function meshBuildV2Wires(message: string): Promise<{
  ok: boolean
  wires?: MeshV2Wire[]
  error?: string
  message?: string
}> {
  const r = await executeCommand<{
    ok?: boolean
    wires?: MeshV2Wire[]
    message?: string
    error?: string
  }>('/mesh-build-v2', [message])
  const rec = r as { ok?: boolean; wires?: MeshV2Wire[]; message?: string; error?: string }
  return {
    ok: rec.ok === true,
    wires: rec.wires,
    error: rec.error,
    message: rec.message,
  }
}

export async function meshDecryptV2Wire(
  senderAddress: string,
  wireBase64: string
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const r = await executeCommand<{ ok?: boolean; text?: string; message?: string; error?: string }>(
    '/mesh-decrypt-v2',
    [senderAddress, wireBase64]
  )
  const rec = r as { ok?: boolean; text?: string; message?: string; error?: string }
  const text = typeof rec.text === 'string' ? rec.text : typeof rec.message === 'string' ? rec.message : undefined
  return {
    ok: rec.ok === true && !!text,
    text,
    error: rec.error,
  }
}

/** Sneakernet: ECDH + AES-GCM wie /send; Empfänger muss in peerMap (nach Handshake). */
const MORG_PKG_COMMAND_TIMEOUT_MS = 180_000

export async function morgPkgExport(
  recipient0x: string,
  plaintext: string
): Promise<{ ok: boolean; morgPkg?: Record<string, unknown>; message?: string; error?: string }> {
  const r = await executeCommand('/morg-pkg-export', [recipient0x], {
    commandPlaintext: plaintext,
    timeoutMs: MORG_PKG_COMMAND_TIMEOUT_MS,
  })
  const rec = r as { ok?: boolean; morgPkg?: Record<string, unknown>; message?: string; error?: string }
  return {
    ok: rec.ok === true,
    morgPkg: rec.morgPkg,
    message: rec.message,
    error: rec.error,
  }
}

export async function morgPkgImport(pkg: Record<string, unknown>): Promise<{
  ok: boolean
  plaintext?: string
  message?: string
  error?: string
}> {
  const r = await executeCommand('/morg-pkg-import', [], {
    morgPkg: pkg,
    timeoutMs: MORG_PKG_COMMAND_TIMEOUT_MS,
  })
  const rec = r as { ok?: boolean; plaintext?: string; text?: string; message?: string; error?: string }
  const plaintext =
    typeof rec.plaintext === 'string'
      ? rec.plaintext
      : typeof rec.text === 'string'
        ? rec.text
        : undefined
  return { ok: rec.ok === true && !!plaintext, plaintext, message: rec.message, error: rec.error }
}
