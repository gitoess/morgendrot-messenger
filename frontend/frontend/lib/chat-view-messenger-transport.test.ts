import { describe, expect, it } from 'vitest'
import {
  CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG,
  CHAT_ENCRYPTED_MESH_DISABLED_MSG,
  CHAT_PATH4_SELF_ARCHIVE_HINT,
  isLoRaMeshTransport,
  MESH_PLAINTEXT_MAX_CHARS,
} from './chat-view-messenger-transport'

describe('chat-view-messenger-transport', () => {
  it('MESH_PLAINTEXT_MAX_CHARS ist dokumentiert klein (LoRa)', () => {
    expect(MESH_PLAINTEXT_MAX_CHARS).toBe(200)
  })

  it('isLoRaMeshTransport nur mesh', () => {
    expect(isLoRaMeshTransport('mesh')).toBe(true)
    expect(isLoRaMeshTransport('internet')).toBe(false)
    expect(isLoRaMeshTransport('adhoc')).toBe(false)
  })

  it('Policy-Texte sind gesetzt', () => {
    expect(CHAT_ENCRYPTED_HANDSHAKE_REQUIRED_MSG.toLowerCase()).toContain('handshake')
    expect(CHAT_ENCRYPTED_MESH_DISABLED_MSG.toLowerCase()).toContain('deaktiviert')
    expect(CHAT_PATH4_SELF_ARCHIVE_HINT.toLowerCase()).toContain('tangle')
  })
})
