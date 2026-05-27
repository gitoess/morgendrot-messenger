/**
 * Handoff-ZIP in Mailbox-Nachricht (E2EE wie andere MORG-Wires).
 */
import { MESSAGING_WIRE_UTF8_MAX, wireUtf8ByteLength } from '@/frontend/lib/compact-image-wire'

export const MORG_HANDOFF_ZIP_PREFIX = '[[MORG_HANDOFF_ZIP_V1:'
export const MORG_HANDOFF_ZIP_SUFFIX = ']]'
export const HANDOFF_ZIP_META_LINE = 'morgendrot.handoff.zip.meta.v1'

export type HandoffZipWireMeta = {
  label?: string
  protected: boolean
  exportedAt: string
  zipByteLength: number
}

function bytesToB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, '')
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function buildHandoffZipWire(zipBytes: Uint8Array, meta: Omit<HandoffZipWireMeta, 'zipByteLength'>): string {
  const fullMeta: HandoffZipWireMeta = { ...meta, zipByteLength: zipBytes.length }
  const core = `${MORG_HANDOFF_ZIP_PREFIX}${bytesToB64(zipBytes)}${MORG_HANDOFF_ZIP_SUFFIX}`
  return `${core}\n\n${HANDOFF_ZIP_META_LINE} ${JSON.stringify(fullMeta)}`
}

export function parseHandoffZipWire(text: string): { zipBytes: Uint8Array; meta: HandoffZipWireMeta } | null {
  const raw = (text || '').trim()
  if (!raw.includes(MORG_HANDOFF_ZIP_PREFIX)) return null
  const start = raw.indexOf(MORG_HANDOFF_ZIP_PREFIX)
  const afterPrefix = start + MORG_HANDOFF_ZIP_PREFIX.length
  const end = raw.indexOf(MORG_HANDOFF_ZIP_SUFFIX, afterPrefix)
  if (end < 0) return null
  const b64 = raw.slice(afterPrefix, end)
  if (!b64.trim()) return null
  let zipBytes: Uint8Array
  try {
    zipBytes = b64ToBytes(b64)
  } catch {
    return null
  }
  let meta: HandoffZipWireMeta = {
    protected: false,
    exportedAt: new Date().toISOString(),
    zipByteLength: zipBytes.length,
  }
  const metaIdx = raw.indexOf(HANDOFF_ZIP_META_LINE)
  if (metaIdx >= 0) {
    const jsonPart = raw.slice(metaIdx + HANDOFF_ZIP_META_LINE.length).trim()
    try {
      const j = JSON.parse(jsonPart.split('\n')[0] || '{}') as HandoffZipWireMeta
      if (j && typeof j === 'object') meta = { ...meta, ...j, zipByteLength: zipBytes.length }
    } catch {
      /* optional meta */
    }
  }
  return { zipBytes, meta }
}

export function handoffZipWireFitsMailbox(wire: string): { ok: true } | { ok: false; error: string } {
  const n = wireUtf8ByteLength(wire)
  if (n > MESSAGING_WIRE_UTF8_MAX) {
    return {
      ok: false,
      error: `Handoff-Wire zu lang (${n} B UTF-8, max. ${MESSAGING_WIRE_UTF8_MAX}). ZIP verkleinern oder USB nutzen.`,
    }
  }
  return { ok: true }
}
