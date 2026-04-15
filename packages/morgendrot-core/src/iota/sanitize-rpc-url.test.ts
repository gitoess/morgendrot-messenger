import { describe, expect, it } from 'vitest'
import { sanitizeDirectIotaRpcUrl } from './sanitize-rpc-url'

describe('sanitizeDirectIotaRpcUrl', () => {
  it('accepts https origin', () => {
    expect(sanitizeDirectIotaRpcUrl('  https://api.testnet.iota.cafe  ')).toBe('https://api.testnet.iota.cafe')
  })

  it('preserves path without trailing slash', () => {
    expect(sanitizeDirectIotaRpcUrl('https://example.com/rpc/')).toBe('https://example.com/rpc')
  })

  it('rejects non-http(s)', () => {
    expect(() => sanitizeDirectIotaRpcUrl('ftp://x')).toThrow(/http/)
  })

  it('rejects empty', () => {
    expect(() => sanitizeDirectIotaRpcUrl('  ')).toThrow(/fehlt/)
  })

  it('rejects userinfo', () => {
    expect(() => sanitizeDirectIotaRpcUrl('https://user:pass@api.testnet.iota.cafe')).toThrow(/Credentials/)
  })
})
