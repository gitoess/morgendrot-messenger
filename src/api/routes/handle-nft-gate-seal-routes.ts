/**
 * B2-P4b — /api/nft-gate-seal/* Key-Broker.
 */
import type http from 'node:http'
import type { SendJsonFn } from './api-route-types.js'
import { createIpRateLimiter, normalizeApiClientIp } from './api-ip-rate-limit.js'
import { CFG } from '../../config.js'
import {
  isNftGateSealBrokerReady,
  issueNftSealUnwrapKey,
  issueNftSealWrapKey,
} from '../../nft-gate-seal-broker.js'
import { MESSAGING_MODULES_PACKAGE_HINT } from '../../nft-gate-seal-package-hint.js'

const rate = createIpRateLimiter(60)

async function readJsonBody(req: http.IncomingMessage, maxBytes = 16_384): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) throw new Error('Body zu groß.')
    chunks.push(buf)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw) as unknown
}

function denyRate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  cors: Record<string, string>,
  sendJson: SendJsonFn
): boolean {
  const ip = normalizeApiClientIp(req)
  if (!rate.check(ip)) {
    sendJson(res, 429, { ok: false, error: 'Rate-Limit nft-gate-seal.' }, cors)
    return true
  }
  rate.record(ip)
  return false
}

export async function handleNftGateSealRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: string,
  cors: Record<string, string>,
  sendJson: SendJsonFn
): Promise<boolean> {
  if (!url.startsWith('/api/nft-gate-seal')) return false

  if (url === '/api/nft-gate-seal/status' && req.method === 'GET') {
    sendJson(
      res,
      200,
      {
        ok: true,
        ready: isNftGateSealBrokerReady(),
        policyModule: 'nft_gate_seal',
        messagingModulesPackageHint: MESSAGING_MODULES_PACKAGE_HINT,
        note: 'P4b PoC: einzelner Broker, nicht dezentrales Mysten-Seal.',
      },
      cors
    )
    return true
  }

  if (url === '/api/nft-gate-seal/wrap-key' && req.method === 'POST') {
    if (denyRate(req, res, cors, sendJson)) return true
    try {
      const body = (await readJsonBody(req)) as {
        nftObjectId?: string
        requiredWallet?: string
      }
      const nftObjectId = String(body.nftObjectId || '').trim()
      if (!nftObjectId) {
        sendJson(res, 400, { ok: false, error: 'nftObjectId fehlt.' }, cors)
        return true
      }
      const out = await issueNftSealWrapKey({
        nftObjectId,
        requiredWallet: body.requiredWallet || null,
      })
      if (!out.ok) {
        sendJson(res, 400, out, cors)
        return true
      }
      sendJson(res, 200, { ok: true, wrapKeyB64: out.wrapKeyB64 }, cors)
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }, cors)
    }
    return true
  }

  if (url === '/api/nft-gate-seal/unwrap-key' && req.method === 'POST') {
    if (denyRate(req, res, cors, sendJson)) return true
    try {
      const body = (await readJsonBody(req)) as {
        nftObjectId?: string
        requesterAddress?: string
        requiredWallet?: string
      }
      const nftObjectId = String(body.nftObjectId || '').trim()
      const requesterAddress = String(body.requesterAddress || '').trim()
      if (!nftObjectId || !requesterAddress) {
        sendJson(res, 400, { ok: false, error: 'nftObjectId und requesterAddress nötig.' }, cors)
        return true
      }
      const out = await issueNftSealUnwrapKey({
        nftObjectId,
        requesterAddress,
        requiredWallet: body.requiredWallet || null,
      })
      if (!out.ok) {
        sendJson(res, 403, out, cors)
        return true
      }
      sendJson(res, 200, { ok: true, wrapKeyB64: out.wrapKeyB64 }, cors)
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }, cors)
    }
    return true
  }

  sendJson(res, 404, { ok: false, error: `Unbekannt: ${url}`, role: CFG.ROLE }, cors)
  return true
}
