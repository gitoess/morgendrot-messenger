import { describe, expect, it } from 'vitest'
import type { TangleInventoryItem } from '@/frontend/lib/tangle-inventory'
import {
  canRecoverTangleInventoryText,
  isTangleInventoryUserMessage,
  tangleInventoryOriginLabel,
} from '@/frontend/lib/tangle-inventory'

describe('isTangleInventoryUserMessage', () => {
  const base: TangleInventoryItem = {
    id: '1',
    digest: '0xabc',
    timestamp: 1,
    type: 'text',
    status: 'anchored',
  }

  it('includes mailbox and path4', () => {
    expect(isTangleInventoryUserMessage({ ...base, origin: 'mailbox' })).toBe(true)
    expect(isTangleInventoryUserMessage({ ...base, origin: 'path4' })).toBe(true)
  })

  it('excludes anchor and relay', () => {
    expect(isTangleInventoryUserMessage({ ...base, origin: 'anchor', type: 'protocol-hash' })).toBe(false)
    expect(isTangleInventoryUserMessage({ ...base, origin: 'relay' })).toBe(false)
  })
})

describe('canRecoverTangleInventoryText', () => {
  const base: TangleInventoryItem = {
    id: '1',
    digest: '0xabc',
    timestamp: 1,
    type: 'text',
    status: 'anchored',
  }

  it('blocks protocol anchors', () => {
    expect(canRecoverTangleInventoryText({ ...base, origin: 'anchor' })).toBe(false)
  })

  it('blocks relay without nonce', () => {
    expect(canRecoverTangleInventoryText({ ...base, origin: 'relay' })).toBe(false)
    expect(canRecoverTangleInventoryText({ ...base, origin: 'relay', nonce: '1' })).toBe(true)
  })
})

describe('tangleInventoryOriginLabel', () => {
  it('labels path4', () => {
    expect(tangleInventoryOriginLabel('path4')).toContain('Pfad 4')
  })
})
