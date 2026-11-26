import { describe, expect, it } from 'vitest'
import {
  mainMailboxExplain,
  mainMailboxTitle,
  myMailboxesSettingsBlurb,
  privateMailboxesExplain,
  teamMailboxesExplain,
} from '@/frontend/lib/mailbox-clarity-copy'

describe('mailbox-clarity-copy', () => {
  it('kurze Klarheit-Zeilen (kein Essay)', () => {
    expect(mainMailboxTitle()).toBe('Hauptpostfach')
    expect(mainMailboxExplain()).toMatch(/Shared|MAILBOX_ID/i)
    expect(privateMailboxesExplain()).toMatch(/persönlich|Object-ID/i)
    expect(teamMailboxesExplain(true)).toMatch(/Team-Broadcast/i)
    expect(teamMailboxesExplain(false)).toMatch(/beitreten|einfügen/i)
    expect(myMailboxesSettingsBlurb()).toMatch(/Haupt/i)
  })
})
