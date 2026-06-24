import { describe, expect, it } from 'vitest'
import { isBossLanApiBase } from './is-boss-lan-api-base'

describe('isBossLanApiBase', () => {
  it('erkennt localhost und RFC1918', () => {
    expect(isBossLanApiBase('http://127.0.0.1:3342')).toBe(true)
    expect(isBossLanApiBase('http://localhost:3342')).toBe(true)
    expect(isBossLanApiBase('http://192.168.1.50:3342')).toBe(true)
    expect(isBossLanApiBase('http://10.0.0.5:3342')).toBe(true)
    expect(isBossLanApiBase('http://172.16.0.1:3342')).toBe(true)
  })

  it('lehnt öffentliche Hosts ab', () => {
    expect(isBossLanApiBase('https://api.example.com')).toBe(false)
    expect(isBossLanApiBase('')).toBe(false)
  })
})
