import type { VoiceRecordKind, VoiceRecordPhase } from '@/frontend/features/voice/messenger-voice-record'

/**
 * Phase-2: Sprachmemo-UI im Send-Panel (Phase, Slots, Limits, SOS-Hinweis).
 * `sosVoiceAwaitingSend` kommt aus Core-State; der Rest typisch aus `useChatViewVoiceRecord`.
 */
export type VoiceRecordSendPanelPort = {
  readonly voicePhase: VoiceRecordPhase
  readonly voiceActiveKind: VoiceRecordKind | null
  readonly voiceProgress01: number
  readonly voiceMaxSeconds: number
  readonly voiceEmergencyMaxSeconds: number
  readonly sosVoiceFollowsOnline: boolean
  readonly onVoiceToggle: () => void
  readonly onVoiceEmergencyToggle: () => void
  readonly voiceNormalBlockedStart: boolean
  readonly voiceEmergencyBlockedStart: boolean
  readonly voiceBusy: boolean
  readonly voiceRecording: boolean
  readonly sosVoiceAwaitingSend: boolean
}

export type VoiceRecordFromHook = Omit<VoiceRecordSendPanelPort, 'sosVoiceAwaitingSend'>

export function asVoiceRecordSendPanel(
  fromHook: VoiceRecordFromHook,
  sosVoiceAwaitingSend: boolean
): VoiceRecordSendPanelPort {
  return { ...fromHook, sosVoiceAwaitingSend }
}
