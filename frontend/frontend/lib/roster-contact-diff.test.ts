import { describe, expect, it } from 'vitest'
import { computeRosterContactDiff, rosterDiffHeadline } from './roster-contact-diff'

const ADDR = '0x' + 'b'.repeat(64)

describe('computeRosterContactDiff', () => {
  it('markiert neuen Kontakt', () => {
    const d = computeRosterContactDiff(undefined, {
      address: ADDR,
      name: 'Anna',
      meshNodeId: '!abc123',
    })
    expect(d.status).toBe('new')
    expect(d.fields.some((f) => f.key === 'label' && f.after === 'Anna')).toBe(true)
    expect(d.fields.some((f) => f.key === 'meshNodeId')).toBe(true)
  })

  it('erkennt Konflikt bei abweichendem Funk-Knoten', () => {
    const d = computeRosterContactDiff(
      { label: 'Anna', meshNodeId: '!oldnode' },
      { address: ADDR, name: 'Anna', meshNodeId: '!newnode' }
    )
    expect(d.status).toBe('conflict')
    expect(rosterDiffHeadline(d)).toBe('Konflikt — prüfen')
  })

  it('erkennt Update bei neuem Telegram-Feld', () => {
    const d = computeRosterContactDiff(
      { label: 'Anna' },
      { address: ADDR, name: 'Anna', telegramChatId: '-100123' }
    )
    expect(d.status).toBe('update')
  })
})
