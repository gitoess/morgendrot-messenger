import type { ApiResponse, KeyData } from '../types'
import { executeCommand } from '@/frontend/lib/api/execute-command'

export const createKey = (lockAddress: string, recipient: string, ttl?: number) =>
  executeCommand('/create-key', ttl ? [lockAddress, recipient, ttl] : [lockAddress, recipient])

export const createKeys = (lockAddress: string, recipient: string, count: number, ttl?: number) =>
  executeCommand('/create-keys', ttl ? [lockAddress, recipient, count, ttl] : [lockAddress, recipient, count])

export const transferKey = (keyId: string, newOwner: string) =>
  executeCommand('/transfer-key', [keyId, newOwner])

export const purgeKey = (keyId: string) => executeCommand('/purge-key', [keyId])

export async function listKeys(): Promise<ApiResponse<KeyData[]>> {
  const res = await executeCommand<KeyData[]>('/list-keys', [])
  const raw = (res as { keys?: Array<{ objectId?: string; lockId?: string; expiresAtMs?: number }> }).keys
    ?? (res as { data?: Array<{ objectId?: string; id?: string; lockId?: string; lockAddress?: string; expiresAtMs?: number; validUntil?: number }> }).data
  if (res.ok && Array.isArray(raw)) {
    return {
      ...res,
      data: raw.map((k) => ({
        id: (k as { objectId?: string; id?: string }).objectId ?? (k as { id?: string }).id ?? (k as { lockId?: string }).lockId ?? '',
        lockAddress: (k as { lockId?: string }).lockId ?? (k as { lockAddress?: string }).lockAddress,
        validUntil: (k as { expiresAtMs?: number }).expiresAtMs ?? (k as { validUntil?: number }).validUntil,
      })),
    }
  }
  return res
}
