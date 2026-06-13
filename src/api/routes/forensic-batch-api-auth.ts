/**
 * Forensic-Batch-API: optional Token, Loopback-Beschränkung, Tresor-Entsperrung für Mutationen.
 */
import type http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { CFG } from '../../config.js'
import type { ApiRouteContext } from './api-route-types.js'
import type { SendJsonFn } from './api-route-types.js'

export function forensicApiClientIp(req: http.IncomingMessage): string {
  return (req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '')
}

export function isLoopbackApiClient(req: http.IncomingMessage): boolean {
  const ip = forensicApiClientIp(req)
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost'
}

export function forensicApiTokenFromRequest(req: http.IncomingMessage): string {
  const header = req.headers['x-morgendrot-forensic-token']
  if (typeof header === 'string' && header.trim()) return header.trim()
  const auth = req.headers.authorization
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }
  return ''
}

export function isForensicApiTokenValid(req: http.IncomingMessage): boolean {
  const expected = CFG.FORENSIC_BATCH_API_TOKEN
  if (!expected) return true
  const got = forensicApiTokenFromRequest(req)
  if (!got || got.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected))
  } catch {
    return false
  }
}

export function isVaultUnlockedForForensicApi(ctx: ApiRouteContext): boolean {
  return ctx.getResolvePassword() == null
}

/** Mutationen (Run, Auto-Config, Registry-Replace, Scheduler): Tresor offen + optional Token/Loopback. */
export function denyForensicBatchMutate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  cors: Record<string, string>,
  sendJson: SendJsonFn,
  ctx: ApiRouteContext
): boolean {
  if (!isVaultUnlockedForForensicApi(ctx)) {
    sendJson(
      res,
      403,
      { ok: false, error: 'Tresor gesperrt — zuerst im UI entsperren, dann Batch ausführen.' },
      cors
    )
    return true
  }
  if (CFG.FORENSIC_BATCH_API_LOOPBACK_ONLY && !isLoopbackApiClient(req)) {
    sendJson(
      res,
      403,
      { ok: false, error: 'Forensic-Batch-Mutationen nur von localhost (FORENSIC_BATCH_API_LOOPBACK_ONLY).' },
      cors
    )
    return true
  }
  if (!isForensicApiTokenValid(req)) {
    sendJson(
      res,
      403,
      { ok: false, error: 'Forensic-API nicht autorisiert.' },
      cors
    )
    return true
  }
  return false
}
