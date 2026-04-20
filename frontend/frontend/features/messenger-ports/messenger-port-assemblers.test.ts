import { describe, it, expect, vi } from 'vitest'
import type { Message } from '@/frontend/lib/types'
import { asComposerDraft } from './composer-draft-port'
import { asInboxFeedRead } from './inbox-feed-read-port'
import {
  asSendMeshMirrorDelay,
  asSendTransportChoice,
  asSendTransportRead,
} from './send-transport-ports'
import type { MessagingPersistenceMode } from '@/frontend/lib/messaging-persistence-mode'
import { asVoiceRecordSendPanel } from './voice-record-send-panel-port'

describe('asInboxFeedRead', () => {
  it('behält Referenzen für messages und myAddress', () => {
    const messages: Message[] = [{ id: '1', from: '0xa', content: '', timestamp: 1 }]
    const port = asInboxFeedRead(messages, ' 0xB ')
    expect(port.messages).toBe(messages)
    expect(port.myAddress).toBe(' 0xB ')
  })
})

describe('asComposerDraft', () => {
  it('leitet Callbacks durch', () => {
    const onMsg = vi.fn()
    const onRec = vi.fn()
    const p = asComposerDraft('hi', '0xr', onMsg, onRec)
    expect(p.message).toBe('hi')
    expect(p.recipient).toBe('0xr')
    p.onMessageChange('x')
    p.onRecipientChange('y')
    expect(onMsg).toHaveBeenCalledWith('x')
    expect(onRec).toHaveBeenCalledWith('y')
  })
})

describe('asSendTransportRead', () => {
  it('mappt encrypted und forcedTransport', () => {
    const p = asSendTransportRead(true, 'mesh')
    expect(p).toEqual({ encrypted: true, forcedTransport: 'mesh' })
  })
})

describe('asSendMeshMirrorDelay', () => {
  it('mappt Pfad-4-Callbacks', () => {
    const fn4 = vi.fn()
    const p = asSendMeshMirrorDelay(false, fn4)
    p.onMeshSelfArchiveAfterLoRaChange(true)
    expect(p.meshSelfArchiveAfterLoRa).toBe(false)
    expect(fn4).toHaveBeenCalledWith(true)
  })
})

describe('asVoiceRecordSendPanel', () => {
  it('merged Hook-Slice und sosVoiceAwaitingSend', () => {
    const fromHook = {
      voicePhase: 'idle' as const,
      voiceActiveKind: null,
      voiceProgress01: 0,
      voiceMaxSeconds: 10,
      voiceEmergencyMaxSeconds: 10,
      sosVoiceFollowsOnline: true,
      onVoiceToggle: vi.fn(),
      onVoiceEmergencyToggle: vi.fn(),
      voiceNormalBlockedStart: false,
      voiceEmergencyBlockedStart: false,
      voiceBusy: false,
      voiceRecording: false,
    }
    const p = asVoiceRecordSendPanel(fromHook, true)
    expect(p.sosVoiceAwaitingSend).toBe(true)
    expect(p.voicePhase).toBe('idle')
    expect(p.onVoiceToggle).toBe(fromHook.onVoiceToggle)
  })
})

describe('asSendTransportChoice', () => {
  it('mappt Transport- und Persistenz-Felder', () => {
    const onEnc = vi.fn()
    const onTr = vi.fn()
    const onPersist = vi.fn()
    const p = asSendTransportChoice(false, onEnc, 'internet', onTr, 'event' as MessagingPersistenceMode, onPersist)
    p.onEncryptedChange(true)
    p.onForcedTransportChange('mesh')
    p.onMessagingPersistenceModeChange('mailbox')
    expect(onEnc).toHaveBeenCalledWith(true)
    expect(onTr).toHaveBeenCalledWith('mesh')
    expect(onPersist).toHaveBeenCalledWith('mailbox')
    expect(p.encrypted).toBe(false)
    expect(p.forcedTransport).toBe('internet')
    expect(p.messagingPersistenceMode).toBe('event')
  })
})
