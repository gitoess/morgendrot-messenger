import { describe, expect, it } from 'vitest'
import { formatRelativeMinutes } from './format-relative-sync'

describe('formatRelativeMinutes', () => {
  it('formatiert Minuten und Tage lesbar', () => {
    expect(formatRelativeMinutes(0)).toBe('gerade eben')
    expect(formatRelativeMinutes(45)).toBe('vor 45 Min.')
    expect(formatRelativeMinutes(120)).toBe('vor 2 Std.')
    expect(formatRelativeMinutes(4365)).toBe('vor 3 Tagen')
  })
})
