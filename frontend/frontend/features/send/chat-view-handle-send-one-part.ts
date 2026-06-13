'use client'

import { createChatViewMailboxSendHandlers } from '@/frontend/features/send/chat-view-handle-send-mailbox'
import type { ChatViewMailboxSendContext } from '@/frontend/features/send/chat-view-handle-send-mailbox'
import { createChatViewMeshPlaintextSendHandlers } from '@/frontend/features/send/chat-view-handle-send-mesh-plaintext'
import type { ChatViewMeshPlaintextSendContext } from '@/frontend/features/send/chat-view-handle-send-mesh-plaintext'
import type { SendPartOk } from '@/frontend/features/send/chat-view-handle-send-part-types'
import {
  CHAT_ENCRYPTED_MESH_DISABLED_MSG,
  type ForcedTransport,
} from '@/frontend/lib/chat-view-messenger-transport'

const ADHOC_PLAINTEXT_MSG =
  'Ad-hoc: nicht implementiert. Wähle „online“ oder „funk“ (Klartext) bzw. verschlüsselt.'

const ADHOC_ENCRYPTED_MSG =
  'Layer 3 (Smartphone-Direct): nicht implementiert – BLE-Advertising/Scan nur als Konzept (bleUuid im Vault).'

const UNKNOWN_PLAINTEXT_PATH_MSG = 'Unbekannter Klartext-Pfad.'
const UNKNOWN_SEND_PATH_MSG = 'Unbekannter Sendepfad.'

export type ChatViewSendOnePartRouteDeps = {
  textSnap: string
  isPrivate: boolean
  encrypted: boolean
  meshPath4StyleActive: boolean
  forcedTransport: ForcedTransport
  tryMailbox: (textSnap: string, enc: boolean) => Promise<SendPartOk>
  tryPublicChannelMeshSend: (textSnap: string) => Promise<SendPartOk>
  tryPrivateKlartextMeshSend: (textSnap: string) => Promise<SendPartOk>
  failSend: (msg: string) => SendPartOk
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
}

/** Reine Pfadwahl für einen Text-Teil — testbar ohne Mailbox/Mesh-Implementierung. */
export async function routeChatViewSendOnePart(deps: ChatViewSendOnePartRouteDeps): Promise<SendPartOk> {
  const { textSnap, isPrivate, encrypted, meshPath4StyleActive, forcedTransport } = deps

  if (!isPrivate) {
    if (forcedTransport === 'mesh') {
      return deps.tryPublicChannelMeshSend(textSnap)
    }
    return deps.tryMailbox(textSnap, encrypted)
  }

  if (!encrypted || meshPath4StyleActive) {
    if (forcedTransport === 'internet') {
      return deps.tryMailbox(textSnap, false)
    }
    if (forcedTransport === 'mesh') {
      return deps.tryPrivateKlartextMeshSend(textSnap)
    }
    deps.setStatus('error')
    deps.setStatusMsg(forcedTransport === 'adhoc' ? ADHOC_PLAINTEXT_MSG : UNKNOWN_PLAINTEXT_PATH_MSG)
    return { ok: false }
  }

  if (forcedTransport === 'adhoc') {
    deps.setStatus('error')
    deps.setStatusMsg(ADHOC_ENCRYPTED_MSG)
    return { ok: false }
  }

  if (forcedTransport === 'mesh') {
    return deps.failSend(CHAT_ENCRYPTED_MESH_DISABLED_MSG)
  }

  if (forcedTransport === 'internet') {
    return deps.tryMailbox(textSnap, true)
  }

  deps.setStatus('error')
  deps.setStatusMsg(UNKNOWN_SEND_PATH_MSG)
  return { ok: false }
}

export type ChatViewSendOnePartContext = {
  throwIfCancelled: () => void
  setStatus: (v: 'idle' | 'success' | 'error') => void
  setStatusMsg: (v: string) => void
  isPrivate: boolean
  encrypted: boolean
  meshPath4StyleActive: boolean
  forcedTransport: ForcedTransport
  mailbox: Omit<ChatViewMailboxSendContext, 'failSend'>
  mesh: Omit<ChatViewMeshPlaintextSendContext, 'failSend' | 'throwIfCancelled' | 'setStatus' | 'setStatusMsg'>
}

export type ChatViewSendOnePartFn = (textSnap: string) => Promise<SendPartOk>

export function createChatViewSendOnePart(ctx: ChatViewSendOnePartContext): ChatViewSendOnePartFn {
  return async (textSnap: string): Promise<SendPartOk> => {
    ctx.throwIfCancelled()
    const failSend = (msg: string): SendPartOk => {
      ctx.setStatus('error')
      ctx.setStatusMsg(msg)
      return { ok: false }
    }

    const { tryMailbox } = createChatViewMailboxSendHandlers({
      ...ctx.mailbox,
      throwIfCancelled: ctx.throwIfCancelled,
      failSend,
    })

    const { tryPublicChannelMeshSend, tryPrivateKlartextMeshSend } = createChatViewMeshPlaintextSendHandlers({
      ...ctx.mesh,
      failSend,
      throwIfCancelled: ctx.throwIfCancelled,
      setStatus: ctx.setStatus,
      setStatusMsg: ctx.setStatusMsg,
    })

    return routeChatViewSendOnePart({
      textSnap,
      isPrivate: ctx.isPrivate,
      encrypted: ctx.encrypted,
      meshPath4StyleActive: ctx.meshPath4StyleActive,
      forcedTransport: ctx.forcedTransport,
      tryMailbox,
      tryPublicChannelMeshSend,
      tryPrivateKlartextMeshSend,
      failSend,
      setStatus: ctx.setStatus,
      setStatusMsg: ctx.setStatusMsg,
    })
  }
}
