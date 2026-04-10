import { describe, it, expect } from 'vitest'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel, lookupContactEntry } from './contact-display'

function entry(label: string): ContactMeshEntryClient {
  return { label }
}

describe('lookupContactEntry', () => {
  it('findet Key case-insensitive', () => {
    const directory: Record<string, ContactMeshEntryClient> = {
      '0xabcdef': entry('Alice'),
    }
    expect(lookupContactEntry(directory, '0xABCDEF')?.label).toBe('Alice')
  })

  it('leerer address → undefined', () => {
    expect(lookupContactEntry({}, '  ')).toBeUndefined()
  })
})

describe('contactDisplayLabel', () => {
  it('liefert getrimmtes Label oder null', () => {
    const directory: Record<string, ContactMeshEntryClient> = {
      '0xaa': entry('  Bob  '),
    }
    expect(contactDisplayLabel(directory, '0xaa')).toBe('Bob')
    expect(contactDisplayLabel(directory, '0xunknown')).toBeNull()
  })

  it('leeres Label im Eintrag → null', () => {
    const directory: Record<string, ContactMeshEntryClient> = {
      '0xaa': entry('   '),
    }
    expect(contactDisplayLabel(directory, '0xaa')).toBeNull()
  })
})
