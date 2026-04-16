import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildMorgEmergencyV1MarkerJson,
  plaintextStartsWithMorgEmergencyV1,
  prependMorgEmergencyV1Marker,
  stripLeadingMorgEmergencyV1Marker,
} from './morg-emergency-v1-text'

describe('MORG_EMERGENCY_V1 Text (Browser)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2020-06-15T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('buildMorgEmergencyV1MarkerJson: text vs voice + ts', () => {
    expect(buildMorgEmergencyV1MarkerJson('text')).toBe(
      '[[MORG_EMERGENCY_V1:{"v":1,"k":"t","ts":1592222400000}]]',
    )
    expect(buildMorgEmergencyV1MarkerJson('voice')).toBe(
      '[[MORG_EMERGENCY_V1:{"v":1,"k":"v","ts":1592222400000}]]',
    )
  })

  it('prepend: leer nur Marker; sonst Zeilenumbruch', () => {
    const head =
      '[[MORG_EMERGENCY_V1:{"v":1,"k":"t","ts":1592222400000}]]'
    expect(prependMorgEmergencyV1Marker('', 'text')).toBe(head)
    expect(prependMorgEmergencyV1Marker('Hallo', 'text')).toBe(`${head}\nHallo`)
  })

  it('stripLeading: kein Präfix', () => {
    expect(stripLeadingMorgEmergencyV1Marker('normal')).toEqual({
      emergency: false,
      body: 'normal',
    })
  })

  it('stripLeading: Präfix ohne schließendes ]] → nicht als Emergency', () => {
    const bad = '[[MORG_EMERGENCY_V1:{"v":1,"k":"t"}'
    expect(stripLeadingMorgEmergencyV1Marker(`${bad} Rest`)).toEqual({
      emergency: false,
      body: `${bad} Rest`,
    })
  })

  it('stripLeading: gültig text + Body', () => {
    const wrapped =
      '[[MORG_EMERGENCY_V1:{"v":1,"k":"t","ts":1}]]\nZeile'
    expect(stripLeadingMorgEmergencyV1Marker(wrapped)).toEqual({
      emergency: true,
      kind: 'text',
      body: 'Zeile',
    })
  })

  it('stripLeading: gültig voice, Body ohne extra Zeilenumbruch', () => {
    const wrapped = '[[MORG_EMERGENCY_V1:{"v":1,"k":"v","ts":0}]]body'
    expect(stripLeadingMorgEmergencyV1Marker(wrapped)).toEqual({
      emergency: true,
      kind: 'voice',
      body: 'body',
    })
  })

  it('stripLeading: JSON ungültig → emergency ohne kind', () => {
    const wrapped = '[[MORG_EMERGENCY_V1:not-json]]x'
    expect(stripLeadingMorgEmergencyV1Marker(wrapped)).toEqual({
      emergency: true,
      kind: undefined,
      body: 'x',
    })
  })

  it('plaintextStartsWithMorgEmergencyV1', () => {
    expect(plaintextStartsWithMorgEmergencyV1('[[MORG_EMERGENCY_V1:')).toBe(true)
    expect(plaintextStartsWithMorgEmergencyV1('other')).toBe(false)
  })
})
