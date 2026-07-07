import { describe, expect, it } from 'vitest'
import {
  hasAnyNetworkDeployIds,
  hasNetworkDeployPackageId,
} from '@/frontend/components/onboarding/boss-network-deploy-ids-panel'

describe('boss-network-deploy-ids-panel helpers', () => {
  it('detects valid package ids', () => {
    const id = '0x' + 'a'.repeat(64)
    expect(hasNetworkDeployPackageId({ packageId: id })).toBe(true)
    expect(hasNetworkDeployPackageId({ packageId: '0xshort' })).toBe(false)
  })

  it('returns true when either network has a package', () => {
    const id = '0x' + 'b'.repeat(64)
    expect(hasAnyNetworkDeployIds(undefined, { packageId: id })).toBe(true)
    expect(hasAnyNetworkDeployIds({}, {})).toBe(false)
  })
})
