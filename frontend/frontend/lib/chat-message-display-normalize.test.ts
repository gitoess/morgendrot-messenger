import { describe, it, expect } from 'vitest'
import { MORG_DELAY_MIRROR_V1 } from '@/frontend/features/send/mesh-delayed-upload'
import {
  normalizeChatMessageContentForDisplay,
  formatSosVisibleContent,
} from '@/frontend/lib/chat-message-display-normalize'
import { wrapCompactImageMessage } from '@/frontend/lib/compact-image-wire'
import { prependMorgEmergencyV1Marker } from '@/frontend/lib/morg-emergency-v1-text'
import { buildMorgSosAckV1Wire } from '@/frontend/lib/morg-sos-ack-wire'

const HELLO_B64 = 'SGVsbG8='

describe('normalizeChatMessageContentForDisplay', () => {
  it('lässt reinen Text unverändert', () => {
    expect(normalizeChatMessageContentForDisplay('Hallo Welt')).toBe('Hallo Welt')
  })

  it('entfernt Delay-Mirror-Zeile am Anfang', () => {
    const raw = `${MORG_DELAY_MIRROR_V1}\nNachricht`
    expect(normalizeChatMessageContentForDisplay(raw)).toBe('Nachricht')
  })

  it('mappt SOS-Marker auf [SOS]-Präfix', () => {
    const w = prependMorgEmergencyV1Marker('Brauche Hilfe', 'text')
    expect(normalizeChatMessageContentForDisplay(w)).toBe('[SOS] Brauche Hilfe')
  })

  it('Delay-Mirror dann SOS', () => {
    const inner = prependMorgEmergencyV1Marker('X', 'text')
    const raw = `${MORG_DELAY_MIRROR_V1}\n${inner}`
    expect(normalizeChatMessageContentForDisplay(raw)).toBe('[SOS] X')
  })

  it('lässt MORG_COMPACT_IMG_V1-Wire intakt (Chunk-/Bildanzeige)', () => {
    const wire = wrapCompactImageMessage(HELLO_B64, 'Legende')
    expect(normalizeChatMessageContentForDisplay(wire)).toBe(wire)
    expect(wire.startsWith('[[MORG_COMPACT_IMG_V1:')).toBe(true)
  })

  it('lässt MF1-Mesh-Fragment-Header intakt', () => {
    const mf1 = '[[MF1:mid=ab12|i=0|n=2|dGVzdA==]]'
    expect(normalizeChatMessageContentForDisplay(mf1)).toBe(mf1)
  })

  it('lässt LUMA/CHROMA-Marker intakt', () => {
    const luma = '[[MORG_LUMA_V1:msgId=deadbeef|len=4|ABCD]]'
    expect(normalizeChatMessageContentForDisplay(luma)).toBe(luma)
  })

  it('SOS nur Marker ohne Body', () => {
    const only = prependMorgEmergencyV1Marker('', 'text')
    expect(normalizeChatMessageContentForDisplay(only)).toBe('[SOS]')
  })

  it('mappt MORG_SOS_ACK_V1 auf [SOS-Bestätigung · …letzte8]', () => {
    const d = 'a'.repeat(64)
    const w = buildMorgSosAckV1Wire(d)
    expect(normalizeChatMessageContentForDisplay(w)).toBe('[SOS-Bestätigung · …aaaaaaaa]')
  })
})

describe('formatSosVisibleContent', () => {
  it('ändert Nicht-SOS nicht', () => {
    expect(formatSosVisibleContent('normal')).toBe('normal')
  })
})
