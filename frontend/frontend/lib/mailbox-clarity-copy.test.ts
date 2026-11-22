import { describe, expect, it } from 'vitest'
import {
  mainMailboxExplain,
  mainMailboxTitle,
  myMailboxesSettingsBlurb,
  privateMailboxesExplain,
  teamMailboxesExplain,
} from '@/frontend/lib/mailbox-clarity-copy'

describe('mailbox-clarity-copy', () => {
  it('Hauptpostfach ohne Einsatz-Pflichtwort im Titel', () => {
    expect(mainMailboxTitle()).toBe('Hauptpostfach')
    expect(mainMailboxExplain().toLowerCase()).not.toContain('einsatz-haupt')
    expect(mainMailboxExplain()).toMatch(/Composer/i)
  })

  it('Settings-Blurb trennt Lesen und Schreiben', () => {
    const b = myMailboxesSettingsBlurb()
    expect(b).toMatch(/Lesen/i)
    expect(b).toMatch(/Schreiben/i)
  })

  it('Privat/Team erklären optional', () => {
    expect(privateMailboxesExplain()).toMatch(/Optional/i)
    expect(teamMailboxesExplain(false)).toMatch(/ID\/QR/i)
    expect(teamMailboxesExplain(true)).toMatch(/Erstellen/i)
  })
})
