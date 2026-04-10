/**
 * Browser-Sprachmemo: MediaRecorder → Backend-Transcode (ffmpeg) → Ogg/Opus-Anhang.
 * Ziel: kurze Clips (LoRa-tauglich), Encoding nur auf CM4/Server — nicht auf Heltec.
 */

import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

/** Phase der UI-Aufnahme (Idle → Start → Recording → Encoding). */
export type VoiceRecordPhase = 'idle' | 'starting' | 'recording' | 'encoding'

/** Normal- vs. SOS-Slot. */
export type VoiceRecordKind = 'normal' | 'emergency'

/**
 * Kurze Clips für Funk (LoRa) und für SOS (Notfall: schnell raus, gleiche Opus-Pipeline).
 * Normale Sprachmemo bei Online (IOTA) darf länger sein (mehr Bandbreite).
 */
export const MESSENGER_VOICE_MESH_OR_SOS_MAX_MS = 10_000

/** Normale Sprachmemo bei Sendepfad „Online“ (IOTA/Mailbox). */
export const MESSENGER_VOICE_ONLINE_NORMAL_MAX_MS = 35_000

/** SOS bei Online (IOTA): länger als Funk-Limit, aber unter normaler Memo-Obergrenze. */
export const MESSENGER_VOICE_ONLINE_SOS_MAX_MS = 30_000

/** Normale Sprachmemo: länger bei Online, kurz bei Funk/Bluetooth. */
export function getMessengerVoiceNormalMaxMs(forcedTransport: ForcedTransport): number {
  return forcedTransport === 'internet' ? MESSENGER_VOICE_ONLINE_NORMAL_MAX_MS : MESSENGER_VOICE_MESH_OR_SOS_MAX_MS
}

/** SOS: wie normale Memo an den Sendepfad gekoppelt – Online länger, Funk/Ad-hoc kurz. */
export function getMessengerVoiceEmergencyMaxMs(forcedTransport: ForcedTransport): number {
  return forcedTransport === 'internet' ? MESSENGER_VOICE_ONLINE_SOS_MAX_MS : MESSENGER_VOICE_MESH_OR_SOS_MAX_MS
}

export function pickVoiceRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const t of types) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t
    } catch {
      /* ignore */
    }
  }
  return ''
}
