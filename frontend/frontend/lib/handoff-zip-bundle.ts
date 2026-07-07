import type { HandoffExtras } from '@/frontend/lib/handoff-extras'

export const HANDOFF_ENCRYPTED_BUNDLE_SCHEMA = 'morgendrot.handoff.bundle.v1' as const

export function serializeHandoffEncryptedBundle(envContent: string, extras?: HandoffExtras): string {
  const payload: Record<string, unknown> = {
    schema: HANDOFF_ENCRYPTED_BUNDLE_SCHEMA,
    env: envContent,
  }
  if (extras && (extras.teamBroadcastKeys?.length || extras.telegramAlarmGroup)) {
    payload.extras = extras
  }
  return JSON.stringify(payload)
}

export function parseHandoffEncryptedBundle(text: string): {
  envText: string
  extras?: HandoffExtras
} {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return { envText: text }
  try {
    const j = JSON.parse(trimmed) as {
      schema?: string
      env?: string
      extras?: HandoffExtras
    }
    if (j?.schema === HANDOFF_ENCRYPTED_BUNDLE_SCHEMA && typeof j.env === 'string' && j.env.trim()) {
      return { envText: j.env, extras: j.extras }
    }
  } catch {
    /* legacy plain .env ciphertext */
  }
  return { envText: text }
}

export function handoffExtrasNeedsZipFile(extras: HandoffExtras | undefined): boolean {
  if (!extras) return false
  if (extras.teamBroadcastKeys?.length) return true
  return Boolean(extras.telegramAlarmGroup?.inviteLink?.trim())
}
