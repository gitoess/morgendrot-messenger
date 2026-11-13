import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  buildContactInfoSections,
  buildGroupInfoSections,
  buildNftInfoSections,
  buildSelfInfoSections,
  buildTelegramAlarmInfoSections,
} from '@/frontend/lib/messenger-entity-info-model'
import {
  writeTeamBroadcastKeyRaw,
  clearTeamBroadcastKeysForTests,
} from '@/frontend/lib/team-broadcast-key-store'

const MB = `0x${'ab'.repeat(32)}`
const WALLET = `0x${'cd'.repeat(32)}`

describe('messenger-entity-info-model', () => {
  beforeEach(() => {
    clearTeamBroadcastKeysForTests?.()
  })
  afterEach(() => {
    clearTeamBroadcastKeysForTests?.()
    vi.restoreAllMocks()
  })

  it('buildContactInfoSections: Wallet + Mailbox-Slots, keine leeren Felder', () => {
    const sections = buildContactInfoSections({
      address: WALLET,
      entry: {
        label: 'Ada',
        mailboxPrivateId: MB,
        telegramChatId: '12345',
      },
      packageId: `0x${'11'.repeat(32)}`,
    })
    const ids = sections.flatMap((s) => s.fields.map((f) => f.id))
    expect(ids).toContain('wallet')
    expect(ids).toContain('tg')
    expect(ids).toContain('mb-private')
    expect(ids).toContain('package')
    expect(sections.every((s) => s.fields.every((f) => f.value.trim()))).toBe(true)
  })

  it('buildGroupInfoSections: Team-Key nur Status, kein Base64', () => {
    writeTeamBroadcastKeyRaw(MB, new Uint8Array(32).fill(7))
    const sections = buildGroupInfoSections({
      group: {
        id: 'g1',
        name: 'Alpha',
        memberAddresses: [WALLET],
        teamMailboxObjectId: MB,
        useTeamBroadcast: true,
      },
    })
    const teamKey = sections.flatMap((s) => s.fields).find((f) => f.id === 'team-key')
    expect(teamKey?.value).toMatch(/hinterlegt/)
    expect(teamKey?.copyable).toBe(false)
    expect(JSON.stringify(sections)).not.toMatch(/keyBase64/)
    expect(sections.some((s) => s.id === 'members')).toBe(true)
  })

  it('buildTelegramAlarmInfoSections: Token nur maskiert', () => {
    const sections = buildTelegramAlarmInfoSections({
      membership: {
        inviteLink: 'https://t.me/+x',
        groupChatId: '-1001',
        label: 'Alarm',
        confirmedAtMs: 1,
      },
      integration: {
        enabled: true,
        botTokenConfigured: true,
        botTokenMasked: '123:…abcd',
        botUserId: '99',
        adminChatId: '1',
        einsatzGroupChatId: '-1001',
        einsatzGroupLabel: 'Alarm',
        einsatzGroupInviteLink: 'https://t.me/+x',
        einsatzGroupAlarmEnabled: true,
        inboundMode: 'longPoll',
        relayBaseUrl: 'http://127.0.0.1:8787',
      },
    })
    const token = sections.flatMap((s) => s.fields).find((f) => f.id === 'bot-token')
    expect(token?.value).toBe('123:…abcd')
    expect(JSON.stringify(sections)).not.toMatch(/botToken[^M]/)
  })

  it('buildNftInfoSections + buildSelfInfoSections', () => {
    const nft = buildNftInfoSections({
      objectId: MB,
      digest: 'dig',
      packageId: `0x${'22'.repeat(32)}`,
      keycardBound: true,
      vaultObjectId: `0x${'33'.repeat(32)}`,
      vaultKind: 'guarded',
      leaseObjectId: `0x${'44'.repeat(32)}`,
      objectExplorerHref: 'https://explorer.example/object',
      vaultExplorerHref: 'https://explorer.example/vault',
      leaseExplorerHref: 'https://explorer.example/lease',
    })
    expect(nft[0]?.fields.map((f) => f.id)).toEqual(
      expect.arrayContaining(['oid', 'tx', 'package', 'keycard', 'vault', 'lease'])
    )
    expect(nft[0]?.fields.find((f) => f.id === 'oid')?.href).toBe('https://explorer.example/object')
    expect(nft[0]?.fields.find((f) => f.id === 'vault')?.href).toBe('https://explorer.example/vault')
    const self = buildSelfInfoSections({
      myAddress: WALLET,
      serverMailboxId: MB,
      packageId: `0x${'22'.repeat(32)}`,
    })
    expect(self.some((s) => s.id === 'mailboxes')).toBe(true)
    expect(self.flatMap((s) => s.fields).some((f) => f.id === 'wallet')).toBe(true)
  })
})
