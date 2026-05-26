import { describe, expect, it } from 'vitest'
import {
  canCreateTeamMailbox,
  canEditEinsatzRoleTemplates,
  canViewEinsatzRoleTemplatesSection,
} from '@/frontend/lib/messenger-role-capabilities'
import type { ApiStatus } from '@/frontend/lib/api/status'

const base: ApiStatus = {
  backendRunning: true,
  backendOnline: true,
  role: 'messenger',
  deploymentProfile: 'consumer',
  permissions: { teamManage: true, configChange: true },
}

describe('canCreateTeamMailbox', () => {
  it('denies consumer even when permissions.teamManage is true', () => {
    expect(canCreateTeamMailbox(base)).toBe(false)
  })

  it('allows einsatz kommandant with teamManage', () => {
    expect(
      canCreateTeamMailbox({
        ...base,
        deploymentProfile: 'einsatz',
        role: 'kommandant',
        permissions: { teamManage: true },
      })
    ).toBe(true)
  })

  it('denies einsatz arbeiter without teamManage', () => {
    expect(
      canCreateTeamMailbox({
        ...base,
        deploymentProfile: 'einsatz',
        role: 'arbeiter',
        permissions: { teamManage: false },
      })
    ).toBe(false)
  })
})

describe('canViewEinsatzRoleTemplatesSection', () => {
  it('hidden for consumer', () => {
    expect(canViewEinsatzRoleTemplatesSection({ ...base, role: 'boss' })).toBe(false)
  })

  it('visible for einsatz kommandant', () => {
    expect(
      canViewEinsatzRoleTemplatesSection({
        ...base,
        deploymentProfile: 'einsatz',
        role: 'kommandant',
      })
    ).toBe(true)
  })
})

describe('canEditEinsatzRoleTemplates', () => {
  it('kommandant can view section but not save', () => {
    expect(
      canEditEinsatzRoleTemplates({
        ...base,
        deploymentProfile: 'einsatz',
        role: 'kommandant',
        permissions: { configChange: false, teamManage: true },
      })
    ).toBe(false)
  })

  it('boss with configChange can save', () => {
    expect(
      canEditEinsatzRoleTemplates({
        ...base,
        deploymentProfile: 'einsatz',
        role: 'boss',
        permissions: { configChange: true, teamManage: true },
      })
    ).toBe(true)
  })
})
