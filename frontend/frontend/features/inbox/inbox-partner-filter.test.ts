import { describe, it, expect } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import {
  addressMatchesIdentity,
  filterInboxMessagesByPartnerAndDirection,
  isMessageOutgoing,
  isMessageSelfToSelf,
  messageCounterpartyAddress,
  messagePureInternetInboxRow,
  messageTouchesInternetTransport,
  messageTouchesMeshTransport,
  uniqueCounterpartyAddresses,
  uniqueCounterpartyAddressesWhen,
} from './inbox-partner-filter'

function m(p: Partial<Message> & Pick<Message, 'id' | 'from' | 'content' | 'timestamp'>): Message {
  return {
    encrypted: false,
    ...p,
  }
}

describe('addressMatchesIdentity', () => {
  it('gleiche Adresse nach Normalisierung', () => {
    expect(addressMatchesIdentity(' 0xAbC ', '0xabc')).toBe(true)
  })

  it('maskierte UI-Adresse mit Kopf und Schwanz', () => {
    const full = '0x1234567890abcdef1234567890abcdef12345678'
    const mask = '0x12345678…5678'
    expect(addressMatchesIdentity(full, mask)).toBe(true)
  })

  it('lehnt zu kurze Masken-Teile ab', () => {
    expect(addressMatchesIdentity('0x1234567890abcdef', '0x123…ef')).toBe(false)
  })

  it('leer → false', () => {
    expect(addressMatchesIdentity('', '0x1')).toBe(false)
  })
})

describe('isMessageOutgoing / isMessageSelfToSelf', () => {
  const me = '0x1111111111111111111111111111111111111111'

  it('outgoing wenn from = ich', () => {
    expect(isMessageOutgoing(m({ id: '1', from: me, content: '', timestamp: 1 }), me)).toBe(true)
  })

  it('nicht outgoing wenn from ≠ ich', () => {
    expect(isMessageOutgoing(m({ id: '1', from: '0x2222', content: '', timestamp: 1 }), me)).toBe(false)
  })

  it('self-to-self: from und recipient matchen mich', () => {
    const msg = m({
      id: '1',
      from: me,
      recipient: me,
      content: '',
      timestamp: 1,
    })
    expect(isMessageSelfToSelf(msg, me)).toBe(true)
  })
})

describe('messageCounterpartyAddress', () => {
  const me = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const them = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

  it('bei ausgehend: Empfänger', () => {
    const msg = m({ id: '1', from: me, recipient: them, content: '', timestamp: 1 })
    expect(messageCounterpartyAddress(msg, me)).toBe(them)
  })

  it('bei eingehend: Absender', () => {
    const msg = m({ id: '1', from: them, recipient: me, content: '', timestamp: 1 })
    expect(messageCounterpartyAddress(msg, me)).toBe(them)
  })
})

describe('filterInboxMessagesByPartnerAndDirection', () => {
  const me = '0x1000000000000000000000000000000000000000'
  const alice = '0x2000000000000000000000000000000000000000'
  const bob = '0x3000000000000000000000000000000000000000'

  const incoming = m({ id: 'in', from: alice, recipient: me, content: 'hi', timestamp: 2 })
  const outgoing = m({ id: 'out', from: me, recipient: bob, content: 'yo', timestamp: 3 })

  it('direction in blendet eigene Sendungen aus', () => {
    const r = filterInboxMessagesByPartnerAndDirection([incoming, outgoing], me, null, 'in')
    expect(r.map((x) => x.id)).toEqual(['in'])
  })

  it('direction out nur eigene Sendungen', () => {
    const r = filterInboxMessagesByPartnerAndDirection([incoming, outgoing], me, null, 'out')
    expect(r.map((x) => x.id)).toEqual(['out'])
  })

  it('partner-Filter auf Gegenüber', () => {
    const r = filterInboxMessagesByPartnerAndDirection([incoming, outgoing], me, alice, 'all')
    expect(r).toHaveLength(1)
    expect(r[0]!.id).toBe('in')
  })

  it('groupMemberAddresses: Union aller Mitglieder', () => {
    const bobMsg = m({ id: 'bob', from: bob, recipient: me, content: 'b', timestamp: 4 })
    const r = filterInboxMessagesByPartnerAndDirection([incoming, outgoing, bobMsg], me, null, 'all', {
      groupMemberAddresses: [alice, bob],
    })
    expect(r.map((x) => x.id).sort()).toEqual(['bob', 'in', 'out'])
    const onlyAlice = filterInboxMessagesByPartnerAndDirection([incoming, outgoing, bobMsg], me, null, 'all', {
      groupMemberAddresses: [alice],
    })
    expect(onlyAlice.map((x) => x.id)).toEqual(['in'])
  })

  it('Telegram: Eingang/Ausgang und Partner tg:', () => {
    const tgIn = m({
      id: 'tg-in',
      from: 'tg:99317902',
      recipient: me,
      content: 'hallo',
      timestamp: 10,
      source: 'telegram',
      transports: ['telegram'],
    })
    const tgOut = m({
      id: 'tg-out',
      from: me,
      recipient: 'tg:99317902',
      content: 'antwort',
      timestamp: 11,
      source: 'telegram',
      transports: ['telegram'],
    })
    expect(filterInboxMessagesByPartnerAndDirection([tgIn, tgOut], me, null, 'in').map((x) => x.id)).toEqual([
      'tg-in',
    ])
    expect(filterInboxMessagesByPartnerAndDirection([tgIn, tgOut], me, null, 'out').map((x) => x.id)).toEqual([
      'tg-out',
    ])
    expect(
      filterInboxMessagesByPartnerAndDirection([tgIn, tgOut], me, 'tg:99317902', 'all').map((x) => x.id).sort()
    ).toEqual(['tg-in', 'tg-out'])
  })

  it('eingehende Funk/Mesh (0x) ignoriert Partner- und Richtungsfilter', () => {
    const meshIn = m({
      id: 'mx',
      from: alice,
      content: 'funk',
      timestamp: 5,
      source: 'mesh',
      transports: ['mesh'],
    })
    const withWrongPartner = filterInboxMessagesByPartnerAndDirection([meshIn], me, bob, 'all')
    expect(withWrongPartner.map((x) => x.id)).toEqual(['mx'])
    const outOnly = filterInboxMessagesByPartnerAndDirection([meshIn], me, null, 'out')
    expect(outOnly.map((x) => x.id)).toEqual(['mx'])
  })
})

describe('messageTouchesMeshTransport / messageTouchesInternetTransport', () => {
  it('reiner Mesh-Quelle: mesh ja, internet nein', () => {
    const msg = m({ id: '1', from: 'mesh:1', content: '', timestamp: 1, source: 'mesh' })
    expect(messageTouchesMeshTransport(msg)).toBe(true)
    expect(messageTouchesInternetTransport(msg)).toBe(false)
  })

  it('transports enthält internet: internet ja', () => {
    const msg = m({
      id: '1',
      from: '0x1',
      content: '',
      timestamp: 1,
      source: 'mesh',
      transports: ['mesh', 'internet'],
    })
    expect(messageTouchesInternetTransport(msg)).toBe(true)
  })

  it('Mailbox ohne source: internet ja', () => {
    const msg = m({ id: '1', from: '0x1', content: '', timestamp: 1, source: 'mailbox' })
    expect(messageTouchesMeshTransport(msg)).toBe(false)
    expect(messageTouchesInternetTransport(msg)).toBe(true)
  })
})

describe('messagePureInternetInboxRow', () => {
  it('Mailbox-Zeile ohne Mesh: ja', () => {
    const msg = m({ id: '1', from: '0x1', content: '', timestamp: 1, source: 'mailbox' })
    expect(messagePureInternetInboxRow(msg)).toBe(true)
  })

  it('reiner Mesh: nein', () => {
    const msg = m({ id: '1', from: 'mesh:!1', content: '', timestamp: 1, source: 'mesh' })
    expect(messagePureInternetInboxRow(msg)).toBe(false)
  })

  it('Mesh+Internet in transports: nein (Mesh-Anteil)', () => {
    const msg = m({
      id: '1',
      from: '0x1',
      content: '',
      timestamp: 1,
      source: 'mesh',
      transports: ['mesh', 'internet'],
    })
    expect(messagePureInternetInboxRow(msg)).toBe(false)
  })
})

describe('uniqueCounterpartyAddressesWhen', () => {
  const me = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const p1 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

  it('filtert nach Prädikat', () => {
    const meshOnly = m({
      id: 'm',
      from: p1,
      recipient: me,
      content: '',
      timestamp: 1,
      source: 'mesh',
    })
    const chain = m({
      id: 'c',
      from: p1,
      recipient: me,
      content: '',
      timestamp: 2,
      source: 'mailbox',
    })
    expect(uniqueCounterpartyAddressesWhen([meshOnly, chain], me, messageTouchesMeshTransport)).toEqual([p1])
    expect(uniqueCounterpartyAddressesWhen([meshOnly, chain], me, messageTouchesInternetTransport)).toEqual([p1])
  })
})

describe('uniqueCounterpartyAddresses', () => {
  const me = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const p1 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const p2 = '0xcccccccccccccccccccccccccccccccccccccccc'

  it('sammelt eindeutig und sortiert', () => {
    const messages = [
      m({ id: '1', from: p1, recipient: me, content: '', timestamp: 1 }),
      m({ id: '2', from: p1, recipient: me, content: '', timestamp: 2 }),
      m({ id: '3', from: me, recipient: p2, content: '', timestamp: 3 }),
    ]
    const u = uniqueCounterpartyAddresses(messages, me)
    expect(u).toEqual([p1, p2].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())))
  })
})
