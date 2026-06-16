'use client'

import type { AppendMeshMessageFn } from '@/frontend/lib/append-mesh-message-fn'
import type { SendPartOk } from '@/frontend/features/send/chat-view-handle-send-part-types'
import type { MeshtasticBleSendApi } from '@/frontend/lib/chat-view-messenger-transport'
import { formatMeshtasticNodeIdFromNum } from '@/frontend/lib/meshtastic-node-id'
import { SOS_MESH_RETRY_DEFAULTS, sosMeshRetryDelayMs } from '@/frontend/lib/morg-sos-mesh-retry'
import { formatUnknownError } from '@/frontend/lib/format-unknown-error'

/** Gleiche Meldung: Klartext-Mesh und verschlüsselter Mesh-Pfad bei fehlendem Heltec. */
export const MESH_BT_NOT_CONNECTED_MSG = 'Meshtastic/Web Bluetooth nicht verbunden (Heltec).'

const PUBLIC_CHANNEL_ENCRYPTED_MESH_MSG =
  'Öffentlicher Kanal: verschlüsselter Funk braucht privaten Chat mit Handshake und /connect. Wähle Klartext + „funk“ oder wechsle in den privaten Chat.'

const PUBLIC_CHANNEL_INVALID_NODE_MSG =
  'Funk-Klartext an Node: gültige Node-ID (z. B. !1a2b3c4d) eintragen — oder Haken „an Node-ID“ deaktivieren für Broadcast.'

const PRIVATE_CHAT_INVALID_NODE_MSG =
  'Funk-Klartext: gültige Node-ID (z. B. !1a2b3c4d) oder Haken „an Node-ID“ aus für Broadcast.'

export function recordMeshOutgoingPlaintext(
  append: AppendMeshMessageFn | undefined,
  myAddress: string,
  text: string,
  dest: number | 'broadcast',
  mirrorOnline = false
): void {
  const addr = myAddress.trim()
  if (!append || !addr) return
  const destLabel = dest === 'broadcast' ? 'Meshtastic Broadcast' : `mesh:${formatMeshtasticNodeIdFromNum(dest)}`
  const ts = Date.now()
  const id = `mesh-out-plain-${ts}-${Math.random().toString(36).slice(2, 9)}`
  append({
    id,
    from: addr,
    recipient: destLabel,
    content: text,
    timestamp: ts,
    encrypted: false,
    source: mirrorOnline ? 'mailbox' : 'mesh',
    transports: mirrorOnline ? ['mesh', 'internet'] : ['mesh'],
    dedupKey: `mesh-out-plain|${addr}|${text.slice(0, 80)}|${Math.floor(ts / 120_000)}`,
    meshMeta:
      dest === 'broadcast' ? { kind: 'text', fromNodeNum: 0 } : { kind: 'text', fromNodeNum: (dest as number) >>> 0 },
  })
}

export type ChatViewMeshPlaintextSendContext = {
  meshtastic: MeshtasticBleSendApi
  meshtasticChannelIndex?: number
  meshPlaintextDest: () => number | 'broadcast' | null
  appendMeshMessage: AppendMeshMessageFn
  myAddress: string
  meshPath4StyleActive: boolean
  isEmergencySend: boolean
  encrypted: boolean
  failSend: (msg: string) => SendPartOk
  throwIfCancelled: () => void
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  isUserCancelError: (e: unknown) => boolean
  runPath4MailboxSelfArchive: (airUtf8: string) => Promise<string>
}

async function finishMeshPlaintextAfterSend(
  ctx: ChatViewMeshPlaintextSendContext,
  textSnap: string,
  dest: number | 'broadcast'
): Promise<SendPartOk> {
  recordMeshOutgoingPlaintext(ctx.appendMeshMessage, ctx.myAddress, textSnap, dest, ctx.meshPath4StyleActive)
  const path4Footnote = await ctx.runPath4MailboxSelfArchive(textSnap)
  if (path4Footnote.startsWith('__PATH4_FAILED__')) {
    return ctx.failSend(path4Footnote.replace('__PATH4_FAILED__', '').trim())
  }
  return { ok: true, path4Footnote: path4Footnote || undefined }
}

async function sendMeshPlaintextOnce(
  ctx: ChatViewMeshPlaintextSendContext,
  textSnap: string,
  dest: number | 'broadcast'
): Promise<SendPartOk> {
  await ctx.meshtastic.sendMeshText(textSnap, dest, ctx.meshtasticChannelIndex ?? 0)
  return finishMeshPlaintextAfterSend(ctx, textSnap, dest)
}

async function tryPrivateKlartextMeshWithSosRetry(
  ctx: ChatViewMeshPlaintextSendContext,
  textSnap: string,
  dest: number | 'broadcast'
): Promise<SendPartOk> {
  const max = SOS_MESH_RETRY_DEFAULTS.maxAttempts
  let lastErr: unknown
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      if (!ctx.meshtastic.connected) {
        throw new Error(MESH_BT_NOT_CONNECTED_MSG)
      }
      return await sendMeshPlaintextOnce(ctx, textSnap, dest)
    } catch (e) {
      if (ctx.isUserCancelError(e)) throw e
      lastErr = e
      if (attempt + 1 >= max) break
      const delay = sosMeshRetryDelayMs(attempt)
      ctx.setStatusMsg(
        `SOS: Funk fehlgeschlagen — Wiederholung ${attempt + 2}/${max} in ca. ${Math.round(delay / 1000)} s …`
      )
      await new Promise((r) => setTimeout(r, delay))
      ctx.throwIfCancelled()
    }
  }
  ctx.setStatus('error')
  ctx.setStatusMsg(formatUnknownError(lastErr))
  return { ok: false }
}

async function tryMeshPlaintextSend(
  ctx: ChatViewMeshPlaintextSendContext,
  textSnap: string,
  invalidDestMessage: string,
  opts: { allowSosRetry: boolean }
): Promise<SendPartOk> {
  const dest = ctx.meshPlaintextDest()
  if (dest === null) return ctx.failSend(invalidDestMessage)

  if (opts.allowSosRetry && ctx.isEmergencySend) {
    return tryPrivateKlartextMeshWithSosRetry(ctx, textSnap, dest)
  }

  if (!ctx.meshtastic.connected) {
    return ctx.failSend(MESH_BT_NOT_CONNECTED_MSG)
  }

  try {
    return await sendMeshPlaintextOnce(ctx, textSnap, dest)
  } catch (e) {
    if (ctx.isUserCancelError(e)) throw e
    ctx.setStatus('error')
    ctx.setStatusMsg(formatUnknownError(e))
    return { ok: false }
  }
}

export function createChatViewMeshPlaintextSendHandlers(ctx: ChatViewMeshPlaintextSendContext) {
  const tryPublicChannelMeshSend = async (textSnap: string): Promise<SendPartOk> => {
    if (ctx.encrypted) return ctx.failSend(PUBLIC_CHANNEL_ENCRYPTED_MESH_MSG)
    if (!ctx.meshtastic.connected) return ctx.failSend(MESH_BT_NOT_CONNECTED_MSG)
    return tryMeshPlaintextSend(ctx, textSnap, PUBLIC_CHANNEL_INVALID_NODE_MSG, { allowSosRetry: false })
  }

  const tryPrivateKlartextMeshSend = async (textSnap: string): Promise<SendPartOk> => {
    return tryMeshPlaintextSend(ctx, textSnap, PRIVATE_CHAT_INVALID_NODE_MSG, { allowSosRetry: true })
  }

  return { tryPublicChannelMeshSend, tryPrivateKlartextMeshSend }
}
