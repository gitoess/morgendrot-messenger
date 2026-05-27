import { describe, expect, it } from 'vitest'
import {
  describeRoleIdBits,
  roleIdHasBit,
  setRoleIdBit,
} from './handoff-role-id-bits'

describe('handoff-role-id-bits', () => {
  it('Standard Helfer ROLE_ID 14', () => {
    expect(describeRoleIdBits(14)).toBe('BW+L+S')
    expect(roleIdHasBit(14, 'S')).toBe(true)
    expect(roleIdHasBit(14, 'D')).toBe(false)
  })

  it('Reporter: S aus, L an', () => {
    const reporter = setRoleIdBit(14, 'S', false)
    expect(reporter).toBe(12)
    expect(describeRoleIdBits(reporter)).toBe('BW+L')
  })

  it('toggle S auf 4 ergibt 6 (L+S)', () => {
    expect(setRoleIdBit(4, 'S', true)).toBe(6)
  })
})
