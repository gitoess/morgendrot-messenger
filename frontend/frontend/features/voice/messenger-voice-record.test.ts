import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getMessengerVoiceEmergencyMaxMs,
  getMessengerVoiceNormalMaxMs,
  pickVoiceRecorderMimeType,
  MESSENGER_VOICE_MESH_OR_SOS_MAX_MS,
  MESSENGER_VOICE_ONLINE_NORMAL_MAX_MS,
  MESSENGER_VOICE_ONLINE_SOS_MAX_MS,
} from './messenger-voice-record'

describe('getMessengerVoiceNormalMaxMs', () => {
  it('internet nutzt Online-Normal-Limit', () => {
    expect(getMessengerVoiceNormalMaxMs('internet')).toBe(MESSENGER_VOICE_ONLINE_NORMAL_MAX_MS)
  })

  it('mesh und adhoc nutzen Funk/SOS-Kurzlimit', () => {
    expect(getMessengerVoiceNormalMaxMs('mesh')).toBe(MESSENGER_VOICE_MESH_OR_SOS_MAX_MS)
    expect(getMessengerVoiceNormalMaxMs('adhoc')).toBe(MESSENGER_VOICE_MESH_OR_SOS_MAX_MS)
  })
})

describe('getMessengerVoiceEmergencyMaxMs', () => {
  it('internet nutzt Online-SOS-Limit', () => {
    expect(getMessengerVoiceEmergencyMaxMs('internet')).toBe(MESSENGER_VOICE_ONLINE_SOS_MAX_MS)
  })

  it('mesh und adhoc nutzen dasselbe Kurzlimit wie Funk-SOS', () => {
    expect(getMessengerVoiceEmergencyMaxMs('mesh')).toBe(MESSENGER_VOICE_MESH_OR_SOS_MAX_MS)
    expect(getMessengerVoiceEmergencyMaxMs('adhoc')).toBe(MESSENGER_VOICE_MESH_OR_SOS_MAX_MS)
  })
})

describe('pickVoiceRecorderMimeType', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ohne MediaRecorder → leerer String', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(pickVoiceRecorderMimeType()).toBe('')
  })

  it('wählt ersten von isTypeSupported bestätigten Typ', () => {
    vi.stubGlobal(
      'MediaRecorder',
      class {
        static isTypeSupported(mime: string) {
          return mime === 'audio/webm'
        }
      } as unknown as typeof MediaRecorder
    )
    expect(pickVoiceRecorderMimeType()).toBe('audio/webm')
  })

  it('überspringt Typen bei Exception in isTypeSupported', () => {
    vi.stubGlobal(
      'MediaRecorder',
      class {
        static isTypeSupported(mime: string) {
          if (mime === 'audio/webm;codecs=opus') throw new Error('unsupported probe')
          return mime === 'audio/mp4'
        }
      } as unknown as typeof MediaRecorder
    )
    expect(pickVoiceRecorderMimeType()).toBe('audio/mp4')
  })

  it('leer wenn kein Typ unterstützt', () => {
    vi.stubGlobal(
      'MediaRecorder',
      class {
        static isTypeSupported() {
          return false
        }
      } as unknown as typeof MediaRecorder
    )
    expect(pickVoiceRecorderMimeType()).toBe('')
  })
})
