import { describe, expect, it } from 'vitest'
import {
  inboxPackageViewFromFilter,
  isTemporaryInboxPackageView,
  maskPackageIdForUi,
  resolveInboxFetchPackageId,
} from './inbox-package-view'

const A = '0x' + 'a'.repeat(64)
const B = '0x' + 'b'.repeat(64)

describe('inbox-package-view', () => {
  it('canonical wenn Filter leer oder gleich Server', () => {
    expect(inboxPackageViewFromFilter('', A).mode).toBe('canonical')
    expect(inboxPackageViewFromFilter(A, A).mode).toBe('canonical')
  })

  it('temporary wenn Filter von Server abweicht', () => {
    const v = inboxPackageViewFromFilter(B, A)
    expect(v.mode).toBe('temporary')
    expect(isTemporaryInboxPackageView(v)).toBe(true)
    expect(resolveInboxFetchPackageId(v, A)).toBe(B.toLowerCase())
  })

  it('maskPackageIdForUi', () => {
    expect(maskPackageIdForUi(A)).toMatch(/^0xaaaa/)
  })
})
