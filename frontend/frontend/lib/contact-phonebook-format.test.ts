import { describe, expect, it } from 'vitest'
import {
  normalizeContactRoleTags,
  parseContactRoleTagsCsv,
  formatContactRoleTagsCsv,
} from './contact-phonebook-format'

describe('contact-phonebook-format roleTags', () => {
  it('normalisiert und dedupliziert', () => {
    expect(normalizeContactRoleTags(['Medic', 'medic', ' THW '])).toEqual(['Medic', 'THW'])
  })

  it('parst CSV', () => {
    expect(parseContactRoleTagsCsv('Medic; THW, Medic')).toEqual(['Medic', 'THW'])
  })

  it('formatiert zurück', () => {
    expect(formatContactRoleTagsCsv(['Medic', 'THW'])).toBe('Medic, THW')
  })
})
