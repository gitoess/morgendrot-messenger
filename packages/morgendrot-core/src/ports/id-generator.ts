/** Eindeutige IDs für Outbox-Einträge — injizierbar (Crypto vs. Test). */
export type IdGeneratorPort = {
  randomId(): string
}

export function createCryptoUuidIdGenerator(): IdGeneratorPort {
  return {
    randomId() {
      const c = globalThis.crypto
      if (c && 'randomUUID' in c && typeof c.randomUUID === 'function') {
        return c.randomUUID()
      }
      return `ob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    },
  }
}

/** Deterministische IDs für Vitest. */
export function createSequencedIdGenerator(prefix = 'id'): IdGeneratorPort {
  let n = 0
  return {
    randomId() {
      n += 1
      return `${prefix}-${n}`
    },
  }
}
