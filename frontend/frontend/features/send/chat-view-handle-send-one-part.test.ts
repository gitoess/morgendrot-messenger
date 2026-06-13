import { describe, expect, it, vi } from 'vitest'
import { routeChatViewSendOnePart } from '@/frontend/features/send/chat-view-handle-send-one-part'
import { CHAT_ENCRYPTED_MESH_DISABLED_MSG } from '@/frontend/lib/chat-view-messenger-transport'

const ok = { ok: true as const }
const noopStatus = vi.fn()
const noopStatusMsg = vi.fn()

function route(overrides: Partial<Parameters<typeof routeChatViewSendOnePart>[0]>) {
  const tryMailbox = vi.fn(async () => ok)
  const tryPublicChannelMeshSend = vi.fn(async () => ok)
  const tryPrivateKlartextMeshSend = vi.fn(async () => ok)
  const failSend = vi.fn((msg: string) => ({ ok: false as const, msg }))

  return routeChatViewSendOnePart({
    textSnap: 'hello',
    isPrivate: true,
    encrypted: false,
    meshPath4StyleActive: false,
    forcedTransport: 'internet',
    tryMailbox,
    tryPublicChannelMeshSend,
    tryPrivateKlartextMeshSend,
    failSend,
    setStatus: noopStatus,
    setStatusMsg: noopStatusMsg,
    ...overrides,
  }).then((result) => ({
    result,
    tryMailbox,
    tryPublicChannelMeshSend,
    tryPrivateKlartextMeshSend,
    failSend,
  }))
}

describe('routeChatViewSendOnePart', () => {
  it('öffentlicher Kanal + mesh → tryPublicChannelMeshSend', async () => {
    const { result, tryPublicChannelMeshSend } = await route({
      isPrivate: false,
      forcedTransport: 'mesh',
    })
    expect(result).toEqual(ok)
    expect(tryPublicChannelMeshSend).toHaveBeenCalledWith('hello')
  })

  it('öffentlicher Kanal + internet → tryMailbox mit encrypted-Flag', async () => {
    const { tryMailbox } = await route({
      isPrivate: false,
      encrypted: true,
      forcedTransport: 'internet',
    })
    expect(tryMailbox).toHaveBeenCalledWith('hello', true)
  })

  it('privater Klartext + mesh → tryPrivateKlartextMeshSend', async () => {
    const { tryPrivateKlartextMeshSend } = await route({
      isPrivate: true,
      encrypted: false,
      forcedTransport: 'mesh',
    })
    expect(tryPrivateKlartextMeshSend).toHaveBeenCalledWith('hello')
  })

  it('privater Klartext + internet → tryMailbox(false)', async () => {
    const { tryMailbox } = await route({
      isPrivate: true,
      encrypted: false,
      forcedTransport: 'internet',
    })
    expect(tryMailbox).toHaveBeenCalledWith('hello', false)
  })

  it('verschlüsselt + mesh → failSend mit CHAT_ENCRYPTED_MESH_DISABLED_MSG', async () => {
    const { failSend } = await route({
      isPrivate: true,
      encrypted: true,
      forcedTransport: 'mesh',
    })
    expect(failSend).toHaveBeenCalledWith(CHAT_ENCRYPTED_MESH_DISABLED_MSG)
  })

  it('verschlüsselt + internet → tryMailbox(true)', async () => {
    const { tryMailbox } = await route({
      isPrivate: true,
      encrypted: true,
      forcedTransport: 'internet',
    })
    expect(tryMailbox).toHaveBeenCalledWith('hello', true)
  })
})
