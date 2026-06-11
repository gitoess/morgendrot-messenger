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

  it('Brett = eigenes Postfach: nur Marker (nicht Ausgang/An mich ohne Marker)', () => {
    const ctx = { broadcastAddress: ME, myAddress: ME, boardSameAsMy: true, authorizedSenders: [BOARD] }
    const fromBoard: Message = {
      id: 'b',
      from: BOARD,
      recipient: ME,
      content: 'Lage',
      timestamp: 1,
      encrypted: false,
    }
    const fromStranger: Message = { ...fromBoard, from: `0x${'c'.repeat(64)}` }
    const selfToSelf: Message = { ...fromBoard, from: ME, content: 'pi3' }
    const marked: Message = { ...fromBoard, content: '[[MORG_PINNWAND_V1]]Lage' }
    const selfMarked: Message = { ...selfToSelf, content: '[[MORG_PINNWAND_V1]]pi3' }
    expect(messageBelongsToPinnwand(fromBoard, ctx)).toBe(false)
    expect(messageBelongsToPinnwand(marked, ctx)).toBe(true)
    expect(messageBelongsToPinnwand(fromStranger, ctx)).toBe(false)
    expect(messageBelongsToPinnwand(selfToSelf, ctx)).toBe(false)
    expect(messageBelongsToPinnwand(selfMarked, ctx)).toBe(true)
  })

  it('Brett = MY_ADDRESS: fremder 1:1-Klartext ohne Marker zählt nicht', () => {
    const ctx = { broadcastAddress: ME, myAddress: ME, boardSameAsMy: true, authorizedSenders: [BOARD] }
    const dm: Message = {
      id: 'dm',
      from: BOARD,
      recipient: ME,
      content: 'Hallo privat',
      timestamp: 1,
      encrypted: false,
    }
    expect(messageBelongsToPinnwand(dm, ctx)).toBe(false)
  })

  it('Brett = MY_ADDRESS: mit Marker zählt', () => {
    const ctx = { broadcastAddress: ME, myAddress: ME, boardSameAsMy: true }
    const msg: Message = {
      id: 'p',
      from: BOARD,
      recipient: ME,
      content: '[[MORG_PINNWAND_V1]]Einsatz-Update',
      timestamp: 1,
      encrypted: false,
    }
    expect(messageBelongsToPinnwand(msg, ctx)).toBe(true)
  })

  it('Brett = MY: pinnwandPost-Flag zählt auch ohne Marker im Anzeige-Text', () => {
    const ctx = { broadcastAddress: ME, myAddress: ME, boardSameAsMy: true }
    const msg: Message = {
      id: 'p2',
      from: ME,
      recipient: ME,
      content: 'Einsatz-Update',
      pinnwandPost: true,
      timestamp: 1,
      encrypted: false,
    }
    expect(messageBelongsToPinnwand(msg, ctx)).toBe(true)
  })

  it('Brett in Whitelist = Wallet: Klartext ohne Marker zählt nicht', () => {
    const USER = `0x${'6'.repeat(64)}`
    const ctx = {
      broadcastAddress: USER,
      authorizedSenders: [USER],
    }
    const self: Message = {
      id: 's',
      from: USER,
      recipient: USER,
      content: 'pi3',
      timestamp: 1,
      encrypted: false,
    }
    const marked: Message = { ...self, content: '[[MORG_PINNWAND_V1]]Lage' }
    expect(messageBelongsToPinnwand(self, ctx)).toBe(false)
    expect(messageBelongsToPinnwand(marked, ctx)).toBe(true)
  })

  it('Brett = MY (nur myAddress im Kontext): Whitelist-1:1 ohne Marker zählt nicht', () => {
    const USER = `0x${'6'.repeat(64)}`
    const ctx = {
      broadcastAddress: USER,
      myAddress: USER,
      authorizedSenders: [BOARD],
    }
    const dm: Message = {
      id: 'dm',
      from: BOARD,
      recipient: USER,
      content: 'privat',
      timestamp: 1,
      encrypted: false,
    }
    expect(messageBelongsToPinnwand(dm, ctx)).toBe(false)
    expect(
      messageBelongsToPinnwand({ ...dm, content: '[[MORG_PINNWAND_V1]]Update' }, ctx)
    ).toBe(true)
  })

  it('Brett = MY ohne Marker: eingehende 1:1 zählt nicht (requiresPinnwandMarker)', () => {
    const ctx = {
      broadcastAddress: ME,
      myAddress: ME,
      boardSameAsMy: true,
      requiresPinnwandMarker: true,
      authorizedSenders: [ME],
    }
    const dm: Message = {
      id: 'in',
      from: BOARD,
      recipient: ME,
      content: 'privat',
      timestamp: 1,
      encrypted: false,
    }
    expect(messageBelongsToPinnwand(dm, ctx)).toBe(false)
  })

  it('Separates Brett: Klartext an Brett-Adresse zählt', () => {
    const ctx = { broadcastAddress: BOARD, myAddress: ME, authorizedSenders: [ME] }
    const msg: Message = {
      id: '1',
      from: ME,
      recipient: BOARD,
      content: 'Lage',
      timestamp: 1,
      encrypted: false,
    }
    expect(messageBelongsToPinnwand(msg, ctx)).toBe(true)
  })

  it('Team-Broadcast ist keine Pinnwand', () => {
    const msg: Message = {
      id: 't',
      from: ME,
      recipient: BOARD,
      content: 'team',
      timestamp: 1,
      encrypted: false,
      chainPurgeKind: 'team-broadcast',
    }
    expect(messageBelongsToPinnwand(msg, BOARD)).toBe(false)
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
