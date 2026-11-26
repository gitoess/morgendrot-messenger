import { describe, expect, it } from 'vitest'
import {
  mainMailboxExplain,
  mainMailboxTitle,
  myMailboxesSettingsBlurb,
  privateMailboxesExplain,
  teamMailboxesExplain,
} from '@/frontend/lib/mailbox-clarity-copy'

describe('mailbox-clarity-copy', () => {
  it('Titel bleibt; Erklärtexte UI-leer (Handbuch)', () => {
    expect(mainMailboxTitle()).toBe('Hauptpostfach')
    expect(mainMailboxExplain()).toBe('')
    expect(myMailboxesSettingsBlurb()).toBe('')
    expect(privateMailboxesExplain()).toBe('')
    expect(teamMailboxesExplain(false)).toBe('')
    expect(teamMailboxesExplain(true)).toBe('')
  })
})
