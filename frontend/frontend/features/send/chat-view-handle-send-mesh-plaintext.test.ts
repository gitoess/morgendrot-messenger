import { describe, expect, it, vi } from 'vitest'
import {
  MESH_BT_NOT_CONNECTED_MSG,
  recordMeshOutgoingPlaintext,
} from '@/frontend/features/send/chat-view-handle-send-mesh-plaintext'

describe('chat-view-handle-send-mesh-plaintext', () => {
  it('recordMeshOutgoingPlaintext schreibt Broadcast-Echo ohne mirrorOnline', () => {
    const append = vi.fn()
    recordMeshOutgoingPlaintext(append, '0x' + 'a'.repeat(64), 'hello mesh', 'broadcast')
    expect(append).toHaveBeenCalledOnce()
    const msg = append.mock.calls[0]![0]!
    expect(msg.recipient).toBe('Meshtastic Broadcast')
    expect(msg.content).toBe('hello mesh')
    expect(msg.encrypted).toBe(false)
    expect(msg.source).toBe('mesh')
    expect(msg.transports).toEqual(['mesh'])
  })

  it('recordMeshOutgoingPlaintext spiegelt Path-4 online in source/transports', () => {
    const append = vi.fn()
    recordMeshOutgoingPlaintext(append, '0x' + 'b'.repeat(64), 'ping', 0x1a2b3c4d, true)
    const msg = append.mock.calls[0]![0]!
    expect(msg.recipient).toMatch(/^mesh:!/)
    expect(msg.source).toBe('mailbox')
    expect(msg.transports).toEqual(['mesh', 'internet'])
  })

  it('recordMeshOutgoingPlaintext no-op ohne append oder Adresse', () => {
    const append = vi.fn()
    recordMeshOutgoingPlaintext(undefined, '0x' + 'c'.repeat(64), 'x', 'broadcast')
    recordMeshOutgoingPlaintext(append, '  ', 'x', 'broadcast')
    expect(append).not.toHaveBeenCalled()
  })

  it('MESH_BT_NOT_CONNECTED_MSG ist stabil für UI und Retry', () => {
    expect(MESH_BT_NOT_CONNECTED_MSG).toContain('Heltec')
  })
})
