import { describe, expect, it } from 'vitest'
import type { Message } from './types'
import {
  addressMatchesIdentity,
  filterInboxMessagesByPartnerAndDirection,
  isMessageOutgoing,
  isMessageSelfToSelf,
  messageCounterpartyAddress,
  uniqueCounterpartyAddresses,
} from './inbox-partner-filter'

const ME = `0x${'a'.repeat(64)}`
const PEER = `0x${'b'.repeat(64)}`
const PEER2 = `0x${'c'.repeat(64)}`

function msg(p: Partial<Message> & Pick<Message, 'id' | 'content' | 'timestamp'>): Message {
  return {
    from: '',
    ...p,
  }
}

describe('addressMatchesIdentity', () => {
  it('exakt (case/trim)', () => {
    expect(addressMatchesIdentity(ME, `  ${ME.toUpperCase()}  `)).toBe(true)
  })

  it('maskierte UI-Adresse mit …', () => {
    const head = ME.slice(0, 10)
    const tail = ME.slice(-4)
    const masked = `${head}…${tail}`
    expect(addressMatchesIdentity(ME, masked)).toBe(true)
  })

  it('zu kurze Maske → false', () => {
    expect(addressMatchesIdentity(ME, '0x…aaaa')).toBe(false)
  })

  it('ohne Ellipse nur exakt', () => {
    expect(addressMatchesIdentity(ME, PEER)).toBe(false)
    expect(addressMatchesIdentity(ME, ME.slice(0, 20))).toBe(false)
  })

  it('leer → false', () => {
    expect(addressMatchesIdentity('', ME)).toBe(false)
    expect(addressMatchesIdentity(ME, '')).toBe(false)
  })
})

describe('isMessageOutgoing / isMessageSelfToSelf', () => {
  it('outgoing wenn from = ich', () => {
    expect(isMessageOutgoing(msg({ id: '1', from: ME, content: '', timestamp: 0 }), ME)).toBe(true)
  })

  it('incoming wenn from = Gegenüber', () => {
    expect(isMessageOutgoing(msg({ id: '1', from: PEER, content: '', timestamp: 0 }), ME)).toBe(false)
  })

  it('self-to-self', () => {
    const m = msg({ id: '1', from: ME, recipient: ME, content: '', timestamp: 0 })
    expect(isMessageSelfToSelf(m, ME)).toBe(true)
  })

  it('self-to-self nicht outgoing-only', () => {
    const m = msg({ id: '1', from: ME, recipient: ME, content: '', timestamp: 0 })
    expect(isMessageOutgoing(m, ME)).toBe(true)
    expect(isMessageSelfToSelf(m, ME)).toBe(true)
  })
})

describe('messageCounterpartyAddress', () => {
  it('outgoing → recipient', () => {
    expect(
      messageCounterpartyAddress(
        msg({ id: '1', from: ME, recipient: PEER, content: '', timestamp: 0 }),
        ME,
      ),
    ).toBe(PEER)
  })

  it('incoming → from', () => {
    expect(
      messageCounterpartyAddress(
        msg({ id: '1', from: PEER, recipient: ME, content: '', timestamp: 0 }),
        ME,
      ),
    ).toBe(PEER)
  })

  it('ohne myAddress → null', () => {
    expect(messageCounterpartyAddress(msg({ id: '1', from: PEER, content: '', timestamp: 0 }), '')).toBeNull()
  })
})

describe('filterInboxMessagesByPartnerAndDirection', () => {
  const incoming = msg({ id: 'i', from: PEER, recipient: ME, content: '', timestamp: 1 })
  const outgoing = msg({ id: 'o', from: ME, recipient: PEER, content: '', timestamp: 2 })
  const selfLoop = msg({ id: 's', from: ME, recipient: ME, content: '', timestamp: 3 })
  const list = [incoming, outgoing, selfLoop]

  it('direction in', () => {
    const r = filterInboxMessagesByPartnerAndDirection(list, ME, null, 'in')
    expect(r.map((m) => m.id).sort()).toEqual(['i', 's'])
  })

  it('direction out', () => {
    const r = filterInboxMessagesByPartnerAndDirection(list, ME, null, 'out')
    expect(r.map((m) => m.id).sort()).toEqual(['o', 's'])
  })

  it('partner filter PEER: Thread ohne Selbst-an-selbst', () => {
    const r = filterInboxMessagesByPartnerAndDirection(list, ME, PEER, 'all')
    expect(r.map((m) => m.id).sort()).toEqual(['i', 'o'])
  })

  it('partner filter fremder Kontakt: leer (Selbst-an-selbst nur im eigenen Thread)', () => {
    const r = filterInboxMessagesByPartnerAndDirection(list, ME, PEER2, 'all')
    expect(r.map((m) => m.id)).toEqual([])
  })

  it('partner filter eigene Adresse: nur Selbst-an-selbst', () => {
    const r = filterInboxMessagesByPartnerAndDirection(list, ME, ME, 'all')
    expect(r.map((m) => m.id)).toEqual(['s'])
  })
})

describe('uniqueCounterpartyAddresses', () => {
  it('dedup + sort', () => {
    const m1 = msg({ id: '1', from: PEER, recipient: ME, content: '', timestamp: 0 })
    const m2 = msg({ id: '2', from: ME, recipient: PEER.toUpperCase(), content: '', timestamp: 0 })
    const m3 = msg({ id: '3', from: PEER2, recipient: ME, content: '', timestamp: 0 })
    const r = uniqueCounterpartyAddresses([m1, m2, m3], ME)
    expect(r).toEqual([PEER, PEER2])
  })
})
