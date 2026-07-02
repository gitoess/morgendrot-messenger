'use client'

import type { TelegramIntegrationPublic } from '@/frontend/lib/api/telegram-integrations'

export type BossTelegramWizardStatus = {
  botConfigured: boolean
  adminChatConfigured: boolean
  groupConfigured: boolean
  /** Bot + persönliche Chat-ID — Minimum für Test/Alarm an dich. */
  readyMinimal: boolean
}

export function deriveBossTelegramWizardStatus(
  pub: TelegramIntegrationPublic | null,
  opts?: {
    botTokenDraft?: string
    adminChatId?: string
    inviteLink?: string
  }
): BossTelegramWizardStatus {
  const tokenOk = Boolean(
    pub?.botTokenConfigured || opts?.botTokenDraft?.trim() || pub?.botToken?.trim()
  )
  const adminOk = Boolean((opts?.adminChatId ?? pub?.adminChatId ?? '').trim())
  const groupOk = Boolean((opts?.inviteLink ?? pub?.einsatzGroupInviteLink ?? '').trim())
  return {
    botConfigured: tokenOk,
    adminChatConfigured: adminOk,
    groupConfigured: groupOk,
    readyMinimal: tokenOk && adminOk,
  }
}
