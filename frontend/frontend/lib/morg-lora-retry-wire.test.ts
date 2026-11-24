import { describe, expect, it } from 'vitest'
import {
  buildMorgLoraRetryStubMessage,
  parseMorgLoraRetryStub,
} from '@/frontend/lib/morg-lora-retry-wire'

describe('morg-lora-retry-wire', () => {
  it('roundtrip stub', () => {
    const w = buildMorgLoraRetryStubMessage('Peer-ACK ausgeblieben')
    const p = parseMorgLoraRetryStub(w)
    expect(p?.detail).toMatch(/Peer-ACK/)
  })

  it('null ohne Marker', () => {
    expect(parseMorgLoraRetryStub('Hallo')).toBeNull()
  })
})
