import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isKnownPrivateMailboxObjectId,
  isKnownTeamMailboxObjectId,
  resolveDirectMailboxUsePrivateMoveCall,
} from './direct-mailbox-object-kind'

const SERVER = '0x' + '1'.repeat(64)
const TEAM = '0x' + 'f'.repeat(64)
const PRIVATE = '0x' + 'a'.repeat(64)

describe('direct-mailbox-object-kind', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      },
    })
    store['morgendrot.myTeamMailboxes.v1'] = JSON.stringify([{ objectId: TEAM, label: 'Alpha' }])
    store['morgendrot.myPrivateMailboxes.v2'] = JSON.stringify([{ objectId: PRIVATE, label: 'Priv' }])
  })

  it('erkennt Team- und Private-IDs', () => {
    expect(isKnownTeamMailboxObjectId(TEAM)).toBe(true)
    expect(isKnownPrivateMailboxObjectId(PRIVATE)).toBe(true)
    expect(isKnownTeamMailboxObjectId(PRIVATE)).toBe(false)
  })

  it('Team-Postfach nutzt shared Move (nicht *_private)', () => {
    const r = resolveDirectMailboxUsePrivateMoveCall({
      mailboxObjectId: TEAM,
      serverMailboxId: SERVER,
    })
    expect(r.mailboxObjectId).toBe(TEAM)
    expect(r.privateMailbox).toBe(false)
  })

  it('Private-Mailbox nutzt *_private Move', () => {
    const r = resolveDirectMailboxUsePrivateMoveCall({
      mailboxObjectId: PRIVATE,
      serverMailboxId: SERVER,
    })
    expect(r.privateMailbox).toBe(true)
  })

  it('Server-Mailbox ohne Override', () => {
    const r = resolveDirectMailboxUsePrivateMoveCall({ serverMailboxId: SERVER })
    expect(r).toEqual({ mailboxObjectId: SERVER, privateMailbox: false })
  })
})
