import { describe, expect, it } from 'vitest'
import { isMailboxMsgMissingPurgeError } from '@/frontend/lib/direct-iota-purge-message'

describe('isMailboxMsgMissingPurgeError', () => {
  it('erkennt Abort 10 / 43', () => {
    expect(
      isMailboxMsgMissingPurgeError(
        "Error in 1st command, from '0x06…::messaging::purge_message_on_uid' (instruction 22), abort code: 10"
      )
    ).toBe(true)
    expect(isMailboxMsgMissingPurgeError('abort code: 43')).toBe(true)
    expect(isMailboxMsgMissingPurgeError('insufficient gas')).toBe(false)
  })
})
