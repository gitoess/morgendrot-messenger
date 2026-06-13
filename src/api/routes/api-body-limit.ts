import type http from 'node:http'

export async function readHttpBodyWithLimit(
  req: http.IncomingMessage,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) {
      return { ok: false, error: `Body zu groß (max. ${maxBytes} Byte).` }
    }
    chunks.push(buf)
  }
  return { ok: true, text: Buffer.concat(chunks).toString('utf8') }
}
