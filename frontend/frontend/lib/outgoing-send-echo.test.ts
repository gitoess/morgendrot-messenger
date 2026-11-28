import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearOutgoingSendEchoForTests,
  lookupOutgoingSendEcho,
  rememberOutgoingSendEcho,
} from '@/frontend/lib/outgoing-send-echo'

const PEER = '0x' + 'ab'.repeat(32)

describe('outgoing-send-echo', () => {
  beforeEach(() => {
    clearOutgoingSendEchoForTests()
  })

  it('merkt Klartext unter Nonce und findet ihn wieder', () => {
    rememberOutgoingSendEcho({
      peerAddress: PEER,
      nonce: '1795789953734',
      plaintext: 'VISITENKARTE\nich',
    })
    expect(lookupOutgoingSendEcho(PEER, '1795789953734')).toBe('VISITENKARTE\nich')
    expect(lookupOutgoingSendEcho('0x' + '00'.repeat(32), '1795789953734')).toBe(
      'VISITENKARTE\nich'
    )
  })
})
