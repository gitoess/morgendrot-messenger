import { describe, expect, it } from 'vitest'
import {
  canPostToPinnwand,
  getMessengerPinnwandCapabilities,
  isPinnwandBroadcastConfigured,
  messageBelongsToPinnwand,
  showPinnwandChannelTab,
  showPinnwandInboxStrip,
} from './messenger-pinnwand-capabilities'
import type { Message } from '@/frontend/lib/types'

const BOARD = `0x${'a'.repeat(64)}`
const ME = `0x${'b'.repeat(64)}`

const statusWithBoard = {
  broadcastPinnwand: {
    enabled: true,
    address: BOARD,
    myAddressAuthorized: true,
  },
  myAddressFull: ME,
} as const

describe('messenger-pinnwand-capabilities', () => {
  it('erkennt konfigurierte Brett-Adresse', () => {
    expect(isPinnwandBroadcastConfigured(statusWithBoard)).toBe(true)
    expect(isPinnwandBroadcastConfigured({ broadcastPinnwand: { enabled: false } })).toBe(false)
  })

  it('Boss darf posten auch ohne Whitelist-Eintrag', () => {
    expect(
      canPostToPinnwand(
        { broadcastPinnwand: { enabled: true, address: BOARD, myAddressAuthorized: false } },
        'boss'
      )
    ).toBe(true)
  })

  it('Arbeiter: Lagebild-Tab und Streifen im 1:1', () => {
    expect(showPinnwandChannelTab(statusWithBoard, 'arbeiter')).toBe(true)
    expect(showPinnwandInboxStrip(statusWithBoard, 'arbeiter', 'private')).toBe(true)
    expect(showPinnwandInboxStrip(statusWithBoard, 'arbeiter', 'pinnwand')).toBe(false)
  })

  it('Boss: Tab ohne Streifen im 1:1', () => {
    expect(showPinnwandChannelTab(statusWithBoard, 'boss')).toBe(true)
    expect(showPinnwandInboxStrip(statusWithBoard, 'boss', 'private')).toBe(false)
  })

  it('Kommandant: Tab sichtbar', () => {
    expect(showPinnwandChannelTab(statusWithBoard, 'kommandant')).toBe(true)
  })

  it('filtert Posteingang nach Brett-Empfänger', () => {
    const msg: Message = {
      id: '1',
      from: ME,
      recipient: BOARD,
      content: 'Lage',
      timestamp: 1,
    }
    expect(messageBelongsToPinnwand(msg, BOARD)).toBe(true)
    expect(messageBelongsToPinnwand({ ...msg, recipient: ME }, BOARD)).toBe(false)
    expect(messageBelongsToPinnwand({ ...msg, encrypted: true }, BOARD)).toBe(false)
  })

  it('Brett = eigenes Postfach: nur Whitelist oder eigener Post', () => {
    const ctx = { broadcastAddress: ME, myAddress: ME, authorizedSenders: [BOARD] }
    const fromBoard: Message = {
      id: 'b',
      from: BOARD,
      recipient: ME,
      content: 'Lage',
      timestamp: 1,
      encrypted: false,
    }
    const fromStranger: Message = { ...fromBoard, from: `0x${'c'.repeat(64)}` }
    const myPost: Message = { ...fromBoard, from: ME }
    expect(messageBelongsToPinnwand(fromBoard, ctx)).toBe(true)
    expect(messageBelongsToPinnwand(fromStranger, ctx)).toBe(false)
    expect(messageBelongsToPinnwand(myPost, ctx)).toBe(true)
  })

  it('warnt wenn Brett-Adresse = eigene Adresse', () => {
    const caps = getMessengerPinnwandCapabilities(
      {
        broadcastPinnwand: { enabled: true, address: ME, myAddressAuthorized: true },
        myAddressFull: ME,
      },
      'boss',
      'pinnwand'
    )
    expect(caps.broadcastEqualsMyAddress).toBe(true)
  })
})
