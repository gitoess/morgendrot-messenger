import { describe, expect, it } from 'vitest'
import {
  contactHandshakeBadgeKind,
  contactHandshakeBadgeLabel,
  isContactHandshakeReady,
  resolveContactHandshakeStatus,
} from '@/frontend/lib/contact-handshake-ui'

const peer = '0x' + 'a'.repeat(64)

describe('contact-handshake-ui', () => {
  it('markiert verbundene Adressen als ready', () => {
    const status = resolveContactHandshakeStatus({
      address: peer,
      connectedAddresses: [peer],
    })
    expect(status).toBe('ready')
    expect(isContactHandshakeReady(status)).toBe(true)
    expect(contactHandshakeBadgeKind(status)).toBe('ready')
    expect(contactHandshakeBadgeLabel('ready')).toBe('Handshake')
  })

  it('liefert none für ungültige Adresse', () => {
    expect(contactHandshakeBadgeKind(resolveContactHandshakeStatus({
      address: 'invalid',
      connectedAddresses: [],
    }))).toBe('none')
  })

  it('zeigt needs_action ohne Verbindung', () => {
    const status = resolveContactHandshakeStatus({
      address: peer,
      connectedAddresses: [],
    })
    expect(contactHandshakeBadgeKind(status)).toBe('needs_action')
    expect(contactHandshakeBadgeLabel('needs_action')).toBe('Handshake nötig')
  })
})
