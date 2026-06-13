/** Einfacher IP-Rate-Limiter (Anfragen pro Minute). limit <= 0 = aus. */
export type IpRateLimiter = {
  check(ip: string): boolean
  record(ip: string): void
}

export function normalizeApiClientIp(req: { socket?: { remoteAddress?: string | null } }): string {
  return (req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '')
}

export function createIpRateLimiter(limitPerMinute: number): IpRateLimiter {
  const map = new Map<string, { count: number; resetAt: number }>()
  return {
    check(ip: string): boolean {
      if (limitPerMinute <= 0) return true
      const now = Date.now()
      const entry = map.get(ip)
      if (!entry || now >= entry.resetAt) return true
      return entry.count < limitPerMinute
    },
    record(ip: string): void {
      if (limitPerMinute <= 0) return
      const now = Date.now()
      const windowMs = 60_000
      let entry = map.get(ip)
      if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs }
        map.set(ip, entry)
      }
      entry.count++
    },
  }
}
