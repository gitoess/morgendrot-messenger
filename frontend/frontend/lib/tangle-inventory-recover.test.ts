import { describe, expect, it } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import {
  chainNoncesMatch,
  findLocalMessageByChainNonce,
  trimTangleContentPreview,
} from '@/frontend/lib/tangle-inventory-recover'

describe('chainNoncesMatch', () => {
  it('matches equal strings and bigint forms', () => {
    expect(chainNoncesMatch('42', '42')).toBe(true)
    expect(chainNoncesMatch('42', '42n')).toBe(false)
    expect(chainNoncesMatch('1740000000000', '1740000000000')).toBe(true)
  })

  it('rejects empty', () => {
    expect(chainNoncesMatch('', '1')).toBe(false)
  })
})

describe('findLocalMessageByChainNonce', () => {
  const messages: Message[] = [
    { id: 'a', from: '0x1', content: 'Hallo', timestamp: 1, chainNonce: '99' },
    { id: 'b', from: '0x2', content: 'Welt', timestamp: 2, chainNonce: '1740000000000' },
  ]

  it('finds by nonce', () => {
    expect(findLocalMessageByChainNonce(messages, '99')?.content).toBe('Hallo')
    expect(findLocalMessageByChainNonce(messages, '1740000000000')?.content).toBe('Welt')
  })

  it('returns undefined when missing', () => {
    expect(findLocalMessageByChainNonce(messages, '1')).toBeUndefined()
    expect(findLocalMessageByChainNonce(undefined, '1')).toBeUndefined()
  })
})

describe('trimTangleContentPreview', () => {
  it('truncates long text', () => {
    const long = 'x'.repeat(3000)
    expect(trimTangleContentPreview(long).endsWith('…')).toBe(true)
    expect(trimTangleContentPreview(' kurz ')).toBe('kurz')
  })
})
