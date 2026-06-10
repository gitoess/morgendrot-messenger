import { describe, expect, it } from 'vitest'
import {
  classifyMessagingMailboxMoveType,
  extractPackageIdFromMoveType,
  formatMailboxPackageMismatchError,
} from './mailbox-object-validate'

const PKG_OLD = '0xcf409a0387de039a707d1916afeb16f17a22969a0735e8cfeeaaf5b5fa3d811f'
const PKG_NEW = '0x50750755dda4661e8dfce3a20ab86b32e533673fd7998bd56694a3e7d174d517'
const MB = '0xc0441011c2353d713f54df3bbc3c60c4f373a8ca080d7d1aba951a697f00866e'

describe('mailbox-object-validate', () => {
  it('extractPackageIdFromMoveType', () => {
    expect(extractPackageIdFromMoveType(`${PKG_OLD}::messaging::Mailbox`)).toBe(PKG_OLD.toLowerCase())
  })

  it('classifyMessagingMailboxMoveType', () => {
    expect(classifyMessagingMailboxMoveType(`${PKG_OLD}::messaging::Mailbox`)).toBe('mailbox')
    expect(classifyMessagingMailboxMoveType(`${PKG_OLD}::messaging::PrivateMailbox`)).toBe('privatemailbox')
    expect(classifyMessagingMailboxMoveType('0x2::coin::Coin')).toBe('other')
  })

  it('formatMailboxPackageMismatchError nach Move-Deploy', () => {
    const msg = formatMailboxPackageMismatchError({
      objectId: MB,
      objectPackageId: PKG_OLD,
      expectedPackageId: PKG_NEW,
      objectKind: 'mailbox',
    })
    expect(msg).toContain('gehört zu Package')
    expect(msg).toContain('Move-Deploy')
  })
})
