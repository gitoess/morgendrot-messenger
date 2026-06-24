'use client'

/** Boss-LAN: Basis-URL zeigt auf RFC1918 oder localhost (§ TEAM-MEMBER-UPDATE-WIZARD-SPEC §8.5). */
export function isBossLanApiBase(base?: string): boolean {
  const b = (base ?? '').trim().toLowerCase()
  if (!b) return false
  try {
    const u = new URL(b.includes('://') ? b : `http://${b}`)
    const host = u.hostname
    if (host === 'localhost' || host === '127.0.0.1') return true
    const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    if (!m) return false
    const a = Number(m[1])
    const b2 = Number(m[2])
    return a === 10 || (a === 172 && b2 >= 16 && b2 <= 31) || (a === 192 && b2 === 168)
  } catch {
    return false
  }
}
