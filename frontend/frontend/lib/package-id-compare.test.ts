import { describe, expect, it } from 'vitest'
import { normalizePackageIdHex, shouldShowPackageIdMismatchBanner } from './package-id-compare'

const A = `0x${'a'.repeat(64)}`
const B = `0x${'b'.repeat(64)}`

describe('normalizePackageIdHex', () => {
  it('undefined / leer nach trim → null', () => {
    expect(normalizePackageIdHex(undefined)).toBeNull()
  })

  it('trim + lower', () => {
    const upper = `0x${'A'.repeat(64)}`
    expect(normalizePackageIdHex(`  ${upper}  `)).toBe(A)
  })

  it('gültige 64-Hex-ID', () => {
    expect(normalizePackageIdHex(A)).toBe(A)
  })

  it('ungültig: zu kurz, falsches Präfix, Nicht-Hex', () => {
    expect(normalizePackageIdHex(`0x${'c'.repeat(63)}`)).toBeNull()
    expect(normalizePackageIdHex(`1x${'c'.repeat(64)}`)).toBeNull()
    expect(normalizePackageIdHex(`0x${'g'.repeat(64)}`)).toBeNull()
    expect(normalizePackageIdHex('')).toBeNull()
    expect(normalizePackageIdHex('   ')).toBeNull()
  })
})

describe('shouldShowPackageIdMismatchBanner', () => {
  it('Basis offline → kein Banner', () => {
    expect(shouldShowPackageIdMismatchBanner(A, B, true)).toBe(false)
  })

  it('keine Server-ID → kein Banner', () => {
    expect(shouldShowPackageIdMismatchBanner(A, undefined, false)).toBe(false)
    expect(shouldShowPackageIdMismatchBanner(A, 'not-hex', false)).toBe(false)
  })

  it('lokales Feld leer/keine gültige ID → kein Banner', () => {
    expect(shouldShowPackageIdMismatchBanner('', A, false)).toBe(false)
    expect(shouldShowPackageIdMismatchBanner('  ', A, false)).toBe(false)
    expect(shouldShowPackageIdMismatchBanner(`0x${'c'.repeat(63)}`, A, false)).toBe(false)
  })

  it('gleiche ID → kein Banner', () => {
    expect(shouldShowPackageIdMismatchBanner(A, A, false)).toBe(false)
    expect(shouldShowPackageIdMismatchBanner(`  ${A.toUpperCase()}  `, A, false)).toBe(false)
  })

  it('zwei gültige, unterschiedliche IDs → Banner', () => {
    expect(shouldShowPackageIdMismatchBanner(A, B, false)).toBe(true)
  })
})
