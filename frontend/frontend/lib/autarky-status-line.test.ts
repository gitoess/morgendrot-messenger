import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  getAutarkyStatusLine,
  getDirectIotaHeaderStatusLine,
  isAutarkyModeEnabled,
} from './autarky-status-line'

describe('autarky-status-line', () => {
  const store: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
      } as Storage,
    } as Window & typeof globalThis)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('aus wenn Autarkie-Modus aus', () => {
    expect(isAutarkyModeEnabled()).toBe(false)
    expect(getAutarkyStatusLine()).toBeNull()
  })

  it('nennt erstes offenes Item', () => {
    store['morgendrot.autarkyMode'] = '1'
    const line = getAutarkyStatusLine()
    expect(line).toMatch(/Autarkie: noch offen/)
  })

  it('Header ohne Autarkie: nennt erste Lücke oder Anzahl', () => {
    const line = getDirectIotaHeaderStatusLine()
    expect(line).toMatch(/Direkt:/)
    expect(line).toMatch(/Puls/)
  })
})
