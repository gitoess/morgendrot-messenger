/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type http from 'node:http'
import {
  denyForensicBatchMutate,
  forensicApiTokenFromRequest,
  isForensicApiTokenValid,
  isLoopbackApiClient,
} from './forensic-batch-api-auth.js'

const sendJson = vi.fn()

function mockReq(opts?: {
  ip?: string
  headers?: Record<string, string>
}): http.IncomingMessage {
  return {
    socket: { remoteAddress: opts?.ip ?? '127.0.0.1' },
    headers: opts?.headers ?? {},
  } as http.IncomingMessage
}

function mockRes(): http.ServerResponse {
  return {} as http.ServerResponse
}

describe('forensic-batch-api-auth', () => {
  beforeEach(() => {
    sendJson.mockReset()
    vi.stubEnv('FORENSIC_BATCH_API_TOKEN', '')
    vi.stubEnv('FORENSIC_BATCH_API_LOOPBACK_ONLY', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('extracts token from custom header and bearer', () => {
    expect(
      forensicApiTokenFromRequest(
        mockReq({ headers: { 'x-morgendrot-forensic-token': 'secret-abc' } })
      )
    ).toBe('secret-abc')
    expect(
      forensicApiTokenFromRequest(mockReq({ headers: { authorization: 'Bearer tok-xyz' } }))
    ).toBe('tok-xyz')
  })

  it('detects loopback clients', () => {
    expect(isLoopbackApiClient(mockReq({ ip: '127.0.0.1' }))).toBe(true)
    expect(isLoopbackApiClient(mockReq({ ip: '::1' }))).toBe(true)
    expect(isLoopbackApiClient(mockReq({ ip: '192.168.1.5' }))).toBe(false)
  })

  it('denies mutate when vault locked', async () => {
    const { CFG } = await import('../../config.js')
    CFG.FORENSIC_BATCH_API_TOKEN = ''
    CFG.FORENSIC_BATCH_API_LOOPBACK_ONLY = false

    const denied = denyForensicBatchMutate(mockReq(), mockRes(), {}, sendJson, {
      getResolvePassword: () => () => {},
    } as never)
    expect(denied).toBe(true)
    expect(sendJson).toHaveBeenCalledWith(
      expect.anything(),
      403,
      expect.objectContaining({ ok: false }),
      expect.anything()
    )
  })

  it('requires token when env token is set', async () => {
    const { CFG } = await import('../../config.js')
    CFG.FORENSIC_BATCH_API_TOKEN = 'test-token-123'
    CFG.FORENSIC_BATCH_API_LOOPBACK_ONLY = false

    expect(isForensicApiTokenValid(mockReq())).toBe(false)
    expect(
      isForensicApiTokenValid(
        mockReq({ headers: { 'x-morgendrot-forensic-token': 'test-token-123' } })
      )
    ).toBe(true)

    const denied = denyForensicBatchMutate(
      mockReq({ headers: { 'x-morgendrot-forensic-token': 'wrong' } }),
      mockRes(),
      {},
      sendJson,
      { getResolvePassword: () => null } as never
    )
    expect(denied).toBe(true)
  })
})
