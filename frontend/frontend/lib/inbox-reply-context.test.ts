import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import {
  resolveReplyContextFromInboxMessage,
  type InboxReplyResolveCtx,
} from '@/frontend/lib/inbox-reply-context'

const ME = '0x' + '1'.repeat(64)
const PEER = '0x' + '2'.repeat(64)
const TEAM_MB = '0x' + '3'.repeat(64)
const BOARD = '0x' + '4'.repeat(64)

function msg(partial: Partial<Message> & Pick<Message, 'id'>): Message {
  return {
    from: PEER,
    content: 'Hallo Team',
    timestamp: 1_700_000_000_000,
    ...partial,
  }
}

function ctx(overrides: Partial<InboxReplyResolveCtx> = {}): InboxReplyResolveCtx {
  return {
    myAddress: ME,
    contactDirectory: {},
    pinnwandBoardAddress: BOARD,
    activeGroup: {
      id: 'grp-a',
      name: 'Einsatz Alpha',
      memberAddresses: [PEER],
      teamMailboxObjectId: TEAM_MB,
      secondaryChannel: { channelIndex: 2 },
    },
    ...overrides,
  }
}

vi.mock('@/frontend/lib/messenger-group-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/frontend/lib/messenger-group-store')>()
  return {
    ...actual,
    readMessengerGroups: vi.fn(() => [
      {
        id: 'grp-store',
        name: 'Aus Store',
        memberAddresses: [PEER],
        teamMailboxObjectId: TEAM_MB,
      },
    ]),
    writeActiveGroupId: vi.fn(),
  }
})

describe('resolveReplyContextFromInboxMessage (H.32a)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('eingehende 1:1 Mailbox → private + internet + Absender', () => {
    const r = resolveReplyContextFromInboxMessage(
      msg({
        id: 'in-1',
        from: PEER,
        recipient: ME,
        transports: ['internet'],
        encrypted: false,
      }),
      ctx()
    )
    expect(r?.kind).toBe('single')
    if (r?.kind !== 'single') return
    expect(r.variant.channel).toBe('private')
    expect(r.variant.forcedTransport).toBe('internet')
    expect(r.variant.recipient).toBe(PEER)
    expect(r.variant.encrypted).toBe(false)
  })

  it('ausgehende 1:1 → Antwort an Empfänger der Zeile', () => {
    const r = resolveReplyContextFromInboxMessage(
      msg({
        id: 'out-1',
        from: ME,
        recipient: PEER,
        transports: ['internet'],
        encrypted: true,
      }),
      ctx()
    )
    expect(r?.kind).toBe('single')
    if (r?.kind !== 'single') return
    expect(r.variant.recipient).toBe(PEER)
    expect(r.variant.encrypted).toBe(true)
  })

  it('Team-Broadcast → Gruppe + Team-Mailbox', () => {
    const r = resolveReplyContextFromInboxMessage(
      msg({
        id: 'team-1',
        from: PEER,
        recipient: TEAM_MB,
        dedupKey: 'team:broadcast:1',
        chainPurgeKind: 'team-broadcast',
        transports: ['internet'],
      }),
      ctx()
    )
    expect(r?.kind).toBe('single')
    if (r?.kind !== 'single') return
    expect(r.variant.channel).toBe('group')
    expect(r.variant.composerMailboxObjectId).toBe(TEAM_MB)
    expect(r.variant.encrypted).toBe(false)
  })

  it('Mesh-Eingang → Funk + Node aus meshMeta', () => {
    const r = resolveReplyContextFromInboxMessage(
      msg({
        id: 'mesh-1',
        from: 'mesh:!deadbeef',
        source: 'mesh',
        transports: ['mesh'],
        meshMeta: { kind: 'text', fromNodeNum: 0xdeadbeef },
      }),
      ctx()
    )
    expect(r?.kind).toBe('single')
    if (r?.kind !== 'single') return
    expect(r.variant.forcedTransport).toBe('mesh')
    expect(r.variant.meshNodeId).toBe('!deadbeef')
    expect(r.variant.encrypted).toBe(false)
  })

  it('Telegram-Journal → private + telegram + tg:-Empfänger', () => {
    const r = resolveReplyContextFromInboxMessage(
      msg({
        id: 'tg-1',
        from: 'tg:99317902',
        recipient: ME,
        source: 'telegram',
        transports: ['telegram'],
      }),
      ctx()
    )
    expect(r?.kind).toBe('single')
    if (r?.kind !== 'single') return
    expect(r.variant.composerDelivery).toBe('telegram')
    expect(r.variant.recipient).toBe('tg:99317902')
  })

  it('Pinnwand-Post → pinnwand + internet + Brett-Adresse', () => {
    const r = resolveReplyContextFromInboxMessage(
      msg({
        id: 'pin-1',
        from: PEER,
        recipient: BOARD,
        pinnwandPost: true,
        transports: ['internet'],
      }),
      ctx()
    )
    expect(r?.kind).toBe('single')
    if (r?.kind !== 'single') return
    expect(r.variant.channel).toBe('pinnwand')
    expect(r.variant.recipient).toBe(BOARD)
  })

  it('Mesh+IOTA-Dedup → Auswahl zwischen Online und Funk', () => {
    const r = resolveReplyContextFromInboxMessage(
      msg({
        id: 'dedup-1',
        from: PEER,
        recipient: ME,
        transports: ['internet', 'mesh'],
        meshMeta: { kind: 'text', fromNodeNum: 0x42 },
      }),
      ctx()
    )
    expect(r?.kind).toBe('choice')
    if (r?.kind !== 'choice') return
    expect(r.variants).toHaveLength(2)
    expect(r.variants.map((v) => v.id).sort()).toEqual(['internet-1:1', 'mesh'])
  })
})
