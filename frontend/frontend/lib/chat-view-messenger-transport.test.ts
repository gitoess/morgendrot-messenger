import { describe, expect, it } from 'vitest'
import { isLoRaMeshTransport, MESH_PLAINTEXT_MAX_CHARS } from './chat-view-messenger-transport'

describe('chat-view-messenger-transport', () => {
  it('MESH_PLAINTEXT_MAX_CHARS ist dokumentiert klein (LoRa)', () => {
    expect(MESH_PLAINTEXT_MAX_CHARS).toBe(200)
  })

  it('isLoRaMeshTransport nur mesh', () => {
    expect(isLoRaMeshTransport('mesh')).toBe(true)
    expect(isLoRaMeshTransport('internet')).toBe(false)
    expect(isLoRaMeshTransport('adhoc')).toBe(false)
  })
})
