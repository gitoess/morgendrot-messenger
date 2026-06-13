import { describe, expect, it } from 'vitest'
import {
  isMeshLoRaImageSendActive,
  isMeshPath4SelfArchiveActive,
} from './mesh-lora-composer-options'
import { isAttachedLoraDualComposerAllowed } from './chat-view-messenger-transport'

describe('mesh-lora-composer-options', () => {
  it('trennt Bild-Funk und Chain-Verankerung', () => {
    expect(
      isMeshLoRaImageSendActive({
        isPrivate: true,
        forcedTransport: 'mesh',
        meshLoRaImagesEnabled: true,
      })
    ).toBe(true)
    expect(
      isMeshPath4SelfArchiveActive({
        isPrivate: true,
        forcedTransport: 'mesh',
        meshSelfArchiveAfterLoRa: false,
      })
    ).toBe(false)
  })

  it('isAttachedLoraDualComposerAllowed nutzt nur Bild-Funk auf mesh', () => {
    expect(
      isAttachedLoraDualComposerAllowed({
        isPrivate: true,
        encrypted: false,
        forcedTransport: 'mesh',
        meshLoRaImagesEnabled: true,
      })
    ).toBe(true)
    expect(
      isAttachedLoraDualComposerAllowed({
        isPrivate: true,
        encrypted: false,
        forcedTransport: 'mesh',
        meshLoRaImagesEnabled: false,
      })
    ).toBe(false)
  })
})
