import { beforeEach, describe, it, expect } from 'vitest'
import {
  readContactMailboxSlots,
  defaultContactSendSlot,
  resolveContactMailboxSlotObjectId,
  resolveContactMailboxSlots,
  readContactSendMailboxTarget,
  writeContactSendMailboxTarget,
  writeProfileContactMailboxSlotOverride,
  slotsToSavePayload,
} from '@/frontend/lib/contact-mailbox-slots'
import { writeRegistryState } from '@/frontend/lib/package-profile-registry'

const MB = '0x' + 'a'.repeat(64)
const MB2 = '0x' + 'b'.repeat(64)
const WALLET = '0x' + 'c'.repeat(64)

describe('contact-mailbox-slots', () => {
  beforeEach(() => {
    window.localStorage.clear()
    writeRegistryState({ userProfiles: [] })
  })

  it('maps legacy mailboxObjectId to private slot', () => {
    const s = readContactMailboxSlots({ label: 'X', mailboxObjectId: MB })
    expect(s.private).toBe(MB)
  })

  it('reads all four slots', () => {
    const s = readContactMailboxSlots({
      label: 'Y',
      mailboxSharedId: MB,
      mailboxPrivateId: MB2,
      mailboxTeamId: MB,
      mailboxBufferId: MB2,
    })
    expect(s.shared).toBe(MB)
    expect(s.private).toBe(MB2)
    expect(s.team).toBe(MB)
    expect(s.buffer).toBe(MB2)
  })

  it('defaultContactSendSlot prefers private', () => {
    expect(defaultContactSendSlot({ label: 'Z', mailboxTeamId: MB, mailboxPrivateId: MB2 })).toBe('private')
  })

  it('resolveContactMailboxSlotObjectId', () => {
    const e = { label: 'A', mailboxBufferId: MB2 }
    expect(resolveContactMailboxSlotObjectId(e, 'buffer')).toBe(MB2)
  })

  it('slotsToSavePayload sets mailboxObjectId from private', () => {
    const p = slotsToSavePayload({
      mailboxSharedId: '',
      mailboxPrivateId: MB,
      mailboxTeamId: '',
      mailboxBufferId: '',
    })
    expect(p.mailboxPrivateId).toBe(MB)
    expect(p.mailboxObjectId).toBe(MB)
  })

  it('Profil-Override überschreibt Telefonbuch-Slots (H.24b)', () => {
    writeRegistryState({ activeProfileId: 'training', userProfiles: [] })
    writeProfileContactMailboxSlotOverride(WALLET, { private: MB2 })
    const merged = resolveContactMailboxSlots(WALLET, { label: 'P', mailboxPrivateId: MB })
    expect(merged.private).toBe(MB2)
  })

  it('Send-Slot-Präferenz ist pro Einsatzprofil getrennt', () => {
    writeRegistryState({ activeProfileId: 'a', userProfiles: [] })
    writeContactSendMailboxTarget(WALLET, 'private')
    expect(readContactSendMailboxTarget(WALLET)).toBe('private')

    writeRegistryState({ activeProfileId: 'b', userProfiles: [] })
    expect(readContactSendMailboxTarget(WALLET)).toBeUndefined()

    writeContactSendMailboxTarget(WALLET, 'team')
    writeRegistryState({ activeProfileId: 'a', userProfiles: [] })
    expect(readContactSendMailboxTarget(WALLET)).toBe('private')
    writeRegistryState({ activeProfileId: 'b', userProfiles: [] })
    expect(readContactSendMailboxTarget(WALLET)).toBe('team')
  })
})
