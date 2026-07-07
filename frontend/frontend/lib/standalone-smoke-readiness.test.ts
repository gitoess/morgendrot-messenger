import { describe, expect, it } from 'vitest'
import { getStandaloneSmokeDeskChecklist } from '@/frontend/lib/standalone-smoke-readiness'

describe('standalone-smoke-readiness', () => {
  it('liefert Checkliste mit Team-Key-Punkt', () => {
    const items = getStandaloneSmokeDeskChecklist()
    expect(items.some((i) => i.id === 'team-broadcast-key')).toBe(true)
    expect(items.some((i) => i.id === 'desk-h15-tests')).toBe(true)
  })
})
