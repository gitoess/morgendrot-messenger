import { describe, it, expect } from 'vitest'
import { getComposerMailboxRecipientHint } from '@/frontend/lib/composer-mailbox-recipient-hint'

const WALLET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const TEAM_MB = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const OTHER_MB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

describe('getComposerMailboxRecipientHint', () => {
  it('kein Hinweis ohne Composer-Mailbox', () => {
    expect(
      getComposerMailboxRecipientHint({
        recipientAddress: WALLET,
        composerMailboxObjectId: '',
        contactDirectory: { [WALLET]: { label: 'T', mailboxTeamId: TEAM_MB } },
      }).show
    ).toBe(false)
  })

  it('kein Hinweis wenn ID zum Kontakt-Slot passt', () => {
    expect(
      getComposerMailboxRecipientHint({
        recipientAddress: WALLET,
        composerMailboxObjectId: TEAM_MB,
        contactDirectory: { [WALLET]: { label: 'T', mailboxTeamId: TEAM_MB } },
      }).show
    ).toBe(false)
  })

  it('Mismatch wenn ID nicht in Telefonbuch-Slots', () => {
    const h = getComposerMailboxRecipientHint({
      recipientAddress: WALLET,
      composerMailboxObjectId: OTHER_MB,
      contactDirectory: { [WALLET]: { label: 'T', mailboxTeamId: TEAM_MB } },
    })
    expect(h.show).toBe(true)
    if (h.show) expect(h.tone).toBe('mismatch')
  })

  it('unknown wenn Kontakt fehlt', () => {
    const h = getComposerMailboxRecipientHint({
      recipientAddress: WALLET,
      composerMailboxObjectId: OTHER_MB,
      contactDirectory: {},
    })
    expect(h.show).toBe(true)
    if (h.show) expect(h.tone).toBe('unknown')
  })
})
