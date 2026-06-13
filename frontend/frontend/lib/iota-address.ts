'use client'

import { isLikelyIotaHexId } from '@morgendrot/core/iota'

/** IOTA-Adresse oder Object-ID: `0x` + 64 Hex. */
export function isValidIotaAddress(value: string): boolean {
  return isLikelyIotaHexId(value)
}

export function trimValidIotaAddress(value: string): string | null {
  const t = value.trim()
  return isValidIotaAddress(t) ? t : null
}
