import { describe, expect, it } from 'vitest'
import {
  deriveBossFunkWizardStatus,
  isLikelyMeshtasticNodeId,
  resolveBossOwnMeshNodeId,
} from '@/frontend/lib/boss-wizard-funk-context'

describe('boss-wizard-funk-context', () => {
  it('findet Node-ID für eigene Adresse case-insensitive', () => {
    const id = resolveBossOwnMeshNodeId('0xABC', {
      '0xabc': { label: 'Boss', meshNodeId: '!deadbeef' },
    })
    expect(id).toBe('!deadbeef')
  })

  it('readyMinimal bei Stick oder Node-ID', () => {
    expect(deriveBossFunkWizardStatus({ connected: true, savedNodeId: '' }).readyMinimal).toBe(true)
    expect(deriveBossFunkWizardStatus({ connected: false, savedNodeId: '!abc' }).readyMinimal).toBe(true)
    expect(deriveBossFunkWizardStatus({ connected: false, savedNodeId: '' }).readyMinimal).toBe(false)
  })

  it('validiert Meshtastic Node-ID Format', () => {
    expect(isLikelyMeshtasticNodeId('!deadbeef')).toBe(true)
    expect(isLikelyMeshtasticNodeId('invalid')).toBe(false)
  })
})
