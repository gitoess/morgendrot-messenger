import { describe, expect, it } from 'vitest'
import { resolveDeploymentProfileTheme, roleDisplayDe } from '@/frontend/lib/deployment-profile-theme'
import { formatActiveProfileTitle } from '@/frontend/lib/active-profile-display'

describe('deployment-profile-theme', () => {
  it('erkennt THW aus Bezeichnung', () => {
    const t = resolveDeploymentProfileTheme({
      handoffLabel: 'THW Einsatz Süd',
      role: 'arbeiter',
      deploymentProfile: 'einsatz',
    })
    expect(t.id).toBe('thw')
    expect(t.watermark).toBe('THW')
  })

  it('erkennt Polizei BW', () => {
    const t = resolveDeploymentProfileTheme({
      handoffLabel: 'Polizei BW Übung',
      role: 'kommandant',
      deploymentProfile: 'einsatz',
    })
    expect(t.id).toBe('polizei')
  })

  it('Wanderer über Label', () => {
    expect(
      resolveDeploymentProfileTheme({
        handoffLabel: 'Wanderer Alpen',
        role: 'messenger',
        deploymentProfile: 'consumer',
      }).id
    ).toBe('wanderer')
  })

  it('roleDisplayDe', () => {
    expect(roleDisplayDe('arbeiter')).toBe('Arbeiter')
    expect(roleDisplayDe('messenger')).toBe('Helfer')
  })
})

describe('formatActiveProfileTitle', () => {
  it('Bezeichnung + Rolle', () => {
    expect(
      formatActiveProfileTitle({
        handoffLabel: 'THW Einsatz Süd',
        role: 'arbeiter',
        deploymentProfile: 'einsatz',
      })
    ).toBe('THW Einsatz Süd – Arbeiter')
  })
})
