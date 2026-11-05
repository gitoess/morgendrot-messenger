import { beforeEach, describe, expect, it } from 'vitest'
import type { PackageProfile } from '@/frontend/lib/package-profile'
import { API_BASE_OVERRIDE_KEY } from '@/frontend/lib/api/api-base'
import { applyPackageProfile, planProfileApplication } from '@/frontend/lib/package-profile-apply'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)

function profile(over: Partial<PackageProfile> & { id: string; label: string }): PackageProfile {
  return {
    bundled: false,
    readOnly: false,
    resolved: Boolean(over.packageId && over.mailboxId),
    ...over,
  }
}

describe('planProfileApplication (H.24b P1b-Rest)', () => {
  it('plant apiBaseUrl, wenn vorhanden', () => {
    const plan = planProfileApplication(
      profile({ id: 'a', label: 'A', packageId: PKG, mailboxId: MB, apiBaseUrl: 'http://127.0.0.1:3342' })
    )
    expect(plan.apiBaseUrl).toBe('http://127.0.0.1:3342')
    expect(plan.warnings).toEqual([])
  })

  it('warnt bei fehlendem apiBase und fehlenden IDs', () => {
    const plan = planProfileApplication(profile({ id: 'a', label: 'A' }))
    expect(plan.apiBaseUrl).toBeUndefined()
    expect(plan.warnings.length).toBe(2)
  })
})

describe('applyPackageProfile (H.24b P1b-Rest)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('setzt API_BASE-Override, wenn apiBaseUrl vorhanden', () => {
    const res = applyPackageProfile(
      profile({ id: 'a', label: 'A', packageId: PKG, mailboxId: MB, apiBaseUrl: 'http://192.168.0.10:3342' })
    )
    expect(res.apiBaseApplied).toBe('http://192.168.0.10:3342')
    expect(window.localStorage.getItem(API_BASE_OVERRIDE_KEY)).toBe('http://192.168.0.10:3342')
  })

  it('überspringt Override, wenn applyApiBase=false', () => {
    const res = applyPackageProfile(
      profile({ id: 'a', label: 'A', packageId: PKG, mailboxId: MB, apiBaseUrl: 'http://192.168.0.10:3342' }),
      { applyApiBase: false }
    )
    expect(res.apiBaseSkipped).toBe(true)
    expect(res.apiBaseApplied).toBeUndefined()
    expect(window.localStorage.getItem(API_BASE_OVERRIDE_KEY)).toBeNull()
  })

  it('ohne apiBaseUrl: kein Override, Warnung vorhanden', () => {
    const res = applyPackageProfile(profile({ id: 'a', label: 'A', packageId: PKG, mailboxId: MB }))
    expect(res.apiBaseApplied).toBeUndefined()
    expect(window.localStorage.getItem(API_BASE_OVERRIDE_KEY)).toBeNull()
    expect(res.warnings.length).toBeGreaterThanOrEqual(1)
  })
})
