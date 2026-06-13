import { prependMailboxOutNonceMarker } from '@morgendrot/core/queue/offline-mailbox'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessengerGroupDefinition } from '@/frontend/lib/messenger-group-store'
import {
  applyGroupOptimisticInboxMerge,
  attemptGroupTeamBroadcast,
  buildGroupTeamBroadcastOptimisticRows,
  getGroupSendPreSendError,
  groupTeamBroadcastWireSuccessMessage,
  inboxReloadDelaysMs,
  publishGroupStreamsAnchorAfterSend,
  resolveSingleWireSuccessMessage,
  stripMailboxOutNonceFromPayload,
} from '@/frontend/features/send/chat-view-handle-send-group'
import { GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG } from '@/frontend/lib/group-team-broadcast'

const MB = '0x' + 'a'.repeat(64)

const group: MessengerGroupDefinition = {
  id: 'g1',
  name: 'Test',
  memberAddresses: ['0x' + 'b'.repeat(64)],
  teamMailboxObjectId: MB,
  streamsAnchorId: 'anchor-1',
}

vi.mock('@/frontend/lib/mailbox-send-hybrid', () => ({
  sendTeamPlaintextBroadcastHybrid: vi.fn(),
}))

vi.mock('@/frontend/lib/api/streams', () => ({
  publishStreamsAnchor: vi.fn(),
}))

vi.mock('@/frontend/lib/group-mailbox-pairwise-send', () => ({
  readGroupMailboxSendAll: vi.fn(() => true),
}))

import { sendTeamPlaintextBroadcastHybrid } from '@/frontend/lib/mailbox-send-hybrid'
import { publishStreamsAnchor } from '@/frontend/lib/api/streams'

describe('chat-view-handle-send-group', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stripMailboxOutNonceFromPayload entfernt Out-Nonce-Marker', () => {
    const body = 'hello'
    const marked = prependMailboxOutNonceMarker(body, 123n)
    expect(stripMailboxOutNonceFromPayload(marked)).toBe(body)
    expect(stripMailboxOutNonceFromPayload(body)).toBe(body)
  })

  it('getGroupSendPreSendError blockiert verschlüsselt auf Internet-Chain', () => {
    expect(
      getGroupSendPreSendError({
        isGroupChannel: true,
        messagingPersistenceMode: 'mailbox',
        forcedTransport: 'internet',
        encrypted: true,
        activeGroup: group,
      })
    ).toBe(GROUP_ENCRYPTED_TEAM_BROADCAST_PENDING_MSG)
  })

  it('getGroupSendPreSendError ignoriert Nicht-Gruppen-Chain', () => {
    expect(
      getGroupSendPreSendError({
        isGroupChannel: false,
        messagingPersistenceMode: 'mailbox',
        forcedTransport: 'internet',
        encrypted: true,
        activeGroup: group,
      })
    ).toBeNull()
  })

  it('resolveSingleWireSuccessMessage nur für team-broadcast', () => {
    expect(resolveSingleWireSuccessMessage(true, 'team-broadcast')).toBe(
      groupTeamBroadcastWireSuccessMessage()
    )
    expect(resolveSingleWireSuccessMessage(true, 'pairwise')).toBeNull()
    expect(resolveSingleWireSuccessMessage(false, 'team-broadcast')).toBeNull()
  })

  it('inboxReloadDelaysMs gestaffelt für Gruppen', () => {
    expect(inboxReloadDelaysMs(true)).toEqual([1200, 4000, 9000])
    expect(inboxReloadDelaysMs(false)).toEqual([1200])
  })

  it('publishGroupStreamsAnchorAfterSend ruft publishStreamsAnchor auf', () => {
    publishGroupStreamsAnchorAfterSend({
      isGroupChannel: true,
      activeGroup: group,
      myAddress: '0x' + 'c'.repeat(64),
      textSnap: 'Hallo Team',
      toAddr: MB,
      multicast: true,
    })
    expect(publishStreamsAnchor).toHaveBeenCalledWith(
      'anchor-1',
      expect.objectContaining({
        type: 'group_message',
        groupId: 'g1',
        to: '@group:g1',
        preview: expect.stringContaining('[team-broadcast]'),
      })
    )
  })

  it('attemptGroupTeamBroadcast liefert success bei ok Hybrid-Send', async () => {
    vi.mocked(sendTeamPlaintextBroadcastHybrid).mockResolvedValue({
      ok: true,
      txDigest: '0xdigest',
    })
    const res = await attemptGroupTeamBroadcast({
      textSnap: 'ping',
      encrypted: false,
      activeGroup: group,
      isGroupChannel: true,
      messagingPersistenceMode: 'mailbox',
      forcedTransport: 'internet',
    })
    expect(res.kind).toBe('success')
    if (res.kind === 'success') {
      expect(res.mailboxCapture.payloadUtf8).toBe('ping')
      expect(res.mailboxCapture.txDigest).toBe('0xdigest')
      expect(res.teamMailboxObjectId).toBe(MB.toLowerCase())
    }
  })

  it('attemptGroupTeamBroadcast liefert failure bei Hybrid-Fehler', async () => {
    vi.mocked(sendTeamPlaintextBroadcastHybrid).mockResolvedValue({
      ok: false,
      error: 'package mismatch',
    })
    const res = await attemptGroupTeamBroadcast({
      textSnap: 'ping',
      encrypted: false,
      activeGroup: group,
      isGroupChannel: true,
      messagingPersistenceMode: 'mailbox',
      forcedTransport: 'internet',
    })
    expect(res).toEqual({
      kind: 'failure',
      message: expect.stringContaining('package mismatch'),
    })
  })

  it('buildGroupTeamBroadcastOptimisticRows nur für Gruppen-Mailbox-Internet', () => {
    const rows = buildGroupTeamBroadcastOptimisticRows({
      isGroupChannel: true,
      messagingPersistenceMode: 'mailbox',
      forcedTransport: 'internet',
      myAddress: '0x' + 'c'.repeat(64),
      activeGroup: group,
      mailboxCapture: {
        payloadUtf8: 'Hallo',
        messageNonceU64: 42n,
        encrypted: false,
      },
      previewFallback: '',
    })
    expect(rows.length).toBeGreaterThan(0)
    expect(
      buildGroupTeamBroadcastOptimisticRows({
        isGroupChannel: true,
        messagingPersistenceMode: 'mailbox',
        forcedTransport: 'mesh',
        myAddress: '0x' + 'c'.repeat(64),
        activeGroup: group,
        mailboxCapture: {
          payloadUtf8: 'Hallo',
          messageNonceU64: 42n,
          encrypted: false,
        },
        previewFallback: '',
      })
    ).toEqual([])
  })

  it('applyGroupOptimisticInboxMerge hängt Zeilen an', () => {
    const prev = [{ id: '1', text: 'alt' } as never]
    const next = [{ id: '2', text: 'neu' } as never]
    const merged = applyGroupOptimisticInboxMerge(prev, next)
    expect(merged.length).toBeGreaterThan(prev.length)
  })
})
