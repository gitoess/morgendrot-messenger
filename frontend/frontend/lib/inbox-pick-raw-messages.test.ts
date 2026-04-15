import { describe, expect, it } from 'vitest'
import { pickInboxRawMessages } from './inbox-pick-raw-messages'

describe('pickInboxRawMessages', () => {
  it('prefers non-empty data over messages', () => {
    expect(pickInboxRawMessages({ data: [{ a: 1 }], messages: [{ b: 2 }] })).toEqual([{ a: 1 }])
  })

  it('falls back to messages when data empty', () => {
    expect(pickInboxRawMessages({ data: [], messages: [{ x: 1 }] })).toEqual([{ x: 1 }])
  })

  it('returns empty array when data is empty array and messages missing', () => {
    expect(pickInboxRawMessages({ data: [] })).toEqual([])
  })

  it('returns undefined when neither side is a useful array', () => {
    expect(pickInboxRawMessages({ data: {}, messages: null })).toBeUndefined()
  })
})
